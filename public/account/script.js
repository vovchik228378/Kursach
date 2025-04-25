// Глобальные переменные
let map;
let currentUser = null; // Храним объект пользователя
let profileUserId = null; // ID пользователя, чей профиль просматриваем
let canAddMarkers = false; // Флаг, можно ли добавлять метки на текущей карте
const userMarkersMap = new Map(); // Map для меток текущего пользователя

// Функция инициализации страницы аккаунта
async function initAccountPage() {
    try {
        // 1. Проверка авторизации
        const {
            data: {
                session
            },
            error: sessionError
        } = await window.supabase.auth.getSession();
        if (sessionError) throw new Error(`Ошибка получения сессии: ${sessionError.message}`);
        if (!session) {
            window.location.href = '/login/'; // Перенаправляем на страницу входа
            return;
        }
        currentUser = session.user; // Сохраняем текущего пользователя

        // 2. Определяем, чей профиль смотрим
        const urlParams = new URLSearchParams(window.location.search);
        profileUserId = urlParams.get('userId') || currentUser.id; // Либо из URL, либо свой ID

        // 3. Получаем данные пользователя (имя)
        const {
            data: userData,
            error: userError
        } = await window.supabase
            .from('users')
            .select('username')
            .eq('id', profileUserId) // Загружаем данные для просматриваемого профиля
            .single();
        if (userError && userError.code !== 'PGRST116') { // Игнорируем ошибку "не найдено", если пользователь только что зарег-ся
            console.error("Ошибка получения данных пользователя:", userError);
            // Можно показать сообщение об ошибке
        }

        // 4. Отображаем имя пользователя и настраиваем заголовок карты
        const usernameDisplay = document.getElementById('usernameDisplay');
        const mapTitle = document.getElementById('mapTitle');
        // ИСПРАВЛЕННАЯ СТРОКА 43: УБРАНЫ ПРОБЕЛ И ЛИШНЯЯ ТОЧКА ПОСЛЕ ?
        const profileUsername = userData?.username || `Пользователь ${profileUserId.substring(0, 6)}...`; // Используем username или часть ID


        if (profileUserId === currentUser.id) {
            usernameDisplay.textContent = `Вы вошли как: ${profileUsername}`;
            mapTitle.textContent = 'Моя карта (личные метки)';
            canAddMarkers = true; // Разрешаем добавление меток на своей карте
            document.getElementById('addMarkerInfo').style.display = 'block'; // Показываем подсказку
        } else {
            usernameDisplay.textContent = `Просмотр профиля: ${profileUsername}`;
            mapTitle.textContent = `Карта пользователя ${profileUsername}`;
            canAddMarkers = false; // Запрещаем добавление меток на чужой карте
            document.getElementById('addMarkerInfo').style.display = 'none'; // Скрываем подсказку
        }

        // 5. Настраиваем кнопку выхода
        document.getElementById('logoutButton').addEventListener('click', async() => {
            const {
                error
            } = await window.supabase.auth.signOut();
            if (error) {
                console.error('Ошибка выхода:', error);
                alert('Не удалось выйти.');
            } else {
                window.location.href = '/'; // Перенаправляем на главную после выхода
            }
        });
        // 6. Инициализация Яндекс.Карт
        await ymaps.ready();
        map = new ymaps.Map("map", {
            center: [55.76, 37.64],
            zoom: 10,
            controls: ['zoomControl', 'fullscreenControl', 'geolocationControl'] // Добавлены контроли
        });
        // Убираем сообщение о загрузке
        const loadingIndicator = document.getElementById('map-loading');
        if (loadingIndicator) loadingIndicator.remove();
        // 7. Загрузка меток пользователя
        await loadUserMarkers(profileUserId);
        // 8. Добавляем обработчик клика для создания метки (только если можно)
        if (canAddMarkers) {
            map.events.add('click', (e) => {
                const coords = e.get('coords');
                showMarkerForm(coords);
            });
        }

        // 9. Подписка на realtime обновления (опционально, если нужна для личной карты)
        setupUserRealtimeUpdates(profileUserId);
        console.log('Страница аккаунта успешно инициализирована.');

    } catch (error) {
        console.error('Ошибка инициализации страницы аккаунта:', error);
        // Показываем ошибку пользователю или редиректим
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
            mapContainer.innerHTML = `<div style="color: red; text-align: center; padding-top: 50px;">Ошибка загрузки профиля: ${error.message}.
            <a href="/">На главную</a></div>`;
        }
        // window.location.href = '/login/'; // Или редирект на логин
    }
}

// Функция загрузки меток конкретного пользователя
async function loadUserMarkers(userId) {
    if (!map) {
        console.warn("Карта еще не готова для загрузки меток.");
        return;
    }
    console.log(`Загрузка меток для пользователя ${userId}...`);
    try {
        const {
            data: markers,
            error
        } = await window.supabase
            .from('markers')
            .select('*') // Здесь join не нужен, т.к. все метки одного пользователя
            .eq('user_id', userId)
            .order('created_at', {
                ascending: false
            });
        if (error) throw error;

        console.log(`Загружено ${markers.length} меток пользователя.`);

        // Очищаем старые метки
        map.geoObjects.removeAll();
        userMarkersMap.clear();

        // Добавляем новые метки
        markers.forEach(addMarkerToUserMap);
        // Центрируем карту по меткам пользователя
        if (markers.length > 0) {
            const bounds = map.geoObjects.getBounds();
            if (bounds) {
                map.setBounds(bounds, {
                    checkZoomRange: true,
                    zoomMargin: 30
                });
            }
        } else {
            console.log("У этого пользователя нет меток.");
            // Можно показать сообщение на карте или установить центр
            map.setCenter([55.76, 37.64], 10);
        }
    } catch (error) {
        console.error('Ошибка загрузки меток пользователя:', error);
        alert(`Не удалось загрузить метки: ${error.message}`);
    }
}


// Функция добавления метки на ЛИЧНУЮ карту
function addMarkerToUserMap(marker) {
    if (!map || !marker || !marker.lat || !marker.lng) {
        console.warn("Невозможно добавить метку на карту пользователя: отсутствуют данные или карта не готова.", marker);
        return;
    }
    if (userMarkersMap.has(marker.id)) return; // Проверка дубликатов

    const placemark = new ymaps.Placemark(
        [marker.lat, marker.lng], {
            balloonContentHeader: `<strong>${marker.name || 'Без названия'}</strong>`,
            balloonContentBody: `Описание: ${marker.description || '-'}`, // Имя пользователя не нужно, т.к. это его карта
            hintContent: marker.name || 'Метка'
        }, {
            preset: `islands#${marker.emoji || 'geolocation'}Icon`, // Используем emoji как часть пресета
            iconColor: getMarkerColor(marker.emoji), // Цвет иконки
            draggable: canAddMarkers, // Разрешаем перетаскивать только свои метки
            balloonCloseButton: true
        }
    );
    // Если метку можно редактировать (своя метка)
    if (canAddMarkers) {
        // Добавляем кнопку удаления в балун
        placemark.properties.set('balloonContentFooter',
            `<button class="button-delete-marker" data-marker-id="${marker.id}">Удалить метку</button>`
        );
        // Обработчик перетаскивания
        placemark.events.add('dragend', async(e) => {
            const newCoords = e.get('target').geometry.getCoordinates();
            console.log(`Метка ${marker.id} перетащена в:`, newCoords);
            await updateMarkerCoords(marker.id, newCoords);
        });
    }

    map.geoObjects.add(placemark);
    userMarkersMap.set(marker.id, placemark);
    console.log(`Добавлена метка ${marker.id} на карту пользователя.`);
}

// Функция для определения цвета иконки (такая же, как в main/script.js)
function getMarkerColor(emoji) {
    switch (emoji) {
        case 'home':
            return '#FF0000';
        case 'work':
            return '#0000FF';
        case 'favorite':
            return '#FF00FF';
            // Заменен redHeart на favorite для соответствия CSS/HTML
        default:
            return '#1E98FF';
    }
}

// Удаление метки с карты пользователя
function removeMarkerFromUserMap(markerId) {
    if (userMarkersMap.has(markerId)) {
        map.geoObjects.remove(userMarkersMap.get(markerId));
        userMarkersMap.delete(markerId);
        console.log(`Удалена метка ${markerId} с карты пользователя.`);
    }
}

// Обработчик клика на кнопку "Удалить метку" в балуне
document.addEventListener('click', async(event) => {
    if (event.target.classList.contains('button-delete-marker')) {
        const markerId = event.target.getAttribute('data-marker-id');
        if (confirm('Вы уверены, что хотите удалить эту метку?')) {
            await deleteMarker(markerId);
        }
    }
});
// Функция обновления координат метки в БД
async function updateMarkerCoords(markerId, coords) {
    try {
        const {
            error
        } = await window.supabase
            .from('markers')
            .update({
                lat: coords[0],
                lng: coords[1]
            })
            .eq('id', markerId)
            .eq('user_id', currentUser.id); // Убедимся, что обновляем свою метку

        if (error) throw error;
        console.log(`Координаты метки ${markerId} обновлены.`);
    } catch (error) {
        console.error(`Ошибка обновления координат метки ${markerId}:`, error);
        alert('Не удалось обновить позицию метки.');
        // Можно вернуть метку на старое место или перезагрузить
        // loadUserMarkers(currentUser.id);
    }
}


// Функция удаления метки из БД
async function deleteMarker(markerId) {
    try {
        // Закрываем балун, если он открыт для этой метки
        if (map.balloon.isOpen() && map.balloon.getData()?.properties?.get('markerId') === markerId) {
            map.balloon.close();
        }

        const {
            error
        } = await window.supabase
            .from('markers')
            .delete()
            .eq('id', markerId)
            .eq('user_id', currentUser.id); // Убедимся, что удаляем свою метку

        if (error) throw error;

        removeMarkerFromUserMap(markerId); // Удаляем с карты немедленно
        console.log(`Метка ${markerId} удалена из БД.`);
        alert('Метка успешно удалена.');
    } catch (error) {
        console.error('Ошибка удаления метки:', error);
        alert(`Не удалось удалить метку: ${error.message}`);
    }
}


// Функция добавления НОВОЙ метки в БД
async function addNewMarker(coords, name, description, emoji = 'geolocation') {
    if (!currentUser) {
        alert("Ошибка: пользователь не определен.");
        return false;
    }
    try {
        const {
            data,
            error
        } = await window.supabase
            .from('markers')
            .insert([{
                user_id: currentUser.id,
                lat: coords[0],
                lng: coords[1],
                name: name,
                description: description,
                emoji: emoji // Сохраняем значение типа 'home', 'work'
            }])
            .select() // Возвращаем добавленную запись
            .single(); // Ожидаем одну запись

        if (error) throw error;
        if (data) {
            // addMarkerToUserMap(data); // Метка добавится через realtime, если он включен
            console.log('Новая метка успешно добавлена в БД:', data);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Ошибка добавления метки:', error);
        alert(`Не удалось добавить метку: ${error.message}`);
        return false;
    }
}

// Функция показа формы добавления метки
function showMarkerForm(coords) {
    // Удаляем предыдущую форму, если она есть
    const existingForm = document.querySelector('.marker-form-overlay');
    if (existingForm) existingForm.remove();

    const formHtml = `
        <div class="marker-form-overlay">
            <div class="marker-form">
                <h3>Добавить новую метку</h3>
                <p>Координаты: ${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}</p>
                <input type="text" id="markerName" placeholder="Название метки (обязательно)" required>
                <textarea id="markerDescription" placeholder="Описание (необязательно)"></textarea>
                <select id="markerEmoji">
                    <option value="geolocation">📍 По умолчанию</option>
                    <option value="home">🏠 Дом</option>
                    <option value="work">💼 Работа</option>
                    <option value="favorite">❤️ Любимое место</option>
                    <option value="star">⭐ Важное</option>
                    <option value="shopping">🛒 Магазин</option>
                </select>
                <div class="form-buttons">
                    <button type="button" id="cancelMarker" class="button button-cancel">Отмена</button>
                    <button type="button" id="saveMarker" class="button">Сохранить</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', formHtml);

    // Фокус на поле названия
    document.getElementById('markerName').focus();
    // Обработчик отмены
    document.getElementById('cancelMarker').addEventListener('click', () => {
        document.querySelector('.marker-form-overlay').remove();
    });
    // Обработчик сохранения
    document.getElementById('saveMarker').addEventListener('click', async() => {
        const nameInput = document.getElementById('markerName');
        const name = nameInput.value.trim();
        const description = document.getElementById('markerDescription').value.trim();
        const emoji = document.getElementById('markerEmoji').value;

        if (!name) {
            alert('Введите название метки!');
            nameInput.focus();
            return;
        }

        const saveButton = document.getElementById('saveMarker');
        saveButton.disabled = true;
        saveButton.textContent = 'Сохранение...';

        const success = await addNewMarker(coords, name, description, emoji);

        saveButton.disabled = false;
        saveButton.textContent = 'Сохранить';

        if (success) {
            document.querySelector('.marker-form-overlay').remove();
            alert('Метка успешно добавлена!');
            // Метка должна появиться через realtime или можно добавить вручную:
            // const { data: newMarkerData } = await ... // Повторный запрос или использование данных из addNewMarker
            // addMarkerToUserMap(newMarkerData);
        }
        // Сообщение об ошибке покажется в addNewMarker
    });
}

// Настройка Realtime для ЛИЧНОЙ карты (опционально)
function setupUserRealtimeUpdates(userIdToWatch) {
    console.log(`Настройка real-time для пользователя ${userIdToWatch}...`);
    const channel = window.supabase
        .channel(`public:markers:user=${userIdToWatch}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'markers',
            filter: `user_id=eq.${userIdToWatch}` // Слушаем изменения только для ЭТОГО пользователя
        }, (payload) => {
            console.log('Realtime событие (личная карта):', payload);
            if (payload.eventType === 'INSERT') {
                // Данные уже должны быть в payload.new
                addMarkerToUserMap(payload.new);
                // Можно центрировать карту по новой метке
                // map.setCenter([payload.new.lat, payload.new.lng]);
            } else if (payload.eventType === 'UPDATE') {
                removeMarkerFromUserMap(payload.old.id);
                addMarkerToUserMap(payload.new);
            } else if (payload.eventType === 'DELETE') {
                removeMarkerFromUserMap(payload.old.id);
            }

        })
        .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                console.log(`Успешно подписались на real-time для пользователя ${userIdToWatch}!`);
            } else {
                console.error(`Проблема с real-time подпиской для пользователя ${userIdToWatch}:`, status, err);
            }
        });
    return channel; // Можно сохранить для отписки
}


// Инициализация при загрузке DOM (через defer)
initAccountPage();