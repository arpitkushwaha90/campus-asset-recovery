const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const chatbotRoute = require("./routes/chatbot");
const activityRoutes = require("./routes/activityRoutes");
const recoveryStories = require("./routes/recoveryStories");
const app = express();

// ✅ MIDDLEWARE
app.use(cors());
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// SOCKET.IO SETUP
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// ✅ SOCKET EVENTS (FIXED CHAT + NOTIFICATIONS)
io.on("connection", (socket) => {
    console.log("🔌 User connected:", socket.id);

    // Join Room (Email ya ID dono support karega)
    socket.on("joinRoom", (userId) => {
        socket.join(`user_${userId}`);
        socket.join(String(userId));
        console.log(`✅ Joined room: user_${userId}`);
    });

    // Real-time Chat Messaging
    socket.on("sendMessage", (data) => {
        console.log("📨 Socket message relay:", data);

        // Receiver ko message bhejo (ID aur room dono formats mein)
        io.to(`user_${data.receiver_id}`).emit("receiveMessage", data);
        io.to(String(data.receiver_id)).emit("receiveMessage", data);

        // Sender ko bhi update bhejo
        io.to(`user_${data.sender_id}`).emit("receiveMessage", data);
        io.to(String(data.sender_id)).emit("receiveMessage", data);
    });

    socket.on("disconnect", () => {
        console.log("❌ User disconnected:", socket.id);
    });
});

// ROUTES
const userRoutes = require("./routes/userRoutes");
const itemRoutes = require("./routes/itemRoutes")(io);
const uploadRoute = require("./routes/uploadRoute");
const adminRoutes = require("./routes/adminRoutes");
const chatRoutes = require("./routes/chatRoutes");

// 🔔 NEW NOTIFICATION ROUTES
const notificationRoutes = require("./routes/notificationRoutes")(io);

// REGISTER ROUTES
app.use("/api/users", userRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/upload", uploadRoute);
app.use("/api/admin", adminRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api", recoveryStories);

// 🔔 REGISTER NOTIFICATION API
app.use("/api/notifications", notificationRoutes);

// ✅ CHATBOT ROUTE
app.use("/chatbot", chatbotRoute);

// STATIC FILES
app.use("/uploads", express.static("uploads"));

// START SERVER
server.listen(4000, () => {
    console.log("🚀 Server + Socket.IO running on port 4000");
});