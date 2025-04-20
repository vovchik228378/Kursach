// Инициализация Supabase
const supabaseUrl = 'https://mxdddbkfyugyyzabfqor.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14ZGRkYmtmeXVneXl6YWJmcW9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwOTY3NzMsImV4cCI6MjA2MDY3Mjc3M30.zNoJad5-R0mTP95yz-2_0j-Lj6-eNy4S89ciQ7BZWmQ'
const supabase = supabase.createClient(supabaseUrl, supabaseKey)

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
        alert('Не удалось загрузить метки');
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
        const { data, error } = await supabase
            .from('markers')
            .insert([{
                user_id: currentUser.id,
                lat: coords[0],
                lng: coords[1],
                name,
                description,
                emoji
            }])
            .select();

        if (error) throw error;

        // Добавляем новую метку на карту
        if (data && data.length > 0) {
            addMarkerToMap(data[0]);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Ошибка добавления метки:', error);
        alert('Не удалось добавить метку');
        return false;
    }
}

// Функция показа формы добавления метки
function showMarkerForm(coords) {
    // Создаем форму
    const formHtml = `
        <div class="marker-form-overlay">
            <div class="marker-form">
                <h3>Добавить новую метку</h3>
                <input type="text" id="markerName" placeholder="Название метки" required>
                <textarea id="markerDescription" placeholder="Описание"></textarea>
                <select id="markerEmoji">
                    <option value="📍">📍 - По умолчанию</option>
                    <option value="home">🏠 - Дом</option>
                    <option value="work">💼 - Работа</option>
                    <option value="favorite">❤️ - Любимое место</option>
                </select>
                <div class="form-buttons">
                    <button id="cancelMarker" class="button button-cancel">Отмена</button>
                    <button id="saveMarker" class="button">Сохранить</button>
                </div>
            </div>
        </div>
    `;

    // Добавляем форму в DOM
    document.body.insertAdjacentHTML('beforeend', formHtml);

    // Обработчики событий
    document.getElementById('cancelMarker').addEventListener('click', () => {
        document.querySelector('.marker-form-overlay').remove();
    });

    document.getElementById('saveMarker').addEventListener('click', async() => {
        const name = document.getElementById('markerName').value.trim();
        const description = document.getElementById('markerDescription').value.trim();
        const emoji = document.getElementById('markerEmoji').value;

        if (!name) {
            alert('Введите название метки');
            return;
        }

        const success = await addNewMarker(coords, name, description, emoji);
        if (success) {
            document.querySelector('.marker-form-overlay').remove();
        }
    });
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