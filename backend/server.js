const express = require("express");
const cors = require("cors");
require("dotenv").config();

// Initialize Firebase FIRST
const admin = require("firebase-admin");
const serviceAccount = require("./firebase-service-account.json");

// Initialize with more options
const firebaseApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "setux-1881.appspot.com"
});

// Get services
const db = admin.firestore();
const bucket = admin.storage().bucket();

// Verify initialization
console.log("Firebase initialized successfully");
console.log("Firestore available:", !!db);
console.log("Storage available:", !!bucket);

// Export for other files to use
module.exports = { admin, db, bucket };

// ... rest of your server.js code
const recordRoutes = require("../routes/records");

const app = express();
const PORT = process.env.PORT || 3000;


// 💥 Crash catchers
process.on("unhandledRejection", (err) => {
  console.error("💥 Unhandled Rejection:", err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err);
  process.exit(1);
});

// 🔧 Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🧪 Health Check
app.get("/", (req, res) => {
  res.send("✅ SetuX backend is running");
});

// 📦 Blockchain-related routes
app.use("/api", recordRoutes);

// 🚀 Launch
app.listen(PORT, () => {
  console.log(`🌐 SetuX backend live at http://localhost:${PORT}`);
});
