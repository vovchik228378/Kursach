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
