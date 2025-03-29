const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const authRoutes = require('./routes/auth');
const markerRoutes = require('./routes/markers');
const db = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

require('dotenv').config();
const SECRET_KEY = process.env.JWT_SECRET || 'default_secret_key';

// Middleware
app.use(cors());
app.use(express.json());

// Статические файлы
app.use(express.static(path.join(__dirname, '..')));

// Маршруты API
const router = express.Router();

// Роуты аутентификации
router.post('/register', (req, res) => {
    const { username, email, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);

    const query = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
    db.query(query, [username, email, hashedPassword], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Ошибка сервера или пользователь уже существует' });
        }
        res.json({ message: 'Пользователь зарегистрирован' });
    });
});

router.post('/login', (req, res) => {
    const { username, password } = req.body;
    const query = 'SELECT * FROM users WHERE username = ? OR email = ?';

    db.query(query, [username, username], (err, results) => {
        if (err || results.length === 0) {
            return res.status(400).json({ message: 'Неверные данные' });
        }

        const user = results[0];
        const isMatch = bcrypt.compareSync(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: 'Неверный пароль' });
        }

        const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '1d' });
        res.json({
            message: 'Успешный вход',
            token,
            username: user.username,
            email: user.email
        });
    });
});

// Маршрут для поиска пользователей
router.get('/users/search', (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ message: 'Необходим поисковый запрос' });
    }

    const searchQuery = 'SELECT id, username FROM users WHERE username LIKE ? LIMIT 10';
    db.query(searchQuery, [`%${query}%`], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Ошибка сервера при поиске' });
        }
        res.json(results);
    });
});

// Маршрут для получения информации о пользователе
router.get('/users/:username', (req, res) => {
    const { username } = req.params;
    const query = 'SELECT id, username FROM users WHERE username = ?';

    db.query(query, [username], (err, results) => {
        if (err || results.length === 0) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }
        res.json(results[0]);
    });
});

// Маршруты для меток (исправленные версии)
router.get('/markers', (req, res) => {
    const { username } = req.query;
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Не авторизован' });
    }

    try {
        jwt.verify(token, SECRET_KEY);
    } catch (err) {
        return res.status(401).json({ message: 'Недействительный токен' });
    }

    const query = `
        SELECT m.* FROM markers m
        JOIN users u ON m.user_id = u.id
        WHERE u.username = ?
    `;

    db.query(query, [username], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }
        res.json(results);
    });
});

router.post('/markers/add', (req, res) => {
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Не авторизован' });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const { lat, lng, hint } = req.body;

        const query = 'INSERT INTO markers (user_id, lat, lng, hint) VALUES (?, ?, ?, ?)';
        db.query(query, [decoded.id, lat, lng, hint], (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: 'Ошибка сервера' });
            }
            res.json({ message: 'Метка добавлена' });
        });
    } catch (err) {
        return res.status(401).json({ message: 'Недействительный токен' });
    }
});

// Подключаем роуты
app.use('/api', router);
app.use('/api/markers', markerRoutes);

// Маршруты для страниц
app.get('/Main-1', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Main-1', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'login', 'login.html'));
});

app.get('/registr', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'registr', 'registr.html'));
});

app.get('/account', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'account', 'index.html'));
});

app.get('/Main-2', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Main-2', 'index.html'));
});

app.get('/friends', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'friends', 'index.html'));
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));