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
