(function() {
    const STORAGE_KEY = 'v6-announcement-seen';
    if (localStorage.getItem(STORAGE_KEY)) return;

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #v6-modal-backdrop {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(10px);
                z-index: 999999;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.5s ease;
                font-family: 'Geist', sans-serif;
            }
            #v6-modal-content {
                background: #0d0d0d;
                border: 1px solid #1a1a1a;
                border-radius: 24px;
                padding: 2.5rem;
                max-width: 450px;
                width: 90%;
                text-align: center;
                transform: scale(0.9);
                transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            }
            #v6-modal-backdrop.visible { opacity: 1; }
            #v6-modal-backdrop.visible #v6-modal-content { transform: scale(1); }
            
            #v6-modal-title {
                font-size: 1.75rem;
                font-weight: 600;
                color: #fff;
                margin-bottom: 1rem;
            }
            #v6-modal-text {
                font-size: 1rem;
                color: #a0a0a0;
                line-height: 1.6;
                margin-bottom: 2rem;
            }
            #v6-modal-btn {
                background: rgba(79, 70, 229, 0.1);
                border: 1px solid #4f46e5;
                color: #4f46e5;
                padding: 0.75rem 2rem;
                border-radius: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                text-decoration: none;
                display: inline-block;
            }
            #v6-modal-btn:hover {
                background: #4f46e5;
                color: #fff;
                transform: translateY(-2px);
            }
        `;
        document.head.appendChild(style);
    }

    function createModal() {
        const backdrop = document.createElement('div');
        backdrop.id = 'v6-modal-backdrop';
        
        backdrop.innerHTML = `
            <div id="v6-modal-content">
                <h2 id="v6-modal-title">V6 is Here</h2>
                <p id="v6-modal-text">
                    The next generation of 4SP has arrived. We won't list the features here — that takes the fun out of it. <br><br>
                    Explore and find them yourself at project-niobium.giize.com.
                </p>
                <a href="https://www.project-niobium.giize.com" id="v6-modal-btn">Take Me There</a>
            </div>
        `;

        document.body.appendChild(backdrop);

        // Close on button click (and save to localStorage)
        backdrop.querySelector('#v6-modal-btn').onclick = () => {
            localStorage.setItem(STORAGE_KEY, 'true');
            backdrop.classList.remove('visible');
            setTimeout(() => backdrop.remove(), 500);
        };

        // Show with animation
        requestAnimationFrame(() => {
            backdrop.classList.add('visible');
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            injectStyles();
            createModal();
        });
    } else {
        injectStyles();
        createModal();
    }
})();
