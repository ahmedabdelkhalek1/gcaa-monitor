let availabilityChart, responseChart;

// Initialize charts
function initCharts() {
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                display: false
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                }
            },
            y: {
                beginAtZero: true
            }
        }
    };

    // Availability Chart
    const availCtx = document.getElementById('availabilityChart').getContext('2d');
    availabilityChart = new Chart(availCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Status',
                data: [],
                borderColor: '#48bb78',
                backgroundColor: 'rgba(72, 187, 120, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: {
                    beginAtZero: true,
                    max: 1,
                    ticks: {
                        callback: function(value) {
                            return value === 1 ? 'Up' : 'Down';
                        }
                    }
                }
            }
        }
    });

    // Response Time Chart
    const respCtx = document.getElementById('responseChart').getContext('2d');
    responseChart = new Chart(respCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Response Time (ms)',
                data: [],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value + ' ms';
                        }
                    }
                }
            }
        }
    });
}

// Fetch and update data
async function fetchData() {
    try {
        const response = await fetch('/api/data');
        if (!response.ok) throw new Error('Failed to fetch data');
        
        const data = await response.json();
        updateDashboard(data);
    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('currentStatus').textContent = 'Error loading data';
    }
}

// Update dashboard with new data
function updateDashboard(data) {
    if (!data || data.length === 0) {
        return;
    }

    // Filter last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last24h = data.filter(record => new Date(record.timestamp) > twentyFourHoursAgo);

    // Update current status
    const latest = data[data.length - 1];
    const statusElement = document.getElementById('currentStatus');
    statusElement.textContent = latest.status.toUpperCase();
    statusElement.className = `stat-value status-${latest.status}`;

    // Calculate uptime
    const upRecords = last24h.filter(r => r.status === 'up').length;
    const uptime = ((upRecords / last24h.length) * 100).toFixed(2);
    document.getElementById('uptime24h').textContent = uptime + '%';

    // Calculate average response time
    const avgResp = (last24h.reduce((sum, r) => sum + r.responseTime, 0) / last24h.length).toFixed(0);
    document.getElementById('avgResponse').textContent = avgResp + ' ms';

    // Last check time
    const lastCheckTime = new Date(latest.timestamp).toLocaleString();
    document.getElementById('lastCheck').textContent = lastCheckTime;
    document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();

    // Update charts (sample every 5 minutes for readability)
    const sampledData = last24h.filter((_, index) => index % 5 === 0);
    
    const labels = sampledData.map(r => {
        const date = new Date(r.timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });

    const availabilityData = sampledData.map(r => r.status === 'up' ? 1 : 0);
    const responseData = sampledData.map(r => r.responseTime);

    // Update availability chart
    availabilityChart.data.labels = labels;
    availabilityChart.data.datasets[0].data = availabilityData;
    availabilityChart.update();

    // Update response time chart
    responseChart.data.labels = labels;
    responseChart.data.datasets[0].data = responseData;
    responseChart.update();
}

// Initialize
initCharts();
fetchData();

// Refresh data every minute
setInterval(fetchData, 60000);
