// Theme switching functionality

(function() {
    'use strict';

    // Theme switching functionality
    function initThemeSwitcher() {
        const themeSelector = document.getElementById('themeSelector');
        if (!themeSelector) return;

        // Load saved theme or default to dark
        const savedTheme = localStorage.getItem('selectedTheme') || 'dark';
        document.body.className = `theme-${savedTheme}`;
        themeSelector.value = savedTheme;

        // Handle theme changes
        themeSelector.addEventListener('change', function(e) {
            const theme = e.target.value;
            document.body.className = `theme-${theme}`;
            localStorage.setItem('selectedTheme', theme);
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initThemeSwitcher);
    } else {
        initThemeSwitcher();
    }

    // Expose for potential external use
    window.XRPL = window.XRPL || {};
    window.XRPL.initThemeSwitcher = initThemeSwitcher;

})();