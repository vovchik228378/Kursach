const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET_KEY = 'твой_секретный_ключ';

// Регистрация пользователя
router.post('/register', async(req, res) => {
    console.log('Получен запрос на регистрацию:', req.body);

    try {
        const { username, email, password } = req.body;

        // Валидация входных данных
        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Все поля обязательны для заполнения'
            });
        }

        // Проверка существования пользователя
        const [existingUsers] = await db.query(
            'SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1', [email, username]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Пользователь с таким email или именем уже существует'
            });
        }

        // Хеширование пароля
        const hashedPassword = await bcrypt.hash(password, 10);

        // Создание пользователя
        const [result] = await db.query(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword]
        );

        console.log(`Пользователь ${username} создан, ID: ${result.insertId}`);

        // Генерация токена для автоматического входа
        const token = jwt.sign({
                id: result.insertId,
                username: username
            },
            SECRET_KEY, { expiresIn: '1d' }
        );

        res.status(201).json({
            success: true,
            message: 'Пользователь успешно зарегистрирован',
            token,
            username
        });

    } catch (error) {
        console.error('Ошибка регистрации:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'Пользователь с такими данными уже существует'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Внутренняя ошибка сервера при регистрации'
        });
    }
});

// Аутентификация пользователя
router.post('/login', async(req, res) => {
    try {
        const { email, password } = req.body;

        // Базовая валидация
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email и пароль обязательны'
            });
        }

        // Поиск пользователя
        const [users] = await db.query(
            'SELECT * FROM users WHERE email = ? LIMIT 1', [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Неверные учетные данные'
            });
        }

        const user = users[0];

        // Проверка пароля
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Неверные учетные данные'
            });
        }

        // Генерация токена
        const token = jwt.sign({
                id: user.id,
                username: user.username
            },
            SECRET_KEY, { expiresIn: '1d' }
        );

        res.json({
            success: true,
            message: 'Аутентификация успешна',
            token,
            username: user.username,
            email: user.email
        });

    } catch (error) {
        console.error('Ошибка аутентификации:', error);
        res.status(500).json({
            success: false,
            message: 'Внутренняя ошибка сервера при аутентификации'
        });
    }
});

module.exports = router;