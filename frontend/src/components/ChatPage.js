import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import { socket } from "../socket";

function ChatPage() {
    const { senderId, receiverId } = useParams();

    const sId = parseInt(senderId, 10);
    const rId = parseInt(receiverId, 10);

    const [messages, setMessages] = useState([]);
    const [msg, setMsg] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const bottomRef = useRef(null);

    // Fetch chat history function
    const fetchChatHistory = () => {
        if (!sId || !rId) return;
        axios
            .get(`http://localhost:4000/api/chat/history/${sId}/${rId}`)
            .then((res) => {
                setMessages(res.data);
                setIsLoading(false);
            })
            .catch((err) => {
                console.error("Error loading chat history:", err);
                setIsLoading(false);
            });
    };

    // Initial fetch
    useEffect(() => {
        setIsLoading(true);
        fetchChatHistory();
    }, [sId, rId]);

    // Socket setup (Real-time receive)
    useEffect(() => {
        if (!sId) return;

        socket.emit("joinRoom", sId);
        socket.emit("joinRoom", `user_${sId}`);

        const handleReceive = (data) => {
            if (
                (Number(data.sender_id) === rId && Number(data.receiver_id) === sId) ||
                (Number(data.sender_id) === sId && Number(data.receiver_id) === rId)
            ) {
                setMessages((prev) => {
                    const exists = prev.some((m) => m.id && data.id && m.id === data.id);
                    return exists ? prev : [...prev, data];
                });
            }
        };

        socket.on("receiveMessage", handleReceive);
        socket.on("message", handleReceive);

        return () => {
            socket.off("receiveMessage", handleReceive);
            socket.off("message", handleReceive);
        };
    }, [sId, rId]);

    // Auto scroll to bottom
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    // Send message
    const sendMessage = async() => {
        if (!msg.trim()) return;

        setIsSending(true);
        const body = {
            sender_id: sId,
            receiver_id: rId,
            message: msg
        };

        try {
            const res = await axios.post(
                "http://localhost:4000/api/chat/send",
                body
            );

            socket.emit("sendMessage", res.data);
            setMessages((prev) => [...prev, res.data]);
            setMsg("");
        } catch (error) {
            console.error("Error sending message:", error);
            alert("Failed to send message");
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return "";
        const date = new Date(timestamp);
        return date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        });
    };

    return ( <
        div className = "chat-container" > { /* Header */ } <
        div className = "chat-header" >
        <
        div className = "header-content" >
        <
        div className = "user-avatar" > 👤 < /div> <
        div className = "user-info" >
        <
        h3 className = "user-name" > User# { rId } < /h3> <
        div className = "user-status" >
        <
        span className = "status-dot" > < /span> <
        span className = "status-text" > Active Chat < /span> < /
        div > <
        /div> < /
        div > <
        div className = "header-actions" >
        <
        button onClick = { fetchChatHistory }
        className = "action-btn"
        title = "Refresh Messages"
        style = {
            {
                background: "#e2e8f0",
                border: "none",
                padding: "8px 12px",
                borderRadius: "6px",
                cursor: "pointer",
                marginRight: "10px"
            }
        } > 🔄Sync <
        /button> <
        button onClick = {
            async() => {
                if (!window.confirm("Delete chat history?")) return;
                try {
                    await axios.delete(
                        `http://localhost:4000/api/chat/delete/${sId}/${rId}`
                    );
                    setMessages([]);
                } catch (delErr) {
                    console.error(delErr);
                }
            }
        }
        style = {
            {
                background: "#ff4d4d",
                color: "white",
                border: "none",
                padding: "8px 12px",
                borderRadius: "6px",
                cursor: "pointer"
            }
        } > 🗑Delete Chat <
        /button> < /
        div > <
        /div>

        { /* Messages Area */ } <
        div className = "messages-container" > {
            isLoading ? ( <
                div className = "loading-messages" >
                <
                div className = "spinner" > < /div> <
                p > Loading conversation... < /p> < /
                div >
            ) : messages.length === 0 ? ( <
                    div className = "empty-chat" >
                    <
                    div className = "empty-icon" > 💬 < /div> <
                    h4 > No messages yet < /h4> <
                    p > Start a conversation by typing below! < /p> < /
                    div >
                ) : ( <
                    div className = "messages-list" > {
                        messages.map((m, index) => {
                                const isOwnMessage = Number(m.sender_id) === sId;
                                const showAvatar = !isOwnMessage &&
                                    (index === 0 || Number(messages[index - 1].sender_id) !== Number(m.sender_id));

                                return ( <
                                    div key = { m.id || index }
                                    className = { `message-wrapper ${isOwnMessage ? "own-message" : "other-message"}` } > {
                                        showAvatar && < div className = "message-avatar" > 👤 < /div>} <
                                        div className = "message-content" >
                                        <
                                        div
                                        className = { `message-bubble ${
                        isOwnMessage ? "own-bubble" : "other-bubble"
                      }` } >
                                        <
                                        div className = "message-text" > { m.message } < /div> <
                                        div className = "message-time" > { formatTime(m.created_at || m.timestamp) } <
                                        /div> < /
                                        div > <
                                        /div> < /
                                        div >
                                    );
                                })
                        } <
                        div ref = { bottomRef }
                        className = "scroll-anchor" > < /div> < /
                        div >
                    )
                } <
                /div>

            { /* Input Area */ } <
            div className = "input-container" >
            <
            div className = "input-wrapper" >
            <
            input
            type = "text"
            placeholder = "Type a message..."
            value = { msg }
            onChange = {
                (e) => setMsg(e.target.value)
            }
            onKeyPress = { handleKeyPress }
            className = "message-input"
            disabled = { isSending }
            /> <
            button
            onClick = { sendMessage }
            className = { `send-button ${isSending ? "sending" : ""}` }
            disabled = {!msg.trim() || isSending } > {
                isSending ? ( <
                    div className = "send-spinner" > < /div>
                ) : ( <
                    span className = "send-icon" > ➤ < /span>
                )
            } <
            /button> < /
            div > <
            /div>

            <
            style > { `
        .chat-container {
          width: 100%;
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: linear-gradient(135deg, #eef2ff, #e0f2fe, #f8fafc);
        }
        .chat-header {
          background: rgba(255, 255, 255, 0.95);
          padding: 14px 24px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
        }
        .header-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .user-avatar {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea, #764ba2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          color: white;
        }
        .user-name {
          margin: 0;
          font-size: 16px;
          color: #1e293b;
        }
        .user-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #64748b;
        }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #2ecc71;
        }
        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }
        .empty-chat {
          text-align: center;
          margin-top: 50px;
          color: #64748b;
        }
        .empty-icon {
          font-size: 40px;
          margin-bottom: 10px;
        }
        .messages-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-width: 800px;
          margin: auto;
        }
        .message-wrapper {
          display: flex;
          align-items: flex-end;
          gap: 8px;
        }
        .message-wrapper.own-message {
          flex-direction: row-reverse;
        }
        .message-avatar {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
        }
        .message-bubble {
          padding: 10px 16px;
          border-radius: 16px;
          max-width: 480px;
          word-break: break-word;
        }
        .own-bubble {
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border-bottom-right-radius: 4px;
        }
        .other-bubble {
          background: white;
          color: #1e293b;
          border-bottom-left-radius: 4px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }
        .message-text {
          font-size: 14px;
          margin-bottom: 3px;
        }
        .message-time {
          font-size: 10px;
          opacity: 0.75;
          text-align: right;
        }
        .input-container {
          background: white;
          padding: 16px 24px;
          border-top: 1px solid rgba(0, 0, 0, 0.08);
        }
        .input-wrapper {
          max-width: 800px;
          margin: auto;
          display: flex;
          gap: 10px;
        }
        .message-input {
          flex: 1;
          padding: 12px 18px;
          border-radius: 25px;
          border: 1px solid #cbd5e1;
          font-size: 14px;
          outline: none;
        }
        .message-input:focus {
          border-color: #667eea;
        }
        .send-button {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          border: none;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .send-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      ` } < /style> < /
            div >
        );
    }

    export default ChatPage;