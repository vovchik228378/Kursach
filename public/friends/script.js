// Используем глобальный объект window.supabase

document.addEventListener('DOMContentLoaded', async() => {
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    const resultsDiv = document.getElementById('results');
    const profileButton = document.getElementById('profileButton');
    let currentUserId = null; // ID текущего пользователя

    // Проверка инициализации Supabase
    if (!window.supabase) {
        console.error("Supabase не инициализирован!");
        resultsDiv.innerHTML = '<div class="error">Ошибка инициализации. Обновите страницу.</div>';
        searchBtn.disabled = true;
        searchInput.disabled = true;
        return;
    }

    try {
        // 1. Проверка авторизации и получение данных пользователя
        const {
            data: {
                session
            },
            error: authError
        } = await window.supabase.auth.getSession();

        if (authError || !session) {
            // Если не авторизован, перенаправляем на логин
            window.location.href = '/login/';
            return; // Прекращаем выполнение скрипта
        }
        currentUserId = session.user.id;

        // 2. Получаем имя текущего пользователя для кнопки
        const {
            data: currentUserData,
            error: userError
        } = await window.supabase
            .from('users')
            .select('username')
            .eq('id', currentUserId)
            .single();

        if (userError && userError.code !== 'PGRST116') {
            console.warn("Не удалось получить имя текущего пользователя:", userError);
            profileButton.textContent = 'Профиль';
        } else {
            profileButton.textContent = currentUserData ?.username || 'Профиль';
        }
        // profileButton.onclick остается как в HTML (переход на /account/)

        // 3. Функция поиска пользователей
        const searchUsers = async() => {
            const queryText = searchInput.value.trim();
            resultsDiv.innerHTML = '<div class="notice">Поиск...</div>'; // Индикатор поиска

            if (!queryText) {
                resultsDiv.innerHTML = '<div class="notice">Введите имя пользователя для поиска.</div>';
                return;
            }

            try {
                // Ищем в таблице users, исключая себя
                const {
                    data: users,
                    error
                } = await window.supabase
                    .from('users')
                    .select('id, username, email') // Выбираем нужные поля
                    .ilike('username', `%${queryText}%`) // Регистронезависимый поиск по части строки
                    .neq('id', currentUserId) // Исключаем текущего пользователя
                    .limit(20); // Ограничиваем количество результатов

                if (error) {
                    console.error("Ошибка поиска Supabase:", error);
                    throw new Error(`Ошибка базы данных: ${error.message}`);
                }

                displayResults(users || []); // Отображаем результаты

            } catch (error) {
                console.error("Ошибка выполнения поиска:", error);
                resultsDiv.innerHTML = `
                    <div class="error">
                        Ошибка при поиске: ${error.message}
                        <button onclick="searchUsers()" class="button-retry">Попробовать снова</button>
                    </div>`;
            }
        };

        // 4. Функция отображения результатов
        const displayResults = (users) => {
            if (users.length === 0) {
                resultsDiv.innerHTML = `
                    <div class="no-results">
                        Пользователи с именем, содержащим "${searchInput.value}", не найдены.
                        <button onclick="searchInput.focus()" class="button-retry">Попробовать другой запрос</button>
                    </div>`;
                return;
            }

            // Генерируем HTML для каждого пользователя
            resultsDiv.innerHTML = users.map(user => `
                <div class="user-card" data-userid="${user.id}">
                    <div class="user-info">
                        <span class="username">${user.username || 'Без имени'}</span>
                        </div>
                     <button class="button view-profile" data-userid="${user.id}">Смотреть карту</button>
                </div>
            `).join('');

            // Добавляем обработчики для кнопок "Смотреть карту"
            document.querySelectorAll('.view-profile').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const userId = e.target.getAttribute('data-userid');
                    if (userId) {
                        // Переход на страницу аккаунта с userId в параметрах
                        window.location.href = `/account/?userId=${userId}`;
                    }
                });
            });
        };

        // 5. Назначаем обработчики событий
        searchBtn.addEventListener('click', searchUsers);
        searchInput.addEventListener('keypress', (e) => {
            // Запускаем поиск по нажатию Enter
            if (e.key === 'Enter') {
                searchUsers();
            }
        });

        // Фокус на поле поиска при загрузке
        searchInput.focus();

    } catch (error) {
        // Глобальная ошибка (например, ошибка сессии)
        console.error("Критическая ошибка на странице поиска:", error);
        resultsDiv.innerHTML = `<div class="error">Не удалось загрузить страницу: ${error.message}. Попробуйте <a href="/">перезагрузить</a>.</div>`;
        if (profileButton) profileButton.style.display = 'none'; // Скрыть кнопку профиля
    }
});