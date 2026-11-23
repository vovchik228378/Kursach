/**
 * Загрузчик Яндекс.Карт 2.1.
 *
 * Скрипт подключается один раз на всё приложение: повторные вызовы
 * переиспользуют уже загруженный API, а не создают второй экземпляр карты
 * (иначе Яндекс ругается на дублирование загрузки).
 */

declare global {
  interface Window {
    ymaps?: any;
  }
}

const API_KEY = import.meta.env.VITE_YANDEX_MAPS_KEY ?? '';

let loadPromise: Promise<any> | null = null;

export function loadYmaps(): Promise<any> {
  if (!API_KEY) {
    return Promise.reject(
      new Error(
        'Не задан ключ Яндекс.Карт. Получите его в кабинете разработчика и укажите VITE_YANDEX_MAPS_KEY в app/.env.local.'
      )
    );
  }

  if (window.ymaps && typeof window.ymaps.ready === 'function') {
    return window.ymaps.ready().then(() => window.ymaps);
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise<any>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(API_KEY)}&lang=ru_RU`;
    script.async = true;

    script.onload = () => {
      const ymaps = window.ymaps;
      if (!ymaps) {
        reject(new Error('API Яндекс.Карт загрузилось, но объект ymaps недоступен'));
        return;
      }
      ymaps.ready(() => resolve(ymaps));
    };

    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Не удалось загрузить API Яндекс.Карт. Проверьте интернет и ключ API.'));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}
