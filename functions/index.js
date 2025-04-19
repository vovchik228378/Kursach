const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

// Инициализация Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Настройка Express
const app = express();
app.use(cors({ origin: true }));

// ====================== API для пользователей ======================
// Регистрация пользователя (аналог INSERT в users)
app.post("/api/users/register", async(req, res) => {
    try {
        const { username, email, password } = req.body;

        // Проверка на существующего пользователя
        const snapshot = await db.collection("users")
            .where("email", "==", email)
            .get();

        if (!snapshot.empty) {
            return res.status(400).json({ error: "Email уже используется" });
        }

        // Создание пользователя
        const userRef = await db.collection("users").add({
            username,
            email,
            password: await admin.auth().createUser({ email, password }).then((user) => user.uid),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.status(201).json({ id: userRef.id });
    } catch (error) {
        functions.logger.error("Ошибка регистрации:", error);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});

// ====================== API для меток ======================
// Добавление метки (аналог INSERT в markers)
app.post("/api/markers", async(req, res) => {
    try {
        const { userId, lat, lng, name, emoji, description } = req.body;

        const markerRef = await db.collection("markers").add({
            userId,
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            name,
            emoji: emoji || "?",
            description: description || "",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Обновляем счетчик меток у пользователя
        await db.collection("users").doc(userId).update({
            markerCount: admin.firestore.FieldValue.increment(1),
        });

        res.status(201).json({ id: markerRef.id });
    } catch (error) {
        functions.logger.error("Ошибка добавления метки:", error);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});

// Получение меток пользователя (аналог SELECT с WHERE user_id)
app.get("/api/markers/:userId", async(req, res) => {
    try {
        const snapshot = await db.collection("markers")
            .where("userId", "==", req.params.userId)
            .orderBy("createdAt", "desc")
            .get();

        const markers = [];
        snapshot.forEach((doc) => {
            markers.push({
                id: doc.id,
                ...doc.data(),
            });
        });

        res.json(markers);
    } catch (error) {
        functions.logger.error("Ошибка получения меток:", error);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});

// ====================== Экспорт API ======================
exports.api = functions.https.onRequest(app);

// ====================== Вспомогательные функции ======================
exports.onUserDeleted = functions.auth.user().onDelete(async(user) => {
    // Удаляем связанные данные при удалении пользователя
    await db.collection("users").doc(user.uid).delete();

    // Удаляем все метки пользователя
    const markersSnapshot = await db.collection("markers")
        .where("userId", "==", user.uid)
        .get();

    const batch = db.batch();
    markersSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });

    await batch.commit();
});