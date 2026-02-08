/**
 * navigation.js
 * * Animation: Height-only expansion (0.6s, Slow-Fast-Slow).
 * * Width: Fixed (240px) to prevent layout shifts.
 * * Update: Navbar elements are unselectable (except Auth text).
 * * Update: Dropdown containers are static (no hover animation).
 * * Update: SMART SCALING - Saves scale to localStorage for instant load.
 * * Update: AUTH LAYOUT RESTRUCTURE - Matches 4sp-max layout (Avatars, Marquee, Show More).
 * * Security: Redirects to ../index.html if logged out.
 */

(async function() {
    // --- Prevent Multiple Loads ---
    if (window.__4sp_nav_loaded) {
        console.warn("Navigation.js already loaded, skipping...");
        return;
    }
    window.__4sp_nav_loaded = true;

    // --- Dynamic Imports ---
    const [
        { onAuthStateChanged, signOut },
        { collection, query, where, onSnapshot },
        { doc, getDoc },
        { db, auth } // Import db and auth directly from firebase-config.js
    ] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"), 
        import('./firebase-config.js') 
    ]);

    // --- Configuration ---
    const STORAGE_KEY = 'viro_navbar_scale_settings';

    // --- Helper Functions ---
    const loadCSS = (href) => {
        return new Promise((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = resolve;
            document.head.appendChild(link);
        });
    };

    const hexToRgb = (hex) => {
        if (!hex || typeof hex !== 'string') return null;
        let c = hex.substring(1);
        if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
        if (c.length !== 6) return null;
        const num = parseInt(c, 16);
        return { r: (num >> 16) & 0xFF, g: (num >> 8) & 0xFF, b: (num >> 0) & 0xFF };
    };

    const getLuminance = (rgb) => {
        if (!rgb) return 0;
        const a = [rgb.r, rgb.g, rgb.b].map(v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    };

    const getLetterAvatarTextColor = (gradientBg) => {
        if (!gradientBg) return '#FFFFFF';
        const match = gradientBg.match(/#([0-9a-fA-F]{3}){1,2}/);
        const firstHexColor = match ? match[0] : null;
        if (!firstHexColor) return '#FFFFFF';
        const rgb = hexToRgb(firstHexColor);
        if (!rgb) return '#FFFFFF';
        const luminance = getLuminance(rgb);
        if (luminance > 0.5) {
            const darkenFactor = 0.5;
            const darkerR = Math.floor(rgb.r * darkenFactor);
            const darkerG = Math.floor(rgb.g * darkenFactor);
            const darkerB = Math.floor(rgb.b * darkenFactor);
            return `#${((1 << 24) + (darkerR << 16) + (darkerG << 8) + darkerB).toString(16).slice(1)}`;
        } else {
            return '#FFFFFF';
        }
    };

    // --- Main Logic ---
    const run = async () => {
        if (!document.getElementById('navbar-container')) {
            const navbarDiv = document.createElement('div');
            navbarDiv.id = 'navbar-container';
            document.body.prepend(navbarDiv);
        }

        injectStyles();
        await loadCSS("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css");
        
        const pages = {
            'dashboard': { name: "Dashboard", url: "/logged-in/dashboard.html", icon: "fa-solid fa-house-chimney" },
            'games': { name: "Favorite Matches", url: "/logged-in/fav_matches.html", icon: "fa-solid fa-basketball" },
            'messages': { name: "Messages", url: "/logged-in/messages.html", icon: "fa-solid fa-comment" },
            'team_msgs': { name: "Team Messages", url: "/logged-in/teams.html", icon: "fa-solid fa-user-group" },
            'sessions': { name: "Team Sessions", url: "/logged-in/team_sessions.html", icon: "fa-solid fa-people-group" },
        };

        initializeNavbar(pages);
        
        // --- SCALING LOGIC ---
        
        // 1. Initial Load: Try LocalStorage for instant snap
        adjustNavbarScale(true);

        // 2. Dynamic Resize: Handle manual window resizing
        window.addEventListener('resize', () => {
            window.requestAnimationFrame(() => adjustNavbarScale(false));
        });

        // 3. RESIZE OBSERVER
        const content = document.querySelector('.navbar-content');
        if (content && window.ResizeObserver) {
            const resizeObserver = new ResizeObserver(() => {
                window.requestAnimationFrame(() => adjustNavbarScale(false));
            });
            resizeObserver.observe(content);
        }
        
        // 4. Fallback Font Check
        if (document.fonts) {
            document.fonts.ready.then(() => adjustNavbarScale(false));
        }
        
        // 5. Hard Reset Safety Valve (500ms)
        setTimeout(() => adjustNavbarScale(false), 500);
    };

    /**
     * Calculates and applies the scale.
     * @param {boolean} isInitial - If true, disables transitions for instant load.
     */
    const adjustNavbarScale = (isInitial = false) => {
        const container = document.getElementById('navbar-container');
        const content = document.querySelector('.navbar-content');
        
        if (!container || !content) return;

        // Use clientWidth to ignore vertical scrollbar width
        const availableWidth = document.documentElement.clientWidth;
        
        // SAFETY BUFFER: Subtract 12px to guarantee the right side stays on screen.
        const safeAvailableWidth = availableWidth - 12;
        
        let scale = 1;
        let neededWidth = safeAvailableWidth; 

        // --- Logic: Check Local Storage vs Calculation ---
        let appliedFromStorage = false;

        if (isInitial) {
            try {
                const savedSettings = JSON.parse(localStorage.getItem(STORAGE_KEY));
                if (savedSettings && Math.abs(savedSettings.availableWidth - availableWidth) < 2) {
                    scale = savedSettings.scale;
                    neededWidth = savedSettings.neededWidth;
                    appliedFromStorage = true;
                }
            } catch (e) {
                console.warn("Error reading navbar settings", e);
            }
        }

        if (!appliedFromStorage) {
            // --- FORCE REFLOW & MEASURE ---
            const currentTransform = content.style.transform;
            const currentTransition = content.style.transition;
            const currentPosition = content.style.position;
            const currentWhitespace = content.style.whiteSpace;
            
            content.style.transition = 'none'; 
            content.style.transform = 'none';
            content.style.position = 'absolute'; 
            content.style.whiteSpace = 'nowrap';
            content.style.width = 'auto';
            content.style.minWidth = 'max-content'; 
            
            // Force layout calc
            void content.offsetWidth; 
            
            // Measure (+2 buffer for subpixel)
            const measuredWidth = content.offsetWidth + 2;
            
            // Restore styles
            content.style.position = currentPosition;
            content.style.whiteSpace = currentWhitespace;
            content.style.minWidth = '100%';
            
            if (!isInitial) {
                content.style.transition = currentTransition;
            } else {
                content.style.transform = currentTransform; 
            }

            // Calculate Scale
            if (measuredWidth > safeAvailableWidth) {
                scale = safeAvailableWidth / measuredWidth;
                neededWidth = measuredWidth;
            } else {
                scale = 1;
                neededWidth = safeAvailableWidth; 
            }

            // Save for next refresh
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                availableWidth: availableWidth,
                scale: scale,
                neededWidth: neededWidth
            }));
        }

        // --- Apply Styles ---
        
        if (isInitial) {
            content.style.transition = 'none'; 
            container.style.transition = 'none';
        } else {
            content.style.transition = 'transform 0.1s ease-out, width 0.1s ease-out';
            container.style.transition = 'height 0.1s ease-out';
        }

        if (scale !== 1) {
            content.style.transformOrigin = 'top left';
            content.style.transform = `scale(${scale})`;
            content.style.width = `${neededWidth}px`; 
            
            const newHeight = 72 * scale;
            container.style.height = `${newHeight}px`;
            document.body.style.paddingTop = `${newHeight + 10}px`;
        } else {
            content.style.transform = 'none';
            content.style.width = '100%';
            container.style.height = '72px';
            document.body.style.paddingTop = '80px';
        }
    };

    const injectStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
            :root {
                --nav-bg: #ffffff;
                --nav-border: #e7e5e4;
                --text-inactive: #57534e;
                --text-active: #c2410c;   
                --btn-bg-hover: #fff7ed;
                --btn-border-hover: #fed7aa;
                --btn-text-active: #9a3412;
                --btn-radius: 14px;
                --morph-width: 240px;
                /* Auth Layout Defaults (Light Mode) */
                --menu-bg: #ffffff;
                --menu-border: #e7e5e4;
                --menu-divider: #f3f4f6;
                --menu-text: #57534e;
                --menu-username-text: #1c1917;
                --menu-email-text: #78716c;
                --avatar-gradient: linear-gradient(135deg, #f97316 0%, #c2410c 100%);
            }

            body { padding-top: 80px !important; font-family: 'Geist', sans-serif !important; }

            #navbar-container {
                position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important;
                z-index: 9999 !important;
                background: var(--nav-bg) !important;
                height: 72px !important; 
                width: 100vw !important;
                display: flex !important; 
                align-items: flex-start !important; 
                justify-content: flex-start !important;
                border-bottom: 1px solid transparent !important;
                box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05) !important;
                font-family: 'Geist', sans-serif !important;
                overflow: visible !important; 
                
                -webkit-user-select: none !important;
                -moz-user-select: none !important;
                -ms-user-select: none !important;
                user-select: none !important;
            }

            .navbar-content {
                display: flex !important; 
                align-items: center !important; 
                justify-content: space-between !important;
                gap: 1rem !important; 
                width: 100% !important; 
                height: 72px !important; 
                padding: 0 1.5rem !important; 
                box-sizing: border-box !important;
                position: relative !important;
                transition: transform 0.1s ease-out, width 0.1s ease-out !important;
            }

            /* --- Sections for Grouping --- */
            .navbar-left, .navbar-right {
                display: flex !important;
                align-items: center !important;
                gap: 1rem !important;
                flex: 1 !important; 
                min-width: 0 !important;
            }
            .navbar-left { justify-content: flex-start !important; }
            .navbar-right { justify-content: flex-end !important; flex-shrink: 0 !important; }
            
            .navbar-center {
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                flex: 0 0 auto !important; 
            }

            .navbar-logo { 
                height: 40px !important; 
                width: auto !important; 
                margin-right: 0.5rem !important; 
                flex-shrink: 0 !important; 
            }

            /* --- Morphing Container --- */
            .morph-wrapper {
                position: relative !important;
                height: 40px !important;
                width: var(--morph-width) !important;
                flex-shrink: 0 !important;
            }

            .morph-btn {
                position: absolute !important;
                top: 0 !important;
                height: 40px !important;
                width: var(--morph-width) !important;
                background: transparent !important;
                border: 1px solid var(--nav-border) !important;
                border-radius: var(--btn-radius) !important;
                color: var(--text-inactive) !important;
                display: flex !important; 
                flex-direction: column !important;
                overflow: hidden !important;
                transition: 
                    height 0.6s cubic-bezier(0.76, 0, 0.24, 1),
                    background-color 0.4s ease,
                    border-color 0.4s ease,
                    box-shadow 0.4s ease !important;
                z-index: 20 !important;
                cursor: pointer !important;
            }

            .morph-btn.left-anchor { left: 0 !important; }
            .morph-btn.right-anchor { right: 0 !important; }

            .morph-btn:not(.expanded):hover {
                background-color: var(--btn-bg-hover) !important;
                border-color: var(--btn-border-hover) !important;
                color: var(--text-active) !important;
            }
            
            .morph-btn:not(.expanded):hover .summary-text,
            .morph-btn:not(.expanded):hover i {
                color: var(--text-active) !important;
            }

            .morph-btn.expanded {
                height: 320px !important; 
                background-color: #ffffff !important;
                border-color: var(--btn-border-hover) !important;
                box-shadow: 0 15px 35px -5px rgba(0,0,0,0.1), 0 8px 15px -7px rgba(0,0,0,0.05) !important;
                z-index: 10000 !important;
                cursor: default !important;
                transform: none !important;
            }

            .summary-view {
                height: 40px !important;
                width: 100% !important;
                display: flex !important; 
                align-items: center !important; 
                justify-content: center !important; 
                gap: 0.6rem !important;
                padding: 0 1rem !important;
                flex-shrink: 0 !important; 
                border-bottom: 1px solid transparent !important;
                transition: border-color 0.4s ease !important;
                pointer-events: none !important; 
            }
            
            .morph-btn.expanded .summary-view {
                border-bottom-color: #f3f4f6 !important; 
                background-color: #fafaf9 !important; 
                pointer-events: auto !important; 
            }

            .summary-text { font-weight: 500 !important; white-space: nowrap !important; transition: color 0.2s ease !important; }

            .detail-view {
                opacity: 0 !important; 
                pointer-events: none !important;
                transition: opacity 0.3s ease 0.1s !important;
                display: flex !important; 
                flex-direction: column !important; 
                flex-grow: 1 !important; 
                width: 100% !important;
                padding: 0.5rem !important; 
                box-sizing: border-box !important; 
                overflow: hidden !important;
            }

            .morph-btn.expanded .detail-view { opacity: 1 !important; pointer-events: auto !important; }

            .header-close-btn {
                position: absolute !important; right: 12px !important; opacity: 0 !important; pointer-events: none !important;
                transition: opacity 0.2s !important; color: #9ca3af !important; cursor: pointer !important;
            }
            .morph-btn.expanded .header-close-btn { opacity: 1 !important; pointer-events: auto !important; }
            .header-close-btn:hover { color: #ef4444 !important; }

            .scroll-list {
                flex-grow: 1 !important; 
                overflow-y: auto !important;
                display: flex !important; 
                flex-direction: column !important; 
                gap: 0.5rem !important; 
                padding-top: 0.5rem !important;
            }
            .scroll-list::-webkit-scrollbar { width: 4px !important; }
            .scroll-list::-webkit-scrollbar-thumb { background: #e5e7eb !important; border-radius: 4px !important; }

            .list-item {
                display: flex !important; align-items: center !important; gap: 0.75rem !important;
                padding: 0.6rem !important; border-radius: 8px !important;
                background: #ffffff !important; border: 1px solid #f3f4f6 !important;
                transition: all 0.2s !important;
            }
            .list-item:hover { 
                background: var(--btn-bg-hover) !important; 
                border-color: var(--btn-border-hover) !important;
                color: var(--text-active) !important;
                transform: translateY(-1px) !important;
            }

            /* --- Navigation Tabs --- */
            .nav-list { display: flex !important; align-items: center !important; gap: 0.5rem !important; flex-shrink: 0 !important; justify-content: center !important; }

            .nav-btn-base {
                display: inline-flex !important; align-items: center !important; justify-content: center !important; gap: 0.5rem !important;
                padding: 0.5rem 1.2rem !important; font-size: 0.9rem !important; font-weight: 500 !important;
                border-radius: var(--btn-radius) !important;
                border: 1px solid transparent !important; background: transparent !important;
                color: var(--text-inactive) !important; transition: all 0.2s ease !important;
                text-decoration: none !important; cursor: pointer !important; white-space: nowrap !important; height: 40px !important;
                flex-shrink: 1 !important;
            }
            .nav-btn-base:hover {
                background: var(--btn-bg-hover) !important; border-color: var(--btn-border-hover) !important;
                color: var(--text-active) !important; transform: translateY(-1px) !important;
            }
            .nav-btn-base:hover i { color: var(--text-active) !important; }
            
            .nav-btn-base.active {
                background: var(--btn-bg-hover) !important; border-color: var(--btn-border-hover) !important;
                color: var(--btn-text-active) !important; font-weight: 500 !important;
            }
            .nav-btn-base.active i { color: var(--btn-text-active) !important; }

            /* --- AUTH BUTTON STYLES (MATCHING 4SP-MAX LAYOUT) --- */
            #auth-toggle {
                border-color: var(--nav-border) !important;
                transition: border-color 0.3s ease !important;
                border-radius: 14px !important; 
                border-width: 1px !important;
                width: 40px !important; height: 40px !important;
                display: flex !important; align-items: center !important; justify-content: center !important;
                cursor: pointer !important; position: relative !important;
                overflow: hidden !important;
                flex-shrink: 0 !important;
            }
            #auth-toggle:hover { z-index: 50 !important; border-color: var(--btn-border-hover) !important; }

            /* Auth Dropdown Menu */
            .auth-menu-container {
                position: absolute !important; right: 0 !important; top: 55px !important; width: 16rem !important;
                background: var(--menu-bg) !important;
                border: 1px solid var(--menu-border) !important;
                border-radius: 20px !important; /* 4sp-max radius */
                padding: 0.75rem !important;
                display: flex !important; flex-direction: column !important; gap: 0.5rem !important;
                box-shadow: 0 10px 30px rgba(0,0,0,0.1) !important;
                transform-origin: top right !important; z-index: 10000 !important;
                transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s ease-out !important;
            }
            
            .auth-menu-container.open { 
                display: flex !important; 
                animation: menu-pop-in 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards !important;
            }
            .auth-menu-container.closing {
                display: flex !important;
                animation: menu-pop-out 0.2s ease-in forwards !important;
                pointer-events: none !important;
            }
            .auth-menu-container.closed { opacity: 0 !important; pointer-events: none !important; display: none !important; }

            @keyframes menu-pop-in {
                0% { opacity: 0; transform: translateY(-15px) scale(0.92); }
                100% { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes menu-pop-out {
                0% { opacity: 1; transform: translateY(0) scale(1); }
                100% { opacity: 0; transform: translateY(-15px) scale(0.92); }
            }

            /* Auth Menu Header */
            .auth-menu-header-container {
                padding: 0 0.5rem 0.5rem 0.5rem !important;
                margin-bottom: 0.25rem !important;
                border-bottom: 1px solid var(--menu-divider) !important;
                display: flex !important; align-items: center !important;
                width: 100% !important; min-width: 0 !important;
            }
            
            .auth-menu-username { 
                color: var(--menu-username-text) !important; 
                font-weight: 600 !important; font-size: 0.95rem !important; margin: 0 !important; 
                text-align: left !important;
            }
            .auth-menu-email { 
                color: var(--menu-email-text) !important; 
                font-size: 0.8rem !important; margin: 0 !important; 
                text-align: left !important;
            }

            /* Marquee Logic */
            .marquee-container { overflow: hidden !important; white-space: nowrap !important; position: relative !important; max-width: 100% !important; }
            .marquee-container.active { 
                mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%) !important; 
                -webkit-mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%) !important; 
            }
            .marquee-content { display: inline-block !important; white-space: nowrap !important; }
            .marquee-container.active .marquee-content { animation: marquee 10s linear infinite !important; min-width: 100% !important; }
            @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }

            /* Menu Links/Buttons */
            .auth-menu-link, .auth-menu-button { 
                display: flex !important; align-items: center !important; gap: 0.75rem !important; width: 100% !important; text-align: left !important; 
                padding: 0.75rem 1rem !important; font-size: 0.9rem !important; font-weight: 500 !important;
                color: var(--menu-text) !important; 
                background: var(--btn-bg-hover) !important; /* Light BG default */
                border: 1px solid var(--btn-bg-hover) !important;
                border-radius: 16px !important; /* 4sp-max radius */
                transition: all 0.2s ease !important; cursor: pointer !important; text-decoration: none !important;
                margin-bottom: 0 !important;
            }
            
            .auth-menu-link:hover, .auth-menu-button:hover { 
                background-color: var(--btn-bg-hover) !important; 
                border-color: var(--btn-border-hover) !important;
                color: var(--text-active) !important; 
                transform: translateY(-2px) scale(1.02) !important;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05) !important;
            }
            
            .auth-menu-link i, .auth-menu-button i { width: 1.25rem !important; text-align: center !important; }
            
            #logout-button { color: #dc2626 !important; border-color: transparent !important; background: #fef2f2 !important; }
            #logout-button:hover { border-color: #fecaca !important; color: #b91c1c !important; }

            .auth-menu-more-section { 
                display: none !important; padding-top: 0.5rem !important; margin-top: 0.5rem !important; 
                border-top: 1px solid var(--menu-divider) !important; flex-direction: column !important; gap: 0.5rem !important; 
            }
            .auth-menu-more-section.expanded { display: flex !important; }

            @media (max-width: 1100px) {
                .nav-btn-base span { display: none !important; }
                .nav-btn-base i { font-size: 1.1rem !important; margin: 0 !important; }
                .summary-text { display: none !important; }
            }
        `;
        document.head.appendChild(style);
    };

    const initializeNavbar = (pages) => { 
        const container = document.getElementById('navbar-container');
        const logoPath = '../images/viro.png';

        // --- Render Structure (3 Groups) ---
        container.innerHTML = `
            <div class="navbar-content">
                <div class="navbar-left">
                    <a href="/" class="flex items-center flex-shrink-0">
                        <img src="${logoPath}" alt="Logo" class="navbar-logo">
                    </a>
                    <div class="morph-wrapper" id="morph-sessions-wrapper">
                        <div id="morph-sessions" class="morph-btn left-anchor">
                            <div class="summary-view">
                                <i class="fa-solid fa-clock-rotate-left summary-icon text-orange-600"></i>
                                <span class="summary-text" id="sessions-summary">1 Active Session</span>
                                <i class="fa-solid fa-xmark header-close-btn" id="close-sessions"></i>
                            </div>
                            <div class="detail-view">
                                <div class="scroll-list" id="sessions-list">
                                    <div class="list-item">
                                        <i class="fa-solid fa-basketball text-orange-600 text-sm"></i>
                                        <div class="flex flex-col">
                                            <span class="font-semibold text-xs text-gray-900">MLSD Varsity Boys</span>
                                            <span class="text-xs text-gray-500">Practice Drills • 2h 10m</span>
                                        </div>
                                    </div>
                                    <div class="list-item">
                                        <i class="fa-solid fa-video text-gray-600 text-sm"></i>
                                        <div class="flex flex-col">
                                            <span class="font-semibold text-xs text-gray-900">Varsity Film Review</span>
                                            <span class="text-xs text-gray-500">Live Session • Active Now</span>
                                        </div>
                                    </div>
                                    <div class="list-item">
                                        <i class="fa-solid fa-clipboard-list text-blue-600 text-sm"></i>
                                        <div class="flex flex-col">
                                            <span class="font-semibold text-xs text-gray-900">JV Scrimmage Prep</span>
                                            <span class="text-xs text-gray-500">Scheduled 4:00 PM</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="navbar-center">
                    <div class="nav-list" id="nav-list"></div>
                </div>

                <div class="navbar-right">
                    <div class="morph-wrapper" id="morph-messages-wrapper">
                        <div id="morph-messages" class="morph-btn right-anchor">
                            <div class="summary-view">
                                <span class="summary-text" id="messages-summary">No new messages</span>
                                <i class="fa-solid fa-bell summary-icon text-orange-600"></i>
                                <i class="fa-solid fa-xmark header-close-btn" id="close-messages" style="right: auto; left: 12px;"></i>
                            </div>
                            <div class="detail-view">
                                <div class="scroll-list" id="messages-list">
                                    <p class="text-center text-gray-500 p-4">No unread messages.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="auth-wrapper" class="relative flex-shrink-0">
                        <span id="friend-request-badge" class="absolute -top-2 -right-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full hidden">0</span>
                    </div>
                </div>
            </div>
        `;

        const navList = document.getElementById('nav-list');
        const authWrapper = document.getElementById('auth-wrapper');
        const messagesSummary = document.getElementById('messages-summary');
        const friendRequestBadge = document.getElementById('friend-request-badge');
        const messagesList = document.getElementById('messages-list');

        // --- Active Page Logic ---
        const getCurrentPageKey = () => {
            const path = window.location.pathname.toLowerCase();
            for (const [key, page] of Object.entries(pages)) {
                if (path.includes(page.url)) return key;
            }
            return null;
        };
        const activeKey = getCurrentPageKey();

        // --- Render Tabs ---
        const tabOrder = ['dashboard', 'games', 'messages', 'team_msgs', 'sessions'];
        navList.innerHTML = tabOrder.map(key => {
            const page = pages[key];
            const isActive = (key === activeKey);
            const activeClass = isActive ? 'active' : '';
            return `
                <a href="${page.url}" class="nav-btn-base ${activeClass}">
                    <i class="${page.icon}"></i>
                    <span>${page.name}</span>
                </a>
            `;
        }).join('');

        // --- Auth Rendering Function (MATCHING 4SP-MAX) ---
        const renderAuth = (user, userData) => {
            const authWrapper = document.getElementById('auth-wrapper');
            if (!authWrapper) return;

            const friendRequestBadge = document.getElementById('friend-request-badge'); 
            if (friendRequestBadge) authWrapper.appendChild(friendRequestBadge);

            if (!user) {
                // Logged Out View
                authWrapper.innerHTML = `
                    <div id="auth-button-container" class="relative flex-shrink-0 flex items-center">
                        <button id="auth-toggle" class="logged-out-auth-toggle">
                            <i class="fa-solid fa-user text-gray-500"></i>
                        </button>
                        <div id="auth-menu-container" class="auth-menu-container closed">
                            <a href="/authentication.html" class="auth-menu-link">
                                <i class="fa-solid fa-lock w-4"></i>
                                Authenticate
                            </a>
                        </div>
                    </div>
                `;
            } else {
                // Logged In View
                const username = userData?.username || user.displayName || 'User';
                const email = user.email || 'No email';
                const initial = (userData?.letterAvatarText || username.charAt(0)).toUpperCase();
                let avatarHtml = '';
                const pfpType = userData?.pfpType || 'google'; 

                // Avatar Logic
                if (pfpType === 'custom' && userData?.customPfp) {
                    avatarHtml = `<img src="${userData.customPfp}" class="w-full h-full object-cover" alt="Profile">`;
                } else if (pfpType === 'mibi' && userData?.mibiConfig) {
                    const { eyes, mouths, hats, bgColor, rotation, size, offsetX, offsetY } = userData.mibiConfig;
                    const scale = (size || 100) / 100;
                    avatarHtml = `
                        <div class="w-full h-full relative overflow-hidden" style="background-color: ${bgColor || '#3B82F6'};">
                             <div class="absolute inset-0 w-full h-full" style="transform: translate(${offsetX || 0}%, ${offsetY || 0}%) rotate(${rotation || 0}deg) scale(${scale}); transform-origin: center;">
                                 <img src="/mibi-avatars/head.png" class="absolute inset-0 w-full h-full object-contain">
                                 ${eyes ? `<img src="/mibi-avatars/eyes/${eyes}" class="absolute inset-0 w-full h-full object-contain">` : ''}
                                 ${mouths ? `<img src="/mibi-avatars/mouths/${mouths}" class="absolute inset-0 w-full h-full object-contain">` : ''}
                                 ${hats ? `<img src="/mibi-avatars/hats/${hats}" class="absolute inset-0 w-full h-full object-contain">` : ''}
                             </div>
                        </div>`;
                } else if (pfpType === 'letter') {
                    const bg = userData?.pfpLetterBg || 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)';
                    const textColor = getLetterAvatarTextColor(bg);
                    const fontSizeClass = initial.length >= 3 ? 'text-xs' : (initial.length === 2 ? 'text-sm' : 'text-base');
                    avatarHtml = `<div class="w-full h-full flex items-center justify-center font-semibold ${fontSizeClass}" style="background: ${bg}; color: ${textColor};">${initial}</div>`;
                } else {
                    const photo = user.photoURL;
                    if (photo) {
                        avatarHtml = `<img src="${photo}" class="w-full h-full object-cover" alt="Profile">`;
                    } else {
                        const bg = 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)';
                        avatarHtml = `<div class="w-full h-full flex items-center justify-center font-semibold text-base" style="background: ${bg}; color: white;">${initial}</div>`;
                    }
                }

                // Auth Menu HTML
                authWrapper.innerHTML = `
                    <div id="auth-button-container" class="relative flex-shrink-0 flex items-center">
                        <button id="auth-toggle">
                            ${avatarHtml}
                        </button>
                        <div id="auth-menu-container" class="auth-menu-container closed">
                            <div class="auth-menu-header-container">
                                <div class="min-w-0 flex-1 overflow-hidden">
                                    <div class="marquee-container" id="username-marquee">
                                        <p class="auth-menu-username marquee-content">${username}</p>
                                    </div>
                                    <div class="marquee-container" id="email-marquee">
                                        <p class="auth-menu-email marquee-content">${email}</p>
                                    </div>
                                </div>
                            </div>
                            <a href="/logged-in/settings.html" class="auth-menu-link">
                                <i class="fa-solid fa-gear w-4"></i>
                                Settings
                            </a>
                            <button id="logout-button" class="auth-menu-button">
                                <i class="fa-solid fa-right-from-bracket w-4"></i>
                                Log Out
                            </button>
                            <button id="more-button" class="auth-menu-button">
                                <i id="more-button-icon" class="fa-solid fa-chevron-down w-4"></i>
                                <span id="more-button-text">Show More</span>
                            </button>
                            <div id="more-section" class="auth-menu-more-section">
                                <a href="/documentation.html" class="auth-menu-link">
                                    <i class="fa-solid fa-book w-4"></i>
                                    Documentation
                                </a>
                                <a href="../legal.html" class="auth-menu-link">
                                    <i class="fa-solid fa-gavel w-4"></i>
                                    Terms & Policies
                                </a>
                                <a href="https://buymeacoffee.com/4simpleproblems" class="auth-menu-link" target="_blank">
                                    <i class="fa-solid fa-mug-hot w-4"></i>
                                    Donate
                                </a>
                            </div>
                        </div>
                    </div>
                `;
            }

            // Setup Listeners
            const toggleBtn = document.getElementById('auth-toggle');
            const menu = document.getElementById('auth-menu-container');
            const logoutBtn = document.getElementById('logout-button');
            const moreBtn = document.getElementById('more-button');
            const moreSection = document.getElementById('more-section');
            const moreIcon = document.getElementById('more-button-icon');
            const moreText = document.getElementById('more-button-text');

            if (toggleBtn && menu) {
                toggleBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleMorph('morph-sessions', false);
                    toggleMorph('morph-messages', false);

                    if (menu.classList.contains('open')) {
                        menu.classList.remove('open');
                        menu.classList.add('closing');
                        menu.addEventListener('animationend', () => {
                            menu.classList.remove('closing');
                            menu.classList.add('closed');
                        }, { once: true });
                    } else {
                        menu.classList.remove('closed');
                        menu.classList.remove('closing');
                        menu.classList.add('open');
                        checkMarquees();
                    }
                });
            }

            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => {
                    auth.signOut().catch(err => console.error("Logout failed:", err));
                });
            }

            if (moreBtn && moreSection) {
                moreBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isExpanded = moreSection.classList.contains('expanded');
                    if (isExpanded) {
                        moreSection.classList.remove('expanded');
                        moreText.textContent = 'Show More';
                        moreIcon.classList.replace('fa-chevron-up', 'fa-chevron-down');
                    } else {
                        moreSection.classList.add('expanded');
                        moreText.textContent = 'Show Less';
                        moreIcon.classList.replace('fa-chevron-down', 'fa-chevron-up');
                    }
                });
            }
        };

        const checkMarquees = () => {
            requestAnimationFrame(() => {
                const containers = document.querySelectorAll('.marquee-container');
                containers.forEach(container => {
                    const content = container.querySelector('.marquee-content');
                    if (!content) return;
                    container.classList.remove('active');
                    if (content.nextElementSibling && content.nextElementSibling.classList.contains('marquee-content')) {
                        content.nextElementSibling.remove();
                    }
                    if (content.offsetWidth > container.offsetWidth) {
                        container.classList.add('active');
                        const duplicate = content.cloneNode(true);
                        duplicate.setAttribute('aria-hidden', 'true'); 
                        content.style.paddingRight = '2rem'; 
                        duplicate.style.paddingRight = '2rem';
                        container.appendChild(duplicate);
                    } else {
                        content.style.paddingRight = '';
                    }
                });
            });
        };

        // --- Real-time Listeners & Auth Redirect ---
        let currentAuthUser = null;
        onAuthStateChanged(auth, async (user) => {
            currentAuthUser = user;

            // --- REDIRECT IF LOGGED OUT ---
            if (!user) {
                window.location.href = '../index.html';
                return;
            }

            // Initial render with basic user data
            renderAuth(user, null);
            adjustNavbarScale(true); 

            if (user) {
                // Fetch full user data for avatar/username
                const userDocRef = doc(db, 'users', user.uid);
                onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        renderAuth(user, userData); // Re-render with full data
                        
                        // Handle Friend Requests
                        const friendRequests = userData.friendRequestsReceived || [];
                        const badge = document.getElementById('friend-request-badge');
                        if (badge) {
                            if (friendRequests.length > 0) {
                                badge.textContent = friendRequests.length;
                                badge.classList.remove('hidden');
                            } else {
                                badge.classList.add('hidden');
                            }
                        }
                    }
                });

                // Handle Messages
                onSnapshot(userDocRef, async (userDocSnap) => {
                    if (userDocSnap.exists()) {
                        const userData = userDocSnap.data();
                        const unreadChats = userData.unreadChats || {};
                        const lastMessageSummary = userData.lastMessageSummary || {};

                        let unreadCount = 0;
                        const unreadPartnerUids = [];
                        for (const partnerUid in unreadChats) {
                            if (unreadChats[partnerUid] === true) {
                                unreadCount++;
                                unreadPartnerUids.push(partnerUid);
                            }
                        }

                        messagesSummary.textContent = unreadCount === 0 ? 'No new messages' : `${unreadCount} new message${unreadCount === 1 ? '' : 's'}`;
                        messagesList.innerHTML = ''; 
                        
                        if (unreadCount > 0) {
                            for (const partnerUid of unreadPartnerUids) {
                                const partnerProfile = await getDoc(doc(db, 'users', partnerUid));
                                if (partnerProfile.exists()) {
                                    const partnerData = partnerProfile.data();
                                    const messageItem = document.createElement('a');
                                    messageItem.href = `${pages.messages.url}?friendId=${partnerUid}`;
                                    messageItem.classList.add('list-item', 'flex-col', 'items-start', 'gap-1');
                                    messageItem.innerHTML = `
                                        <span class="font-semibold text-xs text-gray-900">${partnerData.username || 'Unknown User'}</span>
                                        <span class="text-xs text-gray-500 overflow-hidden whitespace-nowrap text-ellipsis w-full">${lastMessageSummary[partnerUid] || 'New Message'}</span>
                                    `;
                                    messagesList.appendChild(messageItem);
                                }
                            }
                        } else {
                            messagesList.innerHTML = '<p class="text-center text-gray-500 p-4">No unread messages.</p>';
                        }
                    } else {
                        messagesSummary.textContent = 'No new messages';
                        messagesList.innerHTML = '<p class="text-center text-gray-500 p-4">No unread messages.</p>';
                    }
                });
            }
        });

        // --- Morph Logic ---
        const toggleMorph = (id, expand) => {
            const el = document.getElementById(id);
            if (expand) {
                if (id !== 'morph-sessions') toggleMorph('morph-sessions', false);
                if (id !== 'morph-messages') toggleMorph('morph-messages', false);
                el.classList.add('expanded');
            } else {
                el.classList.remove('expanded');
            }
        };

        const sessionsBtn = document.getElementById('morph-sessions');
        sessionsBtn.addEventListener('click', (e) => {
            if (!sessionsBtn.classList.contains('expanded') && !e.target.closest('.header-close-btn')) {
                toggleMorph('morph-sessions', true);
            }
        });
        document.getElementById('close-sessions').addEventListener('click', (e) => {
            e.stopPropagation(); 
            toggleMorph('morph-sessions', false);
        });

        const messagesBtn = document.getElementById('morph-messages');
        messagesBtn.addEventListener('click', (e) => {
            if (!messagesBtn.classList.contains('expanded') && !e.target.closest('.header-close-btn')) {
                toggleMorph('morph-messages', true);
            }
        });
        document.getElementById('close-messages').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMorph('morph-messages', false);
        });

        document.addEventListener('click', (e) => {
            const sBtn = document.getElementById('morph-sessions');
            const mBtn = document.getElementById('morph-messages');
            
            if (sBtn.classList.contains('expanded') && !sBtn.contains(e.target)) {
                toggleMorph('morph-sessions', false);
            }
            if (mBtn.classList.contains('expanded') && !mBtn.contains(e.target)) {
                toggleMorph('morph-messages', false);
            }

            const authMenu = document.getElementById('auth-menu-container');
            const profileBtn = document.getElementById('auth-toggle');
            if (authMenu && authMenu.classList.contains('open')) {
                if (!authMenu.contains(e.target) && (profileBtn && !profileBtn.contains(e.target))) {
                    authMenu.classList.remove('open');
                    authMenu.classList.add('closing');
                    authMenu.addEventListener('animationend', () => {
                        authMenu.classList.remove('closing');
                        authMenu.classList.add('closed');
                    }, { once: true });
                }
            }
        });
    };

    run();

})();
