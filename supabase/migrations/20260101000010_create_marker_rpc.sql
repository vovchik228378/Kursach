-- =============================================================================
-- 0010. Запись меток через серверные функции
-- =============================================================================
-- Причина: клиент отправлял owner_id из сессии, и на живом проекте Postgres
-- видел авторизованного пользователя (auth.uid() не null), но вставка всё
-- равно нарушала RLS — значит, присланный owner_id не совпадал с auth.uid().
--
-- Здесь владелец не принимается от клиента вообще: функции SECURITY DEFINER
-- сами берут auth.uid() и проверяют права. Логика доступа остаётся на сервере,
-- а не в браузере.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Создание метки. Возвращает id новой строки.
-- -----------------------------------------------------------------------------
create or replace function public.create_marker(
    p_title text,
    p_description text,
    p_place_name text,
    p_category_id uuid,
    p_visibility text,
    p_lat double precision,
    p_lng double precision
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_id  uuid;
begin
    if v_uid is null then
        raise exception 'Требуется вход в аккаунт' using errcode = '28000';
    end if;

    if p_title is null or length(btrim(p_title)) = 0 then
        raise exception 'Название метки не может быть пустым' using errcode = '22023';
    end if;

    if p_visibility not in ('public', 'friends', 'private') then
        raise exception 'Недопустимая видимость метки' using errcode = '22023';
    end if;

    insert into public.markers (
        owner_id, title, description, place_name, category_id, visibility, lat, lng
    )
    values (
        v_uid,
        btrim(p_title),
        nullif(btrim(coalesce(p_description, '')), ''),
        nullif(btrim(coalesce(p_place_name, '')), ''),
        p_category_id,
        p_visibility,
        p_lat,
        p_lng
    )
    returning id into v_id;

    return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Редактирование своей метки. Чужая — ошибка, а не «ноль строк».
-- -----------------------------------------------------------------------------
create or replace function public.update_marker(
    p_marker_id uuid,
    p_title text,
    p_description text,
    p_place_name text,
    p_category_id uuid,
    p_visibility text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
begin
    if v_uid is null then
        raise exception 'Требуется вход в аккаунт' using errcode = '28000';
    end if;

    if p_title is null or length(btrim(p_title)) = 0 then
        raise exception 'Название метки не может быть пустым' using errcode = '22023';
    end if;

    if p_visibility not in ('public', 'friends', 'private') then
        raise exception 'Недопустимая видимость метки' using errcode = '22023';
    end if;

    update public.markers
       set title       = btrim(p_title),
           description = nullif(btrim(coalesce(p_description, '')), ''),
           place_name  = nullif(btrim(coalesce(p_place_name, '')), ''),
           category_id = p_category_id,
           visibility  = p_visibility
     where id = p_marker_id
       and owner_id = v_uid;

    if not found then
        raise exception 'Метка не найдена или не принадлежит вам' using errcode = '42501';
    end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Удаление своей метки.
-- -----------------------------------------------------------------------------
create or replace function public.delete_marker(p_marker_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
begin
    if v_uid is null then
        raise exception 'Требуется вход в аккаунт' using errcode = '28000';
    end if;

    delete from public.markers
     where id = p_marker_id
       and owner_id = v_uid;

    if not found then
        raise exception 'Метка не найдена или не принадлежит вам' using errcode = '42501';
    end if;
end;
$$;

-- По умолчанию EXECUTE имеют все роли, включая анонимов. Оставляем только
-- авторизованным: внутри каждой функции всё равно проверяется auth.uid().
revoke all on function public.create_marker(
    text, text, text, uuid, text, double precision, double precision
) from public;
revoke all on function public.update_marker(
    uuid, text, text, text, uuid, text
) from public;
revoke all on function public.delete_marker(uuid) from public;

grant execute on function public.create_marker(
    text, text, text, uuid, text, double precision, double precision
) to authenticated;
grant execute on function public.update_marker(
    uuid, text, text, text, uuid, text
) to authenticated;
grant execute on function public.delete_marker(uuid) to authenticated;
