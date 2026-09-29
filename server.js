const express = require("express");

const { Pool } = require("pg");

const app = express();

app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function initializeDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS devices (
            device_id TEXT PRIMARY KEY,
            paired BOOLEAN DEFAULT FALSE,
            receiver_id TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS notifications (
            id BIGSERIAL PRIMARY KEY,
            device_id TEXT REFERENCES devices(device_id),
            package_name TEXT,
            title TEXT,
            text TEXT,
            received_at TIMESTAMPTZ DEFAULT NOW()
        );
    `);
}

const PORT = process.env.PORT || 3000;

// Temporary in-memory storage
const devices = {};
const notifications = {};

/* =========================
   Generate Pairing Code
========================= */

function generatePairingCode() {
    return Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();
}

/* =========================
   Home
========================= */

app.get("/", (req, res) => {
    res.json({
        message: "Notification API is running"
    });
});

/* =========================
   Generate Pairing Code
========================= */

app.post("/api/pair/generate", (req, res) => {

    const deviceId = generatePairingCode();

    devices[deviceId] = {
        paired: false,
        receiverId: null
    };

    res.json({
        success: true,
        deviceId: deviceId
    });
});

/* =========================
   Connect Receiver
========================= */

app.post("/api/pair/connect", (req, res) => {

    const { deviceId, receiverId } = req.body;

    if (!deviceId || !receiverId) {
        return res.status(400).json({
            success: false,
            message: "deviceId and receiverId are required"
        });
    }

    if (!devices[deviceId]) {
        return res.status(404).json({
            success: false,
            message: "Invalid pairing code"
        });
    }

    devices[deviceId].paired = true;
    devices[deviceId].receiverId = receiverId;

    res.json({
        success: true,
        message: "Device paired successfully"
    });
});

/* =========================
   Receive Notification
========================= */

app.post("/api/notifications", (req, res) => {

    const {
        deviceId,
        packageName,
        title,
        text
    } = req.body;

    // Check source device
    if (!deviceId || !devices[deviceId]) {
        return res.status(400).json({
            success: false,
            message: "Invalid or missing deviceId"
        });
    }

    // Create notification list
    if (!notifications[deviceId]) {
        notifications[deviceId] = [];
    }

    // Store notification
    notifications[deviceId].push({
        packageName: packageName || "",
        title: title || "",
        text: text || "",
        receivedAt: new Date().toISOString()
    });

    console.log("========== NOTIFICATION ==========");
    console.log("Device:", deviceId);
    console.log("Package:", packageName);
    console.log("Title:", title);
    console.log("Text:", text);
    console.log("===================================");

    res.json({
        success: true,
        message: "Notification received and stored"
    });
});

/* =========================
   Get Notifications
========================= */

app.get("/api/notifications/:deviceId", (req, res) => {

    const { deviceId } = req.params;

    if (!devices[deviceId]) {
        return res.status(404).json({
            success: false,
            message: "Invalid deviceId"
        });
    }

    res.json({
        success: true,
        notifications: notifications[deviceId] || []
    });
});

/* =========================
   Start Server
========================= */

initializeDatabase()
    .then(() => {
        app.listen(PORT, "0.0.0.0", () => {
            console.log(`Notification API running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error("Database initialization failed:", error);
    });
