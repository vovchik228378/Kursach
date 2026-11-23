/**
 * Локальный прогон миграций и проверка RLS.
 *
 * Запуск: npm run test:db (из корня проекта).
 *
 * Postgres поднимается в PGlite (WASM), поэтому Docker и установленный сервер
 * не нужны. Окружение Supabase эмулируется файлом bootstrap.sql: создаются
 * роли, схемы auth/storage, auth.uid() и storage.foldername().
 */

import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, '..', 'migrations');

const OWNER = '11111111-1111-1111-1111-111111111111';
const FRIEND = '22222222-2222-2222-2222-222222222222';
const STRANGER = '33333333-3333-3333-3333-333333333333';

let failures = 0;

function check(ok, label, details = '') {
  if (ok) {
    console.log(`ok   — ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL — ${label}${details ? ` (${details})` : ''}`);
  }
}

const db = await PGlite.create({ extensions: { pg_trgm } });

try {
  await db.exec(fs.readFileSync(path.join(here, 'bootstrap.sql'), 'utf8'));

  const migrations = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  let applied = 0;
  for (const file of migrations) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    try {
      await db.exec(sql);
      applied += 1;
    } catch (error) {
      check(false, `миграция ${file}`, error.message);
      break;
    }
  }
  check(applied === migrations.length, `применены все миграции (${applied}/${migrations.length})`);

  const categories = await db.query('select count(*)::int as total from public.categories');
  check(categories.rows[0].total === 8, 'сид содержит 8 категорий', String(categories.rows[0].total));

  const bucket = await db.query("select public from storage.buckets where id = 'marker-photos'");
  check(bucket.rows[0]?.public === false, 'bucket marker-photos приватный');

  const avatars = await db.query("select public from storage.buckets where id = 'avatars'");
  check(avatars.rows[0]?.public === true, 'bucket avatars публичный');

  // Регистрация пользователей: профили должен создать триггер.
  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${OWNER}',    'owner@test.dev',    '{"username":"owner_test"}'),
      ('${FRIEND}',   'friend@test.dev',   '{"username":"friend_test"}'),
      ('${STRANGER}', 'stranger@test.dev', '{"username":"stranger_test"}');
  `);

  const profiles = await db.query('select username from public.profiles order by username');
  check(
    profiles.rows.map((row) => row.username).join(',') === 'friend_test,owner_test,stranger_test',
    'триггер создал профили с никами из метаданных',
    profiles.rows.map((row) => row.username).join(',')
  );

  const asUser = async (userId) => {
    await db.exec(`select set_config('request.jwt.claim.sub', '${userId ?? ''}', false)`);
    await db.exec(`set role ${userId ? 'authenticated' : 'anon'}`);
  };

  const asSystem = async () => {
    await db.exec('reset role');
    await db.exec("select set_config('request.jwt.claim.sub', '', false)");
  };

  // Владелец создаёт три метки разной видимости и заявку в друзья.
  await asUser(OWNER);
  await db.exec(`
    insert into public.markers (owner_id, title, lat, lng, visibility) values
      ('${OWNER}', 'public marker',  55.75, 37.61, 'public'),
      ('${OWNER}', 'friends marker', 55.76, 37.62, 'friends'),
      ('${OWNER}', 'private marker', 55.77, 37.63, 'private');
    insert into public.friendships (requester_id, addressee_id)
      values ('${OWNER}', '${FRIEND}');
  `);
  await asSystem();

  // Друг принимает заявку — политика разрешает это только адресату.
  await asUser(FRIEND);
  await db.exec(
    `update public.friendships set status = 'accepted'
     where requester_id = '${OWNER}' and addressee_id = '${FRIEND}'`
  );
  await asSystem();

  const visibleTitles = async (userId) => {
    await asUser(userId);
    const result = await db.query('select title from public.markers order by title');
    await asSystem();
    return result.rows.map((row) => row.title);
  };

  const guestView = await visibleTitles(null);
  const strangerView = await visibleTitles(STRANGER);
  const friendView = await visibleTitles(FRIEND);
  const ownerView = await visibleTitles(OWNER);

  check(JSON.stringify(guestView) === '["public marker"]', 'гость видит только публичную метку', guestView.join(', '));
  check(JSON.stringify(strangerView) === '["public marker"]', 'посторонний видит только публичную', strangerView.join(', '));
  check(
    JSON.stringify(friendView) === '["friends marker","public marker"]',
    'друг видит публичную и «для друзей»',
    friendView.join(', ')
  );
  check(ownerView.length === 3, 'владелец видит все свои метки', ownerView.join(', '));

  // Чужую метку нельзя изменить: RLS просто не отдаёт строки.
  await asUser(STRANGER);
  const update = await db.query(
    "update public.markers set title = 'hacked' where visibility = 'public' returning id"
  );
  await asSystem();
  check((update.affectedRows ?? update.rows.length) === 0, 'RLS не даёт изменить чужую метку');

  // Комментарии к friends-метке постороннему недоступны.
  const target = await db.query("select id from public.markers where title = 'friends marker'");
  const markerId = target.rows[0].id;

  await asUser(FRIEND);
  await db.query(
    `insert into public.comments (marker_id, author_id, body) values ('${markerId}', '${FRIEND}', 'ok')`
  );
  await asSystem();

  await asUser(STRANGER);
  let blocked = false;
  try {
    await db.query(
      `insert into public.comments (marker_id, author_id, body) values ('${markerId}', '${STRANGER}', 'nope')`
    );
  } catch {
    blocked = true;
  }
  await asSystem();
  check(blocked, 'посторонний не может комментировать friends-метку');

  // Закрытый профиль: публичная метка исчезает у гостя, но остаётся у друга.
  await db.exec(`update public.profiles set is_private = true where id = '${OWNER}'`);
  const guestAfterPrivate = await visibleTitles(null);
  const friendAfterPrivate = await visibleTitles(FRIEND);

  check(guestAfterPrivate.length === 0, 'закрытый профиль скрывает метки от гостя', guestAfterPrivate.join(', '));
  check(
    friendAfterPrivate.length === 2,
    'закрытый профиль оставляет метки другу',
    friendAfterPrivate.join(', ')
  );
} finally {
  await db.close();
}

console.log(failures === 0 ? '\nВсе проверки прошли.' : `\nПровалено проверок: ${failures}`);
process.exitCode = failures === 0 ? 0 : 1;
