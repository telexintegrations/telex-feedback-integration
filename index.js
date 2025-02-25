const express = require("express");
const axios = require("axios");
const fs = require("fs");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const SHEET_ID = process.env.SHEET_ID;
const API_KEY = process.env.GOOGLE_API_KEY;
const PROCESSED_FILE = "processed_feedback.json";

app.use(cors());
app.use(express.json());

// Load processed feedback timestamps
const loadProcessedFeedback = () => {
    if (!fs.existsSync(PROCESSED_FILE)) {
        fs.writeFileSync(PROCESSED_FILE, JSON.stringify([]));
        return [];
    }
    try {
        const data = fs.readFileSync(PROCESSED_FILE, "utf-8");
        return data.trim() ? JSON.parse(data) : [];
    } catch (error) {
        console.error("Error reading processed feedback file:", error);
        return [];
    }
};

// Save processed feedback timestamps
const saveProcessedFeedback = (processed) => {
    try {
        fs.writeFileSync(PROCESSED_FILE, JSON.stringify(processed, null, 2));
    } catch (error) {
        console.error("Error saving processed feedback:", error);
    }
};

// Fetch Google Sheets Data (Using URL from settings)
const fetchFormResponses = async (sheetsUrl) => {
    try {
        const response = await axios.get(sheetsUrl);
        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.log("No data found.");
            return [];
        }
        return rows.slice(1).map(row => ({ timestamp: row[0], feedback: row[1] }));
    } catch (error) {
        console.error("Error fetching data from Google Sheets:", error);
        return [];
    }
};

// Send Feedback Data to Telex
const sendToTelex = async (feedback, return_url) => {
    try {
        const payload = {
            message: `New Feedback: ${feedback.feedback}\nSubmitted at: ${feedback.timestamp}`,
            username: "Form Monitor Bot",
            event_name: "form_feedback_event",
            status: "success"
        };
        await axios.post(return_url, payload, {
            headers: {
                "Content-Type": "application/json"
            }
        });
        console.log(`Feedback sent to Telex successfully: ${return_url}`);
    } catch (error) {
        console.error(`Error sending data to Telex (${return_url}):`, error.message);
    }
};

// Process New Feedback Entries
const processFeedback = async (return_url, settings) => {
    if (!return_url || !settings) {
        console.error("Error: return_url or settings missing in processFeedback()");
        return;
    }

    // Extract Google Sheets URL from settings
    const googleSheetsSetting = settings.find(setting => setting.label === "google sheets");
    if (!googleSheetsSetting || !googleSheetsSetting.default) {
        console.error("Error: Google Sheets URL missing in settings");
        return;
    }
    
    const sheetsUrl = googleSheetsSetting.default;

    const responses = await fetchFormResponses(sheetsUrl);
    let processedTimestamps = loadProcessedFeedback();
    for (const feedback of responses) {
        if (!processedTimestamps.includes(feedback.timestamp)) {
            console.log(`Sending feedback to: ${return_url}`);
            await sendToTelex(feedback, return_url);
            processedTimestamps.push(feedback.timestamp);
        }
    }
    saveProcessedFeedback(processedTimestamps);
};

// Route to return integration.json
app.post("/integration.json", (req, res) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    res.status(200).json({
        data: {
            date: {
                created_at: "2025-02-22",
                updated_at: "2025-02-22"
            },
            descriptions: {
                app_name: "Telex Form Monitoring",
                app_description: "Automatically monitors feedback submissions and sends updates to Telex.",
                app_logo: "https://telex-feedback-integration.onrender.com/logo.PNG",
                app_url: baseUrl,
                background_color: "#FFFFFF"
            },
            is_active: true,
            integration_type: "interval",
            key_features: [
                "Automatic feedback submission to Telex.",
                "Real-time feedback tracking and monitoring.",
                "Configurable update intervals.",
                "Role-based alert notifications."
            ],
            integration_category: "Communication & Collaboration",
            author: "Taiwo Akerele",
            settings: [
                {
                    label: "google sheets",
                    type: "text",
                    required: true,
                    default: `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Form Responses 1?key=${API_KEY}`
                },
                {
                    label: "interval",
                    type: "text",
                    required: true,
                    default: "*/5 * * * *", // Every 5 minutes
                },
            ],
            tick_url: `${baseUrl}/tick`
        }
    });
});

// Route to handle tick event
app.post("/tick", async (req, res) => {
    const { return_url, settings } = req.body;

    if (!return_url || !settings) {
        return res.status(400).json({ error: "Invalid payload" });
    }

    console.log(`Processing feedback with return_url: ${return_url}`);
    await processFeedback(return_url, settings);

    res.status(202).json({ status: "accepted" });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
