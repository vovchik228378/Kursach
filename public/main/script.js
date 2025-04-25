// Используем глобальный объект supabase, инициализированный в HTML
// const supabase = supabase.createClient(...) - УДАЛЕНО

let map;
const markersMap = new Map(); // Используем Map для удобного управления метками по ID

// Инициализация карты и загрузка меток
async function initMap() {
    try {
        await ymaps.ready(); // Дожидаемся готовности API Яндекс.Карт

        map = new ymaps.Map("map", {
            center: [55.76, 37.64], // Москва как центр по умолчанию
            zoom: 10,
            controls: ['zoomControl', 'typeSelector', 'fullscreenControl', 'geolocationControl'] // Добавлен контроль геолокации
        });

        // Убираем сообщение о загрузке
        const loadingIndicator = document.getElementById('map-loading');
        if (loadingIndicator) loadingIndicator.remove();

        // Загружаем метки (вызывается из checkAuthAndSetup в HTML)
        // await loadAllMarkers(); // Перенесено в HTML

        // Подписываемся на изменения в реальном времени
        setupRealtimeUpdates();

        console.log('Карта успешно инициализирована.');

    } catch (error) {
        console.error('Ошибка инициализации карты:', error);
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
            mapContainer.innerHTML = '<div style="color: red; text-align: center; padding-top: 50px;">Не удалось загрузить карту. Проверьте консоль разработчика.</div>';
        }
    }
}

// Загрузка ВСЕХ меток из базы данных
async function loadAllMarkers() {
    if (!map) {
        console.warn("Карта еще не готова для загрузки меток.");
        return;
    }
    console.log("Загрузка всех меток...");
    try {
        const { data: markersData, error } = await window.supabase
            .from('markers')
            .select(`
                *,
                users ( username )
             `) // Запрашиваем username из связанной таблицы users
            .order('created_at', { ascending: false });

        if (error) throw error;

        console.log(`Загружено ${markersData.length} меток.`);

        // Очищаем старые метки с карты и из Map
        map.geoObjects.removeAll();
        markersMap.clear();

        // Добавляем новые метки
        markersData.forEach(marker => {
            addMarkerToMap(marker);
        });

        // Автоматическое масштабирование под все метки, если они есть
        if (markersData.length > 0) {
            const bounds = map.geoObjects.getBounds();
            if (bounds) {
                // Устанавливаем границы с небольшим отступом
                map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 30 });
            }
        } else {
            // Если меток нет, можно установить центр по умолчанию или текущее местоположение
            // map.setCenter([55.76, 37.64], 10); // Пример
            console.log("Нет меток для отображения.");
        }

    } catch (error) {
        console.error('Ошибка загрузки меток:', error);
        alert(`Не удалось загрузить метки: ${error.message}`);
    }
}

// Настройка обновлений в реальном времени
function setupRealtimeUpdates() {
    console.log("Настройка real-time обновлений...");
    const channel = window.supabase
        .channel('public:markers') // Явно указываем схему public
        .on('postgres_changes', {
            event: '*', // Слушаем все события (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'markers'
        }, async(payload) => {
            console.log('Realtime событие:', payload);

            if (payload.eventType === 'INSERT') {
                // Нужен дополнительный запрос, чтобы получить username
                const { data: newMarker, error } = await window.supabase
                    .from('markers')
                    .select('*, users(username)')
                    .eq('id', payload.new.id)
                    .single();
                if (!error && newMarker) {
                    addMarkerToMap(newMarker);
                    // Обновляем границы карты, если нужно
                    // map.setBounds(map.geoObjects.getBounds(), { checkZoomRange: true, zoomMargin: 30 });
                } else {
                    console.error("Ошибка получения данных для новой метки:", error);
                }
            } else if (payload.eventType === 'UPDATE') {
                // Нужен дополнительный запрос, чтобы получить username
                const { data: updatedMarker, error } = await window.supabase
                    .from('markers')
                    .select('*, users(username)')
                    .eq('id', payload.new.id)
                    .single();

                if (!error && updatedMarker) {
                    removeMarkerFromMap(payload.old.id); // Удаляем старую
                    addMarkerToMap(updatedMarker); // Добавляем обновленную
                } else {
                    console.error("Ошибка получения данных для обновленной метки:", error);
                }

            } else if (payload.eventType === 'DELETE') {
                removeMarkerFromMap(payload.old.id);
                // Обновляем границы карты, если нужно
                // if (map.geoObjects.getBounds()) {
                //     map.setBounds(map.geoObjects.getBounds(), { checkZoomRange: true, zoomMargin: 30 });
                // }
            }
        })
        .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                console.log('Успешно подписались на real-time обновления!');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                console.error('Проблема с real-time подпиской:', status, err);
                // Можно попытаться переподключиться через некоторое время
            }
        });

    // Возвращаем канал, чтобы можно было отписаться при необходимости
    return channel;
}

// Добавление метки на карту
function addMarkerToMap(marker) {
    if (!map || !marker || !marker.lat || !marker.lng) {
        console.warn("Невозможно добавить метку: отсутствуют данные или карта не готова.", marker);
        return;
    }
    // Проверяем, нет ли уже такой метки на карте
    if (markersMap.has(marker.id)) {
        console.log(`Метка ${marker.id} уже на карте, пропускаем добавление.`);
        return;
    }

    const placemark = new ymaps.Placemark(
        [marker.lat, marker.lng], {
            // Используем данные из marker.users (полученные через join)
            balloonContentHeader: `<strong>${marker.name || 'Без названия'}</strong>`,
            balloonContentBody: `Описание: ${marker.description || '-'}<br>Добавил: ${marker.users?.username || 'Неизвестно'}`, // Безопасный доступ к username
            hintContent: marker.name || 'Метка'
        }, {
            // Формируем пресет иконки. Убедитесь, что emoji сохраняются как 'home', 'work' и т.д.
            preset: `islands#${marker.emoji || 'geolocation'}Icon`, // Пример: islands#homeIcon, islands#geolocationIcon
            // preset: 'islands#blueCircleDotIcon', // Альтернативный вариант иконки
            iconColor: getMarkerColor(marker.emoji), // Можно задать цвет иконки
            balloonCloseButton: true,
            hideIconOnBalloonOpen: false
        }
    );

    map.geoObjects.add(placemark);
    markersMap.set(marker.id, placemark); // Добавляем метку в Map
    console.log(`Добавлена метка ${marker.id}: ${marker.name}`);
}

// Функция для определения цвета иконки (пример)
function getMarkerColor(emoji) {
    switch (emoji) {
        case 'home':
            return '#FF0000'; // Красный для дома
        case 'work':
            return '#0000FF'; // Синий для работы
        case 'favorite':
            return '#FF00FF'; // Фиолетовый для любимого
        default:
            return '#1E98FF'; // Стандартный синий
    }
}


// Удаление метки с карты
function removeMarkerFromMap(markerId) {
    if (markersMap.has(markerId)) {
        map.geoObjects.remove(markersMap.get(markerId));
        markersMap.delete(markerId); // Удаляем из Map
        console.log(`Удалена метка ${markerId}`);
    } else {
        console.warn(`Попытка удалить несуществующую метку ${markerId}`);
    }
}

// Инициализация при загрузке DOM (теперь через defer в HTML)
// document.addEventListener('DOMContentLoaded', initMap); // УДАЛЕНО, т.к. defer и onload в body
// Запускаем инициализацию карты сразу
initMap();

// Глобальная функция для вызова из HTML (если понадобится)
window.loadAllMarkers = loadAllMarkers;