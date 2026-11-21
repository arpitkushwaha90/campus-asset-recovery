const express = require("express");
const router = express.Router();
const db = require("../db");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

// ==========================
// REAL GMAIL TRANSPORTER
// ==========================
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "arpitkushwaha210@gmail.com",
        pass: "snuhrmgfojclyqxf"

    }
});

// ==========================
// SIGNUP WITH EMAIL VERIFY
// ==========================
router.post("/signup", (req, res) => {
    const { name, email, password } = req.body;

    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    if (!gmailRegex.test(email)) {
        return res.status(400).send("Please enter a valid Gmail address");
    }

    db.query("SELECT * FROM users WHERE email = ?", [email], (err, result) => {
        if (err) return res.status(500).send("DB error");
        if (result.length > 0) return res.status(400).send("User already exists");

        const token = crypto.randomBytes(32).toString("hex");

        db.query(
            "INSERT INTO users (name, email, password, verified, verification_token) VALUES (?, ?, ?, 0, ?)", [name, email, password, token],
            async(err2) => {
                if (err2) return res.status(500).send("Signup error");

                try {
                    const link = `http://localhost:4000/api/users/verify-email?token=${token}`;
                    await transporter.sendMail({
                        from: '"Lost & Found Portal" <arpitkushwaha210@gmail.com>',
                        to: email,
                        subject: "Verify your email - Lost & Found Portal",
                        html: `
              <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Welcome to Lost & Found Portal, ${name}!</h2>
                <p>Please click the button below to verify your email address:</p>
                <a href="${link}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a>
                <br><br>
                <p>Or paste this link into your browser: <br>${link}</p>
              </div>
            `
                    });

                    res.send("Verification email sent");
                } catch (mailErr) {
                    console.error("Mail send error:", mailErr);
                    res.status(500).send("Email sending failed");
                }
            }
        );
    });
});

// ==========================
// VERIFY EMAIL
// ==========================
router.get("/verify-email", (req, res) => {
    const { token } = req.query;

    db.query(
        "SELECT * FROM users WHERE verification_token = ?", [token],
        (err, result) => {
            if (err || result.length === 0) {
                return res.send("<h2 style='color:red;'>Invalid or expired link</h2>");
            }

            db.query(
                "UPDATE users SET verified = 1, verification_token = NULL WHERE id = ?", [result[0].id],
                () => res.send("<h2 style='color:green;'>Email verified successfully! You can now return to the portal and login.</h2>")
            );
        }
    );
});

// ==========================
// LOGIN
// ==========================
router.post("/login", (req, res) => {
    const { email, password } = req.body;

    db.query(
        "SELECT * FROM users WHERE email = ? AND password = ?", [email, password],
        (err, result) => {
            if (err) return res.status(500).send("DB error");
            if (result.length === 0) return res.status(400).send("Invalid credentials");
            if (!result[0].verified) return res.status(403).send("Verify email first");

            res.json({ message: "Login successful", user: result[0] });
        }
    );
});

// =====================================================
// USER PROFILE
// =====================================================
router.get("/profile/:userId", (req, res) => {
    const userId = req.params.userId;

    db.query("SELECT id, email FROM users WHERE id = ?", [userId], (err, users) => {
        if (err || users.length === 0) return res.status(404).send("User not found");

        const user = users[0];

        db.query("SELECT * FROM items WHERE user_email = ?", [user.email], (err2, items) => {
            if (err2) return res.status(500).send("Items fetch error");

            db.query("SELECT * FROM claims WHERE claimant_id = ?", [userId], (err3, claims) => {
                if (err3) return res.status(500).send("Claims fetch error");

                res.json({ user, items, claims });
            });
        });
    });
});

module.exports = router;