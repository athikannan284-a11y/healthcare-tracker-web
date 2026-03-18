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

      const data = await response.json();

      if (response.ok) {
        // Success! Show a nice toast and clear the form
        showToast('✅ Report submitted successfully!', 'success');
        form.reset();

        // Redirect to dashboard after a short delay
        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 1500);
      } else {
        // Server returned an error
        showToast(data.error || 'Something went wrong.', 'error');
      }

    } catch (err) {
      // Network error or server is down
      console.error('Submission error:', err);
      showToast('❌ Could not connect to server. Is it running?', 'error');
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
