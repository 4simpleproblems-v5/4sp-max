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
            @import url('https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap');

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
                font-family: 'Geist', sans-serif !important;
                color: #fff !important;
                overflow: hidden !important;
            }
            #migrate-v6-content {
                text-align: center !important;
                max-width: 600px !important;
                width: 90% !important;
                padding: 3rem 2rem !important;
                background: #000 !important;
                border: 1px solid #1a1a1a !important;
                border-radius: 32px !important;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5) !important;
            }
            #migrate-v6-title {
                font-size: 3.5rem !important;
                font-weight: 800 !important;
                letter-spacing: -0.06em !important;
                margin-bottom: 1.5rem !important;
                line-height: 1 !important;
                background-image: linear-gradient(90deg, #FF7327, #8b5cf6, #FF7327) !important;
                -webkit-background-clip: text !important;
                -webkit-text-fill-color: transparent !important;
                background-clip: text !important;
                background-size: 300% auto !important;
                animation: migrate-shine 8s linear infinite !important;
            }
            @keyframes migrate-shine {
                to { background-position: 300% center !important; }
            }
            #migrate-v6-text {
                font-size: 1.25rem !important;
                color: #9ca3af !important;
                line-height: 1.6 !important;
                margin-bottom: 3rem !important;
                font-weight: 300 !important;
            }
            .migrate-v6-btn {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 1rem 2.5rem !important;
                font-size: 1.125rem !important;
                font-weight: 400 !important;
                color: #ffffff !important;
                background-color: #000 !important;
                border: 1px solid #333 !important;
                border-radius: 22px !important;
                text-decoration: none !important;
                transition: all 0.3s ease !important;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
            }
            .migrate-v6-btn:hover {
                background-color: #0a0a0a !important;
                border-color: #4b5563 !important;
                transform: scale(1.05) !important;
            }
            .migrate-v6-btn i {
                margin-left: 0.5rem !important;
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
                    4SP MAX is being retired. The future is <strong>V6</strong> — faster, more stable, and packed with new features you've been asking for.
                    <br><br>
                    Your account and data are waiting for you on the new platform.
                </p>
                <a href="https://project-niobium.giize.com" class="migrate-v6-btn">
                    Get Started Instantly <i class="fas fa-arrow-right"></i>
                </a>
            </div>
        `;

        // Prevent bypassing
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
