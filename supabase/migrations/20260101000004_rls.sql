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
