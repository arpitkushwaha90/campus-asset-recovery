import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import RecentActivity from "./RecentActivity";

function ViewItems() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");

    // Claim modal states
    const [showClaimForm, setShowClaimForm] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [claimText, setClaimText] = useState("");
    const [isClaiming, setIsClaiming] = useState(false);

    // QR Code modal states
    const [qrModalItem, setQrModalItem] = useState(null);
    const qrCanvasRef = useRef(null);

    // Owner Chat Inbox State
    const [inboxModal, setInboxModal] = useState(false);
    const [conversations, setConversations] = useState([]);
    const [inboxLoading, setInboxLoading] = useState(false);

    const navigate = useNavigate();
    const loggedUserId = localStorage.getItem("userId");

    /* =========================
        TIME AGO FUNCTION
    ========================= */
    const timeAgo = (date) => {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);

        let interval = Math.floor(seconds / 31536000);
        if (interval > 1) return interval + " years ago";

        interval = Math.floor(seconds / 2592000);
        if (interval > 1) return interval + " months ago";

        interval = Math.floor(seconds / 86400);
        if (interval > 1) return interval + " days ago";

        interval = Math.floor(seconds / 3600);
        if (interval > 1) return interval + " hours ago";

        interval = Math.floor(seconds / 60);
        if (interval > 1) return interval + " minutes ago";

        return "just now";
    };

    /* =========================
        LOAD ITEMS
    ========================= */
    const fetchItems = () => {
        axios
            .get("http://localhost:4000/api/items/list")
            .then((res) => {
                const normalized = res.data.map((i) => ({
                    ...i,
                    status: i.status ? i.status.toLowerCase() : "lost"
                }));
                setItems(normalized);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Fetch items error:", err);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchItems();
    }, []);

    /* =========================
        AUTO TIMER UPDATE
    ========================= */
    useEffect(() => {
        const timer = setInterval(() => {
            setItems((prev) => [...prev]);
        }, 60000);

        return () => clearInterval(timer);
    }, []);

    const filteredItems = items.filter((item) => {
        if (filter === "all") return true;
        return item.status === filter;
    });

    /* =========================
        OPEN CHAT LOGIC
    ========================= */
    const handleChatClick = async(item) => {
        if (!loggedUserId) {
            alert("Please login first to chat");
            return;
        }

        const postCreatorId = item.user_id || item.userId || item.creator_id;

        if (String(loggedUserId) === String(postCreatorId)) {
            setInboxLoading(true);
            setInboxModal(true);

            try {
                const res = await axios.get(
                    `http://localhost:4000/api/chat/conversations/${loggedUserId}`
                );
                setConversations(res.data);
            } catch (err) {
                console.error("Inbox load error:", err);
            } finally {
                setInboxLoading(false);
            }
            return;
        }

        navigate(`/chat/${loggedUserId}/${postCreatorId}`);
    };

    /* =========================
        MARK ITEM AS FOUND
    ========================= */
    const handleMarkAsFound = async(itemId) => {
        if (!window.confirm("Have you recovered this item? The status will be updated to 'Found'.")) {
            return;
        }

        try {
            await axios.put(`http://localhost:4000/api/items/mark-found/${itemId}`, {
                userId: loggedUserId
            });

            alert("Success! Item status updated to 'Found'.");

            setItems((prev) =>
                prev.map((i) => (i.id === itemId ? {...i, status: "found" } : i))
            );
        } catch (error) {
            console.error("Error marking found:", error);
            alert("Failed to update status. Please try again.");
        }
    };

    /* =========================
        DOWNLOAD QR POSTER
    ========================= */
    const downloadQRCode = () => {
        const canvas = document.getElementById("item-qr-canvas");
        if (!canvas) return;
        const pngUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = `LostAndFound_QR_${qrModalItem.id}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    };

    if (loading) {
        return ( <
            div className = "loading-container" >
            <
            div className = "loading-spinner" > < /div> <
            p > Loading items... < /p> <
            /div>
        );
    }

    return ( <
        div className = "view-items-container" >
        <
        RecentActivity / >

        <
        div className = "header-section" >
        <
        h1 className = "page-title" > Lost & Found Items < /h1> <
        p className = "page-subtitle" > Browse, claim, and connect with owners < /p> <
        /div>

        { /* FILTERS */ } <
        div className = "filter-tabs" >
        <
        button className = { `filter-btn ${filter === "all" ? "active" : ""}` }
        onClick = {
            () => setFilter("all") } >
        📦All Items <
        /button>

        <
        button className = { `filter-btn ${filter === "lost" ? "active" : ""}` }
        onClick = {
            () => setFilter("lost") } >
        🔍Lost Items <
        /button>

        <
        button className = { `filter-btn ${filter === "found" ? "active" : ""}` }
        onClick = {
            () => setFilter("found") } >
        🎯Found Items <
        /button> <
        /div>

        { /* ITEMS GRID */ } <
        div className = "items-grid" > {
            filteredItems.map((item) => {
                const itemCreatorId = item.user_id || item.userId;
                const isOwnPost = String(itemCreatorId) === String(loggedUserId);

                return ( <
                    div key = { item.id }
                    className = "item-card" >
                    <
                    div className = "item-image-container" >
                    <
                    img src = { item.image || "/placeholder.jpg" }
                    alt = { item.title }
                    className = "item-image"
                    onError = {
                        (e) => {
                            e.target.src = "/placeholder.jpg";
                        }
                    }
                    /> <
                    span className = { `status-badge ${item.status}` } > { item.status.toUpperCase() } <
                    /span> <
                    /div>

                    <
                    div className = "item-content" >
                    <
                    h3 className = "item-title" > { item.title } < /h3>

                    {
                        item.verified === 1 && ( <
                            div className = "verified-badge" > ✔Verified Owner < /div>
                        )
                    }

                    <
                    div className = "item-time" > ⏱Reported { timeAgo(item.created_at) } < /div>

                    <
                    p className = "item-description" > { item.description } < /p>

                    <
                    div className = "item-actions" >
                    <
                    button className = "chat-btn"
                    onClick = {
                        () => handleChatClick(item) }
                    style = {
                        {
                            background: isOwnPost ?
                                "linear-gradient(135deg,#10b981,#059669)" :
                                "linear-gradient(135deg,#667eea,#764ba2)"
                        }
                    } >
                    { isOwnPost ? "📩 View Chats" : "💬 Chat" } <
                    /button>

                    { /* Owner Mark as Found Button */ } {
                        isOwnPost && item.status === "lost" && ( <
                            button onClick = {
                                () => handleMarkAsFound(item.id) }
                            style = {
                                {
                                    padding: "12px 14px",
                                    background: "linear-gradient(135deg, #10b981, #059669)",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "14px",
                                    fontWeight: "600",
                                    cursor: "pointer",
                                    boxShadow: "0 10px 30px rgba(16, 185, 129, 0.35)",
                                    transition: "0.25s"
                                }
                            } >
                            ✅Got It!
                            <
                            /button>
                        )
                    }

                    {
                        item.status === "found" && !isOwnPost && ( <
                            button className = "claim-btn"
                            onClick = {
                                () => {
                                    setSelectedItem(item);
                                    setShowClaimForm(true);
                                }
                            } >
                            📝Claim <
                            /button>
                        )
                    }

                    { /* QR Code Quick View Button */ } {
                        item.status === "found" && ( <
                            button className = "qr-btn"
                            title = "Generate item QR flyer"
                            onClick = {
                                () => setQrModalItem(item) } >
                            📱QR <
                            /button>
                        )
                    } <
                    /div> <
                    /div> <
                    /div>
                );
            })
        } <
        /div>

        { /* QR CODE FLYER MODAL */ } {
            qrModalItem && ( <
                div className = "claim-overlay"
                onClick = {
                    () => setQrModalItem(null) } >
                <
                div className = "claim-box"
                style = {
                    { textAlign: "center", maxWidth: "420px" } }
                onClick = {
                    (e) => e.stopPropagation() } >
                <
                h3 style = {
                    { margin: "0 0 6px 0", color: "#0f172a" } } > 📄Item Notice QR Flyer < /h3> <
                p style = {
                    { fontSize: "13px", color: "#64748b", marginBottom: "20px" } } >
                Print or stick this QR code near where you found the item. <
                /p>

                <
                div style = {
                    {
                        background: "#ffffff",
                        padding: "20px",
                        borderRadius: "16px",
                        border: "2px dashed #cbd5e1",
                        display: "inline-block",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.05)"
                    }
                } >
                <
                QRCodeCanvas id = "item-qr-canvas"
                value = { `${window.location.origin}/items?itemId=${qrModalItem.id}` }
                size = { 190 }
                level = { "H" }
                includeMargin = { true }
                /> <
                div style = {
                    { fontWeight: "700", color: "#1e293b", marginTop: "10px", fontSize: "15px" } } > { qrModalItem.title } <
                /div> <
                div style = {
                    { fontSize: "12px", color: "#64748b" } } >
                Scan to claim with Anti - Fraud Shield <
                /div> <
                /div>

                <
                div className = "claim-actions"
                style = {
                    { marginTop: "24px" } } >
                <
                button onClick = { downloadQRCode }
                style = {
                    {
                        background: "linear-gradient(135deg, #10b981, #059669)",
                        color: "white"
                    }
                } >
                ⬇️Download QR PNG <
                /button> <
                button onClick = {
                    () => setQrModalItem(null) } >
                Close <
                /button> <
                /div> <
                /div> <
                /div>
            )
        }

        { /* OWNER INBOX MODAL */ } {
            inboxModal && ( <
                div className = "claim-overlay"
                onClick = {
                    () => setInboxModal(false) } >
                <
                div className = "claim-box"
                onClick = {
                    (e) => e.stopPropagation() } >
                <
                h3 > Conversations & Inquiries < /h3> <
                p style = {
                    { color: "#64748b", fontSize: "13px" } } >
                Select a user to
                continue the conversation:
                <
                /p>

                {
                    inboxLoading ? ( <
                        p > Loading messages... < /p>
                    ) : conversations.length === 0 ? ( <
                        div style = {
                            { textAlign: "center", padding: "20px" } } >
                        <
                        p > No inquiries received
                        for this item yet. < /p> <
                        /div>
                    ) : ( <
                        div style = {
                            {
                                display: "flex",
                                flexDirection: "column",
                                gap: "10px",
                                marginTop: "15px",
                                maxHeight: "250px",
                                overflowY: "auto"
                            }
                        } >
                        {
                            conversations.map((c) => ( <
                                div key = { c.contact_id }
                                onClick = {
                                    () => {
                                        setInboxModal(false);
                                        navigate(`/chat/${loggedUserId}/${c.contact_id}`);
                                    }
                                }
                                style = {
                                    {
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        padding: "12px 16px",
                                        border: "1px solid #e2e8f0",
                                        borderRadius: "10px",
                                        cursor: "pointer",
                                        background: "#f8fafc"
                                    }
                                } >
                                <
                                div >
                                <
                                div style = {
                                    { fontWeight: "600" } } > { c.contact_name || `User #${c.contact_id}` } <
                                /div> <
                                div style = {
                                    { fontSize: "12px", color: "#64748b" } } > { c.contact_email } <
                                /div> <
                                /div> <
                                button style = {
                                    {
                                        padding: "6px 14px",
                                        background: "#2563eb",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "6px",
                                        cursor: "pointer"
                                    }
                                } >
                                Open Chat→ <
                                /button> <
                                /div>
                            ))
                        } <
                        /div>
                    )
                }

                <
                div className = "claim-actions"
                style = {
                    { marginTop: "20px" } } >
                <
                button onClick = {
                    () => setInboxModal(false) }
                style = {
                    { background: "#f3f4f6" } } >
                Close <
                /button> <
                /div> <
                /div> <
                /div>
            )
        }

        { /* CLAIM POPUP WITH ANTI-FRAUD VERIFICATION */ } {
            showClaimForm && selectedItem && ( <
                div className = "claim-overlay" >
                <
                div className = "claim-box" >
                <
                h3 > 🛡️Claim Verification < /h3> <
                p style = {
                    { fontWeight: "700", color: "#1e293b", margin: "6px 0 16px 0" } } > { selectedItem.title } <
                /p>

                { /* Secret Question Display Box */ } {
                    selectedItem.secret_question ? ( <
                        div style = {
                            {
                                background: "#eff6ff",
                                border: "1px solid #bfdbfe",
                                borderRadius: "12px",
                                padding: "14px",
                                marginBottom: "16px",
                                textAlign: "left"
                            }
                        } >
                        <
                        div style = {
                            { fontSize: "12px", fontWeight: "700", color: "#1d4ed8", textTransform: "uppercase" } } >
                        Security Question by Finder:
                        <
                        /div> <
                        div style = {
                            { fontSize: "14px", fontWeight: "600", color: "#0f172a", marginTop: "4px" } } >
                        "{selectedItem.secret_question}" <
                        /div> <
                        /div>
                    ) : ( <
                        p style = {
                            { fontSize: "13px", color: "#64748b", marginBottom: "12px" } } >
                        Please provide specific details to prove your ownership:
                        <
                        /p>
                    )
                }

                <
                textarea placeholder = {
                    selectedItem.secret_question ?
                    "Type your answer here to prove ownership..." :
                        "Describe unique marks, serial numbers, stickers, or contents..."
                }
                value = { claimText }
                onChange = {
                    (e) => setClaimText(e.target.value) }
                disabled = { isClaiming }
                />

                <
                div className = "claim-actions" >
                <
                button disabled = { isClaiming }
                onClick = {
                    async() => {
                        if (!claimText.trim()) {
                            alert("Please enter your answer / ownership proof");
                            return;
                        }

                        if (!loggedUserId) {
                            alert("Please login first to submit a claim");
                            return;
                        }

                        setIsClaiming(true);
                        try {
                            const res = await axios.post("http://localhost:4000/api/items/claim", {
                                item_id: selectedItem.id,
                                claimant_id: loggedUserId,
                                answers: claimText
                            });

                            const score = res.data.verification_score !== undefined ? res.data.verification_score : 100;

                            if (score >= 40) {
                                alert(`✅ Claim Verified! Match Score: ${score}%\nOpening chat with the finder.`);
                                const targetOwnerId = selectedItem.user_id || selectedItem.userId;
                                navigate(`/chat/${loggedUserId}/${targetOwnerId}`);
                                setShowClaimForm(false);
                                setClaimText("");
                            } else {
                                alert(`⚠️ Low Verification Score (${score}%).\nYour answer does not match the finder's security criteria.`);
                            }
                        } catch (err) {
                            console.error("Claim error:", err);
                            alert("Error submitting claim. Please try again.");
                        } finally {
                            setIsClaiming(false);
                        }
                    }
                } >
                { isClaiming ? "Verifying Answer..." : "Submit Claim" } <
                /button>

                <
                button disabled = { isClaiming }
                onClick = {
                    () => {
                        setShowClaimForm(false);
                        setClaimText("");
                    }
                } >
                Cancel <
                /button> <
                /div> <
                /div> <
                /div>
            )
        }

        { /* CSS */ } <
        style > { `
                body {
                  font-family: "Poppins", sans-serif;
                  background: linear-gradient(135deg, #eef2ff, #e0f2fe, #f8fafc);
                }
                .view-items-container {
                  max-width: 1400px;
                  margin: auto;
                  padding: 50px 20px;
                }
                .header-section {
                  text-align: center;
                  margin-bottom: 60px;
                }
                .page-title {
                  font-size: 3.2rem;
                  font-weight: 900;
                  background: linear-gradient(135deg, #667eea, #764ba2);
                  -webkit-background-clip: text;
                  -webkit-text-fill-color: transparent;
                  letter-spacing: -1px;
                  margin-bottom: 12px;
                }
                .page-subtitle {
                  font-size: 1.15rem;
                  color: #6b7280;
                }
                .filter-tabs {
                  display: flex;
                  justify-content: center;
                  gap: 18px;
                  margin-bottom: 45px;
                }
                .filter-btn {
                  padding: 12px 26px;
                  border-radius: 40px;
                  border: none;
                  background: white;
                  font-weight: 600;
                  cursor: pointer;
                  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
                  transition: 0.25s;
                }
                .filter-btn:hover {
                  transform: translateY(-3px);
                  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15);
                }
                .filter-btn.active {
                  background: linear-gradient(135deg, #667eea, #764ba2);
                  color: white;
                }
                .items-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                  gap: 35px;
                }
                .item-card {
                  background: rgba(255, 255, 255, 0.8);
                  backdrop-filter: blur(15px);
                  border-radius: 26px;
                  overflow: hidden;
                  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.12);
                  transition: 0.4s;
                  position: relative;
                }
                .item-card:hover {
                  transform: translateY(-14px) scale(1.02);
                  box-shadow: 0 40px 90px rgba(0, 0, 0, 0.2);
                }
                .item-image-container {
                  position: relative;
                  height: 240px;
                  overflow: hidden;
                }
                .item-image {
                  width: 100%;
                  height: 100%;
                  object-fit: cover;
                  transition: 0.7s;
                }
                .item-card:hover .item-image {
                  transform: scale(1.15);
                }
                .item-image-container::after {
                  content: "";
                  position: absolute;
                  inset: 0;
                  background: linear-gradient(transparent, rgba(0, 0, 0, 0.35));
                }
                .status-badge {
                  position: absolute;
                  top: 16px;
                  right: 16px;
                  padding: 7px 15px;
                  border-radius: 20px;
                  font-size: 12px;
                  font-weight: 700;
                  color: white;
                  letter-spacing: 0.5px;
                }
                .status-badge.lost {
                  background: linear-gradient(135deg, #ff4d4d, #ff0000);
                }
                .status-badge.found {
                  background: linear-gradient(135deg, #2ecc71, #27ae60);
                }
                .item-content {
                  padding: 24px;
                }
                .item-title {
                  font-size: 1.45rem;
                  font-weight: 700;
                  margin-bottom: 8px;
                  color: #1f2937;
                }
                .verified-badge {
                  display: inline-block;
                  background: #ecfdf5;
                  color: #10b981;
                  font-size: 12px;
                  padding: 5px 10px;
                  border-radius: 8px;
                  font-weight: 600;
                  margin-bottom: 10px;
                }
                .item-time {
                  font-size: 13px;
                  color: #9ca3af;
                  margin-bottom: 12px;
                }
                .item-description {
                  font-size: 14px;
                  color: #4b5563;
                  margin-bottom: 20px;
                  line-height: 1.6;
                  display: -webkit-box;
                  -webkit-line-clamp: 3;
                  -webkit-box-orient: vertical;
                  overflow: hidden;
                }
                .item-actions {
                  display: flex;
                  gap: 8px;
                  flex-wrap: wrap;
                }
                .chat-btn {
                  flex: 1;
                  padding: 12px;
                  border: none;
                  border-radius: 14px;
                  font-weight: 600;
                  cursor: pointer;
                  color: white;
                  box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
                  transition: 0.25s;
                }
                .chat-btn:hover {
                  transform: translateY(-3px);
                  box-shadow: 0 18px 40px rgba(102, 126, 234, 0.5);
                }
                .claim-btn {
                  flex: 1;
                  padding: 12px;
                  border: none;
                  border-radius: 14px;
                  font-weight: 600;
                  cursor: pointer;
                  color: white;
                  background: linear-gradient(135deg, #f59e0b, #ea580c);
                  box-shadow: 0 10px 30px rgba(234, 88, 12, 0.35);
                  transition: 0.25s;
                }
                .claim-btn:hover {
                  transform: translateY(-3px);
                  box-shadow: 0 18px 40px rgba(234, 88, 12, 0.45);
                }
                .qr-btn {
                  padding: 12px 14px;
                  border: none;
                  border-radius: 14px;
                  font-weight: 600;
                  cursor: pointer;
                  color: #1e293b;
                  background: #f1f5f9;
                  border: 1px solid #cbd5e1;
                  transition: 0.25s;
                }
                .qr-btn:hover {
                  background: #e2e8f0;
                  transform: translateY(-2px);
                }
                .claim-overlay {
                  position: fixed;
                  inset: 0;
                  background: rgba(0, 0, 0, 0.55);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  backdrop-filter: blur(10px);
                  z-index: 1000;
                  animation: fadeIn 0.3s;
                }
                .claim-box {
                  width: 460px;
                  background: white;
                  padding: 35px;
                  border-radius: 24px;
                  box-shadow: 0 50px 120px rgba(0, 0, 0, 0.4);
                  animation: popUp 0.35s;
                }
                .claim-box textarea {
                  width: 100%;
                  padding: 15px;
                  border-radius: 12px;
                  border: 1px solid #ddd;
                  font-size: 14px;
                  min-height: 120px;
                  margin-top: 12px;
                  transition: 0.2s;
                  box-sizing: border-box;
                }
                .claim-box textarea:focus {
                  outline: none;
                  border-color: #667eea;
                  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
                }
                .claim-actions {
                  display: flex;
                  gap: 12px;
                  margin-top: 20px;
                }
                .claim-actions button {
                  flex: 1;
                  padding: 12px;
                  border: none;
                  border-radius: 12px;
                  font-weight: 600;
                  cursor: pointer;
                }
                .claim-actions button:first-child {
                  background: linear-gradient(135deg, #667eea, #764ba2);
                  color: white;
                }
                .claim-actions button:last-child {
                  background: #f3f4f6;
                }
                .loading-container {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  height: 350px;
                }
                .loading-spinner {
                  width: 60px;
                  height: 60px;
                  border: 6px solid #eee;
                  border-top: 6px solid #667eea;
                  border-radius: 50%;
                  animation: spin 1s linear infinite;
                }
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
                @keyframes fadeIn {
                  from { opacity: 0; }
                  to { opacity: 1; }
                }
                @keyframes popUp {
                  from { transform: scale(0.8); opacity: 0; }
                  to { transform: scale(1); opacity: 1; }
                }
            ` } < /style> <
        /div>
    );
}

export default ViewItems;