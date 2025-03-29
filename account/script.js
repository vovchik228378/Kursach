document.addEventListener('DOMContentLoaded', function() {
    // Получаем username из URL
    const urlParams = new URLSearchParams(window.location.search);
    const profileUsername = urlParams.get('username');
    const currentUsername = localStorage.getItem('username');

    // Если просматриваем чужой профиль, блокируем функционал
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

        loadMarkers();
    }

    async function loadMarkers() {
        try {
            const username = new URLSearchParams(window.location.search).get('username') ||
                localStorage.getItem('username');

            const response = await fetch(`/api/markers?username=${username}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const data = await response.json();
            markers = data;
            refreshMapMarkers();
        } catch (error) {
            console.error('Ошибка:', error);
        }
    }

    // Остальные функции остаются без изменений
    // ... (addMarkerToServer, removeMarkerFromServer и т.д.)
});