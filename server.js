const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = express();
const port = 5000;


const db = mysql.createConnection({
    host: 'localhost',
    user: 'vovan228',
    password: 'DSMH0k3AoCuU8wyY$9X0',
    database: 'MyCard'
});


db.connect((err) => {
    if (err) {
        console.error('Ошибка подключения к базе данных:', err);
    } else {
        console.log('Подключение к базе данных успешно!');
    }
});


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());


const JWT_SECRET = 'DSMH0k3AoCuU8wyY$9X0';


app.post('/register', async(req, res) => {
    const { username, email, password } = req.body;


    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Все поля обязательны для заполнения' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
    db.query(sql, [username, email, hashedPassword], (err, result) => {
        if (err) {
            console.error('Ошибка при регистрации:', err);
            return res.status(500).json({ message: 'Ошибка при регистрации' });
        }
        res.status(201).json({ message: 'Пользователь успешно зарегистрирован!' });
    });
});


app.post('/login', async(req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Все поля обязательны для заполнения' });
    }

    const sql = 'SELECT * FROM users WHERE email = ?';
    db.query(sql, [email], async(err, results) => {
        if (err) {
            console.error('Ошибка при входе:', err);
            return res.status(500).json({ message: 'Ошибка при входе' });
        }

        if (results.length === 0) {
            return res.status(400).json({ message: 'Пользователь не найден' });
        }

        const user = results[0];

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Неверный пароль' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({ message: 'Вход выполнен успешно!', token });
    });
});

app.listen(port, () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
});