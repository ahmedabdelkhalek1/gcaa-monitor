const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.static('public'));
app.use(express.json());

app.get('/api/data', async (req, res) => {
  const GITHUB_REPO = process.env.GITHUB_REPO;
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const DATA_FILE = 'monitoring-data.json';
  try {
    const apiURL = `https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_FILE}`;
    const response = await fetch(apiURL, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (!response.ok) throw new Error('Failed to fetch from GitHub');
    const fileData = await response.json();
    const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
    const monitoringData = JSON.parse(content);
    res.json(monitoringData);
  } catch (error) {
    console.error('Error fetching from main repo:', error.message);
    // Fallback to drones-status repo
    try {
      const FALLBACK_REPO = 'ahmedabdelkhalek1/drones-status';
      const fallbackApiURL = `https://api.github.com/repos/${FALLBACK_REPO}/contents/${DATA_FILE}`;
      const fallbackResponse = await fetch(fallbackApiURL, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (!fallbackResponse.ok) throw new Error('Failed to fetch from fallback repo');
      const fallbackFileData = await fallbackResponse.json();
      const fallbackContent = Buffer.from(fallbackFileData.content, 'base64').toString('utf-8');
      const fallbackMonitoringData = JSON.parse(fallbackContent);
      res.json(fallbackMonitoringData);
    } catch (fallbackError) {
      console.error('Error fetching from fallback repo:', fallbackError.message);
      res.status(500).json({ error: 'Failed to fetch monitoring data from both repos' });
    }
  }
});

app.get('/api/sites', (req, res) => {
  res.sendFile(path.join(__dirname, 'sites.json'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () =>
  console.log(`🌐 Dashboard server running on port ${PORT}`)
);
