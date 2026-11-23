import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { readAuthErrorFromUrl, translateAuthError } from '../lib/validation';

export function ResetPasswordPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  // Если Supabase вернул ошибку в hash (#error=...), показываем её причину.
  const [urlError] = useState<string | null>(() => readAuthErrorFromUrl());

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => navigate('/', { replace: true }), 1800);
    return () => window.clearTimeout(timer);
  }, [done, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов.');
      return;
    }
    if (password !== confirm) {
      setError('Пароли не совпадают.');
      return;
    }

    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (updateError) {
      setError(translateAuthError(updateError.message));
      return;
    }

    setDone(true);
  };

  if (loading) {
    return (
      <main className="auth">
        <div className="auth__card">
          <p className="hint">Проверяем ссылку…</p>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="auth">
        <div className="auth__card">
          <h1 className="auth__title">Ссылка недействительна</h1>
          <p className="auth__sub">
            {urlError ?? 'Ссылка для смены пароля устарела или уже была использована.'}
          </p>
          <Link to="/forgot-password" className="btn btn--primary btn--block">
            Запросить новую
          </Link>
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <main className="auth">
        <div className="auth__card">
          <h1 className="auth__title">Пароль обновлён</h1>
          <p className="auth__sub">Сейчас вернём вас на карту.</p>
          <div className="alert alert--ok">Новый пароль сохранён.</div>
        </div>
      </main>
    );
  }

  return (
    <main className="auth">
      <div className="auth__card">
        <h1 className="auth__title">Новый пароль</h1>
        <p className="auth__sub">Придумайте пароль, который вы не используете больше нигде.</p>

        <form className="auth__form" onSubmit={handleSubmit}>
          {error && <div className="alert alert--error">{error}</div>}

          <div className="field">
            <label className="label" htmlFor="reset-password">
              Новый пароль
            </label>
            <input
              id="reset-password"
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
            <label className="label" htmlFor="reset-confirm">
              Повторите пароль
            </label>
            <input
              id="reset-confirm"
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
            {busy ? 'Сохранение…' : 'Сохранить пароль'}
          </button>
        </form>
      </div>
    </main>
  );
}
