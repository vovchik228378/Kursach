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
