// Инициализация Supabase
const supabase = supabase.createClient(
    'https://mxdddbkfyugyyzabfqor.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14ZGRkYmtmeXVneXl6YWJmcW9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwOTY3NzMsImV4cCI6MjA2MDY3Mjc3M30.zNoJad5-R0mTP95yz-2_0j-Lj6-eNy4S89ciQ7BZWmQ'
)

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm')
    const emailInput = document.getElementById('email')
    const passwordInput = document.getElementById('password')
    const submitBtn = loginForm.querySelector('button[type="submit"]')

    // Проверка активной сессии
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            window.location.href = '/account/index.html'
        }
    })

    // Обработка формы входа
    loginForm.addEventListener('submit', async(e) => {
        e.preventDefault()

        const email = emailInput.value.trim()
        const password = passwordInput.value

        // Валидация
        if (!email || !password) {
            showError('Заполните все поля')
            return
        }

        // Блокировка кнопки во время запроса
        submitBtn.disabled = true
        submitBtn.textContent = 'Вход...'

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password
            })

            if (error) throw error

            // Успешный вход
            window.location.href = '/account/index.html'
        } catch (error) {
            showError(getErrorMessage(error))
        } finally {
            submitBtn.disabled = false
            submitBtn.textContent = 'Войти'
        }
    })

    // Показать ошибку
    function showError(message) {
        let errorElement = document.getElementById('error-message')
        if (!errorElement) {
            errorElement = document.createElement('div')
            errorElement.id = 'error-message'
            errorElement.className = 'error-message'
            loginForm.prepend(errorElement)
        }
        errorElement.textContent = message
    }

    // Преобразование ошибок в понятный текст
    function getErrorMessage(error) {
        switch (error.message) {
            case 'Invalid login credentials':
                return 'Неверный email или пароль'
            case 'Email not confirmed':
                return 'Подтвердите email перед входом'
            default:
                return 'Ошибка входа: ' + error.message
        }
    }
})