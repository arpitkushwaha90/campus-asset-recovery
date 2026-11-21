const express = require("express");
const router = express.Router();
const db = require("../db");

/* =========================
   SEND MESSAGE
========================= */
router.post("/send", (req, res) => {
    let { sender_id, receiver_id, message } = req.body;

    sender_id = parseInt(sender_id);
    receiver_id = parseInt(receiver_id);

    if (!sender_id || !receiver_id || !message) {
        return res.status(400).json({ error: "Missing fields" });
    }

    const sql = `
    INSERT INTO chat_messages (sender_id, receiver_id, message)
    VALUES (?, ?, ?)
  `;

    db.query(sql, [sender_id, receiver_id, message], (err, result) => {
        if (err) {
            console.log("❌ Chat insert error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        res.json({
            id: result.insertId,
            sender_id,
            receiver_id,
            message,
            created_at: new Date()
        });
    });
});

/* =========================
   GET CHAT HISTORY
========================= */
router.get("/history/:user1/:user2", (req, res) => {
    let { user1, user2 } = req.params;

    user1 = parseInt(user1);
    user2 = parseInt(user2);

    const sql = `
    SELECT * FROM chat_messages
    WHERE (sender_id = ? AND receiver_id = ?)
       OR (sender_id = ? AND receiver_id = ?)
    ORDER BY created_at ASC
  `;

    db.query(sql, [user1, user2, user2, user1], (err, rows) => {
        if (err) {
            console.log("❌ Fetch chat history error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        res.json(rows);
    });
});

/* ==============================================
   GET USER CONVERSATIONS (POST OWNER INBOX LIST)
============================================== */
router.get("/conversations/:userId", (req, res) => {
    const userId = parseInt(req.params.userId);

    if (!userId) {
        return res.status(400).json({ error: "Invalid user ID" });
    }

    const sql = `
    SELECT DISTINCT 
      CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS contact_id,
      users.name AS contact_name,
      users.email AS contact_email
    FROM chat_messages
    JOIN users ON users.id = (CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END)
    WHERE sender_id = ? OR receiver_id = ?
  `;

    db.query(sql, [userId, userId, userId, userId], (err, rows) => {
        if (err) {
            console.log("❌ Fetch conversations error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        res.json(rows);
    });
});

/* =========================
   DELETE CHAT
========================= */
router.delete("/delete/:user1/:user2", (req, res) => {
    let { user1, user2 } = req.params;

    user1 = parseInt(user1);
    user2 = parseInt(user2);

    const sql = `
    DELETE FROM chat_messages
    WHERE (sender_id = ? AND receiver_id = ?)
       OR (sender_id = ? AND receiver_id = ?)
  `;

    db.query(sql, [user1, user2, user2, user1], (err, result) => {
        if (err) {
            console.log("❌ Delete chat error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        res.json({
            message: "Chat deleted successfully"
        });
    });
});

module.exports = router;