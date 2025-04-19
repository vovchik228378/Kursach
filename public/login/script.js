const firebaseConfig = {
    apiKey: "AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ12345678",
    authDomain: "your-project-id.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890abcdef"
};

// Инициализация Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();

// Обработка формы входа
document.getElementById('loginForm').addEventListener('submit', async(e) => {
    e.preventDefault();

    const email = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    // Валидация
    if (!email || !password) {
        showError('Заполните все поля');
        return;
    }

    try {
        // Показываем индикатор загрузки
        const submitBtn = document.querySelector('#loginForm button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Вход...';

        // Аутентификация
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Перенаправление
        window.location.href = '/account/index.html';
    } catch (error) {
        handleAuthError(error);
    } finally {
        // Восстанавливаем кнопку
        const submitBtn = document.querySelector('#loginForm button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Войти';
    }
});

// Обработчик ошибок
function handleAuthError(error) {
    let message = 'Ошибка входа';

    switch (error.code) {
        case 'auth/user-not-found':
            message = 'Пользователь не найден';
            break;
        case 'auth/wrong-password':
            message = 'Неверный пароль';
            break;
        case 'auth/invalid-email':
            message = 'Некорректный email';
            break;
        default:
            message = 'Ошибка: ' + error.message;
    }

    showError(message);
}

// Показ ошибок
function showError(message) {
    const errorElement = document.getElementById('error-message') || createErrorElement();
    errorElement.textContent = message;
}

function createErrorElement() {
    const errorDiv = document.createElement('div');
    errorDiv.id = 'error-message';
    errorDiv.className = 'error-message';
    document.querySelector('.login-form').prepend(errorDiv);
    return errorDiv;
}

// Проверка авторизации при загрузке
auth.onAuthStateChanged((user) => {
    if (user && window.location.pathname.includes('login.html')) {
        window.location.href = '/account/index.html';
    }
});