// Инициализация Supabase
const supabaseUrl = 'https://mxdddbkfyugyyzabfqor.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14ZGRkYmtmeXVneXl6YWJmcW9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwOTY3NzMsImV4cCI6MjA2MDY3Mjc3M30.zNoJad5-R0mTP95yz-2_0j-Lj6-eNy4S89ciQ7BZWmQ'
const supabase = supabase.createClient(supabaseUrl, supabaseKey)

document.addEventListener('DOMContentLoaded', async() => {
    const searchBtn = document.getElementById('searchBtn')
    const searchInput = document.getElementById('searchInput')
    const resultsDiv = document.getElementById('results')
    const profileButton = document.getElementById('profileButton')

    // Проверка авторизации
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        window.location.href = '/login/login.html'
        return
    }

    // Устанавливаем email пользователя в кнопку профиля
    profileButton.textContent = user.email
    profileButton.addEventListener('click', () => {
        window.location.href = '/account/index.html'
    })

    // Поиск пользователей
    const searchUsers = async() => {
        const queryText = searchInput.value.trim()
        if (!queryText) {
            resultsDiv.innerHTML = '<div class="notice">Введите имя для поиска</div>'
            return
        }

        try {
            const { data: users, error } = await supabase
                .from('users')
                .select('id, username, email')
                .ilike('username', `%${queryText}%`)
                .neq('id', user.id) // Исключаем текущего пользователя
                .limit(20) // Ограничиваем количество результатов

            if (error) throw error

            displayResults(users || [])
        } catch (error) {
            console.error("Ошибка поиска:", error)
            resultsDiv.innerHTML = `
                <div class="error">
                    Ошибка при поиске: ${error.message}
                    <button onclick="window.location.reload()">Попробовать снова</button>
                </div>
            `
        }
    }

    // Отображение результатов
    const displayResults = (users) => {
        if (users.length === 0) {
            resultsDiv.innerHTML = `
                <div class="no-results">
                    Ничего не найдено
                    <button onclick="searchInput.focus()">Попробовать другой запрос</button>
                </div>
            `
            return
        }

        resultsDiv.innerHTML = users.map(user => `
            <div class="user-card" data-userid="${user.id}">
                <div class="user-avatar">${(user.username || '?').charAt(0).toUpperCase()}</div>
                <div class="user-info">
                    <span class="username">${user.username || 'Без имени'}</span>
                    <span class="email">${user.email}</span>
                </div>
                <button class="view-profile">👤 Профиль</button>
            </div>
        `).join('')

        // Обработчики кнопок "Профиль"
        document.querySelectorAll('.view-profile').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.target.closest('.user-card').getAttribute('data-userid')
                window.location.href = `/account/index.html?userId=${userId}`
            })
        })
    }

    // Обработчики событий
    searchBtn.addEventListener('click', searchUsers)
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchUsers()
    })

    // Фокус на поле поиска при загрузке
    searchInput.focus()
})