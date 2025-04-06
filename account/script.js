document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const profileUsername = urlParams.get('username');
    const currentUsername = localStorage.getItem('username');

    if (profileUsername && profileUsername !== currentUsername) {
        document.getElementById('addMarker').style.display = 'none';
        document.getElementById('markerList').style.display = 'none';
        document.getElementById('removeMarker').style.display = 'none';
        document.querySelector('h2').textContent = `Карта пользователя ${profileUsername}`;
    }

    ymaps.ready(init);

    let myMap;
    let markers = [];

    function init() {
        myMap = new ymaps.Map("map", {
            center: [55.76, 37.64],
            zoom: 10
        });

        // Добавление метки по клику
        myMap.events.add('click', function(e) {
            if (!profileUsername || profileUsername === currentUsername) {
                showMarkerForm(e.get('coords'));
            }
        });

        loadMarkers();
    }

    function showMarkerForm(coords) {
        const form = document.createElement('div');
        form.innerHTML = `
            <div class="marker-form">
                <h3>Добавить метку</h3>
                <input type="text" id="markerName" placeholder="Название метки">
                <textarea id="markerDesc" placeholder="Описание"></textarea>
                <select id="markerEmoji">
                    <option value="👍">👍 Нравится</option>
                    <option value="👎">👎 Не нравится</option>
                    <option value="❤️">❤️ Любимое место</option>
                    <option value="😊">😊 Приятное место</option>
                    <option value="🍽️">🍽️ Место для еды</option>
                </select>
                <button id="submitMarker" class="button">Добавить</button>
                <button id="cancelMarker" class="button">Отмена</button>
            </div>
        `;

        document.body.appendChild(form);

        document.getElementById('submitMarker').addEventListener('click', function() {
            const name = document.getElementById('markerName').value;
            const description = document.getElementById('markerDesc').value;
            const emoji = document.getElementById('markerEmoji').value;

            if (name) {
                addMarkerToServer(coords, name, description, emoji);
                document.body.removeChild(form);
            } else {
                alert('Пожалуйста, укажите название метки');
            }
        });

        document.getElementById('cancelMarker').addEventListener('click', function() {
            document.body.removeChild(form);
        });
    }

    async function loadMarkers() {
        try {
            const username = profileUsername || currentUsername;
            if (!username) return;

            const response = await fetch(`/api/markers?username=${username}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const data = await response.json();
            markers = data;
            refreshMapMarkers();
            updateMarkerList();
        } catch (error) {
            console.error('Ошибка:', error);
        }
    }

    async function addMarkerToServer(coords, name, description, emoji) {
        try {
            const response = await fetch('/api/markers/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    lat: coords[0],
                    lng: coords[1],
                    name,
                    description,
                    emoji
                })
            });

            if (response.ok) {
                loadMarkers();
            } else {
                console.error('Ошибка при добавлении метки');
            }
        } catch (error) {
            console.error('Ошибка:', error);
        }
    }

    async function removeMarkerFromServer(markerId) {
        try {
            const response = await fetch(`/api/markers/delete/${markerId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                loadMarkers();
            }
        } catch (error) {
            console.error('Ошибка:', error);
        }
    }

    function updateMarkerList() {
        const select = document.getElementById('markerList');
        select.innerHTML = '<option value="">Выберите метку для удаления</option>';

        markers.forEach((marker, index) => {
            const option = document.createElement('option');
            option.value = marker.id;
            option.text = `${marker.name} ${marker.emoji || ''}`;
            select.appendChild(option);
        });
    }

    function refreshMapMarkers() {
        myMap.geoObjects.removeAll();

        markers.forEach(marker => {
            const placemark = new ymaps.Placemark(
                [marker.lat, marker.lng], {
                    balloonContent: `
                        <h3>${marker.name} ${marker.emoji || ''}</h3>
                        <p>${marker.description || ''}</p>
                        <small>Добавлено пользователем: ${marker.username || 'неизвестно'}</small>
                    `,
                    iconCaption: marker.name
                }, {
                    preset: marker.emoji ? 'islands#' + marker.emoji + 'CircleIcon' : 'islands#blueCircleIcon'
                }
            );

            myMap.geoObjects.add(placemark);
        });
    }

    document.getElementById('removeMarker').addEventListener('click', function() {
        const select = document.getElementById('markerList');
        const markerId = select.value;

        if (markerId) {
            removeMarkerFromServer(markerId);
        }
    });
});