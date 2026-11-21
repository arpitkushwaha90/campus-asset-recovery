module.exports = function(io) {
    const express = require("express");
    const router = express.Router();
    const db = require("../db");
    const { computeCompositeScore } = require("../utils/duplicateDetector");
    const { verifyClaimAnswer } = require("../utils/claimVerifier");
    const { computeImageHash } = require("../utils/imageHasher");

    /* ==========================================================
        ADD ITEM (WITH MULTIMODAL VISION, GEO-TIME & CHALLENGE)
    ========================================================== */
    router.post("/add", async(req, res) => {
        const {
            title,
            description,
            image,
            status,
            user_email,
            latitude,
            longitude,
            location_text,
            secret_question,
            secret_answer
        } = req.body;

        if (!title || !status || !user_email) {
            return res.status(400).send("Missing required fields");
        }

        // Generate 64-bit visual hash if image is present
        let imageHash = null;
        if (image) {
            imageHash = await computeImageHash(image);
        }

        const currentItem = {
            title,
            description,
            status,
            latitude: latitude ? parseFloat(latitude) : null,
            longitude: longitude ? parseFloat(longitude) : null,
            image_hash: imageHash
        };

        db.query(
            "SELECT id, title, description, status, user_email, latitude, longitude, image_hash, created_at FROM items ORDER BY id DESC LIMIT 100",
            (err, items) => {
                if (err) {
                    console.error("❌ DB error fetching items for matching:", err);
                    return res.status(500).send("DB error");
                }

                let bestMatch = null;
                let bestScoreObj = { total: 0, nlp: 0, geo: 0, time: 0, visual: 0 };

                items.forEach((item) => {
                    const scoreObj = computeCompositeScore(currentItem, item);

                    if (scoreObj.total > bestScoreObj.total) {
                        bestScoreObj = scoreObj;
                        bestMatch = item;
                    }
                });

                console.log(`\n🔍 [MULTIMODAL INSPECT] Input: "${title}" | Best Match: "${bestMatch ? bestMatch.title : 'None'}"`);
                console.log(`📊 Score Breakdown: NLP: ${(bestScoreObj.nlp * 100).toFixed(1)}% | Geo: ${(bestScoreObj.geo * 100).toFixed(1)}% | Vision: ${(bestScoreObj.visual * 100).toFixed(1)}% | Composite: ${(bestScoreObj.total * 100).toFixed(1)}%`);

                // Hard Duplicate Block: Same status && Composite Score >= 55%
                if (bestScoreObj.total >= 0.55 && bestMatch && bestMatch.status.toLowerCase() === status.toLowerCase()) {
                    console.log(`🚫 [DUPLICATE BLOCKED] Multi-modal duplicate detected for: "${title}"`);

                    return res.status(409).json({
                        isDuplicate: true,
                        message: "Duplicate item detected! This item is already listed.",
                        match: {
                            id: bestMatch.id,
                            title: bestMatch.title,
                            status: bestMatch.status,
                            similarity: Number((bestScoreObj.total * 100).toFixed(1))
                        }
                    });
                }

                const sql = `
                  INSERT INTO items
                  (title, description, image, image_hash, status, user_email, latitude, longitude, location_text, secret_question, secret_answer_hash)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;

                db.query(
                    sql, [
                        title,
                        description,
                        image,
                        imageHash,
                        status,
                        user_email,
                        latitude || null,
                        longitude || null,
                        location_text || null,
                        secret_question || null,
                        secret_answer ? secret_answer.trim().toLowerCase() : null
                    ],
                    (err2, result) => {
                        if (err2) {
                            console.error("❌ Add item error:", err2);
                            return res.status(500).send("Database error");
                        }

                        const newItem = {
                            id: result.insertId,
                            title,
                            description,
                            status,
                            user_email,
                            image,
                            latitude,
                            longitude,
                            location_text,
                            has_challenge: Boolean(secret_question)
                        };

                        io.emit("new_item", newItem);

                        // Cross-Status Match (Lost vs Found Alert threshold >= 40%)
                        const isOpposite = bestMatch && (bestMatch.status.toLowerCase() !== status.toLowerCase());
                        const crossMatch = (bestScoreObj.total >= 0.40 && isOpposite) ? {
                            id: bestMatch.id,
                            title: bestMatch.title,
                            status: bestMatch.status,
                            similarity: Number((bestScoreObj.total * 100).toFixed(1))
                        } : null;

                        res.json({
                            message: "Item added successfully",
                            item_id: result.insertId,
                            match: crossMatch
                        });
                    }
                );
            }
        );
    });

    /* =========================
        GET ALL ITEMS
    ========================= */
    router.get("/list", (req, res) => {
        const sql = `
          SELECT items.id, items.title, items.description, items.image, items.status,
                 items.user_email, items.latitude, items.longitude, items.location_text,
                 items.created_at, items.secret_question,
                 users.id AS user_id, users.verified
          FROM items
          LEFT JOIN users ON items.user_email = users.email
          ORDER BY items.created_at DESC
        `;

        db.query(sql, (err, rows) => {
            if (err) {
                console.error("❌ Items fetch error:", err);
                return res.status(500).send("DB error");
            }
            res.json(rows);
        });
    });

    /* ==========================================================
        SUBMIT CLAIM (WITH ANTI-FRAUD CHALLENGE EVALUATION)
    ========================================================== */
    router.post("/claim", (req, res) => {
        const { item_id, claimant_id, answers } = req.body;

        if (!item_id || !claimant_id || !answers) {
            return res.status(400).send("Missing claim data");
        }

        db.query(
            "SELECT user_email, secret_answer_hash FROM items WHERE id = ?", [item_id],
            (err, itemRows) => {
                if (err || itemRows.length === 0) {
                    return res.status(404).send("Item not found");
                }

                const ownerEmail = itemRows[0].user_email;
                const expectedAnswer = itemRows[0].secret_answer_hash;

                const verificationScore = expectedAnswer ?
                    verifyClaimAnswer(expectedAnswer, answers) :
                    100.0;

                console.log(`🔐 [CLAIM VERIFICATION] Item #${item_id} | Expected: "${expectedAnswer}" | Answer: "${answers}" | Score: ${verificationScore}%`);

                db.query(
                    "INSERT INTO claims (item_id, claimant_id, answers, verification_score) VALUES (?, ?, ?, ?)", [item_id, claimant_id, answers, verificationScore],
                    (err2, result) => {
                        if (err2) {
                            console.error("❌ Claim insert error:", err2);
                            return res.status(500).send("Claim failed");
                        }

                        const claimId = result.insertId;

                        io.to(`user_${ownerEmail}`).emit("new_notification", {
                            title: "New Claim Request",
                            body: `${answers} (Verification Confidence: ${verificationScore}%)`,
                            claim_id: claimId,
                            verification_score: verificationScore,
                            role: "owner"
                        });

                        res.json({
                            message: "Claim submitted successfully",
                            claim_id: claimId,
                            verification_score: verificationScore
                        });
                    }
                );
            }
        );
    });

    /* =========================
        MARK ITEM AS FOUND
    ========================= */
    router.put("/mark-found/:itemId", (req, res) => {
        const { itemId } = req.params;
        const { userId } = req.body;

        const sql = `
          UPDATE items 
          SET status = 'found' 
          WHERE id = ? AND user_email = (SELECT email FROM users WHERE id = ?)
        `;

        db.query(sql, [itemId, userId], (err, result) => {
            if (err) {
                console.error("❌ Mark found error:", err);
                return res.status(500).json({ error: "Database error" });
            }

            if (result.affectedRows === 0) {
                return res.status(403).json({ error: "Unauthorized ya item nahi mila" });
            }

            io.emit("item_status_updated", { itemId: Number(itemId), status: "found" });
            res.json({ message: "Item successfully marked as found!" });
        });
    });

    /* =========================
        ALERT SUBSCRIPTION
    ========================= */
    router.post("/alert-subscribe", (req, res) => {
        const { user_email, keyword } = req.body;

        if (!user_email || !keyword) {
            return res.status(400).json({ message: "Missing email or keyword" });
        }

        const sql = `INSERT INTO alert_subscriptions (user_email, item_keyword) VALUES (?, ?)`;

        db.query(sql, [user_email, keyword], (err) => {
            if (err) {
                console.error("❌ ALERT DB ERROR:", err);
                return res.status(500).json({ message: "Database error while saving alert" });
            }
            res.json({ message: "Alert subscribed successfully" });
        });
    });

    /* =========================
        APPROVE CLAIM
    ========================= */
    router.post("/claim/approve", (req, res) => {
        const { claim_id, location_text } = req.body;

        if (!claim_id || !location_text) {
            return res.status(400).send("Missing data");
        }

        db.query("UPDATE claims SET status='approved' WHERE id=?", [claim_id], (err) => {
            if (err) return res.status(500).send("Approve failed");

            db.query(
                `SELECT users.email FROM claims JOIN users ON claims.claimant_id = users.id WHERE claims.id = ?`, [claim_id],
                (err2, rows) => {
                    if (!rows || rows.length === 0) return res.send("Approved");

                    const claimantEmail = rows[0].email;

                    io.to(`user_${claimantEmail}`).emit("new_notification", {
                        title: "Claim Approved ✅",
                        body: `Pickup location: ${location_text}`,
                        role: "claimant"
                    });

                    res.send("Claim approved");
                }
            );
        });
    });

    /* =========================
        REJECT CLAIM
    ========================= */
    router.post("/claim/reject", (req, res) => {
        const { claim_id } = req.body;

        if (!claim_id) return res.status(400).send("Missing claim id");

        db.query("UPDATE claims SET status='rejected' WHERE id=?", [claim_id], (err) => {
            if (err) return res.status(500).send("Reject failed");

            db.query(
                `SELECT users.email FROM claims JOIN users ON claims.claimant_id = users.id WHERE claims.id = ?`, [claim_id],
                (err2, rows) => {
                    if (!rows || rows.length === 0) return res.send("Rejected");

                    const claimantEmail = rows[0].email;

                    io.to(`user_${claimantEmail}`).emit("new_notification", {
                        title: "Claim Rejected ❌",
                        body: "Owner rejected your claim request",
                        role: "claimant"
                    });

                    res.send("Rejected");
                }
            );
        });
    });

    /* =========================
        USER ITEMS
    ========================= */
    router.get("/user/:email", (req, res) => {
        const { email } = req.params;

        db.query(
            "SELECT * FROM items WHERE user_email = ? ORDER BY created_at DESC", [email],
            (err, rows) => {
                if (err) {
                    console.error("❌ User items error:", err);
                    return res.status(500).send("DB error");
                }
                res.json(rows);
            }
        );
    });

    /* =========================
        USER CLAIMS
    ========================= */
    router.get("/claims/:userId", (req, res) => {
        const { userId } = req.params;

        db.query(
            `SELECT claims.*, items.title, claims.verification_score 
             FROM claims 
             JOIN items ON claims.item_id = items.id 
             WHERE claims.claimant_id = ? 
             ORDER BY claims.created_at DESC`, [userId],
            (err, rows) => {
                if (err) {
                    console.error("❌ User claims error:", err);
                    return res.status(500).send("DB error");
                }
                res.json(rows);
            }
        );
    });

    return router;
};