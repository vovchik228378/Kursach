// Глобальные переменные
let map;
let currentUser;

// Функция загрузки меток пользователя
async function loadUserMarkers(userId) {
    try {
        const { data: markers, error } = await supabase
            .from('markers')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Очищаем карту перед загрузкой новых меток
        map.geoObjects.removeAll();

        if (markers && markers.length > 0) {
            markers.forEach(addMarkerToMap);

            // Автоматически подстраиваем карту под метки
            const bounds = map.geoObjects.getBounds();
            if (bounds) {
                map.setBounds(bounds, { checkZoomRange: true });
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки меток:', error);
    }
}

// Функция добавления метки на карту
function addMarkerToMap(marker) {
    const placemark = new ymaps.Placemark(
        [marker.lat, marker.lng], {
            balloonContentHeader: `<strong>${marker.name}</strong> ${marker.emoji || ''}`,
            balloonContentBody: marker.description || '',
            hintContent: marker.name
        }, {
            preset: marker.emoji ? 'islands#' + marker.emoji + 'CircleIcon' : 'islands#blueCircleIcon',
            balloonCloseButton: true
        }
    );

    map.geoObjects.add(placemark);
}

// Функция добавления новой метки
async function addNewMarker(coords, name, description, emoji = '📍') {
    try {
        const { error } = await supabase
            .from('markers')
            .insert([{
                user_id: currentUser.id,
                lat: coords[0],
                lng: coords[1],
                name,
                description,
                emoji
            }]);

        if (error) throw error;

        return true;
    } catch (error) {
        console.error('Ошибка добавления метки:', error);
        return false;
    }
}

// Функция показа формы добавления метки
function showMarkerForm(coords) {
    // Реализуйте вашу форму добавления метки
    // При подтверждении вызывайте addNewMarker()
}

// Инициализация карты и приложения
document.addEventListener('DOMContentLoaded', async() => {
    try {
        // Получаем текущего пользователя
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
            window.location.href = '/login/login.html';
            return;
        }

        currentUser = user;

        // Инициализация Яндекс.Карт
        ymaps.ready(() => {
            map = new ymaps.Map("map", {
                center: [55.76, 37.64],
                zoom: 10,
                controls: ['zoomControl']
            });

            // Загружаем метки пользователя
            loadUserMarkers(user.id);

            // Если это текущий пользователь - разрешаем добавление меток
            const urlParams = new URLSearchParams(window.location.search);
            const profileUserId = urlParams.get('userId');

            if (!profileUserId || profileUserId === user.id) {
                map.events.add('click', (e) => {
                    const coords = e.get('coords');
                    showMarkerForm(coords);
                });
            }
        });
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        window.location.href = '/login/login.html';
    }
});