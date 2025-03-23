const mysql = require('mysql2');
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'vovan',
    password: '1234554321',
    database: 'myamap'
});

connection.connect((err) => {
    if (err) throw err;
    console.log('mysql подключен');
});

module.exports = connection;