import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { supabase } from '../lib/supabase';

interface LikeButtonProps {
  markerId: string;
}

export function LikeButton({ markerId }: LikeButtonProps) {
  const { session } = useAuth();
  const navigate = useNavigate();

  const [count, setCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  const userId = session?.user.id ?? null;

  const load = useCallback(async () => {
    // Лайков у одной метки немного — считаем на клиенте одним запросом.
    const { data } = await supabase.from('likes').select('user_id').eq('marker_id', markerId);
    const rows = (data as { user_id: string }[] | null) ?? [];
    setCount(rows.length);
    setLiked(Boolean(userId && rows.some((row) => row.user_id === userId)));
  }, [markerId, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async () => {
    if (!userId) {
      navigate('/login');
      return;
    }
    if (busy) return;

    setBusy(true);

    if (liked) {
      await supabase
        .from('likes')
        .delete()
        .eq('marker_id', markerId)
        .eq('user_id', userId);
    } else {
      await supabase.from('likes').insert({ marker_id: markerId, user_id: userId });
    }

    await load();
    setBusy(false);
  };

  return (
    <button
      type="button"
      className={`like-button${liked ? ' is-liked' : ''}`}
      onClick={toggle}
      disabled={busy}
      aria-pressed={liked}
      aria-label={liked ? 'Убрать лайк' : 'Поставить лайк'}
    >
      <span aria-hidden="true">{liked ? '♥' : '♡'}</span>
      {count > 0 ? count : 'Нравится'}
    </button>
  );
}
