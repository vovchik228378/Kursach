-- =============================================================================
-- Диагностика и починка INSERT-политики на markers
-- =============================================================================
-- Зачем: приложение получает 42501 «new row violates row-level security
-- policy» при валидном токене (role=authenticated, sub совпадает).
-- Нужно увидеть, что именно стоит на таблице и видит ли Postgres пользователя.
--
-- Вставить целиком в Supabase Dashboard → SQL Editor → Run.
-- Скрипт идемпотентен.
-- =============================================================================

-- 1. Функция-датчик: приложение вызовет её с токеном пользователя
--    и покажет, кем видит запрос база.
create or replace function public.whoami()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
    select jsonb_build_object(
        'uid', auth.uid(),
        'role', current_user
    );
$$;

grant execute on function public.whoami() to anon, authenticated;

-- 2. Пересоздаём политику вставки: только владелец может создать метку.
drop policy if exists markers_insert_own on public.markers;
create policy markers_insert_own on public.markers
    for insert to authenticated
    with check (owner_id = auth.uid());

-- 3. Показать, что в итоге стоит на таблице.
select policyname, cmd, permissive, roles::text as roles, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'markers'
order by cmd, policyname;
