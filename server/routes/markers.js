const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Получить метки пользователя
router.get('/', auth, (req, res) => {
    const { username } = req.query;

    const query = `
        SELECT m.*, u.username 
        FROM markers m
        JOIN users u ON m.user_id = u.id
        WHERE u.username = ?
    `;

    db.query(query, [username], (err, results) => {
        if (err) {
            console.error('Ошибка при получении меток:', err);
            return res.status(500).json({ message: 'Ошибка сервера' });
        }
        res.json(results);
    });
});

// Добавить метку
router.post('/add', auth, (req, res) => {
    const { lat, lng, name, description, emoji } = req.body;
    const userId = req.user.id;
    const username = req.user.username;

    if (!name) {
        return res.status(400).json({ message: 'Название метки обязательно' });
    }

    const query = `
        INSERT INTO markers 
        (user_id, username, lat, lng, name, description, emoji)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
        userId,
        username,
        lat,
        lng,
        name,
        description || null,
        emoji || '?'
    ];

    db.query(query, values, (err, results) => {
        if (err) {
            console.error('Ошибка добавления метки:', err);
            return res.status(500).json({ message: 'Ошибка добавления метки' });
        }

        // Возвращаем добавленную метку
        const newMarker = {
            id: results.insertId,
            user_id: userId,
            username,
            lat,
            lng,
            name,
            description,
            emoji
        };

        res.json({
            message: 'Метка успешно добавлена',
            marker: newMarker
        });
    });
});

// Удалить метку
router.delete('/delete/:id', auth, (req, res) => {
    const markerId = req.params.id;
    const userId = req.user.id;

    db.query(
        'DELETE FROM markers WHERE id = ? AND user_id = ?', [markerId, userId],
        (err, results) => {
            if (err) {
                console.error('Ошибка удаления метки:', err);
                return res.status(500).json({ message: 'Ошибка удаления' });
            }

            if (results.affectedRows === 0) {
                return res.status(404).json({ message: 'Метка не найдена или нет прав' });
            }

            res.json({ message: 'Метка успешно удалена' });
        }
    );
});

module.exports = router;