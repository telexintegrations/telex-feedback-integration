const request = require('supertest');
const { fetchFormResponses, sendToTelex, app } = require('./index');

jest.mock('axios');
const axios = require('axios');

describe('Google Sheets and Telex Integration', () => {
    test('fetchFormResponses should return an array', async () => {
        axios.get = jest.fn().mockResolvedValue({ data: { values: [['Timestamp', 'Feedback'], ['2025-02-22', 'Great Service!']] } });
        const responses = await fetchFormResponses();
        expect(Array.isArray(responses)).toBe(true);
        expect(responses.length).toBeGreaterThan(0);
    });
    
    test('sendToTelex should return success', async () => {
        axios.post.mockResolvedValue({ data: { success: true } });
        const result = await sendToTelex({ timestamp: '2025-02-22', feedback: 'Great service!' });
        expect(result.success).toBe(true);
    });

    test('GET / should return a success message', async () => {
        const res = await request(app).get('/');
        expect(res.status).toBe(200);
        expect(res.text).toBe('Telex Feedback Form Monitoring Integration Running!');
    });

    test('GET /api/telex/data should return form responses', async () => {
        axios.get = jest.fn().mockResolvedValue({ data: { values: [['Timestamp', 'Feedback'], ['2025-02-22', 'Great service!']] } });
        const res = await request(app).get('/api/telex/data');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('data');
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('POST /api/telex/tick should trigger processing and return success', async () => {
        axios.post.mockResolvedValue({ data: { success: true } });
        const res = await request(app).post('/api/telex/tick');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message', 'Tick received, feedback processed!');
    });
});