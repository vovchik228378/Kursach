# Новая база Supabase для дипломной версии

Схема описана миграциями в `supabase/migrations/`. Применяются по порядку номеров, каждая идемпотентна — повторный запуск не ломает базу.

| Файл | Что делает |
| --- | --- |
| `0001_extensions.sql` | `pg_trgm` для поиска по подстроке |
| `0002_core_tables.sql` | профили, категории, метки, фото, комментарии, лайки, друзья |
| `0003_functions.sql` | `updated_at`, создание профиля при регистрации, `is_friend`, `can_view_marker` |
| `0004_rls.sql` | политики доступа для всех таблиц |
| `0005_storage.sql` | приватный bucket `marker-photos` и политики на файлы |
| `0006_grants_realtime_seed.sql` | гранты, Realtime, 8 категорий |
| `0007_privacy.sql` | приватность профиля: закрытый профиль скрывает метки от всех, кроме друзей |
| `0008_photo_owner_only.sql` | загружать фото может только владелец метки |
| `0009_avatars.sql` | публичный bucket `avatars` и политики на аватары |

## 1. Создать проект

1. <https://supabase.com/dashboard> → **New project**.
2. Имя: `mycard-diploma`. Регион — ближе к пользователям (для России обычно `eu-central-1`).
3. Сохранить пароль базы: он понадобится для `psql` и Supabase CLI.
4. Дождаться, пока проект поднимется (2–3 минуты).

## 2. Забрать ключи

**Settings → API Keys → Publishable and secret API keys** → создать `default` и скопировать:

- `Project URL` — вида `https://xxxxxxxx.supabase.co`;
- `Publishable key` — `sb_publishable_...`.

`secret`-ключ (`sb_secret_...`) в браузер не попадает никогда — он обходит RLS.

## 3. Применить миграции

### Вариант A — один файл (быстрее всего)

Dashboard → **SQL Editor** → **New query**, вставьте целиком [`setup_all.sql`](setup_all.sql) и нажмите **Run**. Это те же девять миграций в правильном порядке, обёрнутые в одну транзакцию: если что-то пойдёт не так, не применится ничего.

### Вариант B — по файлам

Dashboard → **SQL Editor** → **New query** → вставить содержимое файла → **Run**.
Повторить для всех девяти файлов **по порядку номеров**. В конце каждого файла ошибок быть не должно; сообщения `already exists` допустимы только при повторном прогоне.

### Вариант C — через Supabase CLI

```bash
npm i -g supabase
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push
```

CLI подхватит все файлы из `supabase/migrations/` и применит их по порядку.

## 4. Проверить, что всё встало

```sql
-- 8 категорий
select count(*) from public.categories;

-- таблицы и включённый RLS
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- политики
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- realtime
select tablename from pg_publication_tables where pubname = 'supabase_realtime';

-- bucket
select id, public from storage.buckets where id = 'marker-photos';
select id, public from storage.buckets where id = 'avatars';
```

Ожидаемо: 8 категорий, `rowsecurity = true` у всех таблиц, политики на чтение/запись, три таблицы в публикации, `marker-photos` с `public = false`, `avatars` с `public = true`.

## 5. Настройки Auth

Dashboard → **Authentication**:

- **URL Configuration → Site URL**: `https://mycard-ae62b.web.app`. Это адрес, на который Supabase отправляет после подтверждения почты и сброса пароля. Если оставить дефолтный `http://localhost:3000`, письма будут вести на несуществующий адрес — именно так выглядит ошибка `#error=access_denied&error_code=otp_expired`.
- **Redirect URLs**: добавить
  - `https://mycard-ae62b.web.app/**`
  - `https://mycard-ae62b.web.app/reset-password`
  - `http://localhost:5173/**` (для разработки)
  - `http://localhost:5173/reset-password`

  Если адреса нет в списке, Supabase молча подменяет его на Site URL.
- **Providers → Email**: для защиты удобнее оставить подтверждение письмом; для демонстрации можно выключить — тогда регистрация сразу даёт сессию, и письма не нужны.
- **Встроенная почта Supabase** имеет жёсткий лимит отправок (несколько писем в час на проект), после чего отвечает `429 over_email_send_rate_limit`. Для реальной эксплуатации подключается свой SMTP, для диплома достаточно выключить подтверждение.

После изменения настроек старые ссылки из писем остаются недействительными — нужно запросить новое письмо.

## 6. Что прислать разработчику

Только два значения — они публичные и всё равно попадают в бандл:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Хранить их нужно в `app/.env.local` (файл в `.gitignore`). Пароль базы и `secret`-ключ в переписку не отправляйте.

## Модель доступа

| Таблица | Чтение | Запись |
| --- | --- | --- |
| `profiles` | все | только свой профиль |
| `categories` | все | никто (справочник) |
| `markers` | по `visibility`: public — всем, friends — друзьям, private — владельцу | только владелец |
| `marker_photos` | если видна метка | автор фото; удалять может и владелец метки |
| `comments` | если видна метка | автор; удалять может и владелец метки |
| `likes` | если видна метка | только свой лайк |
| `friendships` | только участники пары | только участники пары |
| Storage `marker-photos` | если видна метка | только в свою папку |

Проверки видимости вынесены в `public.can_view_marker()` и `public.is_friend()` — это `security definer` функции, поэтому политики не зацикливаются друг на друге.

## Если категории выглядят кракозябрами

Признак: вместо «Дом», «Работа», «Еда» в фильтре видно `Р”РѕРј`, `Р Р°Р±РѕС‚Р°`. Причина — SQL-файл был прочитан в оболочке с кодировкой не UTF-8, и кириллица с эмодзи в сиде превратились в двойную перекодировку.

Лечение: выполнить [`fix_categories.sql`](fix_categories.sql) в SQL Editor и обновить страницу. Пересобирать фронтенд не нужно — имена берутся из базы.

Файл [`setup_all.sql`](setup_all.sql) уже пересобран в UTF-8, поэтому на чистом проекте этой проблемы не будет.

Если у профиля `is_private = true`, его метки видит только он сам и его принятые друзья — независимо от `visibility`. Приватные профили не показываются в поиске людей (это фильтр приложения, а не RLS: по прямой ссылке профиль открывается, но метки остаются скрыты).
