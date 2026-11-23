-- =============================================================================
-- Эмуляция окружения Supabase для локального прогона миграций.
-- =============================================================================
-- В PGlite нет Supabase-обвязки, поэтому здесь создаётся минимум, на который
-- опираются миграции: роли, схемы auth/storage/extensions, auth.uid(),
-- storage.objects, storage.foldername() и пустая публикация Realtime.
--
-- Это НЕ замена настоящему Supabase: проверяются синтаксис миграций и логика
-- RLS, но не права реальных ролей и не поведение GoTrue/PostgREST.
-- =============================================================================

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;

create table auth.users (
    id                uuid primary key default gen_random_uuid(),
    email             text,
    raw_user_meta_data jsonb default '{}'::jsonb
);

-- Аналог auth.uid(): берёт id из настройки, как это делает Supabase из JWT.
create or replace function auth.uid() returns uuid
language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table storage.buckets (
    id                 text primary key,
    name               text not null,
    public             boolean default false,
    file_size_limit    bigint,
    allowed_mime_types text[]
);

create table storage.objects (
    id        uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name      text,
    owner     uuid
);
alter table storage.objects enable row level security;

-- Аналог storage.foldername(): все сегменты пути, кроме имени файла.
create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
    select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
$$;

create publication supabase_realtime;

grant usage on schema auth, storage, extensions to anon, authenticated;
