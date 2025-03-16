document.getElementById('loginForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('http://localhost:5000/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();
        alert(data.message);

        if (response.ok) {
            localStorage.setItem('token', data.token);
            window.location.href = 'Main-2\index.html';
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка при входе');
    }
});
if (response.ok) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', username);
    window.location.href = 'Main-2\index.html';
}