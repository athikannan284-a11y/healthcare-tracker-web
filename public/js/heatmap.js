// ============================================================
// heatmap.js — Logic for the Clinic-Specific Heatmap Page
// ============================================================

let map;
let heatmapLayer;
let currentClinicMarkers = [];

// Static list of clinics in Coimbatore for demonstration
const CLINICS = [
  { id: 'kmch', name: 'Kovai Medical Center (KMCH)', address: 'Avinashi Road, Coimbatore', lat: 11.0345, lng: 77.0270 },
  { id: 'gknm', name: 'GKNM Hospital', address: 'P.N. Palayam, Coimbatore', lat: 11.0098, lng: 76.9749 },
  { id: 'psg', name: 'PSG Hospitals', address: 'Peelamedu, Coimbatore', lat: 11.0267, lng: 77.0090 },
  { id: 'gh', name: 'Coimbatore Medical College Hospital (GH)', address: 'Trichy Road, Coimbatore', lat: 10.9995, lng: 76.9669 },
  { id: 'ramakrishna', name: 'Sri Ramakrishna Hospital', address: 'Avarampalayam, Coimbatore', lat: 11.0163, lng: 76.9830 },
  { id: 'kg', name: 'KG Hospital', address: 'Arts College Road, Coimbatore', lat: 10.9972, lng: 76.9652 },
  { id: 'royalcare', name: 'Royal Care Hospital', address: 'Neelambur, Coimbatore', lat: 11.0588, lng: 77.0855 }
];

document.addEventListener('DOMContentLoaded', () => {
  initClinicMap();
  renderClinicList();
});

// 1. Initialize the Leaflet Map
function initClinicMap() {
  // Default center slightly over Coimbatore
  map = L.map('clinicMap', {
    center: [11.0168, 76.9558],
    zoom: 12,
    minZoom: 10,
    zoomControl: false
  });

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 18
  }).addTo(map);
}

// 2. Render the sidebar list of clinics
function renderClinicList() {
  const listEl = document.getElementById('clinicList');
  listEl.innerHTML = '';

  CLINICS.forEach(clinic => {
    const card = document.createElement('div');
    card.className = 'clinic-card';
    card.dataset.id = clinic.id;
    
    // For demo purposes, we randomly generate stats, but in a real scenario
    // we would fetch these from the API
    const totalCases = Math.floor(Math.random() * 50) + 10;
    
    card.innerHTML = `
      <div class="clinic-card__name">${clinic.name}</div>
      <div class="clinic-card__address">📍 ${clinic.address}</div>
      <div class="clinic-card__stats">
        <div class="clinic-card__stat">Reports: <span>${totalCases}</span></div>
      </div>
    `;

    card.addEventListener('click', () => selectClinic(clinic.id));
    listEl.appendChild(card);
  });
}

// 3. Handle clinic selection
async function selectClinic(clinicId) {
  // Update sidebar active state
  document.querySelectorAll('.clinic-card').forEach(card => {
    if (card.dataset.id === clinicId) {
      card.classList.add('clinic-card--active');
    } else {
      card.classList.remove('clinic-card--active');
    }
  });

  // Hide empty state
  document.getElementById('heatmapEmptyState').style.display = 'none';

  // Find clinic object
  const clinic = CLINICS.find(c => c.id === clinicId);
  
  if (!clinic) return;

  // Fly to the clinic location on the map
  map.flyTo([clinic.lat, clinic.lng], 14, {
    duration: 1.5
  });

  // For the hackathon demo we will vividly generate random, clustered data
  // strictly around this specific clinic every time it's clicked.
  const generatedReports = generateMockClinicData(clinic.lat, clinic.lng);

  renderClinicData(clinic, generatedReports);
}

// 4. Generate Random Data
function generateMockClinicData(centerLat, centerLng) {
  const reports = [];
  // Generate 40-80 random cases near the clinic
  const caseCount = Math.floor(Math.random() * 40) + 40;
  
  const possibleSymptoms = ['Fever, Cough', 'Headache', 'Sore Throat', 'Fatigue, Body Ache', 'Nausea'];

  for (let i = 0; i < caseCount; i++) {
    // Generate lat/lng offsets within roughly 2-3km
    // 0.01 roughly equals 1km at the equator
    const latOffset = (Math.random() - 0.5) * 0.04;
    const lngOffset = (Math.random() - 0.5) * 0.04;

    // Favor points closer to the center to make a glowing heatmap
    const weight = Math.random();
    
    reports.push({
      lat: centerLat + (latOffset * weight),
      lng: centerLng + (lngOffset * weight),
      symptoms: possibleSymptoms[Math.floor(Math.random() * possibleSymptoms.length)]
    });
  }
  
  return reports;
}

// 5. Render specific heatmap layered data
function renderClinicData(clinic, reports) {
  // Clear previous layers
  if (heatmapLayer) map.removeLayer(heatmapLayer);
  currentClinicMarkers.forEach(m => map.removeLayer(m));
  currentClinicMarkers = [];

  // 1. Add a main marker for the Clinic itself
  const clinicIcon = L.divIcon({
    className: 'custom-clinic-icon',
    html: `<div style="font-size: 24px; filter: drop-shadow(0 0 10px rgba(255,255,255,0.5));">🏥</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });

  const mainMarker = L.marker([clinic.lat, clinic.lng], { icon: clinicIcon, zIndexOffset: 1000 }).addTo(map);
  mainMarker.bindPopup(`<strong style="color:var(--text-primary);">${clinic.name}</strong><br><span style="color:var(--text-muted);">${clinic.address}</span>`, {
    className: 'custom-dark-popup'
  });
  currentClinicMarkers.push(mainMarker);

  // If no reports near the clinic, just stop here
  if (reports.length === 0) return;

  // 2. Render Heatmap for the reports
  const heatPoints = reports.map(r => [r.lat, r.lng, 1]);
  heatmapLayer = L.heatLayer(heatPoints, {
    radius: 35,
    blur: 25,
    maxZoom: 16,
    gradient: {
      0.0: 'transparent',
      0.5: '#ff8c42', // Orange for clinic heatmaps looks distinct
      0.8: '#ff3b5c',
      1.0: '#ff1744'
    }
  }).addTo(map);

  // 3. Add small dots for individual cases
  reports.forEach(report => {
    const dotIcon = L.divIcon({
      className: 'clinic-case-dot',
      html: `<div style="
        width: 6px; 
        height: 6px; 
        background: #ffd166; 
        border-radius: 50%; 
        box-shadow: 0 0 8px rgba(255, 209, 102, 0.8);">
      </div>`,
      iconSize: [6, 6]
    });

    const marker = L.marker([report.lat, report.lng], { icon: dotIcon }).addTo(map);
    
    // Popup for the case details
    const symptomPills = report.symptoms.split(',')
      .map(s => `<span class="popup-symptom" style="background: rgba(255, 209, 102, 0.15); color: #ffd166;">${s.trim()}</span>`)
      .join(' ');

    marker.bindPopup(`
      <div style="background: var(--bg-card); padding: 5px; color: var(--text-primary);">
        <div class="popup-title" style="background: none; color: #ffd166; -webkit-text-fill-color: #ffd166;">Case Details</div>
        <div style="margin: 8px 0;">${symptomPills}</div>
      </div>
    `, { className: 'custom-dark-popup', closeButton: false });

    currentClinicMarkers.push(marker);
  });
}

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
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}
