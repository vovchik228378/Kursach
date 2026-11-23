/** Общие типы для обоих реализаций карты (Яндекс и OpenStreetMap). */

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  title: string;
  color: string;
}

export interface MapCanvasProps {
  markers: MapPin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMapClick?: (coords: [number, number]) => void;
  crosshair?: boolean;
}
