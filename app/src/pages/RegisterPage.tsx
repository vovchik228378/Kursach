import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { isValidUsername, translateAuthError } from '../lib/validation';

export function RegisterPage() {
  const { session, signUp } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (session) navigate('/', { replace: true });
  }, [session, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

    if (!isValidUsername(trimmedUsername)) {
      setError('Ник: от 3 до 30 символов, только латинские буквы, цифры и «_».');
      return;
    }
    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов.');
      return;
    }
    if (password !== confirm) {
      setError('Пароли не совпадают.');
      return;
    }

    setBusy(true);

    try {
      const result = await signUp(trimmedEmail, password, trimmedUsername);
      if (result.needsConfirmation) {
        setSentTo(trimmedEmail);
      } else {
        navigate('/', { replace: true });
      }
    } catch (signUpError) {
      setError(translateAuthError((signUpError as Error).message));
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <main className="auth">
        <div className="auth__card">
          <h1 className="auth__title">Проверьте почту</h1>
          <p className="auth__sub">
            Мы отправили ссылку для подтверждения на <strong>{sentTo}</strong>.
          </p>
          <div className="alert alert--info">
            Письмо может попасть в «Спам». После подтверждения можно войти.
          </div>
          <Link to="/login" className="btn btn--primary btn--block">
            Перейти ко входу
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="auth">
      <div className="auth__card">
        <h1 className="auth__title">Создать аккаунт</h1>
        <p className="auth__sub">
          Своя карта мест, фото, комментарии и друзья — всё в одном месте.
        </p>

        <form className="auth__form" onSubmit={handleSubmit}>
          {error && <div className="alert alert--error">{error}</div>}

          <div className="field">
            <label className="label" htmlFor="register-username">
              Ник
            </label>
            <input
              id="register-username"
              className="input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              minLength={3}
              maxLength={30}
              placeholder="vova_map"
              required
            />
            <span className="hint">Так вас увидят другие. Латиница, цифры и «_».</span>
          </div>

          <div className="field">
            <label className="label" htmlFor="register-email">
              Электронная почта
            </label>
            <input
              id="register-email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="register-password">
              Пароль
            </label>
            <input
              id="register-password"
              className="input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="register-confirm">
              Повторите пароль
            </label>
            <input
              id="register-confirm"
              className="input"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              minLength={6}
              required
            />
          </div>

          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? 'Создание…' : 'Зарегистрироваться'}
          </button>
        </form>

        <div className="auth__foot">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </div>
      </div>
    </main>
  );
}
