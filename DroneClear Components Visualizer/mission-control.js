// =============================================================
// mission-control.js — Dashboard stats and interactivity
// Standalone IIFE — no dependency on app.js or state.js
// =============================================================

(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', initMissionControl);

    async function initMissionControl() {
        await loadDashboardStats();
    }

    /**
     * Fetch live counts from the existing REST API and populate
     * the stat counter elements. Uses textContent (XSS-safe).
     * Gracefully degrades — leaves "--" placeholders on failure.
     */
    async function loadDashboardStats() {
        try {
            const [catRes, modelRes, guideRes] = await Promise.all([
                fetch('/api/categories/'),
                fetch('/api/drone-models/'),
                fetch('/api/build-guides/'),
            ]);

            // Categories endpoint returns array with annotated `count` per category
            if (catRes.ok) {
                const cats = await catRes.json();
                const catArray = Array.isArray(cats) ? cats : (cats.results || []);

                const catEl = document.getElementById('stat-categories');
                if (catEl) catEl.textContent = catArray.length;

                // Sum component counts from category annotations
                const totalParts = catArray.reduce((sum, c) => sum + (c.count || 0), 0);
                const partsEl = document.getElementById('stat-parts');
                if (partsEl) partsEl.textContent = totalParts.toLocaleString();
            }

            if (modelRes.ok) {
                const models = await modelRes.json();
                const modelArray = Array.isArray(models) ? models : (models.results || []);
                const el = document.getElementById('stat-models');
                if (el) el.textContent = modelArray.length;
            }

            if (guideRes.ok) {
                const guides = await guideRes.json();
                const guideArray = Array.isArray(guides) ? guides : (guides.results || []);
                const el = document.getElementById('stat-guides');
                if (el) el.textContent = guideArray.length;
            }
        } catch (err) {
            console.warn('Mission Control: could not load stats', err);
            // Leave "--" placeholders — graceful degradation
        }
    }
})();
