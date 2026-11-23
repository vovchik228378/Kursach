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
