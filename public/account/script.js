import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, query, where, getDocs, addDoc, doc, deleteDoc, onSnapshot } from "firebase/firestore";
import { initializeApp } from "firebase/app";

// Инициализация Firebase
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const profileUserId = urlParams.get('userId');
    let currentUserId = null;
    let currentUsername = null;
    let myMap = null;
    let markers = [];

    // Проверка аутентификации
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUserId = user.uid;
            currentUsername = user.displayName || user.email;
            document.getElementById('profileButton').textContent = currentUsername;
            document.getElementById('logoutButton').addEventListener('click', () => {
                auth.signOut().then(() => window.location.href = '/login.html');
            });
            initMap();
        } else {
            window.location.href = '/login.html';
        }
    });

    // Инициализация карты
    function initMap() {
        ymaps.ready(() => {
            myMap = new ymaps.Map("map", {
                center: [55.76, 37.64],
                zoom: 10,
                controls: ['zoomControl']
            });

            // Проверка прав доступа
            if (profileUserId && profileUserId !== currentUserId) {
                document.getElementById('addMarker').style.display = 'none';
                document.getElementById('markerList').style.display = 'none';
                document.getElementById('removeMarker').style.display = 'none';
                document.querySelector('h2').textContent = `Карта пользователя ${profileUserId}`;
            } else {
                // Добавление метки по клику
                myMap.events.add('click', function(e) {
                    showMarkerForm(e.get('coords'));
                });
            }

            setupRealtimeMarkers();
        });
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

        document.getElementById('submitMarker').addEventListener('click', async function() {
            const name = document.getElementById('markerName').value.trim();
            const description = document.getElementById('markerDesc').value.trim();
            const emoji = document.getElementById('markerEmoji').value;

            if (!name) {
                alert('Пожалуйста, укажите название метки');
                return;
            }

            try {
                await addMarkerToFirestore(coords, name, description, emoji);
                document.body.removeChild(form);
            } catch (error) {
                console.error('Ошибка:', error);
                alert('Не удалось добавить метку');
            }
        });

        document.getElementById('cancelMarker').addEventListener('click', function() {
            document.body.removeChild(form);
        });
    }

    // Настройка реального обновления меток
    function setupRealtimeMarkers() {
        const userIdToLoad = profileUserId || currentUserId;
        if (!userIdToLoad) return;

        const q = query(
            collection(db, "markers"),
            where("userId", "==", userIdToLoad)
        );

        onSnapshot(q, (snapshot) => {
            markers = [];
            snapshot.forEach((doc) => {
                markers.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            refreshMapMarkers();
            updateMarkerList();
        });
    }

    // Добавление метки в Firestore
    async function addMarkerToFirestore(coords, name, description, emoji) {
        try {
            await addDoc(collection(db, "markers"), {
                userId: currentUserId,
                username: currentUsername,
                lat: coords[0],
                lng: coords[1],
                name,
                description,
                emoji,
                createdAt: new Date()
            });
        } catch (error) {
            console.error("Ошибка добавления метки:", error);
            throw error;
        }
    }

    // Удаление метки из Firestore
    async function removeMarkerFromFirestore(markerId) {
        try {
            await deleteDoc(doc(db, "markers", markerId));
            return true;
        } catch (error) {
            console.error("Ошибка удаления метки:", error);
            return false;
        }
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
                    balloonContentFooter: `Добавлено: ${marker.username}`,
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

    // Обновление списка меток
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

    // Обработчик кнопки удаления
    const removeBtn = document.getElementById('removeMarker');
    if (removeBtn) {
        removeBtn.addEventListener('click', function() {
            const select = document.getElementById('markerList');
            const markerId = select.value;

            if (markerId && confirm('Вы уверены, что хотите удалить эту метку?')) {
                removeMarkerFromFirestore(markerId);
            }
        });
    }
});