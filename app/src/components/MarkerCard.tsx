import type { Marker } from '../types/db';

interface MarkerCardProps {
  marker: Marker;
  active: boolean;
  onClick: () => void;
}

export function MarkerCard({ marker, active, onClick }: MarkerCardProps) {
  const emoji = marker.categories?.emoji ?? '📍';
  const color = marker.categories?.color ?? '#6B7280';
  const author =
    marker.profiles?.display_name || marker.profiles?.username || 'Неизвестный автор';

  return (
    <button
      type="button"
      className={`marker-card${active ? ' is-active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <span
        className="marker-card__pin"
        style={{ background: `${color}1a`, color }}
        aria-hidden="true"
      >
        {emoji}
      </span>

      <span className="marker-card__body">
        <span className="marker-card__title">{marker.title}</span>
        <span className="marker-card__meta">
          {author}
          {marker.place_name ? ` · ${marker.place_name}` : ''}
        </span>
        {marker.description && (
          <span className="marker-card__desc">{marker.description}</span>
        )}
      </span>
    </button>
  );
}
