const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Получить все метки (общая карта)
router.get('/', (req, res) => {
    db.query('SELECT * FROM markers', (err, results) => {
        if (err) return res.status(500).json({ message: 'Ошибка' });
        res.json(results);
    });
});

// Получить метки текущего пользователя (личный кабинет)
router.get('/my', auth, (req, res) => {
    db.query('SELECT * FROM markers WHERE user_id = ?', [req.userId], (err, results) => {
        if (err) return res.status(500).json({ message: 'Ошибка' });
        res.json(results);
    });
});

// Добавить метку
router.post('/add', auth, (req, res) => {
    const { lat, lng, hint } = req.body;
    db.query('INSERT INTO markers (user_id, lat, lng, hint) VALUES (?, ?, ?, ?)', [req.userId, lat, lng, hint],
        (err) => {
            if (err) return res.status(500).json({ message: 'Ошибка добавления' });
            res.json({ message: 'Метка добавлена' });
        });
});

// Удалить метку
router.delete('/delete/:id', auth, (req, res) => {
    const markerId = req.params.id;
    db.query('DELETE FROM markers WHERE id = ? AND user_id = ?', [markerId, req.userId],
        (err) => {
            if (err) return res.status(500).json({ message: 'Ошибка удаления' });
            res.json({ message: 'Метка удалена' });
        });
});

module.exports = router;