// ============================================================
// server.js — Express backend for the Health Tracker
// ============================================================
// This file sets up a simple Express server that:
//   1. Serves the frontend files from the "public" folder
//   2. Provides API endpoints to submit and retrieve health reports
//   3. Stores data in a JSON file (no database setup required!)
// ============================================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config(); // Load environment variables from .env
console.log('🚀 [SERVER] Starting Health Tracker v2.0...');
const { createClient } = require('@supabase/supabase-js');

// --- Initialize Supabase Client ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ CRITICAL ERROR: SUPABASE_URL and SUPABASE_KEY must be set in .env');
  console.error('Submission and data fetching will fail.');
}
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Create the Express app ---
const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Serve static frontend files ---
app.use(express.static(path.join(__dirname, 'public')));

// --- Helper: geocode a location string to lat/lng ---
// Uses the free OpenStreetMap Nominatim API (no API key needed!)
async function geocode(locationString) {
  try {
    const encoded = encodeURIComponent(locationString);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=1`;

    // Add a timeout to the fetch to prevent hanging on slow mobile networks
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(url, {
      headers: { 'User-Agent': 'GravityHealthTracker/1.0' },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn(`[Geocode] Nominatim returned status ${response.status}. Falling back.`);
      return {
        lat: 11.0168 + (Math.random() - 0.5) * 0.05,
        lng: 76.9558 + (Math.random() - 0.5) * 0.05,
        displayName: `${locationString} (Approximated)`
      };
    }
    
    const data = await response.json();

    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        displayName: data[0].display_name
      };
    }
    
    // FALLBACK:
    console.log(`Geocode failed for "${locationString}". Using Coimbatore fallback.`);
    
    return {
      lat: 11.0168 + (Math.random() - 0.5) * 0.05,
      lng: 76.9558 + (Math.random() - 0.5) * 0.05,
      displayName: `${locationString} (Approximated)`
    };

  } catch (err) {
    console.error('Geocoding error:', err.name === 'AbortError' ? 'Request timed out' : err.message);
    // Always fallback to Coimbatore so the submission is NOT blocked
    return {
      lat: 11.0168,
      lng: 76.9558,
      displayName: `${locationString} (Network Fallback)`
    };
  }
}

// ============================================================
// API ENDPOINTS
// ============================================================

// --- POST /api/reports  →  Submit a new health report ---
app.post('/api/reports', async (req, res) => {
  try {
    const { name, dob, symptoms, location } = req.body;
    console.log(`[API] Incoming report request: ${name}, ${location}`);

    // Validate input
    if (!name || !dob || !symptoms || !location) {
      console.warn('[API] Validation failed: missing fields');
      return res.status(400).json({
        error: 'Name, Date of Birth, Symptoms, and Location are all required.'
      });
    }

    // Geocode the location to get coordinates
    console.log(`[API] Geocoding location: "${location}"...`);
    const geo = await geocode(location);
    console.log(`[API] Geocode result: ${geo.lat}, ${geo.lng} (${geo.displayName})`);

    // Build the report object
    const report = {
      id: uuidv4(),
      name: name.trim(),
      dob: dob,
      symptoms: symptoms.trim(),
      location: location.trim(),
      lat: geo.lat,
      lng: geo.lng,
      displayName: geo.displayName,
      timestamp: new Date().toISOString()
    };

    // Save to Supabase 'reports' table
    console.log('[API] Inserting into Supabase...');
    const { data, error } = await supabase
      .from('reports')
      .insert([report])
      .select();

    if (error) {
      console.error('[API] Supabase insert error:', error.message);
      return res.status(500).json({ 
        error: 'Database error storing report.',
        details: error.message 
      });
    }

    console.log(`✅ [API] New report saved to Supabase: "${symptoms}" at ${location}`);
    res.status(201).json({ message: 'Report submitted successfully!', report });

  } catch (err) {
    console.error('[API] Server error during submission:', err);
    res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
});

// --- GET /api/reports  →  Retrieve all reports (with optional filter) ---
// Query params:  ?symptom=fever  (optional — filters by keyword)
app.get('/api/reports', async (req, res) => {
  try {
    let query = supabase.from('reports').select('*').order('timestamp', { ascending: false });

    // Optional: filter by symptom keyword using ilike for case-insensitive search
    const symptomFilter = req.query.symptom;
    if (symptomFilter) {
      query = query.ilike('symptoms', `%${symptomFilter}%`);
    }

    const { data: reports, error } = await query;

    if (error) {
      console.error('Supabase fetch error:', error.message);
      return res.status(500).json({ error: 'Database error retrieving reports.' });
    }

    res.json(reports || []);
  } catch (err) {
    console.error('Error reading reports:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// --- GET /api/stats  →  Quick summary statistics ---
app.get('/api/stats', async (req, res) => {
  try {
    const { data: reports, error } = await supabase
      .from('reports')
      .select('*');

    if (error) {
      console.error('Supabase fetch error for stats:', error.message);
      return res.status(500).json({ error: 'Database error retrieving stats.' });
    }

    // Count reports per location
    const locationCounts = {};
    const symptomCounts = {};

    reports.forEach(r => {
      // Count locations
      locationCounts[r.location] = (locationCounts[r.location] || 0) + 1;

      // Count individual symptoms (split by comma)
      if (r.symptoms) {
        r.symptoms.split(',').forEach(s => {
          const sym = s.trim().toLowerCase();
          if (sym) symptomCounts[sym] = (symptomCounts[sym] || 0) + 1;
        });
      }
    });

    res.json({
      totalReports: reports.length,
      uniqueLocations: Object.keys(locationCounts).length,
      topSymptoms: Object.entries(symptomCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count })),
      locationCounts
    });
  } catch (err) {
    console.error('Error computing stats:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});


// --- Catch-all: serve index.html for any unknown route ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Export the app for Netlify Functions ---
module.exports = app;

// --- Start the server for local development ---
if (process.env.NODE_ENV !== 'production' && !process.env.NETLIFY) {
  app.listen(PORT, () => {
    console.log(`
    🌍 ─────────────────────────────────────────────
       Health Tracker is running!
       Open in browser: http://localhost:${PORT}
    🌍 ─────────────────────────────────────────────
    `);
  });
}

