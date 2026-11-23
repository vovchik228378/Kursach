import { useRef, useState } from 'react';
import { useAuth } from '../features/auth/AuthProvider';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/db';

interface AvatarUploaderProps {
  profile: Profile;
  onUpdated: (url: string | null) => void;
}

const BUCKET = 'avatars';
const MAX_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PUBLIC_MARKER = `/storage/v1/object/public/${BUCKET}/`;

export function AvatarUploader({ profile, onUpdated }: AvatarUploaderProps) {
  const { session } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = profile.display_name || profile.username;

  /** Удаляем предыдущий файл, если он лежит в нашем bucket. */
  const removeOldFile = async () => {
    if (!profile.avatar_url || !profile.avatar_url.includes(PUBLIC_MARKER)) return;
    const oldPath = decodeURIComponent(profile.avatar_url.split(PUBLIC_MARKER)[1] ?? '');
    if (oldPath) {
      await supabase.storage.from(BUCKET).remove([oldPath]);
    }
  };

  const handleFile = async (file: File) => {
    if (!session?.user) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Подойдут JPEG, PNG или WebP.');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('Файл больше 2 МБ — сожмите его.');
      return;
    }

    setBusy(true);
    setError(null);

    const extension = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `${session.user.id}/avatar-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      setError(uploadError.message);
      setBusy(false);
      return;
    }

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = publicData.publicUrl;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', session.user.id);

    if (updateError) {
      // Не оставляем файл, на который никто не ссылается.
      await supabase.storage.from(BUCKET).remove([path]);
      setError(updateError.message);
      setBusy(false);
      return;
    }

    await removeOldFile();
    setBusy(false);
    onUpdated(publicUrl);
  };

  const removeAvatar = async () => {
    if (!session?.user) return;
    if (!window.confirm('Удалить фото профиля?')) return;

    setBusy(true);
    setError(null);

    await removeOldFile();

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', session.user.id);

    setBusy(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    onUpdated(null);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span className="avatar avatar--lg" aria-hidden="true">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt="" />
        ) : (
          name.slice(0, 1).toUpperCase()
        )}
      </span>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? 'Загрузка…' : profile.avatar_url ? 'Сменить фото' : 'Загрузить фото'}
          </button>

          {profile.avatar_url && (
            <button
              type="button"
              className="btn btn--danger btn--sm"
              onClick={() => void removeAvatar()}
              disabled={busy}
            >
              Удалить
            </button>
          )}
        </div>

        <span className="hint">JPEG, PNG или WebP, до 2 МБ.</span>
        {error && <span className="hint" style={{ color: 'var(--c-danger)' }}>{error}</span>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
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
