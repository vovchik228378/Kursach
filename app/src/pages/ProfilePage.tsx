import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MarkerCard } from '../components/MarkerCard';
import { AvatarUploader } from '../components/AvatarUploader';
import { useAuth } from '../features/auth/AuthProvider';
import { MARKER_SELECT } from '../lib/queries';
import { supabase } from '../lib/supabase';
import type { Friendship, Marker, Profile } from '../types/db';

export function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { session, refreshProfile } = useAuth();
  const userId = session?.user.id ?? null;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [friendship, setFriendship] = useState<Friendship | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    if (!username) return;

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', username)
        .maybeSingle();

      if (cancelled) return;

      if (profileError || !data) {
        setError('Пользователь не найден.');
        setLoading(false);
        return;
      }

      const owner = data as Profile;
      setProfile(owner);
      setDisplayName(owner.display_name ?? '');
      setBio(owner.bio ?? '');
      setIsPrivate(owner.is_private);

      const { data: markersData } = await supabase
        .from('markers')
        .select(MARKER_SELECT)
        .eq('owner_id', owner.id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (cancelled) return;
      setMarkers((markersData as unknown as Marker[]) ?? []);

      if (userId && userId !== owner.id) {
        const { data: relations } = await supabase
          .from('friendships')
          .select('*')
          .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

        if (cancelled) return;

        const rows = (relations as Friendship[] | null) ?? [];
        setFriendship(
          rows.find(
            (row) => row.requester_id === owner.id || row.addressee_id === owner.id
          ) ?? null
        );
      } else {
        setFriendship(null);
      }

      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [username, userId]);

  const isMe = Boolean(profile && userId && profile.id === userId);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;

    setBusy(true);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        is_private: isPrivate
      })
      .eq('id', profile.id);
    setBusy(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setProfile({
      ...profile,
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
      is_private: isPrivate
    });
    setEditing(false);
    await refreshProfile();
  };

  const sendRequest = async () => {
    if (!profile || !userId) {
      navigate('/login');
      return;
    }

    setBusy(true);
    const { data, error: insertError } = await supabase
      .from('friendships')
      .insert({ requester_id: userId, addressee_id: profile.id })
      .select('*')
      .single();
    setBusy(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setFriendship(data as Friendship);
  };

  const acceptRequest = async () => {
    if (!friendship) return;
    setBusy(true);
    const { error: updateError } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendship.id);
    setBusy(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setFriendship({ ...friendship, status: 'accepted' });
  };

  const removeFriend = async () => {
    if (!friendship) return;
    if (!window.confirm('Удалить из друзей?')) return;

    setBusy(true);
    const { error: deleteError } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendship.id);
    setBusy(false);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setFriendship(null);
  };

  if (loading) {
    return (
      <main className="profile">
        <p className="hint">Загрузка профиля…</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="profile">
        <div className="empty">
          <div className="empty__title">{error ?? 'Пользователь не найден'}</div>
          <div>Проверьте ссылку — возможно, ник изменился.</div>
        </div>
      </main>
    );
  }

  const name = profile.display_name || profile.username;
  const friendState = friendship?.status ?? null;

  return (
    <main className="profile">
      <div className="profile__head">
        <span className="avatar avatar--lg" aria-hidden="true">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" />
          ) : (
            name.slice(0, 1).toUpperCase()
          )}
        </span>

        <div style={{ minWidth: 0 }}>
          <h1 className="profile__name">{name}</h1>
          <div className="profile__username">@{profile.username}</div>
          {profile.bio && <p className="profile__bio">{profile.bio}</p>}
          <div className="profile__stats">
            <span>{markers.length} меток</span>
            {profile.is_private && <span className="badge">Закрытый профиль</span>}
          </div>
        </div>

        <div className="profile__actions">
          {isMe ? (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setEditing((current) => !current)}
            >
              {editing ? 'Отмена' : 'Редактировать'}
            </button>
          ) : friendState === 'accepted' ? (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={busy}
              onClick={() => void removeFriend()}
            >
              Удалить из друзей
            </button>
          ) : friendState === 'pending' && friendship?.requester_id === userId ? (
            <span className="badge">Заявка отправлена</span>
          ) : friendState === 'pending' ? (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={busy}
              onClick={() => void acceptRequest()}
            >
              Принять заявку
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={busy}
              onClick={() => void sendRequest()}
            >
              Добавить в друзья
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert--error" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}

      {editing && isMe && (
        <form className="section" onSubmit={saveProfile}>
          <div className="section__title">Профиль</div>

          <div style={{ marginBottom: 16 }}>
            <AvatarUploader
              profile={profile}
              onUpdated={(url) => {
                setProfile((current) =>
                  current ? { ...current, avatar_url: url } : current
                );
                void refreshProfile();
              }}
            />
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label className="label" htmlFor="profile-name">
              Отображаемое имя
            </label>
            <input
              id="profile-name"
              className="input"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={60}
              placeholder={profile.username}
            />
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label className="label" htmlFor="profile-bio">
              О себе
            </label>
            <textarea
              id="profile-bio"
              className="textarea"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={300}
              placeholder="Пара слов о вас"
            />
          </div>

          <label className="hint" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(event) => setIsPrivate(event.target.checked)}
            />
            Закрытый профиль: метки видят только друзья
          </label>

          <button
            type="submit"
            className="btn btn--primary"
            style={{ marginTop: 12 }}
            disabled={busy}
          >
            {busy ? 'Сохранение…' : 'Сохранить'}
          </button>
        </form>
      )}

      <div className="section">
        <div className="section__title">
          {isMe ? 'Мои метки' : 'Метки пользователя'} · {markers.length}
        </div>

        {markers.length === 0 ? (
          <div className="empty">
            <div className="empty__title">Пока пусто</div>
            <div>
              {isMe
                ? 'Поставьте первую метку на карте.'
                : 'Пользователь ещё не отметил места или скрыл их.'}
            </div>
          </div>
        ) : (
          <div className="profile__grid">
            {markers.map((marker) => (
              <MarkerCard
                key={marker.id}
                marker={marker}
                active={false}
                onClick={() => navigate(`/?marker=${marker.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
