const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const authRoutes = require('./routes/auth');
const markerRoutes = require('./routes/markers');

app.use(cors());
app.use(express.json());

// Указываем путь к статическим файлам (E:\aue228\client)
app.use(express.static(path.join(__dirname, '..', )));

// Маршруты API
app.use('/api', authRoutes);
app.use('/api/markers', markerRoutes);

// Маршрут для корневого пути
app.get('/Main-1', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Main-1', 'index.html'));
});

// Маршрут для страницы входа
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'login', 'login.html'));
});

// Маршрут для страницы регистрации
app.get('/registr', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'registr', 'registr.html'));
});

app.get('/account', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'account', 'index.html'));
});

app.get('/Main-2', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Main-2', 'index.html'));
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));