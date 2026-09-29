const express = require("express");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

// Temporary in-memory pairing storage
const devices = {};

// Generate a simple 6-character pairing code
function generatePairingCode() {
    return Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();
}

// Home
app.get("/", (req, res) => {
    res.json({
        message: "Notification API is running"
    });
});

// Generate pairing code
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

// Pair receiver using code
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

// Receive notification
app.post("/api/notifications", (req, res) => {

    const {
        deviceId,
        packageName,
        title,
        text
    } = req.body;

    console.log("========== NOTIFICATION ==========");
    console.log("Device:", deviceId);
    console.log("Package:", packageName);
    console.log("Title:", title);
    console.log("Text:", text);
    console.log("===================================");

    res.json({
        success: true,
        message: "Notification received"
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Notification API running on port ${PORT}`);
});
