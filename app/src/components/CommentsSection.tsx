import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { supabase } from '../lib/supabase';
import type { MarkerComment } from '../types/db';

interface CommentsSectionProps {
  markerId: string;
  canModerate: boolean;
}

const COMMENT_SELECT = `
  id, marker_id, author_id, body, created_at,
  profiles!comments_author_id_fkey ( username, display_name, avatar_url )
`;

function formatDate(value: string): string {
  return new Date(value).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function CommentsSection({ markerId, canModerate }: CommentsSectionProps) {
  const { session } = useAuth();
  const navigate = useNavigate();

  const [comments, setComments] = useState<MarkerComment[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user.id ?? null;

  const load = useCallback(async () => {
    const { data, error: selectError } = await supabase
      .from('comments')
      .select(COMMENT_SELECT)
      .eq('marker_id', markerId)
      .order('created_at', { ascending: true });

    if (selectError) {
      setError(selectError.message);
      return;
    }
    setComments((data as unknown as MarkerComment[]) ?? []);
  }, [markerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!userId) {
      navigate('/login');
      return;
    }

    const text = body.trim();
    if (!text) return;

    setSending(true);
    setError(null);

    const { error: insertError } = await supabase.from('comments').insert({
      marker_id: markerId,
      author_id: userId,
      body: text
    });

    setSending(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setBody('');
    await load();
  };

  const remove = async (id: string) => {
    if (!window.confirm('Удалить комментарий?')) return;
    await supabase.from('comments').delete().eq('id', id);
    await load();
  };

  return (
    <div className="comments">
      <div className="comments__title">
        Комментарии{comments.length > 0 ? ` · ${comments.length}` : ''}
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {!userId && (
        <p className="hint">Войдите, чтобы читать комментарии и участвовать в обсуждении.</p>
      )}

      {userId && comments.length === 0 && (
        <p className="hint">Пока никто не комментировал.</p>
      )}

      {comments.map((comment) => {
        const name =
          comment.profiles?.display_name || comment.profiles?.username || 'Пользователь';
        const canDelete = Boolean(
          userId && (comment.author_id === userId || canModerate)
        );

        return (
          <div className="comment" key={comment.id}>
            <span className="avatar" aria-hidden="true">
              {name.slice(0, 1).toUpperCase()}
            </span>
            <div className="comment__body">
              <div className="comment__head">
                <span className="comment__author">{name}</span>
                <span>{formatDate(comment.created_at)}</span>
                {canDelete && (
                  <button
                    type="button"
                    className="comment__delete"
                    onClick={() => void remove(comment.id)}
                  >
                    Удалить
                  </button>
                )}
              </div>
              <div className="comment__text">{comment.body}</div>
            </div>
          </div>
        );
      })}

      <form className="comment-form" onSubmit={submit}>
        <textarea
          className="textarea"
          style={{ minHeight: 72 }}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={1000}
          placeholder={userId ? 'Написать комментарий…' : 'Войдите, чтобы комментировать'}
          disabled={!userId}
        />
        <button
          type="submit"
          className="btn btn--primary btn--sm"
          disabled={!userId || sending || !body.trim()}
          style={{ alignSelf: 'flex-end' }}
        >
          {sending ? 'Отправка…' : 'Отправить'}
        </button>
      </form>
    </div>
  );
}
