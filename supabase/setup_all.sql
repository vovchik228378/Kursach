-- ============================================================
-- MyCard 2.0 - full schema setup (generated from migrations)
-- Paste into Supabase Dashboard -> SQL Editor -> Run
-- ============================================================
begin;

-- ===== 20260101000001_extensions.sql =====
-- =============================================================================
-- 0001. Расширения
-- =============================================================================
-- pg_trgm нужен для быстрого поиска «по подстроке» (ILIKE '%...%') и
-- нечёткого поиска по названиям меток и именам пользователей.
-- Ставим в схему extensions — так принято в Supabase, чтобы не засорять public.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- Чтобы операторы поиска резолвились и из public, и из extensions.
set search_path = public, extensions;


-- ===== 20260101000002_core_tables.sql =====
-- =============================================================================
-- 0002. Базовая схема: профили, категории, метки, фото, комментарии, лайки, друзья
-- =============================================================================
-- Все таблицы создаются идемпотентно, чтобы миграцию можно было запускать
-- повторно без падений (удобно, если что-то пошло не так на середине).
-- =============================================================================

set search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- Профили. Отдельная таблица от auth.users: почту и пароль хранит GoTrue,
-- а публичные данные (ник, аватар, био) — здесь. Почты в этой таблице нет
-- специально: её не нужно отдавать другим пользователям.
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
    id           uuid primary key references auth.users (id) on delete cascade,
    username     text not null check (username ~ '^[A-Za-z0-9_]{3,30}$'),
    display_name text check (char_length(display_name) <= 60),
    bio          text check (char_length(bio) <= 300),
    avatar_url   text,
    is_private   boolean not null default false,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

-- Ник уникален без учёта регистра: «Vova» и «vova» — один и тот же ник.
create unique index if not exists profiles_username_lower_key
    on public.profiles (lower(username));

-- Триграммный индекс для поиска по части ника.
create index if not exists profiles_username_trgm_idx
    on public.profiles using gin (username gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- Категории меток. Справочник: одинаковые иконка и цвет на клиенте и в БД.
-- -----------------------------------------------------------------------------
create table if not exists public.categories (
    id         uuid primary key default gen_random_uuid(),
    slug       text not null unique,
    name       text not null,
    emoji      text not null,
    color      text not null,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Метки на карте.
-- visibility:
--   public  — видит любой, включая неавторизованных;
--   friends — только владелец и его принятые друзья;
--   private — только владелец.
-- -----------------------------------------------------------------------------
create table if not exists public.markers (
    id          uuid primary key default gen_random_uuid(),
    owner_id    uuid not null references public.profiles (id) on delete cascade,
    category_id uuid references public.categories (id) on delete set null,
    title       text not null check (char_length(title) between 1 and 120),
    description text check (char_length(description) <= 2000),
    lat         double precision not null check (lat between -90 and 90),
    lng         double precision not null check (lng between -180 and 180),
    place_name  text check (char_length(place_name) <= 300),
    visibility  text not null default 'public'
                check (visibility in ('public', 'friends', 'private')),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index if not exists markers_owner_idx on public.markers (owner_id);
create index if not exists markers_category_idx on public.markers (category_id);
create index if not exists markers_visibility_idx on public.markers (visibility);
create index if not exists markers_created_at_idx on public.markers (created_at desc);

-- Полнотекстовый «умный» поиск по названию и описанию.
create index if not exists markers_title_trgm_idx
    on public.markers using gin (title gin_trgm_ops);
create index if not exists markers_description_trgm_idx
    on public.markers using gin (description gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- Фото меток. Сам файл лежит в Supabase Storage (bucket marker-photos),
-- здесь — только путь и владелец. Формат пути: {owner_id}/{marker_id}/{uuid}.jpg
-- -----------------------------------------------------------------------------
create table if not exists public.marker_photos (
    id           uuid primary key default gen_random_uuid(),
    marker_id    uuid not null references public.markers (id) on delete cascade,
    owner_id     uuid not null references public.profiles (id) on delete cascade,
    storage_path text not null unique,
    created_at   timestamptz not null default now()
);

create index if not exists marker_photos_marker_idx on public.marker_photos (marker_id);

-- -----------------------------------------------------------------------------
-- Комментарии к меткам.
-- -----------------------------------------------------------------------------
create table if not exists public.comments (
    id         uuid primary key default gen_random_uuid(),
    marker_id  uuid not null references public.markers (id) on delete cascade,
    author_id  uuid not null references public.profiles (id) on delete cascade,
    body       text not null check (char_length(body) between 1 and 1000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists comments_marker_idx on public.comments (marker_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Лайки. Первичный ключ (marker_id, user_id) не даёт лайкнуть дважды.
-- -----------------------------------------------------------------------------
create table if not exists public.likes (
    marker_id  uuid not null references public.markers (id) on delete cascade,
    user_id    uuid not null references public.profiles (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (marker_id, user_id)
);

create index if not exists likes_user_idx on public.likes (user_id);

-- -----------------------------------------------------------------------------
-- Друзья. Одна строка на пару пользователей, направление хранится в
-- requester_id → addressee_id, состояние — в status.
-- -----------------------------------------------------------------------------
create table if not exists public.friendships (
    id           uuid primary key default gen_random_uuid(),
    requester_id uuid not null references public.profiles (id) on delete cascade,
    addressee_id uuid not null references public.profiles (id) on delete cascade,
    status       text not null default 'pending'
                 check (status in ('pending', 'accepted', 'declined')),
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    check (requester_id <> addressee_id)
);

-- Пара уникальна в обе стороны: заявка A→B и B→A — это одна и та же пара.
create unique index if not exists friendships_pair_key
    on public.friendships (least(requester_id, addressee_id),
                           greatest(requester_id, addressee_id));
create index if not exists friendships_requester_idx on public.friendships (requester_id);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);


-- ===== 20260101000003_functions.sql =====
-- =============================================================================
-- 0003. Функции и триггеры
-- =============================================================================
-- Здесь всё, что должно выполняться на стороне БД: автообновление updated_at,
-- создание профиля при регистрации, проверки видимости для RLS.
-- Функции-проверки объявлены SECURITY DEFINER, чтобы политики RLS не уходили
-- в рекурсию (политика на friendships не должна сама себя перечитывать).
-- =============================================================================

set search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- Автообновление updated_at.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Создание профиля при регистрации.
-- Ник берётся из raw_user_meta_data.username (его передаёт форма регистрации),
-- приводится к допустимому виду; при занятости добавляется суффикс _1, _2, ...
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    base_username  text;
    final_username text;
    suffix         integer := 0;
begin
    base_username := regexp_replace(
        coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), ''),
        '[^A-Za-z0-9_]', '', 'g'
    );

    if base_username is null or char_length(base_username) < 3 then
        base_username := 'user_' || left(new.id::text, 8);
    end if;

    base_username := left(base_username, 30);
    final_username := base_username;

    while exists (select 1 from public.profiles p where lower(p.username) = lower(final_username)) loop
        suffix := suffix + 1;
        final_username := left(base_username, 30 - char_length(suffix::text) - 1) || '_' || suffix::text;
    end loop;

    insert into public.profiles (id, username)
    values (new.id, final_username)
    on conflict (id) do nothing;

    return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Принятая дружба между двумя пользователями (в любую сторону).
-- -----------------------------------------------------------------------------
create or replace function public.is_friend(p_user_id uuid, p_other_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.friendships f
        where f.status = 'accepted'
          and p_user_id is not null
          and p_other_id is not null
          and (
              (f.requester_id = p_user_id and f.addressee_id = p_other_id)
              or (f.requester_id = p_other_id and f.addressee_id = p_user_id)
          )
    );
$$;

-- -----------------------------------------------------------------------------
-- Может ли пользователь видеть метку. Используется в политиках меток,
-- комментариев, лайков и фото — правило видимости описано в одном месте.
-- -----------------------------------------------------------------------------
create or replace function public.can_view_marker(p_marker_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.markers m
        where m.id = p_marker_id
          and (
              m.visibility = 'public'
              or m.owner_id = p_user_id
              or (
                  m.visibility = 'friends'
                  and p_user_id is not null
                  and public.is_friend(m.owner_id, p_user_id)
              )
          )
    );
$$;

-- -----------------------------------------------------------------------------
-- Является ли пользователь владельцем метки (нужно для прав на фото).
-- -----------------------------------------------------------------------------
create or replace function public.is_marker_owner(p_marker_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.markers m
        where m.id = p_marker_id
          and m.owner_id = p_user_id
    );
$$;

-- -----------------------------------------------------------------------------
-- Триггеры updated_at.
-- -----------------------------------------------------------------------------
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
    before update on public.profiles
    for each row execute function public.set_updated_at();

drop trigger if exists markers_set_updated_at on public.markers;
create trigger markers_set_updated_at
    before update on public.markers
    for each row execute function public.set_updated_at();

drop trigger if exists comments_set_updated_at on public.comments;
create trigger comments_set_updated_at
    before update on public.comments
    for each row execute function public.set_updated_at();

drop trigger if exists friendships_set_updated_at on public.friendships;
create trigger friendships_set_updated_at
    before update on public.friendships
    for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Триггер на auth.users: создаёт профиль сразу после регистрации.
-- -----------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();


-- ===== 20260101000004_rls.sql =====
-- =============================================================================
-- 0004. Row Level Security
-- =============================================================================
-- Правило простое: читать может тот, кому разрешает видимость, писать —
-- только владелец. Проверки видимости вынесены в функции из 0003, поэтому
-- политика меток, комментариев, лайков и фото выглядит одинаково.
-- =============================================================================

alter table public.profiles     enable row level security;
alter table public.categories   enable row level security;
alter table public.markers      enable row level security;
alter table public.marker_photos enable row level security;
alter table public.comments     enable row level security;
alter table public.likes        enable row level security;
alter table public.friendships  enable row level security;

-- -----------------------------------------------------------------------------
-- profiles: профили публичны (нужны для поиска людей и подписей на карте).
-- Создание идёт только через триггер handle_new_user, удаление — через
-- удаление пользователя в auth.users (каскад). Поэтому insert/delete политик нет.
-- -----------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
    for select to anon, authenticated
    using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
    for update to authenticated
    using (id = auth.uid())
    with check (id = auth.uid());

-- -----------------------------------------------------------------------------
-- categories: справочник только для чтения.
-- -----------------------------------------------------------------------------
drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories
    for select to anon, authenticated
    using (true);

-- -----------------------------------------------------------------------------
-- markers
-- -----------------------------------------------------------------------------
drop policy if exists markers_select on public.markers;
create policy markers_select on public.markers
    for select to anon, authenticated
    using (
        visibility = 'public'
        or owner_id = auth.uid()
        or (
            visibility = 'friends'
            and auth.uid() is not null
            and public.is_friend(owner_id, auth.uid())
        )
    );

drop policy if exists markers_insert_own on public.markers;
create policy markers_insert_own on public.markers
    for insert to authenticated
    with check (owner_id = auth.uid());

drop policy if exists markers_update_own on public.markers;
create policy markers_update_own on public.markers
    for update to authenticated
    using (owner_id = auth.uid())
    with check (owner_id = auth.uid());

drop policy if exists markers_delete_own on public.markers;
create policy markers_delete_own on public.markers
    for delete to authenticated
    using (owner_id = auth.uid());

-- -----------------------------------------------------------------------------
-- marker_photos
-- -----------------------------------------------------------------------------
drop policy if exists marker_photos_select on public.marker_photos;
create policy marker_photos_select on public.marker_photos
    for select to authenticated
    using (public.can_view_marker(marker_id, auth.uid()));

drop policy if exists marker_photos_insert on public.marker_photos;
create policy marker_photos_insert on public.marker_photos
    for insert to authenticated
    with check (owner_id = auth.uid() and public.can_view_marker(marker_id, auth.uid()));

drop policy if exists marker_photos_delete on public.marker_photos;
create policy marker_photos_delete on public.marker_photos
    for delete to authenticated
    using (owner_id = auth.uid() or public.is_marker_owner(marker_id, auth.uid()));

-- -----------------------------------------------------------------------------
-- comments
-- -----------------------------------------------------------------------------
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
    for select to authenticated
    using (public.can_view_marker(marker_id, auth.uid()));

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
    for insert to authenticated
    with check (author_id = auth.uid() and public.can_view_marker(marker_id, auth.uid()));

drop policy if exists comments_update_own on public.comments;
create policy comments_update_own on public.comments
    for update to authenticated
    using (author_id = auth.uid())
    with check (author_id = auth.uid());

drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments
    for delete to authenticated
    using (author_id = auth.uid() or public.is_marker_owner(marker_id, auth.uid()));

-- -----------------------------------------------------------------------------
-- likes
-- -----------------------------------------------------------------------------
drop policy if exists likes_select on public.likes;
create policy likes_select on public.likes
    for select to authenticated
    using (public.can_view_marker(marker_id, auth.uid()));

drop policy if exists likes_insert on public.likes;
create policy likes_insert on public.likes
    for insert to authenticated
    with check (user_id = auth.uid() and public.can_view_marker(marker_id, auth.uid()));

drop policy if exists likes_delete_own on public.likes;
create policy likes_delete_own on public.likes
    for delete to authenticated
    using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- friendships: заявки видят только участники.
-- -----------------------------------------------------------------------------
drop policy if exists friendships_select on public.friendships;
create policy friendships_select on public.friendships
    for select to authenticated
    using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists friendships_insert on public.friendships;
create policy friendships_insert on public.friendships
    for insert to authenticated
    with check (requester_id = auth.uid() and status = 'pending');

drop policy if exists friendships_update on public.friendships;
create policy friendships_update on public.friendships
    for update to authenticated
    using (requester_id = auth.uid() or addressee_id = auth.uid())
    with check (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists friendships_delete on public.friendships;
create policy friendships_delete on public.friendships
    for delete to authenticated
    using (requester_id = auth.uid() or addressee_id = auth.uid());


-- ===== 20260101000005_storage.sql =====
-- =============================================================================
-- 0005. Supabase Storage для фото меток
-- =============================================================================
-- Bucket приватный: файл нельзя открыть по прямой ссылке. Клиент получает
-- подписанную ссылку (createSignedUrl), а Storage проверяет политику на
-- чтение — то есть фото приватной метки не увидит посторонний.
--
-- Формат пути: {owner_id}/{marker_id}/{uuid}.{ext}
--   [1] — владелец, [2] — метка (foldername возвращает папки без имени файла).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'marker-photos',
    'marker-photos',
    false,
    5242880, -- 5 МБ
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
    set public             = excluded.public,
        file_size_limit    = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- Чтение: только если метка видима этому пользователю.
-- -----------------------------------------------------------------------------
drop policy if exists "marker photos read" on storage.objects;
create policy "marker photos read" on storage.objects
    for select to authenticated
    using (
        bucket_id = 'marker-photos'
        and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
        and public.can_view_marker(((storage.foldername(name))[2])::uuid, auth.uid())
    );

-- -----------------------------------------------------------------------------
-- Загрузка: только в свою папку и только к видимой метке.
-- -----------------------------------------------------------------------------
drop policy if exists "marker photos insert" on storage.objects;
create policy "marker photos insert" on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'marker-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
        and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
        and public.can_view_marker(((storage.foldername(name))[2])::uuid, auth.uid())
    );

-- -----------------------------------------------------------------------------
-- Замена файла: только владелец папки.
-- -----------------------------------------------------------------------------
drop policy if exists "marker photos update" on storage.objects;
create policy "marker photos update" on storage.objects
    for update to authenticated
    using (
        bucket_id = 'marker-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

-- -----------------------------------------------------------------------------
-- Удаление: автор фото или владелец метки.
-- -----------------------------------------------------------------------------
drop policy if exists "marker photos delete" on storage.objects;
create policy "marker photos delete" on storage.objects
    for delete to authenticated
    using (
        bucket_id = 'marker-photos'
        and (
            (storage.foldername(name))[1] = auth.uid()::text
            or (
                (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
                and public.is_marker_owner(((storage.foldername(name))[2])::uuid, auth.uid())
            )
        )
    );


-- ===== 20260101000006_grants_realtime_seed.sql =====
-- =============================================================================
-- 0006. Права, Realtime и справочник категорий
-- =============================================================================

set search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- Гранты. RLS ограничивает строки, но таблицы ещё нужно открыть ролям
-- Supabase (anon — неавторизованный посетитель, authenticated — вошедший).
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select on public.profiles      to anon;
grant select on public.categories    to anon;
grant select on public.markers       to anon;

grant select, update on public.profiles to authenticated;

grant select on public.categories to authenticated;

grant select, insert, update, delete on public.markers       to authenticated;
grant select, insert, update, delete on public.marker_photos to authenticated;
grant select, insert, update, delete on public.comments      to authenticated;
grant select, insert, update, delete on public.likes         to authenticated;
grant select, insert, update, delete on public.friendships   to authenticated;

-- Новые таблицы в public по умолчанию получают те же права.
alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public
    grant select, insert, update, delete on tables to authenticated;

-- -----------------------------------------------------------------------------
-- Realtime: изменения меток, комментариев и лайков должны приходить в браузер.
-- Таблица попадает в публикацию один раз — повторный запуск миграции безопасен.
-- -----------------------------------------------------------------------------
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'markers'
    ) then
        execute 'alter publication supabase_realtime add table public.markers';
    end if;

    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'comments'
    ) then
        execute 'alter publication supabase_realtime add table public.comments';
    end if;

    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'likes'
    ) then
        execute 'alter publication supabase_realtime add table public.likes';
    end if;
end $$;

-- -----------------------------------------------------------------------------
-- Справочник категорий. slug — стабильный ключ, на него опирается клиент.
-- -----------------------------------------------------------------------------
insert into public.categories (slug, name, emoji, color, sort_order) values
    ('home',    'Дом',            '🏠', '#E4572E', 10),
    ('work',    'Работа',         '💼', '#2E86AB', 20),
    ('food',    'Еда',            '🍜', '#F4A259', 30),
    ('nature',  'Природа',        '🌳', '#4E9F3D', 40),
    ('culture', 'Культура',       '🎭', '#8E44AD', 50),
    ('sport',   'Спорт',          '🏋️', '#16A085', 60),
    ('travel',  'Путешествия',    '✈️', '#2D9CDB', 70),
    ('other',   'Другое',         '📍', '#6B7280', 80)
on conflict (slug) do update
    set name       = excluded.name,
        emoji      = excluded.emoji,
        color      = excluded.color,
        sort_order = excluded.sort_order;


-- ===== 20260101000007_privacy.sql =====
-- =============================================================================
-- 0007. Приватность профиля
-- =============================================================================
-- Флаг profiles.is_private усиливает правила:
--   * у приватного профиля даже «публичные» метки видят только друзья;
--   * метки «для друзей» у обычного профиля видят друзья;
--   * остальное — как раньше.
--
-- Функция одна на все политики (метки, комментарии, лайки, фото), поэтому
-- достаточно заменить её — и правило начнёт действовать везде.
-- =============================================================================

create or replace function public.can_view_marker(p_marker_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.markers m
        join public.profiles p on p.id = m.owner_id
        where m.id = p_marker_id
          and (
              -- владелец видит всё своё
              m.owner_id = p_user_id
              -- публичный профиль: публичные метки открыты всем, включая гостей
              or (not p.is_private and m.visibility = 'public')
              -- друзья видят и публичные, и «только для друзей»
              or (
                  p_user_id is not null
                  and m.visibility in ('public', 'friends')
                  and public.is_friend(m.owner_id, p_user_id)
              )
          )
    );
$$;

-- Политика меток теперь переиспользует функцию, а не дублирует правило.
drop policy if exists markers_select on public.markers;
create policy markers_select on public.markers
    for select to anon, authenticated
    using (public.can_view_marker(id, auth.uid()));

-- Приватные профили исключаются из поиска людей на уровне приложения,
-- а этот индекс ускоряет такой фильтр.
create index if not exists profiles_is_private_idx
    on public.profiles (is_private)
    where is_private;


-- ===== 20260101000008_photo_owner_only.sql =====
-- =============================================================================
-- 0008. Фото добавляет только владелец метки
-- =============================================================================
-- В 0004/0005 загрузку мог выполнить любой авторизованный пользователь,
-- которому видна метка. Интерфейс при этом разрешал загрузку только владельцу,
-- то есть политика была шире продукта. Сужаем до владельца метки: иначе любой
-- мог бы залить произвольные файлы к чужой публичной метке.
-- =============================================================================

drop policy if exists marker_photos_insert on public.marker_photos;
create policy marker_photos_insert on public.marker_photos
    for insert to authenticated
    with check (
        owner_id = auth.uid()
        and public.is_marker_owner(marker_id, auth.uid())
    );

drop policy if exists "marker photos insert" on storage.objects;
create policy "marker photos insert" on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'marker-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
        and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
        and public.is_marker_owner(((storage.foldername(name))[2])::uuid, auth.uid())
    );


-- ===== 20260101000009_avatars.sql =====
-- =============================================================================
-- 0009. Аватары профиля
-- =============================================================================
-- Отдельный публичный bucket: аватар — часть публичного профиля, он и так
-- виден в списках и на карте. Поэтому здесь, в отличие от фото меток, хватает
-- публичного URL без подписей.
--
-- Путь: {user_id}/{filename}.{ext} — писать можно только в свою папку.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'avatars',
    'avatars',
    true,
    2097152, -- 2 МБ
    array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
    set public             = excluded.public,
        file_size_limit    = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- Чтение: аватары публичны.
-- -----------------------------------------------------------------------------
drop policy if exists "avatars read" on storage.objects;
create policy "avatars read" on storage.objects
    for select to anon, authenticated
    using (bucket_id = 'avatars');

-- -----------------------------------------------------------------------------
-- Загрузка: только в свою папку.
-- -----------------------------------------------------------------------------
drop policy if exists "avatars insert" on storage.objects;
create policy "avatars insert" on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

-- -----------------------------------------------------------------------------
-- Замена и удаление: только свой файл.
-- -----------------------------------------------------------------------------
drop policy if exists "avatars update" on storage.objects;
create policy "avatars update" on storage.objects
    for update to authenticated
    using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists "avatars delete" on storage.objects;
create policy "avatars delete" on storage.objects
    for delete to authenticated
    using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

commit;
