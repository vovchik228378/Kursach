import { MapCanvasOsm } from './MapCanvasOsm';
import { MapCanvasYandex } from './MapCanvasYandex';
import type { MapCanvasProps } from './mapTypes';

/**
 * Выбор карты:
 *   задан VITE_YANDEX_MAPS_KEY → Яндекс.Карты (как в курсовом проекте);
 *   ключа нет                → OpenStreetMap с кластеризацией.
 *
 * Второй вариант нужен, чтобы приложение оставалось рабочим без
 * коммерческого ключа: на защите карта не должна быть пустым прямоугольником.
 */
const hasYandexKey = Boolean(import.meta.env.VITE_YANDEX_MAPS_KEY);

export const mapProvider: 'yandex' | 'osm' = hasYandexKey ? 'yandex' : 'osm';

export function MapCanvas(props: MapCanvasProps) {
  return hasYandexKey ? <MapCanvasYandex {...props} /> : <MapCanvasOsm {...props} />;
}

export type { MapPin } from './mapTypes';
