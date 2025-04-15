document.getElementById('loginForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // Определяем базовый URL API в зависимости от окружения
    const API_BASE_URL = window.location.hostname === 'localhost' ?
        'http://localhost:5000' :
        'https://vovchik228378.github.io/'; // Замените на реальный URL вашего API

    try {
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();
        alert(data.message);

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.username);

            // Используем абсолютный путь с учетом структуры репозитория
            window.location.href = '/Kursach/Main-2/index.html';
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при входе');
    }
});