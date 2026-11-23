import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CategoryChips } from '../components/CategoryChips';
import { MapCanvas, type MapPin } from '../components/MapCanvas';
import { MarkerCard } from '../components/MarkerCard';
import { MarkerFormModal } from '../components/MarkerFormModal';
import { MarkerPanel } from '../components/MarkerPanel';
import { useAuth } from '../features/auth/AuthProvider';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { MARKER_SELECT } from '../lib/queries';
import type { Category, Marker } from '../types/db';

export function MapPage() {
  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const markerParam = searchParams.get('marker');

  const [categories, setCategories] = useState<Category[]>([]);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [draftCoords, setDraftCoords] = useState<[number, number] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [version, setVersion] = useState(0);

  // Поиск с задержкой: не дёргаем базу на каждое нажатие.
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Переход с профиля: /?marker=<id> сразу открывает нужную метку.
  useEffect(() => {
    if (markerParam) setSelectedId(markerParam);
  }, [markerParam]);

  // Категории — справочник, грузим один раз.
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    void supabase
      .from('categories')
      .select('*')
      .order('sort_order')
      .then(({ data, error: categoriesError }) => {
        if (cancelled) return;
        if (categoriesError) {
          setError(categoriesError.message);
          return;
        }
        setCategories((data as Category[]) ?? []);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Метки: фильтр по категории + поиск по названию и описанию.
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let cancelled = false;

    const run = async () => {
      setLoading(true);

      // Пользовательский ввод не должен ломать синтаксис фильтра PostgREST.
      const safeQuery = query.replace(/[,()%]/g, ' ').trim();

      let builder = supabase.from('markers').select(MARKER_SELECT);
      if (categoryId) builder = builder.eq('category_id', categoryId);
      if (safeQuery) {
        builder = builder.or(
          `title.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`
        );
      }

      const { data, error: markersError } = await builder
        .order('created_at', { ascending: false })
        .limit(500);

      if (cancelled) return;

      if (markersError) {
        setError(markersError.message);
        setMarkers([]);
      } else {
        setError(null);
        setMarkers((data as unknown as Marker[]) ?? []);
      }

      setLoading(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [categoryId, query, version]);

  // Realtime: любое изменение меток перезапрашивает список.
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel('markers-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'markers' },
        () => setVersion((current) => current + 1)
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const pins: MapPin[] = useMemo(
    () =>
      markers.map((marker) => ({
        id: marker.id,
        lat: marker.lat,
        lng: marker.lng,
        title: marker.title,
        color: marker.categories?.color ?? '#6B7280'
      })),
    [markers]
  );

  const selected = useMemo(
    () => markers.find((marker) => marker.id === selectedId) ?? null,
    [markers, selectedId]
  );

  const canDelete = Boolean(session?.user && selected && selected.owner_id === session.user.id);

  const handleMapClick = useCallback(
    (coords: [number, number]) => {
      if (!drawMode) return;
      setDraftCoords(coords);
      setDrawMode(false);
    },
    [drawMode]
  );

  const handleSaved = (id: string) => {
    setDraftCoords(null);
    setEditingId(null);
    setVersion((current) => current + 1);
    setSelectedId(id);
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!window.confirm(`Удалить метку «${selected.title}»?`)) return;

    setDeleting(true);
    // Удаление тоже идёт через функцию: она сама сверяет владельца.
    const { error: deleteError } = await supabase.rpc('delete_marker', {
      p_marker_id: selected.id
    });
    setDeleting(false);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setSelectedId(null);
    setVersion((current) => current + 1);
  };

  const isFiltering = Boolean(query) || Boolean(categoryId);

  return (
    <div className="explore">
      <aside className="sidebar">
        <div className="sidebar__head">
          <div className="sidebar__title-row">
            <h1 className="sidebar__title">Места</h1>
            <span className="sidebar__count">
              {loading ? 'Загрузка…' : `${markers.length} на карте`}
            </span>
          </div>

          <div className="search">
            <span className="search__icon" aria-hidden="true">
              ⌕
            </span>
            <input
              className="input"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по названию или описанию"
              aria-label="Поиск меток"
            />
          </div>

          <CategoryChips
            categories={categories}
            activeId={categoryId}
            onChange={setCategoryId}
          />
        </div>

        <div className="sidebar__body">
          {error && <div className="alert alert--error">{error}</div>}

          {!loading && markers.length === 0 && (
            <div className="empty">
              <div className="empty__title">
                {isFiltering ? 'Ничего не нашлось' : 'Пока нет меток'}
              </div>
              <div>
                {isFiltering
                  ? 'Попробуйте изменить запрос или сбросить категорию.'
                  : 'Поставьте первую точку на карте — она появится здесь.'}
              </div>
            </div>
          )}

          {markers.map((marker) => (
            <MarkerCard
              key={marker.id}
              marker={marker}
              active={marker.id === selectedId}
              onClick={() => setSelectedId(marker.id)}
            />
          ))}
        </div>
      </aside>

      <div className="map-wrap">
        <MapCanvas
          markers={pins}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMapClick={handleMapClick}
          crosshair={drawMode}
        />

        {drawMode && (
          <div className="map__hint">Кликните на карту, чтобы поставить метку</div>
        )}

        <div className="map__fab">
          {session ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setDrawMode((current) => !current)}
            >
              {drawMode ? 'Отменить' : '+ Добавить метку'}
            </button>
          ) : (
            <Link to="/login" className="btn btn--primary">
              Войти, чтобы добавлять метки
            </Link>
          )}
        </div>

        {selected && (
          <MarkerPanel
            marker={selected}
            canDelete={canDelete}
            deleting={deleting}
            onClose={() => {
              setSelectedId(null);
              setEditingId(null);
            }}
            onDelete={handleDelete}
            onEdit={() => setEditingId(selected.id)}
          />
        )}
      </div>

      {draftCoords && !editingId && (
        <MarkerFormModal
          coords={draftCoords}
          categories={categories}
          onClose={() => setDraftCoords(null)}
          onSaved={handleSaved}
        />
      )}

      {editingId && selected && (
        <MarkerFormModal
          key={editingId}
          initial={selected}
          categories={categories}
          onClose={() => setEditingId(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
