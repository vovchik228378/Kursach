// Инициализация Supabase
const supabase = supabase.createClient(
    'https://mxdddbkfyugyyzabfqor.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14ZGRkYmtmeXVneXl6YWJmcW9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwOTY3NzMsImV4cCI6MjA2MDY3Mjc3M30.zNoJad5-R0mTP95yz-2_0j-Lj6-eNy4S89ciQ7BZWmQ'
)

document.getElementById('registrationForm').addEventListener('submit', async(e) => {
    e.preventDefault()

    const email = document.getElementById('email').value.trim()
    const password = document.getElementById('password').value
    const confirmPassword = document.getElementById('confirm-password').value
    const username = document.getElementById('username').value.trim()

    // Валидация формы
    if (password !== confirmPassword) {
        showError('Пароли не совпадают')
        return
    }

    if (password.length < 6) {
        showError('Пароль должен содержать минимум 6 символов')
        return
    }

    if (username.length < 3) {
        showError('Имя пользователя должно содержать минимум 3 символа')
        return
    }

    const submitBtn = e.target.querySelector('button[type="submit"]')
    submitBtn.disabled = true
    submitBtn.textContent = 'Регистрация...'

    try {
        // 1. Регистрация в Supabase Auth
        const { data: auth, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: username
                }
            }
        })

        if (authError) throw authError

        // 2. Сохранение дополнительных данных в таблице users
        const { error: dbError } = await supabase
            .from('users')
            .insert([{
                id: auth.user.id,
                email,
                username,
                created_at: new Date().toISOString()
            }])

        if (dbError) throw dbError

        // Успешная регистрация
        alert('Регистрация успешно завершена! Проверьте вашу почту для подтверждения email.')
        window.location.href = '/account/index.html'

    } catch (error) {
        console.error('Ошибка регистрации:', error)
        showError(getErrorMessage(error))
    } finally {
        submitBtn.disabled = false
        submitBtn.textContent = 'Зарегистрироваться'
    }
})

// Функции для обработки ошибок
function showError(message) {
    let errorElement = document.getElementById('error-message')
    if (!errorElement) {
        errorElement = document.createElement('div')
        errorElement.id = 'error-message'
        errorElement.className = 'error-message'
        document.querySelector('.register-form').prepend(errorElement)
    }
    errorElement.textContent = message
}

function getErrorMessage(error) {
    switch (error.message) {
        case 'User already registered':
            return 'Пользователь с таким email уже зарегистрирован'
        case 'Password should be at least 6 characters':
            return 'Пароль должен содержать минимум 6 символов'
        case 'Invalid email':
            return 'Некорректный email'
        default:
            return 'Ошибка регистрации: ' + error.message
    }
}