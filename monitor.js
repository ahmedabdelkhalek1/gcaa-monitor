const fetch = require('node-fetch');
const cron = require('node-cron');
require('dotenv').config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO; // format: username/repo-name
const TARGET_URL = 'https://drones.gov.ae/';
const DATA_FILE = 'monitoring-data.json';

// Function to check website availability and response time
async function checkWebsite() {
  const startTime = Date.now();
  let status = 'down';
  let statusCode = 0;
  let responseTime = 0;

  try {
    const response = await fetch(TARGET_URL, {
      method: 'GET',
      timeout: 30000,
      headers: {
        'User-Agent': 'GCAA-Monitor/1.0'
      }
    });
    
    const endTime = Date.now();
    responseTime = endTime - startTime;
    statusCode = response.status;
    status = response.ok ? 'up' : 'down';
    
    console.log(`✓ Check completed: ${status} (${statusCode}) - ${responseTime}ms`);
  } catch (error) {
    const endTime = Date.now();
    responseTime = endTime - startTime;
    console.error(`✗ Check failed: ${error.message}`);
  }

  return {
    timestamp: new Date().toISOString(),
    status,
    statusCode,
    responseTime,
    url: TARGET_URL
  };
}

// Function to get current data from GitHub
async function getGitHubFile() {
  const apiURL = `https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_FILE}`;
  
  try {
    const response = await fetch(apiURL, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (response.status === 404) {
      return { data: [], sha: null };
    }

    const fileData = await response.json();
    const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
    
    return {
      data: JSON.parse(content),
      sha: fileData.sha
    };
  } catch (error) {
    console.error('Error fetching from GitHub:', error.message);
    return { data: [], sha: null };
  }
}

// Function to push data to GitHub
async function pushToGitHub(newRecord) {
  const apiURL = `https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_FILE}`;
  
  try {
    // Get existing data
    const { data: existingData, sha } = await getGitHubFile();
    
    // Add new record (keep last 10080 records = 1 week of minute data)
    existingData.push(newRecord);
    if (existingData.length > 10080) {
      existingData.shift();
    }

    // Prepare content
    const content = JSON.stringify(existingData, null, 2);
    const encodedContent = Buffer.from(content).toString('base64');

    // Push to GitHub
    const payload = {
      message: `Monitor update: ${newRecord.status} at ${newRecord.timestamp}`,
      content: encodedContent,
      branch: 'main'
    };

    if (sha) {
      payload.sha = sha;
    }

    const response = await fetch(apiURL, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error: ${error}`);
    }

    console.log('✓ Data pushed to GitHub successfully');
    return true;
  } catch (error) {
    console.error('✗ Error pushing to GitHub:', error.message);
    return false;
  }
}

// Main monitoring function
async function runMonitor() {
  console.log('\n--- Running Monitor ---');
  const result = await checkWebsite();
  await pushToGitHub(result);
}

// Run immediately on start
runMonitor();

// Schedule to run every minute
cron.schedule('* * * * *', () => {
  runMonitor();
});

console.log('🚀 GCAA Monitor started - Running every minute');

