/*const mysql = require("mysql2");

const db = mysql.createConnection({
    host: "127.0.0.1",
    user: "root",
    password: "",
    database: "lostfound_db",
    port: 3307
});

db.connect((err) => {
    if (err) {
        console.error("❌ Database connection failed:", err.message);
    } else {
        console.log("✅ Database connected successfully to Port 3307");
    }
});

module.exports = db;*/

const mysql = require("mysql2");

const isCloud = Boolean(process.env.DB_HOST);

const db = mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "lostfound_db",
    port: Number(process.env.DB_PORT) || 3307,
    ...(isCloud ? { ssl: { rejectUnauthorized: false } } : {})
});

db.connect((err) => {
    if (err) {
        console.error("❌ Database connection failed:", err.message);
    } else {
        console.log("✅ Database connected successfully");
    }
});

module.exports = db;