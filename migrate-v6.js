(function() {
    // Exit fullscreen if active
    function exitFullscreen() {
        if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
            else if (document.msExitFullscreen) document.msExitFullscreen();
        }
    }

    function injectStyles() {
        if (document.getElementById('migrate-v6-styles')) return;
        const style = document.createElement('style');
        style.id = 'migrate-v6-styles';
        style.textContent = `
            #migrate-v6-backdrop {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                background: #000 !important;
                z-index: 2147483647 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
                color: #fff !important;
                overflow: hidden !important;
            }
            #migrate-v6-content {
                text-align: center !important;
                max-width: 600px !important;
                padding: 2rem !important;
                background: #0a0a0a !important;
                border: 1px solid #1a1a1a !important;
                border-radius: 32px !important;
                box-shadow: 0 0 100px rgba(79, 70, 229, 0.1) !important;
            }
            #migrate-v6-title {
                font-size: 3rem !important;
                font-weight: 900 !important;
                letter-spacing: -0.05em !important;
                margin-bottom: 1rem !important;
                background: linear-gradient(to bottom right, #fff, #666) !important;
                -webkit-background-clip: text !important;
                -webkit-text-fill-color: transparent !important;
            }
            #migrate-v6-text {
                font-size: 1.1rem !important;
                color: #888 !important;
                line-height: 1.6 !important;
                margin-bottom: 2.5rem !important;
            }
            .migrate-v6-btn {
                display: inline-block !important;
                background: #fff !important;
                color: #000 !important;
                padding: 1rem 2.5rem !important;
                border-radius: 16px !important;
                font-weight: 700 !important;
                text-decoration: none !important;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
                font-size: 1rem !important;
            }
            .migrate-v6-btn:hover {
                transform: scale(1.05) !important;
                box-shadow: 0 0 30px rgba(255, 255, 255, 0.2) !important;
            }
            .migrate-v6-btn:active {
                transform: scale(0.95) !important;
            }
        `;
        document.head.appendChild(style);
    }

    function createOverlay() {
        if (document.getElementById('migrate-v6-backdrop')) return;
        
        const backdrop = document.createElement('div');
        backdrop.id = 'migrate-v6-backdrop';
        backdrop.innerHTML = `
            <div id="migrate-v6-content">
                <h1 id="migrate-v6-title">Time to Move.</h1>
                <p id="migrate-v6-text">
                    4SP MAX is being retired. The future is V6 — faster, more stable, and packed with new features you've been asking for.
                    <br><br>
                    Your account and data are waiting for you on the new platform.
                </p>
                <a href="https://project-niobium.giize.com" class="migrate-v6-btn">Migrate to V6</a>
            </div>
        `;

        // Prevent bypassing via pointer events or focus
        backdrop.addEventListener('contextmenu', e => e.preventDefault());
        
        document.body.appendChild(backdrop);
        exitFullscreen();
    }

    // Protection logic
    function protect() {
        injectStyles();
        createOverlay();
        exitFullscreen();
    }

    // Monitor for tampering
    const observer = new MutationObserver((mutations) => {
        let needsRestore = false;
        for (const mutation of mutations) {
            for (const node of mutation.removedNodes) {
                if (node.id === 'migrate-v6-backdrop' || node.id === 'migrate-v6-styles') {
                    needsRestore = true;
                    break;
                }
            }
        }
        if (needsRestore) protect();
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });

    // Aggressive reinforcement
    setInterval(protect, 1000);
    window.addEventListener('resize', exitFullscreen);
    
    // Initial trigger
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', protect);
    } else {
        protect();
    }
})();
// Made with ❤️ from 4SP
