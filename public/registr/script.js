// Импорт Firebase (должен быть добавлен в HTML перед этим файлом)
// <script src="https://www.gstatic.com/firebasejs/9.6.0/firebase-app-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/9.6.0/firebase-auth-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore-compat.js"></script>

// Конфигурация Firebase (замените значения на свои из Firebase Console)
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
const db = firebase.firestore();

// Обработка формы регистрации
document.getElementById('registrationForm').addEventListener('submit', async(e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    // Валидация формы
    if (!username || !email || !password || !confirmPassword) {
        alert('Пожалуйста, заполните все поля!');
        return;
    }

    if (password.length < 6) {
        alert('Пароль должен содержать минимум 6 символов!');
        return;
    }

    if (password !== confirmPassword) {
        alert('Пароли не совпадают!');
        return;
    }

    try {
        // Показываем индикатор загрузки
        const submitBtn = document.querySelector('#registrationForm button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Регистрация...';

        // 1. Создаем пользователя в Authentication
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // 2. Сохраняем дополнительные данные в Firestore
        await db.collection('users').doc(user.uid).set({
            username: username,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            markerCount: 0,
            emailVerified: false,
            isPublic: false // Флаг публичного профиля
        });

        // 3. Отправляем письмо для верификации
        await user.sendEmailVerification();

        alert('Регистрация успешна! Письмо для подтверждения email отправлено на вашу почту.');
        window.location.href = '/account/index.html';
    } catch (error) {
        let errorMessage = 'Ошибка регистрации';
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'Этот email уже зарегистрирован';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Некорректный email';
                break;
            case 'auth/weak-password':
                errorMessage = 'Пароль слишком простой (минимум 6 символов)';
                break;
            case 'auth/operation-not-allowed':
                errorMessage = 'Регистрация по email временно недоступна';
                break;
            default:
                errorMessage = 'Произошла ошибка: ' + error.message;
        }

        alert(errorMessage);
        console.error('Ошибка регистрации:', error);

        // Восстанавливаем кнопку
        const submitBtn = document.querySelector('#registrationForm button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Зарегистрироваться';
    }
});

// Дополнительно: кнопка "Уже есть аккаунт?"
const loginLink = document.createElement('div');
loginLink.className = 'login-link';
loginLink.innerHTML = '<p>Уже есть аккаунт? <a href="/login/login.html">Войти</a></p>';
document.querySelector('.container').appendChild(loginLink);