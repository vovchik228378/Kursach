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
