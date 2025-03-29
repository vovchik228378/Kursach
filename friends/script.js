document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    const resultsDiv = document.getElementById('results');

    const searchUsers = async() => {
        const query = searchInput.value.trim();
        if (!query) return;

        try {
            const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) throw new Error('Ошибка поиска');

            const users = await response.json();
            displayResults(users);
        } catch (error) {
            resultsDiv.innerHTML = `<div class="error">${error.message}</div>`;
        }
    };

    const displayResults = (users) => {
        if (users.length === 0) {
            resultsDiv.innerHTML = '<div class="no-results">Ничего не найдено</div>';
            return;
        }

        resultsDiv.innerHTML = users.map(user => `
            <div class="user-card" data-username="${user.username}">
                <span class="username clickable">${user.username}</span>
            </div>
        `).join('');

        // Добавляем обработчики клика
        document.querySelectorAll('.clickable').forEach(el => {
            el.addEventListener('click', (e) => {
                const username = e.target.closest('.user-card').getAttribute('data-username');
                window.location.href = `/account/index.html?username=${username}`;
            });
        });
    };

    searchBtn.addEventListener('click', searchUsers);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchUsers();
    });
});