import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { isValidEmail, translateAuthError } from '../lib/validation';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setError('Похоже, в адресе опечатка.');
      return;
    }

    setBusy(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    setBusy(false);

    if (resetError) {
      setError(translateAuthError(resetError.message));
      return;
    }

    setSent(true);
  };

  if (sent) {
    return (
      <main className="auth">
        <div className="auth__card">
          <h1 className="auth__title">Письмо отправлено</h1>
          <p className="auth__sub">
            Если аккаунт с адресом <strong>{email.trim()}</strong> существует, на него пришла
            ссылка для смены пароля.
          </p>
          <div className="alert alert--info">
            Ссылка живёт ограниченное время. Проверьте папку «Спам», если письма нет через
            пару минут.
          </div>
          <Link to="/login" className="btn btn--primary btn--block">
            Вернуться ко входу
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="auth">
      <div className="auth__card">
        <h1 className="auth__title">Восстановление пароля</h1>
        <p className="auth__sub">Пришлём ссылку для смены пароля на почту аккаунта.</p>

        <form className="auth__form" onSubmit={handleSubmit}>
          {error && <div className="alert alert--error">{error}</div>}

          <div className="field">
            <label className="label" htmlFor="forgot-email">
              Электронная почта
            </label>
            <input
              id="forgot-email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? 'Отправка…' : 'Отправить ссылку'}
          </button>
        </form>

        <div className="auth__foot">
          Вспомнили пароль? <Link to="/login">Войти</Link>
        </div>
      </div>
    </main>
  );
}
