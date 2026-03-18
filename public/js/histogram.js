// ============================================================
// histogram.js — Chart.js Logic for the Dashboard
// ============================================================

let myChart;

// DOM elements
const statTotal = document.getElementById('statTotal');
const statLocations = document.getElementById('statLocations');
const statTopSymptom = document.getElementById('statTopSymptom');
const symptomFilter = document.getElementById('symptomFilter');
const refreshBtn = document.getElementById('refreshBtn');
const emptyState = document.getElementById('emptyState');

document.addEventListener('DOMContentLoaded', () => {
  loadData();
});

// Constant list of clinics matching our heatmap page
const CLINICS = [
  { id: 'kmch', name: 'Kovai Medical Center (KMCH)', lat: 11.0345, lng: 77.0270 },
  { id: 'gknm', name: 'GKNM Hospital', lat: 11.0098, lng: 76.9749 },
  { id: 'psg', name: 'PSG Hospitals', lat: 11.0267, lng: 77.0090 },
  { id: 'gh', name: 'Coimbatore GH', lat: 10.9995, lng: 76.9669 },
  { id: 'ramakrishna', name: 'Sri Ramakrishna', lat: 11.0163, lng: 76.9830 },
  { id: 'kg', name: 'KG Hospital', lat: 10.9972, lng: 76.9652 },
  { id: 'royalcare', name: 'Royal Care Hospital', lat: 11.0588, lng: 77.0855 }
];

// Utility: Calculate Distance between coordinates (Haversine formula)
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; // Distance in km
}

function deg2rad(deg) { return deg * (Math.PI/180); }

// 1. Fetch Stats and Calculate Clinic Proximity
async function fetchStats(symptomKeyword = '') {
  try {
    let reportsUrl = '/api/reports';
    if (symptomKeyword) {
      reportsUrl += `?symptom=${encodeURIComponent(symptomKeyword)}`;
    }

    const res = await fetch(reportsUrl);
    const reports = await res.json();
    
    // Initialize counters for our specific clinics
    const clinicCounts = {};
    CLINICS.forEach(c => clinicCounts[c.name] = 0);
    const symptomCounts = {};
    let totalReportsAtClinics = 0;
    
    reports.forEach(r => {
      // Find which clinic this report is closest to (within 8km)
      let closestClinic = null;
      let minDistance = 8; // 8km threshold

      CLINICS.forEach(clinic => {
        const dist = getDistanceFromLatLonInKm(clinic.lat, clinic.lng, r.lat, r.lng);
        if (dist < minDistance) {
          minDistance = dist;
          closestClinic = clinic.name;
        }
      });

      // If it falls near a clinic, count it
      if (closestClinic) {
        clinicCounts[closestClinic]++;
        totalReportsAtClinics++;
      }

      // Tally all symptoms normally
      r.symptoms.split(',').forEach(s => {
        const sym = s.trim();
        if (sym) symptomCounts[sym] = (symptomCounts[sym] || 0) + 1;
      });
    });

    return {
      totalReports: reports.length,  // Show ACTUAL total from database
      uniqueLocations: new Set(reports.map(r => r.location.split(',')[0].trim())).size,
      topSymptoms: Object.entries(symptomCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count })),
      locationCounts: clinicCounts
    };

  } catch (err) {
    console.error('Error fetching stats:', err);
    return null;
  }
}

// 2. Render Toolbar Stats
function renderToolbar(stats) {
  if (!stats) return;

  animateValue(statTotal, stats.totalReports);
  animateValue(statLocations, stats.uniqueLocations);

  if (stats.topSymptoms && stats.topSymptoms.length > 0) {
    statTopSymptom.textContent = stats.topSymptoms[0].name;
  } else {
    statTopSymptom.textContent = '—';
  }

  // Only populate the filter dropdown once (or retain its selection)
  const currentFilter = symptomFilter.value;
  if (symptomFilter.options.length <= 1) {
    symptomFilter.innerHTML = '<option value="">All Symptoms</option>';
    stats.topSymptoms.forEach(s => {
      const option = document.createElement('option');
      option.value = s.name;
      option.textContent = `${s.name}`;
      symptomFilter.appendChild(option);
    });
    symptomFilter.value = currentFilter;
  }
}

// Simple count-up animation
function animateValue(element, target) {
  const currentText = element.textContent.replace(/\D/g, '');
  const start = parseInt(currentText) || 0;
  const duration = 600;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (target - start) * eased);
    element.textContent = current;

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  requestAnimationFrame(update);
}

// 3. Render the Histogram Chart
function renderChart(locationCounts) {
  const ctx = document.getElementById('histogramChart');
  const labels = Object.keys(locationCounts);
  const data = Object.values(locationCounts);

  if (labels.length === 0) {
    emptyState.style.display = 'block';
    ctx.style.display = 'none';
    if (myChart) myChart.destroy();
    return;
  }

  emptyState.style.display = 'none';
  ctx.style.display = 'block';

  // Generate an array of distinct, vibrant colors for the bars
  const colors = [
    'rgba(255, 59, 92, 0.8)',   // accent-red
    'rgba(255, 140, 66, 0.8)',  // accent-orange
    'rgba(255, 209, 102, 0.8)', // accent-yellow
    'rgba(16, 185, 129, 0.8)',  // emerald
    'rgba(59, 130, 246, 0.8)',  // blue
    'rgba(139, 92, 246, 0.8)',  // purple
    'rgba(236, 72, 153, 0.8)',  // pink
    'rgba(6, 182, 212, 0.8)'    // cyan
  ];

  const borderColors = colors.map(color => color.replace('0.8', '1'));
  
  // Assign colors to bars (looping if there are more bars than colors)
  const barColors = data.map((_, i) => colors[i % colors.length]);
  const barBorderColors = data.map((_, i) => borderColors[i % borderColors.length]);

  if (myChart) {
    myChart.destroy();
  }

  // Set default Chart.js fonts to match our dark theme
  Chart.defaults.color = '#8888a8';
  Chart.defaults.font.family = "'Inter', sans-serif";

  myChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Number of Reports',
        data: data,
        backgroundColor: barColors,
        borderColor: barBorderColors,
        borderWidth: 1,
        borderRadius: 4, // rounded tops
        barPercentage: 0.5, // Reduced from 0.95 for thinner bars
        categoryPercentage: 0.6 // Reduced from 0.9 for more spacing
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false // We don't need a legend for a simple histogram
        },
        tooltip: {
          backgroundColor: 'rgba(18, 18, 32, 0.9)',
          titleColor: '#e8e8f0',
          bodyColor: '#e8e8f0',
          borderColor: 'rgba(255, 255, 255, 0.06)',
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          callbacks: {
            label: function(context) {
              return `${context.parsed.y} reports`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          },
          ticks: {
            precision: 0, // only show whole numbers
            padding: 10
          }
        },
        x: {
          grid: {
            display: false,
            drawBorder: false
          },
          ticks: {
            padding: 10,
            font: {
              size: 13
            }
          }
        }
      },
      animation: {
        duration: 1000,
        easing: 'easeOutQuart'
      }
    }
  });
}

// 4. Event Handlers
refreshBtn.addEventListener('click', () => {
  refreshBtn.style.transition = 'transform 0.5s';
  refreshBtn.style.transform = 'rotate(360deg)';
  setTimeout(() => { refreshBtn.style.transform = 'rotate(0deg)'; }, 500);
  loadData();
});

symptomFilter.addEventListener('change', () => {
  loadData();
});

// Main Data Loader
async function loadData() {
  const filterValue = symptomFilter.value;
  const stats = await fetchStats(filterValue);
  
  if (stats) {
    renderToolbar(stats);
    renderChart(stats.locationCounts);
  }
}
