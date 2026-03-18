/**
 * cursor.js — Handles the 3D tilt effect and background parallax
 * 
 * This script adds interactivity by tracking the mouse cursor and applying:
 * 1. 3D transform (tilt) to the report form card.
 * 2. Parallax translation to the background morphological shapes.
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 3D Tilt Effect for Report Card ---
    const card = document.querySelector('.report-card');
    const container = document.querySelector('.report-container');

    if (card && container) {
        container.addEventListener('mousemove', (e) => {
            // Calculate rotation based on cursor position relative to window center
            const xAxis = (window.innerWidth / 2 - e.pageX) / 25;
            const yAxis = (window.innerHeight / 2 - e.pageY) / 25;
            card.style.transform = `rotateY(${xAxis}deg) rotateX(${yAxis}deg)`;
        });

        container.addEventListener('mouseenter', () => {
            // Remove transition for snappier tracking
            card.style.transition = 'none';
        });

        container.addEventListener('mouseleave', () => {
            // Smoothly reset tilt when mouse leaves
            card.style.transition = 'all 0.5s ease';
            card.style.transform = `rotateY(0deg) rotateX(0deg)`;
        });
    }

    // --- Interactive Background Parallax ---
    const wraps = document.querySelectorAll('.shape-wrap');
    
    if (wraps.length > 0) {
        document.addEventListener('mousemove', (e) => {
            // Calculate drift based on cursor percentage across the viewport
            const x = (e.clientX / window.innerWidth - 0.5) * 60; // Max 60px drift
            const y = (e.clientY / window.innerHeight - 0.5) * 60;
            
            wraps.forEach((wrap, index) => {
                // Each wrapper moves at a slightly different speed/intensity for depth
                const factor = (index + 1) * 0.4;
                wrap.style.transform = `translate(${x * factor}px, ${y * factor}px)`;
            });

            const spheres = document.querySelectorAll('.glow-sphere');
            spheres.forEach((sphere, index) => {
                const factor = (index + 1) * 0.15; // Subtle movement for background glow
                sphere.style.transform = `translate(${x * factor}px, ${y * factor}px)`;
            });
        });
    }
});
