import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
import { initializeApp } from "firebase/app";

// Инициализация Firebase (должна совпадать с инициализацией в других файлах)
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

document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    const resultsDiv = document.getElementById('results');
    let currentUserId = null;

    // Проверка аутентификации
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUserId = user.uid;
            document.getElementById('profileButton').textContent = user.displayName || user.email;
            document.getElementById('profileButton').onclick = () => {
                window.location.href = '/account/index.html';
            };
        } else {
            window.location.href = '/login.html';
        }
    });

    const searchUsers = async() => {
        const queryText = searchInput.value.trim();
        if (!queryText) return;

        try {
            // Поиск пользователей в Firestore
            const usersRef = collection(db, "users");
            const q = query(
                usersRef,
                where("username", ">=", queryText),
                where("username", "<=", queryText + "\uf8ff")
            );

            const querySnapshot = await getDocs(q);
            const users = [];

            querySnapshot.forEach((doc) => {
                if (doc.id !== currentUserId) { // Исключаем текущего пользователя
                    users.push({
                        id: doc.id,
                        username: doc.data().username
                    });
                }
            });

            displayResults(users);
        } catch (error) {
            console.error("Ошибка поиска:", error);
            resultsDiv.innerHTML = `<div class="error">Ошибка при поиске пользователей</div>`;
        }
    };

    const displayResults = (users) => {
        if (users.length === 0) {
            resultsDiv.innerHTML = '<div class="no-results">Ничего не найдено</div>';
            return;
        }

        resultsDiv.innerHTML = users.map(user => `
            <div class="user-card" data-userid="${user.id}">
                <span class="username clickable">${user.username}</span>
            </div>
        `).join('');

        // Обработчики клика
        document.querySelectorAll('.clickable').forEach(el => {
            el.addEventListener('click', (e) => {
                const userId = e.target.closest('.user-card').getAttribute('data-userid');
                window.location.href = `/account/index.html?userId=${userId}`;
            });
        });
    };

    searchBtn.addEventListener('click', searchUsers);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchUsers();
    });
});