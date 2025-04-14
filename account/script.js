document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const profileUsername = urlParams.get('username');
    const currentUsername = localStorage.getItem('username');
    const token = localStorage.getItem('token');

    // Проверка прав доступа
    if (profileUsername && profileUsername !== currentUsername) {
        document.getElementById('addMarker').style.display = 'none';
        document.getElementById('markerList').style.display = 'none';
        document.getElementById('removeMarker').style.display = 'none';
        document.querySelector('h2').textContent = `Карта пользователя ${profileUsername}`;
    }

    // Инициализация карты
    ymaps.ready(init);

    let myMap;
    let markers = [];

    function init() {
        myMap = new ymaps.Map("map", {
            center: [55.76, 37.64],
            zoom: 10,
            controls: ['zoomControl']
        });

        // Добавление метки по клику
        if (!profileUsername || profileUsername === currentUsername) {
            myMap.events.add('click', function(e) {
                showMarkerForm(e.get('coords'));
            });
        }

        loadMarkers();
    }

    // Форма добавления метки
    function showMarkerForm(coords) {
        const form = document.createElement('div');
        form.className = 'marker-form-overlay';
        form.innerHTML = `
            <div class="marker-form">
                <h3>Добавить метку</h3>
                <input type="text" id="markerName" placeholder="Название метки*" required>
                <textarea id="markerDesc" placeholder="Описание"></textarea>
                <select id="markerEmoji">
                    <option value="👍">👍 Нравится</option>
                    <option value="👎">👎 Не нравится</option>
                    <option value="❤️">❤️ Любимое место</option>
                    <option value="😊">😊 Приятное место</option>
                    <option value="🍽️">🍽️ Место для еды</option>
                    <option value="🏠">🏠 Дом</option>
                    <option value="🏢">🏢 Работа</option>
                </select>
                <div class="form-buttons">
                    <button id="submitMarker" class="button">Добавить</button>
                    <button id="cancelMarker" class="button button-cancel">Отмена</button>
                </div>
            </div>
        `;

        document.body.appendChild(form);

        // Обработчики событий формы
        document.getElementById('submitMarker').addEventListener('click', async function() {
            const name = document.getElementById('markerName').value.trim();
            const description = document.getElementById('markerDesc').value.trim();
            const emoji = document.getElementById('markerEmoji').value;

            if (!name) {
                alert('Пожалуйста, укажите название метки');
                return;
            }

            try {
                await addMarkerToServer(coords, name, description, emoji);
                document.body.removeChild(form);
            } catch (error) {
                console.error('Ошибка:', error);
            }
        });

        document.getElementById('cancelMarker').addEventListener('click', function() {
            document.body.removeChild(form);
        });
    }

    // Загрузка меток с сервера
    async function loadMarkers() {
        try {
            const username = profileUsername || currentUsername;
            if (!username || !token) return;

            const response = await fetch(`/api/markers?username=${encodeURIComponent(username)}`, { //Тут
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`Ошибка HTTP: ${response.status}`);
            }

            markers = await response.json();
            refreshMapMarkers();
            updateMarkerList();
        } catch (error) {
            console.error('Ошибка загрузки меток:', error);
            alert('Не удалось загрузить метки. Проверьте консоль для подробностей.');
        }
    }

    // Добавление метки на сервер
    async function addMarkerToServer(coords, name, description, emoji) {
        try {
            const response = await fetch('/api/markers/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    lat: coords[0],
                    lng: coords[1],
                    name: name,
                    description: description,
                    emoji: emoji
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Ошибка при добавлении метки');
            }

            // Добавляем новую метку в массив
            markers.unshift(data.marker);
            refreshMapMarkers();
            updateMarkerList();

            return data.marker;

        } catch (error) {
            console.error('Ошибка добавления метки:', error);
            alert('Не удалось добавить метку: ' + error.message);
            throw error;
        }
    }

    // Удаление метки
    async function removeMarkerFromServer(markerId) {
        try {
            const response = await fetch(`/api/markers/delete/${markerId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Ошибка при удалении метки');
            }

            // Удаляем метку из массива
            markers = markers.filter(marker => marker.id != markerId);
            refreshMapMarkers();
            updateMarkerList();

            alert('Метка успешно удалена');

        } catch (error) {
            console.error('Ошибка удаления метки:', error);
            alert('Не удалось удалить метку: ' + error.message);
        }
    }

    // Обновление списка меток в select
    function updateMarkerList() {
        const select = document.getElementById('markerList');
        if (!select) return;

        select.innerHTML = '<option value="">Выберите метку для удаления</option>';

        markers.forEach(marker => {
            const option = document.createElement('option');
            option.value = marker.id;
            option.textContent = `${marker.name} ${marker.emoji || ''}`;
            select.appendChild(option);
        });
    }

    // Обновление меток на карте
    function refreshMapMarkers() {
        if (!myMap) return;

        myMap.geoObjects.removeAll();

        markers.forEach(marker => {
            const placemark = new ymaps.Placemark(
                [marker.lat, marker.lng], {
                    balloonContentHeader: `<strong>${marker.name}</strong> ${marker.emoji || ''}`,
                    balloonContentBody: marker.description || '',
                    balloonContentFooter: `Добавлено: ${marker.username || currentUsername}`,
                    hintContent: marker.name
                }, {
                    preset: marker.emoji ? 'islands#' + marker.emoji + 'CircleIcon' : 'islands#blueCircleIcon',
                    balloonCloseButton: true,
                    hideIconOnBalloonOpen: false
                }
            );

            myMap.geoObjects.add(placemark);
        });
    }

    // Обработчик кнопки удаления
    const removeBtn = document.getElementById('removeMarker');
    if (removeBtn) {
        removeBtn.addEventListener('click', function() {
            const select = document.getElementById('markerList');
            const markerId = select.value;

            if (markerId && confirm('Вы уверены, что хотите удалить эту метку?')) {
                removeMarkerFromServer(markerId);
            }
        });
    }

    // Автоматическое обновление меток каждые 30 секунд
    setInterval(() => {
        if (document.visibilityState === 'visible') {
            loadMarkers();
        }
    }, 30000);
});