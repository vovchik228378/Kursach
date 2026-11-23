-- =============================================================================
-- 0008. Фото добавляет только владелец метки
-- =============================================================================
-- В 0004/0005 загрузку мог выполнить любой авторизованный пользователь,
-- которому видна метка. Интерфейс при этом разрешал загрузку только владельцу,
-- то есть политика была шире продукта. Сужаем до владельца метки: иначе любой
-- мог бы залить произвольные файлы к чужой публичной метке.
-- =============================================================================

drop policy if exists marker_photos_insert on public.marker_photos;
create policy marker_photos_insert on public.marker_photos
    for insert to authenticated
    with check (
        owner_id = auth.uid()
        and public.is_marker_owner(marker_id, auth.uid())
    );

drop policy if exists "marker photos insert" on storage.objects;
create policy "marker photos insert" on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'marker-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
        and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
        and public.is_marker_owner(((storage.foldername(name))[2])::uuid, auth.uid())
    );
