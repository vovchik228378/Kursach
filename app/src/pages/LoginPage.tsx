import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { readAuthErrorFromUrl, translateAuthError } from '../lib/validation';

export function LoginPage() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Сюда приходит редирект с #error=... , если ссылка из письма протухла.
  useEffect(() => {
    const urlError = readAuthErrorFromUrl();
    if (urlError) setError(urlError);
  }, []);

  useEffect(() => {
    if (session) navigate('/', { replace: true });
  }, [session, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      await signIn(email.trim(), password);
      navigate('/', { replace: true });
    } catch (signInError) {
      setError(translateAuthError((signInError as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth">
      <div className="auth__card">
        <h1 className="auth__title">С возвращением</h1>
        <p className="auth__sub">Войдите, чтобы видеть свои места и места друзей.</p>

        <form className="auth__form" onSubmit={handleSubmit}>
          {error && <div className="alert alert--error">{error}</div>}

          <div className="field">
            <label className="label" htmlFor="login-email">
              Электронная почта
            </label>
            <input
              id="login-email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="login-password">
              Пароль
            </label>
            <input
              id="login-password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? 'Вход…' : 'Войти'}
          </button>
        </form>

        <div className="auth__foot">
          <Link to="/forgot-password">Забыли пароль?</Link>
        </div>

        <div className="auth__foot">
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
        </div>
      </div>
    </main>
  );
}
