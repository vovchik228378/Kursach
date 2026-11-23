import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import type { MapCanvasProps } from './mapTypes';

const DEFAULT_CENTER: [number, number] = [55.7558, 37.6173];
const OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

/**
 * Резервная карта на OpenStreetMap.
 *
 * Нужна, когда нет ключа Яндекс.Карт: приложение остаётся рабочим —
 * те же метки, кластеры и клик по карте, только на других тайлах.
 */
export function MapCanvasOsm({
  markers,
  selectedId,
  onSelect,
  onMapClick,
  crosshair = false
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<any>(null);
  const layersRef = useRef<Map<string, L.CircleMarker>>(new Map());

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
    if (!containerRef.current) return;

    let map: L.Map | null = null;

    try {
      map = L.map(containerRef.current, {
        center: DEFAULT_CENTER,
        zoom: 10,
        zoomControl: true
      });

      L.tileLayer(OSM_TILES, {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(map);

      const cluster = (L as any).markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 50
      });
      map.addLayer(cluster);

      map.on('click', (event: L.LeafletMouseEvent) => {
        onMapClickRef.current?.([event.latlng.lat, event.latlng.lng]);
      });

      mapRef.current = map;
      clusterRef.current = cluster;
      setReady(true);

      // Контейнер мог получить размер уже после инициализации —
      // без этого Leaflet рисует тайлы в неправильном масштабе.
      window.setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 0);
    } catch (initError) {
      setError((initError as Error).message);
    }

    const onResize = () => mapRef.current?.invalidateSize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      clusterRef.current = null;
      layersRef.current.clear();
    };
  }, []);

  // Перерисовать метки при изменении набора (фильтры, поиск, realtime).
  useEffect(() => {
    const cluster = clusterRef.current;
    if (!ready || !cluster) return;

    cluster.clearLayers();
    layersRef.current.clear();

    markers.forEach((marker) => {
      const layer = L.circleMarker([marker.lat, marker.lng], {
        radius: 8,
        color: '#ffffff',
        weight: 2,
        fillColor: marker.color,
        fillOpacity: 1
      });

      layer.bindTooltip(marker.title, { direction: 'top' });
      layer.on('click', () => onSelectRef.current(marker.id));

      layersRef.current.set(marker.id, layer);
      cluster.addLayer(layer);
    });
  }, [ready, markers]);

  // Выбранная метка: приблизить и подсветить.
  useEffect(() => {
    if (!ready || !selectedId) return;

    const marker = markers.find((item) => item.id === selectedId);
    const map = mapRef.current;
    if (!marker || !map) return;

    map.setView([marker.lat, marker.lng], Math.max(map.getZoom(), 13), { animate: true });

    layersRef.current.forEach((layer, id) => {
      layer.setStyle(
        id === selectedId ? { weight: 3, radius: 10 } : { weight: 2, radius: 8 }
      );
    });
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
