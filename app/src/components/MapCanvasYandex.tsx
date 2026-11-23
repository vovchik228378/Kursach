import { useEffect, useRef, useState } from 'react';
import { loadYmaps } from '../lib/ymaps';
import type { MapCanvasProps } from './mapTypes';

const DEFAULT_CENTER: [number, number] = [55.7558, 37.6173];

/**
 * Карта Яндекса с кластеризацией. Используется, когда задан
 * VITE_YANDEX_MAPS_KEY; иначе приложение поднимает OpenStreetMap.
 */
export function MapCanvasYandex({
  markers,
  selectedId,
  onSelect,
  onMapClick,
  crosshair = false
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const clustererRef = useRef<any>(null);
  const placemarksRef = useRef<Map<string, any>>(new Map());

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSelectRef = useRef(onSelect);
  const onMapClickRef = useRef(onMapClick);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    let cancelled = false;

    loadYmaps()
      .then((ymaps) => {
        if (cancelled || !containerRef.current) return;

        const map = new ymaps.Map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: 10,
          controls: ['zoomControl', 'geolocationControl', 'fullscreenControl']
        });

        const clusterer = new ymaps.Clusterer({
          groupByCoordinates: false,
          clusterDisableClickZoom: false
        });

        map.geoObjects.add(clusterer);

        map.events.add('click', (event: any) => {
          const coords = event.get('coords') as [number, number];
          onMapClickRef.current?.(coords);
        });

        mapRef.current = map;
        clustererRef.current = clusterer;
        setReady(true);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
      clustererRef.current = null;
      placemarksRef.current.clear();
    };
  }, []);

  // Перерисовать метки при изменении набора (фильтры, поиск, realtime).
  useEffect(() => {
    const ymaps = window.ymaps;
    const clusterer = clustererRef.current;
    if (!ready || !ymaps || !clusterer) return;

    clusterer.removeAll();
    placemarksRef.current.clear();

    const placemarks = markers.map((marker) => {
      const placemark = new ymaps.Placemark(
        [marker.lat, marker.lng],
        { hintContent: marker.title },
        {
          preset: 'islands#dotIcon',
          iconColor: marker.color,
          hasBalloon: false,
          openEmptyBalloon: false
        }
      );

      placemark.events.add('click', () => onSelectRef.current(marker.id));
      placemarksRef.current.set(marker.id, placemark);
      return placemark;
    });

    clusterer.add(placemarks);
  }, [ready, markers]);

  // Показать выбранную метку: плавно подвинуть карту к ней.
  useEffect(() => {
    if (!ready || !selectedId) return;
    const placemark = placemarksRef.current.get(selectedId);
    const map = mapRef.current;
    if (!placemark || !map) return;

    const coords = placemark.geometry.getCoordinates() as [number, number];
    map.panTo(coords, { duration: 250, flying: false });
  }, [ready, selectedId, markers]);

  if (error) {
    return <div className="map__state">{error}</div>;
  }

  return (
    <>
      <div
        ref={containerRef}
        className="map"
        style={crosshair ? { cursor: 'crosshair' } : undefined}
      />
      {!ready && <div className="map__state">Загрузка карты…</div>}
    </>
  );
}
