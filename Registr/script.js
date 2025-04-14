document.getElementById('registrationForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (password !== confirmPassword) {
        alert('Пароли не совпадают!');
        return;
    }

    // Определяем базовый URL в зависимости от окружения
    const BASE_URL = window.location.hostname === 'localhost' ?
        'http://localhost:5000' :
        'https://your-backend-server.com'; // Замените на реальный URL вашего API

    try {
        // 1. Регистрация
        const response = await fetch(`${BASE_URL}/api/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, email, password }),
        });

        const data = await response.json();
        alert(data.message);

        // 2. Автоматический вход после регистрации
        if (response.ok) {
            const loginResponse = await fetch(`${BASE_URL}/api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const loginData = await loginResponse.json();

            if (loginResponse.ok) {
                // Сохраняем данные
                localStorage.setItem('token', loginData.token);
                localStorage.setItem('username', loginData.username);

                // Перенаправляем (используем относительный путь)
                window.location.href = '/Main-2/index.html';
            }
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при регистрации');
    }
});