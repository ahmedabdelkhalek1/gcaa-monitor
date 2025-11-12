let availabilityChart, responseChart, allData = [];
const siteSelector = document.getElementById('siteSelector');

// Initialize charts
function initCharts() {
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true }
    }
  };
  availabilityChart = new Chart(document.getElementById('availabilityChart').getContext('2d'), {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Status', data: [], borderColor: '#48bb78', backgroundColor: 'rgba(72, 187, 120, 0.1)', fill: true, tension: 0.4 }] },
    options: { ...commonOptions, scales: { ...commonOptions.scales, y: { beginAtZero: true, max: 1, ticks: { callback: v => v === 1 ? 'Up' : 'Down' }}}}
  });
  responseChart = new Chart(document.getElementById('responseChart').getContext('2d'), {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Response Time (ms)', data: [], borderColor: '#667eea', backgroundColor: 'rgba(102, 126, 234, 0.1)', fill: true, tension: 0.4 }] },
    options: { ...commonOptions, scales: { ...commonOptions.scales, y: { beginAtZero: true, ticks: { callback: v => v + ' ms' }}}}
  });
}

async function fetchData() {
  try {
    // First fetch sites to populate dropdown
    const sitesResponse = await fetch('/api/sites');
    if (!sitesResponse.ok) throw new Error('Failed to fetch sites');
    const sites = await sitesResponse.json();

    // Update selector with sites from sites.json
    siteSelector.innerHTML = '';
    sites.forEach(site => {
      const opt = document.createElement('option');
      opt.value = site.name; opt.textContent = site.name;
      siteSelector.appendChild(opt);
    });

    // Then fetch monitoring data
    const dataResponse = await fetch('/api/data');
    if (!dataResponse.ok) throw new Error('Failed to fetch data');
    allData = await dataResponse.json();

    updateDashboard(siteSelector.value);
  } catch (error) {
    console.error('Error loading data:', error.message);
    document.getElementById('currentStatus').textContent = 'Error loading data';
  }
}

function updateDashboard(selectedSite) {
  const data = allData.filter(r => r.name === selectedSite);
  if (!data.length) return;
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const last24h = data.filter(r => new Date(r.timestamp) > twentyFourHoursAgo);
  const latest = data[data.length - 1];
  const statusElement = document.getElementById('currentStatus');
  statusElement.textContent = latest.status.toUpperCase();
  statusElement.className = `stat-value status-${latest.status}`;
  const upRecords = last24h.filter(r => r.status === 'up').length;
  const uptime = ((upRecords / last24h.length) * 100).toFixed(2);
  document.getElementById('uptime24h').textContent = uptime + '%';
  const avgResp = (last24h.reduce((sum, r) => sum + r.responseTime, 0) / last24h.length).toFixed(0);
  document.getElementById('avgResponse').textContent = avgResp + ' ms';
  document.getElementById('lastCheck').textContent = new Date(latest.timestamp).toLocaleString();
  document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
  const sampledData = last24h.filter((_, index) => index % 5 === 0);
  const labels = sampledData.map(r => new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const availabilityData = sampledData.map(r => r.status === 'up' ? 1 : 0);
  const responseData = sampledData.map(r => r.responseTime);
  availabilityChart.data.labels = labels;
  availabilityChart.data.datasets[0].data = availabilityData;
  availabilityChart.update();
  responseChart.data.labels = labels;
  responseChart.data.datasets[0].data = responseData;
  responseChart.update();
}

siteSelector.addEventListener('change', () => updateDashboard(siteSelector.value));
initCharts();
fetchData();
setInterval(fetchData, 60000);
