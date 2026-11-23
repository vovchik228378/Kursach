import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { isSupabaseConfigured } from '../lib/supabase';

export function AppShell() {
  const { session, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const displayName =
    profile?.display_name ||
    profile?.username ||
    session?.user.email?.split('@')[0] ||
    'Профиль';

  const initials = displayName.slice(0, 1).toUpperCase();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Не удалось выйти:', error);
    }
  };

  return (
    <div className="app">
      {!isSupabaseConfigured && (
        <div className="config-banner">
          Supabase не настроен: создайте <code>app/.env.local</code> из{' '}
          <code>app/.env.example</code> и перезапустите <code>npm run dev</code>.
        </div>
      )}

      <header className="topbar">
        <div className="topbar__inner">
          <Link to="/" className="brand">
            <span className="brand__mark" aria-hidden="true">
              ◉
            </span>
            <span className="brand__text">МояКарта</span>
          </Link>

          <nav className="topbar__nav" aria-label="Основная навигация">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `navlink${isActive ? ' is-active' : ''}`}
            >
              Карта
            </NavLink>

            {session && (
              <NavLink
                to="/friends"
                className={({ isActive }) => `navlink${isActive ? ' is-active' : ''}`}
              >
                Друзья
              </NavLink>
            )}
          </nav>

          <div className="topbar__spacer" />

          <div className="topbar__user">
            {session ? (
              <>
                {profile && (
                  <Link
                    to={`/u/${profile.username}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    title="Мой профиль"
                  >
                    <span className="avatar" aria-hidden="true">
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt="" />
                      ) : (
                        initials
                      )}
                    </span>
                    <span
                      className="hint"
                      style={{ color: 'var(--c-ink-2)', fontWeight: 600 }}
                    >
                      {displayName}
                    </span>
                  </Link>
                )}

                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={handleSignOut}
                >
                  Выйти
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn--ghost btn--sm">
                  Войти
                </Link>
                <Link to="/register" className="btn btn--primary btn--sm">
                  Регистрация
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <Outlet />
    </div>
  );
}
