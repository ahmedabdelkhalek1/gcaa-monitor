const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const cron = require('node-cron');
require('dotenv').config();

const SITES_FILE = path.join(__dirname, 'sites.json');
const DATA_FILE = 'monitoring-data.json';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;

async function checkWebsite(name, url) {
  const startTime = Date.now();
  let status = 'down', statusCode = 0, responseTime = 0;

  try {
    const response = await fetch(url, { method: 'GET', timeout: 30000 });
    const endTime = Date.now();
    responseTime = endTime - startTime;
    statusCode = response.status;
    status = response.ok ? 'up' : 'down';
    console.log(`✓ ${name}: ${status} (${statusCode}) - ${responseTime}ms`);
  } catch (error) {
    const endTime = Date.now();
    responseTime = endTime - startTime;
    console.error(`✗ ${name}: ${error.message}`);
  }

  return {
    timestamp: new Date().toISOString(),
    name,
    url,
    status,
    statusCode,
    responseTime
  };
}

async function getGitHubFile() {
  const apiURL = `https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_FILE}`;
  try {
    const response = await fetch(apiURL, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (response.status === 404) return { data: [], sha: null };
    const fileData = await response.json();
    const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
    return { data: JSON.parse(content), sha: fileData.sha };
  } catch (error) {
    console.error('Error fetching GitHub:', error.message);
    return { data: [], sha: null };
  }
}

async function pushToGitHub(newRecords) {
  const apiURL = `https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_FILE}`;
  try {
    // Get existing data
    const { data: existingData, sha } = await getGitHubFile();

    // Flatten to single array, append new records
    const allRecords = existingData.concat(newRecords);

    // Keep only last 7 days (~10,080 records per site)
    const lastWeek = allRecords.filter(r => 
      new Date(r.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );

    // Prepare content and push
    const content = JSON.stringify(lastWeek, null, 2);
    const encodedContent = Buffer.from(content).toString('base64');

    const payload = {
      message: `Monitor update (${newRecords.map(nr => nr.name).join(", ")})`,
      content: encodedContent,
      branch: 'master'
    };
    if (sha) payload.sha = sha;

    const response = await fetch(apiURL, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`GitHub API error: ${await response.text()}`);
    console.log('✓ Data pushed to GitHub successfully');
    return true;
  } catch (error) {
    console.error('✗ Error pushing GitHub:', error.message);
    return false;
  }
}

async function runMonitor() {
  console.log('\n--- Running Monitor ---');
  const sites = JSON.parse(fs.readFileSync(SITES_FILE));
  const results = [];
  for (const site of sites) {
    results.push(await checkWebsite(site.name, site.url));
  }
  await pushToGitHub(results);
}

runMonitor();
cron.schedule('* * * * *', runMonitor);
console.log('🚀 Multi-Site Monitor started - running every minute');
