(function() {
    // Prevent multiple injections
    if (window.BIM_BOT_LOADED) return;
    window.BIM_BOT_LOADED = true;

    // =========================================================================
    // 1. STYLE INJECTION (Matching navigation.js theme)
    // =========================================================================
    const style = document.createElement('style');
    style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap');
        @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css');

        :root {
            --bim-bg: #000000;
            --bim-border: rgb(55, 65, 81);
            --bim-text: #d1d5db;
            --bim-text-hover: #ffffff;
            --bim-accent: #4f46e5;
            --bim-accent-hover: #6366f1;
            --bim-accent-bg: rgba(79, 70, 229, 0.1);
            --bim-radius: 16px;
        }

        #bim-container {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 320px;
            background: var(--bim-bg);
            border: 1px solid var(--bim-border);
            border-radius: var(--bim-radius);
            font-family: 'Nunito', sans-serif;
            color: var(--bim-text);
            z-index: 999999;
            box-shadow: 0 10px 40px rgba(0,0,0,0.8);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transition: height 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
        }

        /* Draggable Header */
        #bim-header {
            padding: 12px 16px;
            background: rgba(20, 20, 20, 0.95);
            border-bottom: 1px solid var(--bim-border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            cursor: grab;
            user-select: none;
        }
        #bim-header:active { cursor: grabbing; }

        .bim-title {
            font-weight: 700;
            font-size: 1rem;
            color: #fff;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .bim-controls { display: flex; gap: 8px; }

        .bim-icon-btn {
            background: transparent;
            border: none;
            color: var(--bim-text);
            cursor: pointer;
            padding: 4px;
            transition: color 0.2s;
        }
        .bim-icon-btn:hover { color: #fff; }

        /* Content Area */
        #bim-body {
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            max-height: 400px;
            transition: all 0.3s ease;
        }
        
        #bim-container.minimized #bim-body {
            display: none;
        }

        /* Log Output Area */
        #bim-log {
            background: #0a0a0a;
            border: 1px solid #222;
            border-radius: 12px;
            padding: 12px;
            height: 200px;
            overflow-y: auto;
            font-size: 0.85rem;
            font-family: 'Nunito', sans-serif; /* Kept font consistent */
            white-space: pre-wrap;
            color: #ccc;
            scrollbar-width: thin;
            scrollbar-color: #333 #0a0a0a;
        }

        #bim-log::-webkit-scrollbar { width: 6px; }
        #bim-log::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }

        /* Log Items */
        .log-entry { margin-bottom: 8px; border-bottom: 1px solid #222; padding-bottom: 8px; }
        .log-entry:last-child { border-bottom: none; margin-bottom: 0; }
        .log-label { color: var(--bim-accent); font-weight: bold; font-size: 0.75rem; text-transform: uppercase; margin-bottom: 2px; }
        .log-value { color: #fff; line-height: 1.4; }
        .log-error { color: #ef4444; }

        /* Action Button (Matches Navigation.js button style) */
        #bim-action-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            padding: 10px;
            font-size: 0.9rem;
            color: var(--bim-text);
            background: var(--bim-accent-bg);
            border: 1px solid var(--bim-accent-bg);
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            font-weight: 600;
        }
        
        #bim-action-btn:hover {
            background: rgba(79, 70, 229, 0.15);
            border-color: var(--bim-accent);
            color: var(--bim-text-hover);
            transform: translateY(-1px);
        }
        
        #bim-action-btn:active { transform: translateY(0); }

        .resize-handle {
            position: absolute;
            bottom: 0;
            right: 0;
            width: 15px;
            height: 15px;
            cursor: nwse-resize;
            z-index: 10;
        }
    `;
    document.head.appendChild(style);

    // =========================================================================
    // 2. HTML STRUCTURE
    // =========================================================================
    const container = document.createElement('div');
    container.id = 'bim-container';
    container.innerHTML = `
        <div id="bim-header">
            <div class="bim-title"><i class="fa-solid fa-robot"></i> BIM Bot</div>
            <div class="bim-controls">
                <button class="bim-icon-btn" id="bim-minimize"><i class="fa-solid fa-minus"></i></button>
                <button class="bim-icon-btn" id="bim-close"><i class="fa-solid fa-xmark"></i></button>
            </div>
        </div>
        <div id="bim-body">
            <div id="bim-log">
                <div class="log-entry" style="color: #666; text-align: center; margin-top: 80px;">
                    Answers will appear here...
                </div>
            </div>
            <button id="bim-action-btn">
                <i class="fa-solid fa-key"></i> Reveal Answers
            </button>
        </div>
        <div class="resize-handle"></div>
    `;
    document.body.appendChild(container);

    // =========================================================================
    // 3. UI LOGIC (Drag, Minimize, Output)
    // =========================================================================
    const header = document.getElementById('bim-header');
    const logArea = document.getElementById('bim-log');
    const minimizeBtn = document.getElementById('bim-minimize');
    const closeBtn = document.getElementById('bim-close');
    const actionBtn = document.getElementById('bim-action-btn');

    // Logging helper
    function log(title, content, isError = false) {
        // Clear placeholder on first log
        if (logArea.innerText.includes('Answers will appear here...')) {
            logArea.innerHTML = '';
        }
        
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        
        const label = document.createElement('div');
        label.className = 'log-label';
        label.textContent = title;
        
        const val = document.createElement('div');
        val.className = isError ? 'log-value log-error' : 'log-value';
        val.innerHTML = content; // Allow HTML for formatting arrays/lines

        entry.appendChild(label);
        entry.appendChild(val);
        logArea.appendChild(entry);
        
        // Auto-scroll to bottom
        logArea.scrollTop = logArea.scrollHeight;
    }

    // Draggable Logic
    let isDragging = false, currentX, currentY, initialX, initialY, xOffset = 0, yOffset = 0;

    header.addEventListener("mousedown", dragStart);
    document.addEventListener("mouseup", dragEnd);
    document.addEventListener("mousemove", drag);

    function dragStart(e) {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        if (e.target.closest('.bim-controls')) return; // Don't drag if clicking buttons
        isDragging = true;
    }

    function dragEnd(e) {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            xOffset = currentX;
            yOffset = currentY;
            container.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
        }
    }

    // Toggle Minimize
    minimizeBtn.addEventListener('click', () => {
        container.classList.toggle('minimized');
        const icon = minimizeBtn.querySelector('i');
        if (container.classList.contains('minimized')) {
             icon.classList.remove('fa-minus');
             icon.classList.add('fa-plus');
        } else {
             icon.classList.remove('fa-plus');
             icon.classList.add('fa-minus');
        }
    });

    // Close
    closeBtn.addEventListener('click', () => {
        container.style.opacity = '0';
        setTimeout(() => container.remove(), 300);
        window.BIM_BOT_LOADED = false;
    });

    // =========================================================================
    // 4. ANSWER EXTRACTION LOGIC (De-obfuscated & Cleaned)
    // =========================================================================
    
    function extractAnswers() {
        logArea.innerHTML = ''; // Clear previous logs
        
        try {
            if (typeof LearnosityAssess === 'undefined') {
                log('Error', 'LearnosityAssess object not found.', true);
                return;
            }

            const currentItem = LearnosityAssess.getCurrentItem();
            if (!currentItem || !currentItem.questions) {
                log('Error', 'No questions found in current item.', true);
                return;
            }

            const questions = currentItem.questions;
            let foundCount = 0;

            questions.forEach((q, index) => {
                const type = q.type;
                const validation = q.validation;
                const validResponse = validation ? validation.valid_response : null;

                if (!validResponse) return;

                let answerText = '';

                // --- Multiple Choice (MCQ) ---
                if (type === 'mcq') {
                    const value = validResponse.value;
                    // Map numeric index to Letter (0=A, 1=B, etc.)
                    const indices = Array.isArray(value) ? value : [value];
                    const answers = indices.map(idx => {
                        const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
                        return letters[idx] || `Index ${idx}`;
                    });
                    answerText = answers.join(', ');
                }
                // --- Short Text / Cloze Text ---
                else if (type === 'shorttext' || type === 'clozetext' || type === 'clozedropdown') {
                    const value = validResponse.value;
                    if (Array.isArray(value)) {
                         // Some types use nested arrays or objects
                         answerText = value.map(v => (typeof v === 'object') ? v.value || JSON.stringify(v) : v).join(' | ');
                    } else {
                        answerText = value;
                    }
                }
                // --- Association / Token Highlight ---
                else if (type === 'tokenhighlight' || type === 'clozeassociation') {
                     const value = validResponse.value;
                     answerText = Array.isArray(value) ? value.join(', ') : value;
                }
                // --- Choice Matrix ---
                else if (type === 'choicematrix') {
                     const value = validResponse.value;
                     // Usually an array of integers representing selected indices per row
                     answerText = Array.isArray(value) ? value.map(v => (v === null ? '-' : v)).join(', ') : value;
                }
                // --- Fallback ---
                else {
                    answerText = JSON.stringify(validResponse.value);
                }

                log(`Question ${index + 1} (${type})`, answerText);
                foundCount++;
            });

            if (foundCount === 0) {
                log('Info', 'No auto-validatable questions found.');
            } else {
                // Play notification sound if available from nav.js, or generic
                if (window.playClickSound) window.playClickSound();
            }

        } catch (e) {
            console.error(e);
            log('Critical Error', e.message, true);
        }
    }

    // Attach click handler
    actionBtn.addEventListener('click', extractAnswers);

    // Initial Message
    log('Ready', 'BIM Bot 2.0 initialized.<br>Click "Reveal Answers" to start.');

})();
