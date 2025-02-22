const express = require('express');
const axios = require('axios');
const { google } = require('googleapis');
const integrationData = require('./telex-integration.json');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const SHEET_ID = process.env.SHEET_ID;
const API_KEY = process.env.GOOGLE_API_KEY;
const TELEX_WEBHOOK = process.env.TELEX_WEBHOOK;

//Fetch Google Sheets Data
const fetchFormResponses = async () => {
    try {
        const sheets = google.sheets({ version: 'v4', auth: API_KEY });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: 'Form Responses 1!A:B',
        });
        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.log('No data found.');
            return [];
        };
        return rows.slice(1).map(row => ({ timestamp: row[0], feedback: row[1] }));
    } catch (error) {
        console.error('Error fetching data from Google Sheets:', error);
        return [];
    }
};

//Send Data to Telex
const sendToTelex = async (feedback) => {
    try {
        const message = {
            event_name: 'Feedback Submission',
            message: `New Feedback: ${feedback.feedback}\nSubmitted at: ${feedback.timestamp}`,
            status: 'success',
            username: 'admin'
        };
        await axios.post(TELEX_WEBHOOK, message);
        console.log('Feedback sent to Telex successfully!');
        return { success: true };
    } catch (error) {
       console.error('Error sending data to Telex:', error);
       return { success: false };
    }
}

const processFeedback = async () => {
    const responses = await fetchFormResponses();
    for (const feedback of responses) {
        await sendToTelex(feedback);
    }
};

// Target URL - for fetching data from the Google Sheets API
app.get('/api/telex/data', async (req, res) =>{
    const responses = await fetchFormResponses();
    res.status(200).json({ data: responses});
});

// Tick URL - for sending data to Telex
app.post('/api/telex/tick', async (req, res) => {
    console.log('Telex Tick Received');
    await processFeedback();
    setInterval(processFeedback, 3600000);
    res.status(200).json({ message: 'Tick received, feedback processed!'});
});

app.get('/telex-integration', (req, res) => {
    res.json(integrationData);
})

app.get('/', (req, res) => res.send('Telex Feedback Form Monitoring Integration Running!'));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = { fetchFormResponses, sendToTelex, processFeedback, app };
