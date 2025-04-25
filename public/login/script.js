// Используем глобальный объект window.supabase

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email'); // Используем email ID
    const passwordInput = document.getElementById('password');
    const submitBtn = document.getElementById('loginButton'); // Используем ID кнопки
    const errorMessageDiv = document.getElementById('errorMessage');

    // Проверяем, инициализирован ли Supabase
    if (!window.supabase) {
        console.error("Supabase не инициализирован!");
        errorMessageDiv.textContent = "Ошибка инициализации. Попробуйте обновить страницу.";
        errorMessageDiv.style.display = 'block';
        submitBtn.disabled = true;
        return;
    }

    loginForm.addEventListener('submit', async(e) => {
        e.preventDefault(); // Предотвращаем стандартную отправку формы
        errorMessageDiv.style.display = 'none'; // Скрываем предыдущие ошибки

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // Простая валидация на клиенте
        if (!email || !password) {
            errorMessageDiv.textContent = 'Пожалуйста, заполните все поля.';
            errorMessageDiv.style.display = 'block';
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Вход...';

        try {
            const { data, error } = await window.supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) {
                // Обрабатываем специфичные ошибки Supabase
                console.error('Ошибка входа:', error);
                if (error.message.includes('Invalid login credentials')) {
                    errorMessageDiv.textContent = 'Неверный email или пароль.';
                } else if (error.message.includes('Email not confirmed')) {
                    errorMessageDiv.textContent = 'Пожалуйста, подтвердите ваш email. Проверьте почту.';
                } else {
                    errorMessageDiv.textContent = `Ошибка входа: ${error.message}`;
                }
                errorMessageDiv.style.display = 'block';
                passwordInput.value = ''; // Очищаем поле пароля
                emailInput.focus(); // Фокус на email
            } else {
                console.log('Успешный вход:', data);
                // Перенаправляем в личный кабинет после успешного входа
                window.location.href = '/account/'; // Редирект на страницу аккаунта
            }

        } catch (error) {
            // Ловим другие возможные ошибки (например, сетевые)
            console.error('Непредвиденная ошибка входа:', error);
            errorMessageDiv.textContent = 'Произошла непредвиденная ошибка. Попробуйте еще раз.';
            errorMessageDiv.style.display = 'block';
        } finally {
            // Всегда включаем кнопку обратно
            submitBtn.disabled = false;
            submitBtn.textContent = 'Войти';
        }
    });
});