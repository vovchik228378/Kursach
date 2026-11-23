import { CommentsSection } from './CommentsSection';
import { LikeButton } from './LikeButton';
import { PhotoGallery } from './PhotoGallery';
import type { Marker, Visibility } from '../types/db';

interface MarkerPanelProps {
  marker: Marker;
  canDelete: boolean;
  deleting: boolean;
  onClose: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

const VISIBILITY_LABEL: Record<Visibility, string> = {
  public: 'Публичная',
  friends: 'Для друзей',
  private: 'Личная'
};

export function MarkerPanel({
  marker,
  canDelete,
  deleting,
  onClose,
  onDelete,
  onEdit
}: MarkerPanelProps) {
  const author =
    marker.profiles?.display_name || marker.profiles?.username || 'Неизвестный автор';
  const created = new Date(marker.created_at).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <aside className="panel" aria-label={`Метка «${marker.title}»`}>
      <div className="panel__head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="panel__title">{marker.title}</h2>
          <div className="panel__sub">
            {author} · {created}
          </div>
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>
      </div>

      <div className="panel__body">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {marker.categories && (
            <span
              className="badge"
              style={{
                background: `${marker.categories.color}1a`,
                color: marker.categories.color
              }}
            >
              <span aria-hidden="true">{marker.categories.emoji}</span>
              {marker.categories.name}
            </span>
          )}
          <span className={`badge badge--${marker.visibility}`}>
            {VISIBILITY_LABEL[marker.visibility]}
          </span>
        </div>

        {marker.description && <p className="panel__desc">{marker.description}</p>}

        {marker.place_name && (
          <div className="meta-row">
            <span className="meta-row__label">Место</span>
            <span>{marker.place_name}</span>
          </div>
        )}

        <div className="meta-row">
          <span className="meta-row__label">Координаты</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            {marker.lat.toFixed(5)}, {marker.lng.toFixed(5)}
          </span>
        </div>

        <div>
          <LikeButton markerId={marker.id} />
        </div>

        <PhotoGallery markerId={marker.id} canUpload={canDelete} />

        <CommentsSection markerId={marker.id} canModerate={canDelete} />
      </div>

      {canDelete && (
        <div className="panel__foot">
          <button
            type="button"
            className="btn btn--ghost"
            style={{ flex: 1 }}
            onClick={onEdit}
          >
            Изменить
          </button>
          <button
            type="button"
            className="btn btn--danger"
            style={{ flex: 1 }}
            onClick={onDelete}
            disabled={deleting}
          >
            {deleting ? 'Удаление…' : 'Удалить'}
          </button>
        </div>
      )}
    </aside>
  );
}
