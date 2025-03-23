const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const authRoutes = require('./routes/auth');
const markerRoutes = require('./routes/markers');

app.use(cors());
app.use(express.json());

app.use(express.static(path.join('E:', 'aue228', )));

app.use('/api', authRoutes);
app.use('/api/markers', markerRoutes);

app.get('/', (req, res) => {
    res.sendFile(path.join('E:', 'aue228', 'Main-1', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join('E:', 'aue228', 'login', 'login.html'));
});

app.get('/registr', (req, res) => {
    res.sendFile(path.join('E:', 'aue228', 'registr', 'registr.html'));
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));