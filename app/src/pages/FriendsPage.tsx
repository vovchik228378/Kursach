import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { supabase } from '../lib/supabase';
import type { Friendship, ProfileLite } from '../types/db';

export function FriendsPage() {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user.id ?? null;

  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [people, setPeople] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ProfileLite[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      const { data, error: loadError } = await supabase
        .from('friendships')
        .select('*')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

      if (cancelled) return;

      if (loadError) {
        setError(loadError.message);
        setLoading(false);
        return;
      }

      const rows = (data as Friendship[] | null) ?? [];
      const ids = Array.from(
        new Set(
          rows
            .flatMap((row) => [row.requester_id, row.addressee_id])
            .filter((id) => id !== userId)
        )
      );

      const map: Record<string, ProfileLite> = {};
      if (ids.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', ids);

        ((profilesData as ProfileLite[] | null) ?? []).forEach((person) => {
          map[person.id] = person;
        });
      }

      if (cancelled) return;

      setPeople(map);
      setFriendships(rows);
      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Поиск людей по нику, с задержкой.
  useEffect(() => {
    if (!userId) return;

    const query = search.trim();
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .ilike('username', `%${query.replace(/[,()%]/g, ' ')}%`)
        .eq('is_private', false)
        .neq('id', userId)
        .limit(20);

      setResults((data as ProfileLite[] | null) ?? []);
      setSearching(false);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search, userId]);

  if (authLoading) {
    return (
      <div className="friends">
        <p className="hint">Загрузка…</p>
      </div>
    );
  }

  if (!session || !userId) {
    return <Navigate to="/login" replace />;
  }

  const incoming = friendships.filter(
    (row) => row.status === 'pending' && row.addressee_id === userId
  );
  const outgoing = friendships.filter(
    (row) => row.status === 'pending' && row.requester_id === userId
  );
  const accepted = friendships.filter((row) => row.status === 'accepted');

  const personOf = (row: Friendship): ProfileLite | undefined =>
    people[row.requester_id === userId ? row.addressee_id : row.requester_id];

  const relationFor = (otherId: string): Friendship | undefined =>
    friendships.find(
      (row) =>
        (row.requester_id === userId && row.addressee_id === otherId) ||
        (row.requester_id === otherId && row.addressee_id === userId)
    );

  const sendRequest = async (person: ProfileLite) => {
    setBusyId(person.id);
    const { error: insertError } = await supabase
      .from('friendships')
      .insert({ requester_id: userId, addressee_id: person.id });
    setBusyId(null);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    // Новый человек мог не быть в people — добавляем, чтобы секции отрисовались.
    setPeople((current) => ({ ...current, [person.id]: person }));

    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
    setFriendships((data as Friendship[] | null) ?? []);
  };

  const acceptRequest = async (row: Friendship) => {
    setBusyId(row.id);
    const { error: updateError } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', row.id);
    setBusyId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setFriendships((current) =>
      current.map((item) => (item.id === row.id ? { ...item, status: 'accepted' } : item))
    );
  };

  const dropRelation = async (row: Friendship) => {
    setBusyId(row.id);
    const { error: deleteError } = await supabase
      .from('friendships')
      .delete()
      .eq('id', row.id);
    setBusyId(null);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setFriendships((current) => current.filter((item) => item.id !== row.id));
  };

  const renderPerson = (person: ProfileLite | undefined, actions: ReactNode) => {
    if (!person) return null;
    const name = person.display_name || person.username;

    return (
      <div className="user-row" key={person.id}>
        <span className="avatar" aria-hidden="true">
          {person.avatar_url ? <img src={person.avatar_url} alt="" /> : name.slice(0, 1).toUpperCase()}
        </span>
        <div className="user-row__body">
          <Link to={`/u/${person.username}`} className="user-row__name">
            {name}
          </Link>
          <div className="user-row__meta">@{person.username}</div>
        </div>
        <div className="user-row__actions">{actions}</div>
      </div>
    );
  };

  return (
    <main className="friends">
      <h1 className="friends__title">Друзья</h1>
      <p className="friends__sub">
        Друзья видят ваши метки с видимостью «для друзей», даже если профиль закрыт.
      </p>

      {error && <div className="alert alert--error">{error}</div>}

      <div className="section">
        <div className="section__title">Найти человека</div>
        <input
          className="input"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Введите ник"
          aria-label="Поиск пользователей"
        />
        {searching && <p className="hint">Поиск…</p>}

        {results.map((person) => {
          const relation = relationFor(person.id);
          let action: ReactNode;

          if (!relation) {
            action = (
              <button
                type="button"
                className="btn btn--primary btn--sm"
                disabled={busyId === person.id}
                onClick={() => void sendRequest(person)}
              >
                Добавить
              </button>
            );
          } else if (relation.status === 'accepted') {
            action = <span className="badge">В друзьях</span>;
          } else if (relation.requester_id === userId) {
            action = (
              <>
                <span className="badge">Заявка отправлена</span>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={busyId === relation.id}
                  onClick={() => void dropRelation(relation)}
                >
                  Отменить
                </button>
              </>
            );
          } else {
            action = (
              <>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  disabled={busyId === relation.id}
                  onClick={() => void acceptRequest(relation)}
                >
                  Принять
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={busyId === relation.id}
                  onClick={() => void dropRelation(relation)}
                >
                  Отклонить
                </button>
              </>
            );
          }

          return renderPerson(person, action);
        })}
      </div>

      {incoming.length > 0 && (
        <div className="section">
          <div className="section__title">Заявки вам · {incoming.length}</div>
          {incoming.map((row) =>
            renderPerson(
              personOf(row),
              <>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  disabled={busyId === row.id}
                  onClick={() => void acceptRequest(row)}
                >
                  Принять
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={busyId === row.id}
                  onClick={() => void dropRelation(row)}
                >
                  Отклонить
                </button>
              </>
            )
          )}
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="section">
          <div className="section__title">Ваши заявки · {outgoing.length}</div>
          {outgoing.map((row) =>
            renderPerson(
              personOf(row),
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={busyId === row.id}
                onClick={() => void dropRelation(row)}
              >
                Отменить
              </button>
            )
          )}
        </div>
      )}

      <div className="section">
        <div className="section__title">Мои друзья · {accepted.length}</div>
        {loading && <p className="hint">Загрузка…</p>}
        {!loading && accepted.length === 0 && (
          <div className="empty">
            <div className="empty__title">Пока никого</div>
            <div>Найдите человека по нику и отправьте заявку.</div>
          </div>
        )}
        {accepted.map((row) =>
          renderPerson(
            personOf(row),
            <button
              type="button"
              className="btn btn--danger btn--sm"
              disabled={busyId === row.id}
              onClick={() => void dropRelation(row)}
            >
              Удалить
            </button>
          )
        )}
      </div>
    </main>
  );
}
