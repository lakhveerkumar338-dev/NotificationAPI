const express = require("express");
const { Pool } = require("pg");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

/* =========================
   PostgreSQL Connection
========================= */

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

/* =========================
   Initialize Database
========================= */

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

    console.log("Database tables ready");
}

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

app.post("/api/pair/generate", async (req, res) => {

    try {

        let deviceId;

        while (true) {

            deviceId = generatePairingCode();

            const existing = await pool.query(
                `SELECT device_id
                 FROM devices
                 WHERE device_id = $1`,
                [deviceId]
            );

            if (existing.rows.length === 0) {
                break;
            }
        }

        await pool.query(
            `INSERT INTO devices
             (device_id, paired, receiver_id)
             VALUES ($1, FALSE, NULL)`,
            [deviceId]
        );

        res.json({
            success: true,
            deviceId: deviceId
        });

    } catch (error) {

        console.error(
            "Pairing code generation failed:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to generate pairing code"
        });
    }
});

/* =========================
   Connect Receiver
========================= */

app.post("/api/pair/connect", async (req, res) => {

    try {

        const {
            deviceId,
            receiverId
        } = req.body;

        if (!deviceId || !receiverId) {

            return res.status(400).json({
                success: false,
                message: "deviceId and receiverId are required"
            });
        }

        const result = await pool.query(
            `SELECT device_id
             FROM devices
             WHERE device_id = $1`,
            [deviceId]
        );

        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Invalid pairing code"
            });
        }

        await pool.query(
            `UPDATE devices
             SET paired = TRUE,
                 receiver_id = $1
             WHERE device_id = $2`,
            [receiverId, deviceId]
        );

        res.json({
            success: true,
            message: "Device paired successfully"
        });

    } catch (error) {

        console.error(
            "Pairing connection failed:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to connect device"
        });
    }
});

/* =========================
   Receive Notification
========================= */

app.post("/api/notifications", async (req, res) => {

    try {

        const {
            deviceId,
            packageName,
            title,
            text
        } = req.body;

        if (!deviceId) {

            return res.status(400).json({
                success: false,
                message: "deviceId is required"
            });
        }

        const device = await pool.query(
            `SELECT device_id
             FROM devices
             WHERE device_id = $1`,
            [deviceId]
        );

        if (device.rows.length === 0) {

            return res.status(400).json({
                success: false,
                message: "Invalid deviceId"
            });
        }

        await pool.query(
            `INSERT INTO notifications
             (device_id, package_name, title, text)
             VALUES ($1, $2, $3, $4)`,
            [
                deviceId,
                packageName || "",
                title || "",
                text || ""
            ]
        );

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

    } catch (error) {

        console.error(
            "Notification storage failed:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to store notification"
        });
    }
});

/* =========================
   Get Notifications
========================= */

app.get("/api/notifications/:deviceId", async (req, res) => {

    try {

        const {
            deviceId
        } = req.params;

        const device = await pool.query(
            `SELECT device_id
             FROM devices
             WHERE device_id = $1`,
            [deviceId]
        );

        if (device.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Invalid deviceId"
            });
        }

        const result = await pool.query(
            `SELECT
                package_name AS "packageName",
                title,
                text,
                received_at AS "receivedAt"
             FROM notifications
             WHERE device_id = $1
             ORDER BY received_at ASC`,
            [deviceId]
        );

        res.json({
            success: true,
            notifications: result.rows
        });

    } catch (error) {

        console.error(
            "Notification fetch failed:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to fetch notifications"
        });
    }
});

/* =========================
   Start Server
========================= */

initializeDatabase()
    .then(() => {

        app.listen(
            PORT,
            "0.0.0.0",
            () => {

                console.log(
                    `Notification API running on port ${PORT}`
                );
            }
        );

    })
    .catch((error) => {

        console.error(
            "Database initialization failed:",
            error
        );

        process.exit(1);
    });
