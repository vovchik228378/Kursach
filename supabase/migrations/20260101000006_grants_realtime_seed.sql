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
