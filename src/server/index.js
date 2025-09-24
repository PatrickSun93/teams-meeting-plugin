// Express server for Teams app
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// Teams app routes
app.get('/config', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/config.html'));
});

app.get('/tab', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

// API routes for transcription
app.post('/api/transcription/start', (req, res) => {
  // TODO: Implement transcription start logic
  res.json({ success: true, message: 'Transcription started' });
});

app.post('/api/transcription/stop', (req, res) => {
  // TODO: Implement transcription stop logic
  res.json({ success: true, message: 'Transcription stopped' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Catch all handler for React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

app.listen(PORT, () => {
  console.log(`Teams Transcription App running on port ${PORT}`);
  console.log(`Access the app at: http://localhost:${PORT}`);
});