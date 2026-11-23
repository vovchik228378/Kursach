import { useEffect, useState, type FormEvent } from 'react';
import { decodeJwtPayload } from '../lib/jwt';
import { supabase } from '../lib/supabase';
import type { Category, Marker, Visibility } from '../types/db';

interface MarkerFormModalProps {
  categories: Category[];
  /** Координаты для новой метки (клик по карте). */
  coords?: [number, number];
  /** Существующая метка — тогда форма работает в режиме редактирования. */
  initial?: Marker;
  onClose: () => void;
  onSaved: (id: string) => void;
}

const VISIBILITY_OPTIONS: { value: Visibility; label: string; hint: string }[] = [
  { value: 'public', label: 'Публичная', hint: 'Видна всем на общей карте' },
  { value: 'friends', label: 'Для друзей', hint: 'Только вы и принятые друзья' },
  { value: 'private', label: 'Личная', hint: 'Видна только вам' }
];

export function MarkerFormModal({
  categories,
  coords,
  initial,
  onClose,
  onSaved
}: MarkerFormModalProps) {
  const isEdit = Boolean(initial);

  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [placeName, setPlaceName] = useState(initial?.place_name ?? '');
  const [categoryId, setCategoryId] = useState(
    initial?.category_id ?? categories[0]?.id ?? ''
  );
  const [visibility, setVisibility] = useState<Visibility>(initial?.visibility ?? 'public');
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const position: [number, number] | null = initial
    ? [initial.lat, initial.lng]
    : coords ?? null;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!position) {
      setError('Не выбраны координаты метки.');
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Введите название метки.');
      return;
    }

    setSaving(true);
    setError(null);

    if (initial) {
      // Владельца и права проверяет серверная функция, а не клиент.
      const { error: updateError } = await supabase.rpc('update_marker', {
        p_marker_id: initial.id,
        p_title: trimmedTitle,
        p_description: description.trim() || null,
        p_place_name: placeName.trim() || null,
        p_category_id: categoryId || null,
        p_visibility: visibility
      });

      setSaving(false);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      onSaved(initial.id);
      return;
    }

    // Сессию и токен обновляем прямо перед записью: истёкший access_token
    // шлюз обрабатывает как анонимный запрос, и RLS отвечает 42501.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setSaving(false);
      setError('Сессия не найдена. Выйдите и войдите заново.');
      return;
    }

    const { data: refreshed } = await supabase.auth.refreshSession();
    const activeSession = refreshed.session ?? sessionData.session;
    const accessToken = activeSession.access_token;

    // Датчик из supabase/diagnose_markers.sql: кем видит запрос сама база.
    // Если функции нет — молча продолжаем, это не часть основного сценария.
    let dbIdentity: { uid?: string | null; role?: string } | null = null;
    const { data: who } = await supabase.rpc('whoami');
    if (who && typeof who === 'object') {
      dbIdentity = who as { uid?: string | null; role?: string };
    }

    // Владелец не передаётся с клиента: функция на сервере сама берёт auth.uid().
    const { data: createdId, error: insertError } = await supabase.rpc('create_marker', {
      p_title: trimmedTitle,
      p_description: description.trim() || null,
      p_place_name: placeName.trim() || null,
      p_category_id: categoryId || null,
      p_visibility: visibility,
      p_lat: position[0],
      p_lng: position[1]
    });

    setSaving(false);

    if (insertError) {
      // PostgREST не показывает, кем он видел запрос, поэтому разбираем claims.
      const claims = decodeJwtPayload(accessToken);
      const nowSeconds = Math.floor(Date.now() / 1000);
      const expired = typeof claims?.exp === 'number' ? claims.exp <= nowSeconds : null;
      const sameUser = claims?.sub === activeSession.user.id;
      const ownerMatchesDb = dbIdentity?.uid === activeSession.user.id;

      console.error('[markers.insert] не удалось создать метку', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        userId: activeSession.user.id,
        refreshed: Boolean(refreshed.session),
        dbIdentity,
        token: claims
          ? { sub: claims.sub, role: claims.role, exp: claims.exp, expired, sameUser }
          : null
      });

      setDebug(
        `код ${insertError.code}; обновление токена: ${
          refreshed.session ? 'да' : 'нет'
        }; роль в токене: ${claims?.role ?? 'нет токена'}; sub совпадает: ${
          sameUser ? 'да' : 'нет'
        }; истёк: ${expired === null ? 'неизвестно' : expired ? 'да' : 'нет'}; ` +
          `owner_id клиента: ${activeSession.user.id}; совпадает с базой: ${
            ownerMatchesDb ? 'да' : 'нет'
          }; кем видит база: ${
            dbIdentity ? `${dbIdentity.uid ?? 'null'} (${dbIdentity.role})` : 'функция whoami не установлена'
          }`
      );

      const functionMissing =
        insertError.code === '42883' ||
        /could not find the function|function .* does not exist/i.test(insertError.message);

      setError(
        functionMissing
          ? 'На сервере ещё нет функции create_marker. Примените миграцию supabase/migrations/20260101000010_create_marker_rpc.sql в SQL Editor.'
          : insertError.code === '42501'
            ? 'Сервер не принял запрос от вашего аккаунта (RLS). Выйдите и войдите заново; если не поможет — раскройте «Технические детали» ниже и пришлите их текст.'
          : insertError.message
      );
      return;
    }

    onSaved(createdId as string);
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Редактирование метки' : 'Новая метка'}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal__head">
          <h2 className="modal__title">
            {isEdit ? 'Редактировать метку' : 'Новая метка'}
          </h2>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div className="modal__body">
          {position && (
            <p className="hint">
              Координаты: {position[0].toFixed(5)}, {position[1].toFixed(5)}
            </p>
          )}

          {error && <div className="alert alert--error">{error}</div>}

          {debug && (
            <details className="hint">
              <summary style={{ cursor: 'pointer' }}>Технические детали</summary>
              <div style={{ marginTop: 4 }}>{debug}</div>
            </details>
          )}

          <div className="field">
            <label className="label" htmlFor="marker-title">
              Название
            </label>
            <input
              id="marker-title"
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              placeholder="Например: любимая кофейня"
              autoFocus
              required
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="marker-category">
              Категория
            </label>
            <select
              id="marker-category"
              className="select"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Без категории</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.emoji} {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="label" htmlFor="marker-place">
              Место
            </label>
            <input
              id="marker-place"
              className="input"
              value={placeName}
              onChange={(event) => setPlaceName(event.target.value)}
              maxLength={300}
              placeholder="Адрес или название заведения"
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="marker-description">
              Описание
            </label>
            <textarea
              id="marker-description"
              className="textarea"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={2000}
              placeholder="Что здесь особенного?"
            />
          </div>

          <div className="field">
            <span className="label">Кто увидит метку</span>
            <div className="chips">
              {VISIBILITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`chip${visibility === option.value ? ' is-active' : ''}`}
                  onClick={() => setVisibility(option.value)}
                  title={option.hint}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Сохранение…' : isEdit ? 'Сохранить изменения' : 'Создать метку'}
          </button>
        </div>
      </form>
    </div>
  );
}
