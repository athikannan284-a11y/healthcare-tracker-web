// ============================================================
// form.js — Handles the symptom submission form
// ============================================================

// Wait for the page to fully load
document.addEventListener('DOMContentLoaded', () => {

  // --- Grab references to DOM elements ---
  const form = document.getElementById('reportForm');
  const submitBtn = document.getElementById('submitBtn');
  const symptomsInput = document.getElementById('symptoms');
  const locationInput = document.getElementById('location');
  const nameInput = document.getElementById('name');
  const dobInput = document.getElementById('dob');

  // --- Handle form submission ---
  form.addEventListener('submit', async (event) => {
    // Prevent the page from reloading (default form behavior)
    event.preventDefault();

    // Get the values from the form
    const name = nameInput.value.trim().toUpperCase();
    const dob = dobInput.value;
    const symptoms = symptomsInput.value.trim();
    const location = locationInput.value.trim();

    // Basic validation
    if (!name || !dob || !symptoms || !location) {
      showToast('Please fill in all fields.', 'error');
      return;
    }

    // Show loading state on the button
    submitBtn.classList.add('btn--loading');
    submitBtn.disabled = true;

    try {
      // Send the data to our backend API
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, dob, symptoms, location })
      });

      // Status & Content-Type check
      const contentType = response.headers.get('content-type');
      let data = {};
      let rawText = '';

      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        rawText = await response.text();
        console.error('Non-JSON response:', rawText);
      }

      if (response.ok) {
        // Success!
        showToast('✅ Report submitted successfully! [v2.0]', 'success');
        form.reset();

        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 1500);
      } else {
        // Server returned an error (400, 500, etc.)
        // If we have rawText but no data.error, show a snippet of the rawText
        let errorMsg = data.error || (rawText ? `Server Error: ${rawText.substring(0, 50)}...` : `Status ${response.status}`);
        if (data.details) errorMsg += ` (${data.details})`;
        
        showToast(`❌ ${errorMsg} [v2.0]`, 'error');
        console.error('Server error:', response.status, data || rawText);
      }

    } catch (err) {
      // Network error, timeout, or server is down
      console.error('Submission network error:', err);
      showToast('❌ Connection Failed. Check internet/server status. [v2.0]', 'error');
    } finally {
      // Remove loading state
      submitBtn.classList.remove('btn--loading');
      submitBtn.disabled = false;
    }
  });
  
  // --- Keyboard Navigation ---
  
  // Name -> DOB
  nameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      dobInput.focus();
    }
  });

  // DOB -> Symptoms
  dobInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      symptomsInput.focus();
    }
  });

  // Symptoms -> Location
  symptomsInput.addEventListener('keydown', (event) => {
    // If user presses Enter (and NOT Shift+Enter)
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // Prevent adding a newline in textarea
      locationInput.focus();   // Jump to the next field
    }
  });

  // ============================================================
  // Toast Notification System
  // ============================================================
  // Shows a temporary message at the top-right of the screen

  function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');

    // Create the toast element
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;

    // Add it to the container
    container.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      toast.classList.add('toast--exit');
      // Wait for the exit animation to finish, then remove from DOM
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

});
