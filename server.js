const express = require("express");

const app = express();

app.use(express.json());

const PORT = 3000;

app.get("/", (req, res) => {
    res.json({
        message: "Notification API is running"
    });
});

app.post("/api/notifications", (req, res) => {

    const { packageName, title, text } = req.body;

    console.log("========== NOTIFICATION ==========");
    console.log("Package:", packageName);
    console.log("Title:", title);
    console.log("Text:", text);
    console.log("===================================");

    res.json({
        success: true,
        message: "Notification received"
    });
});

app.listen(PORT, () => {
    console.log(`Notification API running on port ${PORT}`);
});