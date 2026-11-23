import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../features/auth/AuthProvider';
import { supabase } from '../lib/supabase';
import type { MarkerPhoto } from '../types/db';

interface PhotoItem extends MarkerPhoto {
  url: string | null;
}

interface PhotoGalleryProps {
  markerId: string;
  canUpload: boolean;
}

const BUCKET = 'marker-photos';
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function PhotoGallery({ markerId, canUpload }: PhotoGalleryProps) {
  const { session } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: selectError } = await supabase
      .from('marker_photos')
      .select('*')
      .eq('marker_id', markerId)
      .order('created_at');

    if (selectError) {
      setError(selectError.message);
      setLoading(false);
      return;
    }

    const rows = (data as MarkerPhoto[] | null) ?? [];

    // Bucket приватный: каждой картинке нужна подписанная ссылка,
    // и Storage сам проверит, что метку этому пользователю видно.
    const items = await Promise.all(
      rows.map(async (row) => {
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(row.storage_path, 3600);
        return { ...row, url: signed?.signedUrl ?? null };
      })
    );

    setPhotos(items);
    setLoading(false);
  }, [markerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleFile = async (file: File) => {
    if (!session?.user) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Поддерживаются JPEG, PNG, WebP и GIF.');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('Файл больше 5 МБ — уменьшите или сожмите его.');
      return;
    }

    setUploading(true);
    setError(null);

    const extension = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `${session.user.id}/${markerId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { error: insertError } = await supabase.from('marker_photos').insert({
      marker_id: markerId,
      owner_id: session.user.id,
      storage_path: path
    });

    if (insertError) {
      // Не оставляем «осиротевший» файл в бакете.
      await supabase.storage.from(BUCKET).remove([path]);
      setError(insertError.message);
      setUploading(false);
      return;
    }

    await load();
    setUploading(false);
  };

  const removePhoto = async (photo: PhotoItem) => {
    if (!window.confirm('Удалить это фото?')) return;

    await supabase.storage.from(BUCKET).remove([photo.storage_path]);
    await supabase.from('marker_photos').delete().eq('id', photo.id);
    await load();
  };

  if (loading) return null;
  if (photos.length === 0 && !canUpload) return null;

  return (
    <div className="panel-section">
      <div className="comments__title">Фото</div>

      {error && <div className="alert alert--error">{error}</div>}

      <div className="photo-grid">
        {photos.map((photo) => (
          <div className="photo-grid__item" key={photo.id}>
            {photo.url && <img src={photo.url} alt="" loading="lazy" />}
            {canUpload && (
              <button
                type="button"
                className="photo-grid__remove"
                onClick={() => void removePhoto(photo)}
                aria-label="Удалить фото"
              >
                ×
              </button>
            )}
          </div>
        ))}

        {canUpload && (
          <button
            type="button"
            className="photo-add"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Загрузка…' : '+ Фото'}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = '';
        }}
      />
    </div>
  );
}
