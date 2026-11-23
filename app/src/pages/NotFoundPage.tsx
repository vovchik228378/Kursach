import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="auth">
      <div className="auth__card">
        <h1 className="auth__title">Страница не найдена</h1>
        <p className="auth__sub">Кажется, такая ссылка никуда не ведёт.</p>
        <Link to="/" className="btn btn--primary btn--block">
          Вернуться на карту
        </Link>
      </div>
    </main>
  );
}
