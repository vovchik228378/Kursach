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

    try {
        const response = await fetch('http://localhost:5000/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, email, password }),
        });

        const data = await response.json();
        alert(data.message);

        if (response.ok) {
            const loginResponse = await fetch('http://localhost:5000/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const loginData = await loginResponse.json();
            if (loginResponse.ok) {
                localStorage.setItem('token', loginData.token);
                localStorage.setItem('username', loginData.username);
                window.location.href = '/Main-2/index.html';
            }
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при регистрации');
    }
});