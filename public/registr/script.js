// Используем глобальный объект window.supabase

document.addEventListener('DOMContentLoaded', () => {
    const registrationForm = document.getElementById('registrationForm');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const submitBtn = document.getElementById('registerButton');
    const errorMessageDiv = document.getElementById('errorMessage');

    if (!window.supabase) {
        console.error("Supabase не инициализирован!");
        errorMessageDiv.textContent = "Ошибка инициализации. Попробуйте обновить страницу.";
        errorMessageDiv.style.display = 'block';
        submitBtn.disabled = true;
        return;
    }

    registrationForm.addEventListener('submit', async(e) => {
        e.preventDefault();
        errorMessageDiv.style.display = 'none'; // Скрываем старые ошибки

        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        const username = usernameInput.value.trim();

        // Валидация на клиенте
        if (!username || !email || !password || !confirmPassword) {
            errorMessageDiv.textContent = 'Пожалуйста, заполните все поля.';
            errorMessageDiv.style.display = 'block';
            return;
        }
        if (password.length < 6) {
            errorMessageDiv.textContent = 'Пароль должен быть не менее 6 символов.';
            errorMessageDiv.style.display = 'block';
            passwordInput.focus();
            return;
        }
        if (password !== confirmPassword) {
            errorMessageDiv.textContent = 'Пароли не совпадают!';
            errorMessageDiv.style.display = 'block';
            confirmPasswordInput.focus();
            return;
        }
        // Проверка имени пользователя (простая)
        const usernamePattern = /^[a-zA-Z0-9_]{3,30}$/;
        if (!usernamePattern.test(username)) {
            errorMessageDiv.textContent = 'Недопустимое имя пользователя. Используйте 3-30 латинских букв, цифр или \'_\'.';
            errorMessageDiv.style.display = 'block';
            usernameInput.focus();
            return;
        }


        submitBtn.disabled = true;
        submitBtn.textContent = 'Регистрация...';

        try {
            // 1. Регистрация в Supabase Auth
            // Передаем username в options.data, чтобы триггер мог его использовать
            const { data, error: authError } = await window.supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        username: username // Передаем username сюда
                    },
                    // emailRedirectTo: `${window.location.origin}/account/` // Если нужно подтверждение email
                }
            });

            // Обработка ошибок регистрации
            if (authError) {
                console.error('Ошибка регистрации (Auth):', authError);
                if (authError.message.includes('User already registered') || authError.message.includes('duplicate key value violates unique constraint "users_email_key"')) {
                    errorMessageDiv.textContent = 'Этот email уже зарегистрирован.';
                } else if (authError.message.includes('duplicate key value violates unique constraint "users_username_key"')) { // Проверка уникальности username (если добавили constraint в SQL)
                    errorMessageDiv.textContent = 'Это имя пользователя уже занято.';
                } else if (authError.message.includes('Password should be at least 6 characters')) {
                    errorMessageDiv.textContent = 'Пароль должен быть не менее 6 символов.';
                } else {
                    errorMessageDiv.textContent = `Ошибка регистрации: ${authError.message}`;
                }
                errorMessageDiv.style.display = 'block';
                throw authError; // Прерываем выполнение, чтобы не попасть в finally с успехом
            }

            // Важно: Если включено подтверждение email в Supabase, пользователь не войдет сразу.
            // Запись в public.users создастся триггером handle_new_user.
            // Здесь можно показать сообщение о необходимости подтвердить email.

            if (data.user && data.session) {
                // Если email verification ОТКЛЮЧЕНА, пользователь войдет сразу
                console.log('Регистрация и вход выполнены:', data.user);
                // Триггер должен был добавить пользователя в public.users
                // Перенаправляем в личный кабинет
                window.location.href = '/account/';
            } else if (data.user) {
                // Если email verification ВКЛЮЧЕНА
                console.log('Регистрация успешна, нужно подтверждение email:', data.user);
                registrationForm.innerHTML = `
                     <div style="color: green; text-align: center;">
                         Регистрация прошла успешно! <br>
                         Мы отправили письмо для подтверждения на адрес <strong>${email}</strong>. <br>
                         Пожалуйста, проверьте вашу почту (включая папку "Спам") и перейдите по ссылке для активации аккаунта.
                     </div>
                     <div style="margin-top: 20px; text-align: center;">
                         <a href="/login/" class="button">Перейти на страницу входа</a>
                     </div>
                  `;
            } else {
                // Неожиданный результат
                throw new Error('Регистрация прошла, но не удалось получить данные пользователя или сессию.');
            }


        } catch (error) {
            // Ловим ошибки (включая те, что пробросили из блока try)
            console.error('Общая ошибка регистрации:', error);
            // Сообщение об ошибке уже должно быть установлено в блоке try
            if (errorMessageDiv.style.display === 'none') { // Если не было установлено ранее
                errorMessageDiv.textContent = 'Произошла ошибка регистрации. Попробуйте еще раз.';
                errorMessageDiv.style.display = 'block';
            }

        } finally {
            // Включаем кнопку только если не было успешной регистрации с подтверждением email
            if (!document.querySelector('div[style*="color: green"]')) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Зарегистрироваться';
            }
        }
    });
});