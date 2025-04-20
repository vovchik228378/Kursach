document.addEventListener('DOMContentLoaded', () => {
    const registrationForm = document.getElementById('registrationForm');

    if (!registrationForm) return;

    registrationForm.addEventListener('submit', async(e) => {
        e.preventDefault();

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const username = document.getElementById('username').value.trim();

        // Валидация формы
        if (password !== confirmPassword) {
            showError('Пароли не совпадают');
            return;
        }

        if (password.length < 6) {
            showError('Пароль должен содержать минимум 6 символов');
            return;
        }

        if (username.length < 3) {
            showError('Имя пользователя должно содержать минимум 3 символа');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Регистрация...';

        try {
            // 1. Регистрация в Supabase Auth
            const { data: auth, error: authError } = await window.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username: username
                    }
                }
            });

            if (authError) throw authError;

            // 2. Сохранение дополнительных данных в таблице users
            const { error: dbError } = await window.supabase
                .from('users')
                .insert([{
                    id: auth.user.id,
                    email,
                    username,
                    created_at: new Date().toISOString()
                }]);

            if (dbError) throw dbError;

            alert('Регистрация успешно завершена! Проверьте вашу почту для подтверждения email.');
            window.location.href = '/account/index.html';

        } catch (error) {
            console.error('Ошибка регистрации:', error);
            showError(getErrorMessage(error));
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Зарегистрироваться';
        }
    });

    function showError(message) {
        let errorElement = document.getElementById('error-message');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.id = 'error-message';
            errorElement.className = 'error-message';
            registrationForm.prepend(errorElement);
        }
        errorElement.textContent = message;
    }

    function getErrorMessage(error) {
        switch (error.message) {
            case 'User already registered':
                return 'Пользователь с таким email уже зарегистрирован';
            case 'Password should be at least 6 characters':
                return 'Пароль должен содержать минимум 6 символов';
            case 'Invalid email':
                return 'Некорректный email';
            default:
                return 'Ошибка регистрации: ' + error.message;
        }
    }
});