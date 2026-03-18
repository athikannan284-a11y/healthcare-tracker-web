// ============================================================
// map.js — Leaflet Maps with heatmap & gravity-inspired effects
// ============================================================

let map;
let heatmap;
let markers = [];
let gravityOverlays = [];

// 1. Initialize the Leaflet Map
function initMap() {
  // Dark theme map tiles (CartoDB Dark Matter)
  // Coimbatore, Tamil Nadu coordinates: 11.0168, 76.9558
  map = L.map('map', {
    center: [11.0168, 76.9558],
    zoom: 12, // Starting zoom level
    minZoom: 9, // Allows zooming out a bit more to see surrounding areas
    maxZoom: 16, // Allows zooming in closer
    zoomControl: false // We will add it manully to position it
  });

  L.control.zoom({
    position: 'bottomright'
  }).addTo(map);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);

  // Load initial data
  loadData();
}

// Ensure initMap is called when the DOM is ready since we removed the Google Maps callback
document.addEventListener('DOMContentLoaded', initMap);

// DOM elements
const statTotal = document.getElementById('statTotal');
const statLocations = document.getElementById('statLocations');
const statTopSymptom = document.getElementById('statTopSymptom');
const symptomFilter = document.getElementById('symptomFilter');
const refreshBtn = document.getElementById('refreshBtn');
const emptyState = document.getElementById('emptyState');

// 3. Fetch Reports from API
async function fetchReports(symptomKeyword = '') {
  try {
    let url = '/api/reports';
    if (symptomKeyword) {
      url += `?symptom=${encodeURIComponent(symptomKeyword)}`;
    }
    const response = await fetch(url);
    return await response.json();
  } catch (err) {
    console.error('Error fetching reports:', err);
    return [];
  }
}

// 4. Fetch Stats for the toolbar
async function fetchStats() {
  try {
    const response = await fetch('/api/stats');
    const stats = await response.json();

    animateValue(statTotal, stats.totalReports);
    animateValue(statLocations, stats.uniqueLocations);

    if (stats.topSymptoms && stats.topSymptoms.length > 0) {
      statTopSymptom.textContent = stats.topSymptoms[0].name;
    } else {
      statTopSymptom.textContent = '—';
    }

    populateFilter(stats.topSymptoms || []);
  } catch (err) {
    console.error('Error fetching stats:', err);
  }
}

// Simple count-up animation for stat values
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

// 5. Populate symptom filter dropdown
function populateFilter(topSymptoms) {
  const currentValue = symptomFilter.value;
  symptomFilter.innerHTML = '<option value="">All Symptoms</option>';

  topSymptoms.forEach(s => {
    const option = document.createElement('option');
    option.value = s.name;
    option.textContent = `${s.name} (${s.count})`;
    symptomFilter.appendChild(option);
  });

  symptomFilter.value = currentValue;
}

// 6. Render everything on the map
function renderMap(reports) {
  // Clear previous markers
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  // Clear previous gravity overlays (custom DOM elements we added)
  gravityOverlays.forEach(el => {
    if (el.parentNode) el.parentNode.removeChild(el);
  });
  gravityOverlays = [];

  // Clear previous heatmap
  if (heatmap) {
    map.removeLayer(heatmap);
  }

  // Show/hide empty state
  if (reports.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  // --- A. Build the heatmap data ---
  const heatPoints = reports.map(r => [r.lat, r.lng, 1]); // lat, lng, intensity
  heatmap = L.heatLayer(heatPoints, {
    radius: 40,
    blur: 30,
    maxZoom: 10,
    gradient: {
      0.0: '#1a0530',
      0.4: '#ffd166',
      0.6: '#ff8c42',
      0.8: '#ff3b5c',
      1.0: '#ff1744'
    }
  }).addTo(map);

  // --- B. Cluster nearby points for gravity effect ---
  const clusters = computeClusters(reports, 0.5);

  // --- C. Render gravity glow circles for each cluster ---
  clusters.forEach(cluster => {
    const size = Math.min(20 + cluster.count * 15, 120);
    createGravityOverlay(cluster.lat, cluster.lng, size);
  });

  // --- D. Add individual report markers with gravity drift ---
  const bounds = [];

  reports.forEach((report, index) => {
    const cluster = findNearestCluster(report, clusters);
    const driftX = (cluster.lat - report.lat) * 2;
    const driftY = (cluster.lng - report.lng) * 2;

    bounds.push([report.lat, report.lng]);

    const symptomPills = report.symptoms
      .split(',')
      .map(s => `<span class="popup-symptom">${s.trim()}</span>`)
      .join(' ');

    const time = new Date(report.timestamp).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const contentString = `
      <div style="background: #121220; padding: 10px; color: #e8e8f0; border-radius: 8px;">
        <div class="popup-title">📍 ${report.location}</div>
        <div style="margin: 8px 0;">${symptomPills}</div>
        <div class="popup-time">🕐 ${time}</div>
      </div>
    `;

    createDriftMarker(report.lat, report.lng, driftX, driftY, contentString, index);
  });

  // --- E. Fit map bounds to show all data (Disabled to keep map centered on Coimbatore) ---
  // if (bounds.length > 0) {
  //   const leafletBounds = L.latLngBounds(bounds);
  //   map.fitBounds(leafletBounds, { padding: [50, 50], maxZoom: 8 });
  // }
}

// Custom Overlay for Gravity Effects using Leaflet Custom Icons/Markers
function createGravityOverlay(lat, lng, size) {
  const icon = L.divIcon({
    className: 'custom-gravity-icon',
    html: `<div class="gravity-marker" style="
      width: ${size}px;
      height: ${size}px;
      margin-left: -${size / 2}px;
      margin-top: -${size / 2}px;
      animation-duration: ${2 + Math.random() * 2}s;
    "></div>`,
    iconSize: [0, 0] // Centered exactly at the coordinate
  });

  const marker = L.marker([lat, lng], { icon: icon, interactive: false }).addTo(map);
  gravityOverlays.push(marker.getElement());
  markers.push(marker); // Keep track to remove on refresh
}

// Custom Overlay for Drifting Dots (Markers) using Leaflet
function createDriftMarker(lat, lng, driftX, driftY, popupHtml, index) {
  const dotSize = 8;
  const icon = L.divIcon({
    className: 'custom-drift-icon',
    html: `<div class="gravity-drift" style="
      width: ${dotSize}px;
      height: ${dotSize}px;
      background: radial-gradient(circle, #ff3b5c 0%, transparent 70%);
      border-radius: 50%;
      box-shadow: 0 0 8px rgba(255, 59, 92, 0.5);
      animation-delay: ${(index * 0.2) % 3}s;
      --drift-x: ${driftX}px;
      --drift-y: ${driftY}px;
      margin-left: -${dotSize / 2}px;
      margin-top: -${dotSize / 2}px;
    "></div>`,
    iconSize: [0, 0]
  });

  const marker = L.marker([lat, lng], { icon: icon }).addTo(map);
  
  // Custom styling for Leaflet popups
  marker.bindPopup(popupHtml, {
    className: 'custom-dark-popup',
    closeButton: false,
    minWidth: 200
  });

  markers.push(marker);
}

// Clustering Algorithm (simple grid-based)
function computeClusters(reports, gridSize) {
  const grid = {};
  reports.forEach(report => {
    const gridLat = Math.round(report.lat / gridSize) * gridSize;
    const gridLng = Math.round(report.lng / gridSize) * gridSize;
    const key = `${gridLat},${gridLng}`;
    if (!grid[key]) {
      grid[key] = { lat: 0, lng: 0, count: 0, totalLat: 0, totalLng: 0 };
    }
    grid[key].totalLat += report.lat;
    grid[key].totalLng += report.lng;
    grid[key].count += 1;
  });
  return Object.values(grid).map(cluster => ({
    lat: cluster.totalLat / cluster.count,
    lng: cluster.totalLng / cluster.count,
    count: cluster.count
  }));
}

function findNearestCluster(report, clusters) {
  let nearest = clusters[0];
  let minDist = Infinity;
  clusters.forEach(cluster => {
    const dist = Math.pow(report.lat - cluster.lat, 2) + Math.pow(report.lng - cluster.lng, 2);
    if (dist < minDist) {
      minDist = dist;
      nearest = cluster;
    }
  });
  return nearest;
}

// 8. Event Handlers
refreshBtn.addEventListener('click', () => {
  refreshBtn.style.transition = 'transform 0.5s';
  refreshBtn.style.transform = 'rotate(360deg)';
  setTimeout(() => { refreshBtn.style.transform = 'rotate(0deg)'; }, 500);
  loadData();
});

symptomFilter.addEventListener('change', () => {
  loadData();
});

// 9. Main data loading function
async function loadData() {
  const filterValue = symptomFilter.value;
  const reports = await fetchReports(filterValue);
  renderMap(reports);
  await fetchStats();
}

