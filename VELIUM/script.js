const API_BASE = "https://argon.global.ssl.fastly.net";
const API_SAAVN = "https://jiosaavn-api-privatecvc2.vercel.app";
const LYRICS_API_BASE = "https://lyrics.lewdhutao.my.eu.org/v2/musixmatch/lyrics";

// State
let library = { likedSongs: [], playlists: [] };
let currentTrack = null;
let currentResults = [];
let searchType = 'song';
let lastQuery = '';
let isPlaying = false;
let itemToAdd = null;
let currentPlaylistId = null; 
let isDraggingSlider = false; 
let lastVolume = 1;

// Queue & Playback State
let playQueue = [];
let queueIndex = -1;
let crossfadeConfig = { enabled: false, duration: 6 };
let activePlayerId = 'audio-player'; 
let isCrossfading = false;
let crossfadeInterval = null;

// Cropper State
let cropperImage = null;
let cropState = { x: 0, y: 0, radius: 100 };
let isDraggingCrop = false;
let dragStart = { x: 0, y: 0 };

// DOM Elements
let searchBox, searchBtn, contentArea, playerBar, audioPlayer, audioPlayer2, playerImg, playerTitle, playerArtist;
let downloadBtn, playerLikeBtn, lyricsOverlay, closeLyricsBtn, lyricsTitle, lyricsArtist, lyricsText;
let mainHeader, libraryList, createPlaylistBtn, playPauseBtn, seekSlider, currentTimeElem;
let totalDurationElem, volumeSlider;
let editPlaylistNameInput, playlistCoverInput, cropperCanvas;
let settingsDropdown, transitionSelect, crossfadeSliderContainer, crossfadeSlider, crossfadeValue;

const GRID_CLASS = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    try {
        console.log("Initializing Velium Music...");
        
        searchBox = document.getElementById('search-box');
        searchBtn = document.getElementById('search-btn');
        contentArea = document.getElementById('content-area');
        playerBar = document.getElementById('player-bar');
        audioPlayer = document.getElementById('audio-player');
        audioPlayer2 = document.getElementById('audio-player-2');
        playerImg = document.getElementById('player-img');
        playerTitle = document.getElementById('player-title');
        playerArtist = document.getElementById('player-artist');
        downloadBtn = document.getElementById('download-btn');
        playerLikeBtn = document.getElementById('player-like-btn');
        lyricsOverlay = document.getElementById('lyrics-overlay');
        closeLyricsBtn = document.getElementById('close-lyrics');
        lyricsTitle = document.getElementById('lyrics-title');
        lyricsArtist = document.getElementById('lyrics-artist');
        lyricsText = document.getElementById('lyrics-text');
        mainHeader = document.getElementById('main-header');
        libraryList = document.getElementById('library-list');
        createPlaylistBtn = document.getElementById('create-playlist-btn');
        playPauseBtn = document.getElementById('play-pause-btn');
        seekSlider = document.getElementById('seek-slider');
        currentTimeElem = document.getElementById('current-time');
        totalDurationElem = document.getElementById('total-duration');
        volumeSlider = document.getElementById('volume-slider');
        editPlaylistNameInput = document.getElementById('edit-playlist-name');
        playlistCoverInput = document.getElementById('playlist-cover-input');
        cropperCanvas = document.getElementById('cropperCanvas');
        settingsDropdown = document.getElementById('settings-dropdown');
        transitionSelect = document.getElementById('transition-select');
        crossfadeSliderContainer = document.getElementById('crossfade-slider-container');
        crossfadeSlider = document.getElementById('crossfade-slider');
        crossfadeValue = document.getElementById('crossfade-value');

        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
            else if (e.code === 'ArrowRight') { const p = getActivePlayer(); if (p) p.currentTime += 10; showToast('Forward 10s'); }
            else if (e.code === 'ArrowLeft') { const p = getActivePlayer(); if (p) p.currentTime -= 10; showToast('Back 10s'); }
            else if (e.key.toLowerCase() === 'f') { if (currentTrack) toggleLike(currentTrack); }
            else if (e.key.toLowerCase() === 'm') { toggleMute(); }
        });

        // Restore Settings
        const savedCrossfade = localStorage.getItem('crossfadeConfig');
        if (savedCrossfade) {
            crossfadeConfig = JSON.parse(savedCrossfade);
            if (transitionSelect) transitionSelect.value = crossfadeConfig.enabled ? 'crossfade' : 'none';
            if (crossfadeSlider) crossfadeSlider.value = crossfadeConfig.duration;
            if (crossfadeValue) crossfadeValue.textContent = crossfadeConfig.duration + 's';
            if (crossfadeConfig.enabled && crossfadeSliderContainer) {
                crossfadeSliderContainer.classList.remove('hidden');
                crossfadeSliderContainer.style.display = 'flex';
            }
        }

        // Event Listeners
        if (searchBtn) searchBtn.addEventListener('click', handleSearch);
        if (searchBox) searchBox.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearch(); });
        
        document.querySelectorAll('input[name="search-type"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                searchType = e.target.value;
                if (lastQuery) handleSearch();
            });
        });

        if (closeLyricsBtn) closeLyricsBtn.addEventListener('click', () => lyricsOverlay.classList.remove('active'));
        if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlay);
        if (playerLikeBtn) playerLikeBtn.addEventListener('click', () => { if (currentTrack) toggleLike(currentTrack); });

        [audioPlayer, audioPlayer2].forEach(p => {
            if (!p) return;
            p.addEventListener('timeupdate', () => { if (p.id === activePlayerId) updateProgress(); });
            p.addEventListener('loadedmetadata', () => {
                if (p.id === activePlayerId) {
                    if (totalDurationElem) totalDurationElem.textContent = formatTime(p.duration);
                    if (seekSlider) seekSlider.max = p.duration;
                }
            });
            p.addEventListener('ended', () => handleSongEnd(p));
            p.addEventListener('play', () => { if (p.id === activePlayerId) { isPlaying = true; updatePlayBtn(); } });
            p.addEventListener('pause', () => { if (p.id === activePlayerId && !isCrossfading) { isPlaying = false; updatePlayBtn(); } });
        });

        if (seekSlider) {
            seekSlider.addEventListener('input', () => { isDraggingSlider = true; if (currentTimeElem) currentTimeElem.textContent = formatTime(seekSlider.value); });
            seekSlider.addEventListener('change', () => { const p = getActivePlayer(); if (p) p.currentTime = seekSlider.value; isDraggingSlider = false; });
        }
        if (volumeSlider) volumeSlider.addEventListener('input', (e) => setMasterVolume(e.target.value));
        if (playlistCoverInput) playlistCoverInput.addEventListener('change', handleImageUpload);
        if (cropperCanvas) {
            cropperCanvas.addEventListener('mousedown', e => handleCropStart(e.offsetX, e.offsetY));
            cropperCanvas.addEventListener('mousemove', e => handleCropMove(e.offsetX, e.offsetY));
            cropperCanvas.addEventListener('mouseup', handleCropEnd);
            cropperCanvas.addEventListener('mouseleave', handleCropEnd);
            cropperCanvas.addEventListener('wheel', handleCropScroll);
        }
        if (crossfadeSlider) {
            crossfadeSlider.addEventListener('input', (e) => {
                const val = e.target.value;
                crossfadeValue.textContent = val + 's';
                crossfadeConfig.duration = parseInt(val);
                saveSettings();
            });
        }

        await loadLibrary();
        renderLibrary();
        console.log("Initialization complete.");
    } catch (e) {
        console.error("Initialization failed:", e);
    }
}

// --- Audio Helpers ---
function getActivePlayer() { return document.getElementById(activePlayerId); }
function getInactivePlayer() { return document.getElementById(activePlayerId === 'audio-player' ? 'audio-player-2' : 'audio-player'); }

function setMasterVolume(val) {
    const v = Math.max(0, Math.min(1, val));
    if (audioPlayer) audioPlayer.volume = v;
    if (audioPlayer2) audioPlayer2.volume = v;
    if (volumeSlider) volumeSlider.value = v;
    updateVolumeIcon();
}

function updateVolumeIcon() {
    const icon = document.getElementById('volume-icon');
    const player = getActivePlayer();
    if (!icon || !player) return;
    icon.className = 'fas cursor-pointer w-5 text-center';
    if (player.volume === 0) icon.classList.add('fa-volume-xmark');
    else if (player.volume < 0.5) icon.classList.add('fa-volume-low');
    else icon.classList.add('fa-volume-high');
}

function updatePlayerLikeIcon() {
    if (!currentTrack) return;
    const btn = document.getElementById('player-like-btn');
    if (!btn) return;
    const trackUrl = currentTrack.song?.url || currentTrack.url;
    const isLiked = library.likedSongs.some(s => (s.id && s.id === currentTrack.id) || (trackUrl && (s.song?.url || s.url) === trackUrl));
    btn.innerHTML = isLiked ? '<i class="fas fa-heart text-red-500"></i>' : '<i class="far fa-heart"></i>';
}

function toggleMute() {
    const p = getActivePlayer();
    if (!p) return;
    if (p.volume > 0) { lastVolume = p.volume; setMasterVolume(0); }
    else { setMasterVolume(lastVolume || 1); }
}

// --- Library & DB ---
async function loadLibrary() { if (window.VeliumDB) { try { library = await window.VeliumDB.getLibrary(); if (!library.likedSongs) library.likedSongs = []; if (!library.playlists) library.playlists = []; } catch (e) { console.error("DB Load failed", e); } } else { const stored = localStorage.getItem('velium_library'); if (stored) library = JSON.parse(stored); } }
async function saveLibrary() { if (window.VeliumDB) { await window.VeliumDB.saveLibrary(library); } else { localStorage.setItem('velium_library', JSON.stringify(library)); } }

function renderLibrary() {
    if (!libraryList) return;
    libraryList.innerHTML = '';
    const likedDiv = document.createElement('div');
    likedDiv.className = 'compact-list-item flex items-center gap-2 p-2';
    let coverUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    if (library.likedSongs.length > 0) coverUrl = getImageUrl(library.likedSongs[0]);
    likedDiv.innerHTML = `<img src="${coverUrl}" class="w-10 h-10 rounded object-cover"><div class="flex-grow overflow-hidden"><div class="text-sm text-white truncate">Liked Songs</div><div class="text-xs text-gray-500">${library.likedSongs.length} song${library.likedSongs.length!==1?'s':''}</div></div>`;
    likedDiv.onclick = () => { openLikedSongs(); closeLibraryDrawer(); };
    libraryList.appendChild(likedDiv);
    library.playlists.forEach(pl => {
        const div = document.createElement('div');
        div.className = 'compact-list-item flex items-center gap-2 p-2';
        let plCover = pl.cover || (pl.songs.length > 0 ? getImageUrl(pl.songs[0]) : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=');
        div.innerHTML = `<img src="${plCover}" class="w-10 h-10 rounded object-cover"><div class="flex-grow overflow-hidden"><div class="text-sm text-white truncate">${pl.name}</div><div class="text-xs text-gray-500">${pl.songs.length} song${pl.songs.length!==1?'s':''}</div></div>`;
        div.onclick = () => { openPlaylist(pl.id); closeLibraryDrawer(); };
        libraryList.appendChild(div);
    });
}

function closeLibraryDrawer() { const d = document.getElementById('library-drawer'); if (d) d.classList.add('translate-x-full'); }

// --- Navigation ---
function showHome() {
    closeLibraryDrawer();
    currentPlaylistId = null;
    mainHeader.textContent = "Home";
    contentArea.className = GRID_CLASS;
    contentArea.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center text-gray-500 mt-20 opacity-50"><i class="fas fa-compact-disc text-6xl mb-4"></i><p class="text-xl">Search to start listening.</p></div>`;
}

async function handleSearch() {
    closeLibraryDrawer();
    currentPlaylistId = null;
    const query = searchBox ? searchBox.value.trim() : '';
    if (!query) return;
    lastQuery = query;
    contentArea.innerHTML = '<div class="loader"><i class="fas fa-circle-notch fa-spin fa-3x"></i></div>';
    contentArea.className = GRID_CLASS; 
    mainHeader.textContent = `Results for "${query}"`;
    try {
        let aq = query; if (searchType !== 'song') aq += ` ${searchType}`;
        const ap = fetch(`${API_BASE}/api/search?query=${encodeURIComponent(aq)}&limit=20`).then(r => r.ok ? r.json() : { collection: [] }).catch(() => ({ collection: [] }));
        const sp = fetch(`${API_SAAVN}/search/${searchType}s?query=${encodeURIComponent(query)}`).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] }));
        const [ar, sr] = await Promise.all([ap, sp]);
        let combined = [];
        // Prioritize Saavn (Official) results
        if (sr.data) { const items = sr.data.results || sr.data; if (Array.isArray(items)) combined.push(...items); }
        if (ar.collection) combined.push(...ar.collection);
        
        if (combined.length > 0) renderResults(combined);
        else contentArea.innerHTML = '<div class="col-span-full text-center text-gray-500 mt-10 w-full">No results found.</div>';
    } catch (e) { console.error(e); contentArea.innerHTML = `<div class="col-span-full text-center text-red-500 mt-10 w-full">Error: ${e.message}</div>`; }
}

// ... (renderResults) ...

// --- Playback ---
function getDownloadUrl(item) {
    let url = '';
    // 1. Check direct downloadUrl array (Saavn API standard)
    if (item.downloadUrl) { 
        if (Array.isArray(item.downloadUrl) && item.downloadUrl.length > 0) { 
            // Try 320kbps, then 160kbps, then last available
            const b = item.downloadUrl.find(d => d.quality === '320kbps') || item.downloadUrl.find(d => d.quality === '160kbps') || item.downloadUrl[item.downloadUrl.length - 1]; 
            url = b.link || b.url; // Handle 'link' or 'url' key
        } else if (typeof item.downloadUrl === 'string') {
            url = item.downloadUrl;
        }
    }
    
    // 2. Fallback to extracting from object or using Argon proxy
    if (!url) { 
        const p = item.song?.url || item.url; 
        if (p) { 
            if (typeof p === 'string' && (p.includes('saavncdn.com') || p.match(/\.(mp3|mp4|m4a)$/i))) {
                url = p; 
            } else if (Array.isArray(p)) { 
                const b = p.find(d => d.quality === '320kbps') || p[p.length - 1]; 
                url = b.link || b.url;
            } else {
                // If it's a page URL, try Argon downloader (might be unstable)
                url = `${API_BASE}/api/download?track_url=${encodeURIComponent(p)}`; 
            }
        } 
    }
    
    // 3. Fallback for 'media_url' (some APIs)
    if (!url && item.media_url) url = item.media_url;

    return url;
}

function playSong(item, index = -1, queue = []) {
    const active = getActivePlayer(), inactive = getInactivePlayer();
    if (crossfadeInterval) clearInterval(crossfadeInterval);
    isCrossfading = false;
    if (inactive) { inactive.pause(); inactive.currentTime = 0; }
    currentTrack = item;
    if (index > -1 && queue.length > 0) { playQueue = queue; queueIndex = index; }
    else { playQueue = [item]; queueIndex = 0; }
    const songName = item.song?.name || item.name || 'Unknown', downloadUrl = getDownloadUrl(item);
    if (playerTitle) playerTitle.textContent = songName;
    if (playerArtist) playerArtist.textContent = item.author?.name || item.primaryArtists || '';
    if (playerImg) playerImg.src = getImageUrl(item);
    updatePlayerLikeIcon();
    if (downloadBtn) downloadBtn.onclick = (e) => { e.preventDefault(); showToast(`Downloading...`); downloadResource(downloadUrl, `${songName}.mp3`); };
    active.src = downloadUrl; active.volume = (volumeSlider ? volumeSlider.value : 1);
    active.play().catch(e => console.log("Play error", e));
    if (playerBar) { playerBar.classList.remove('hidden'); playerBar.style.display = 'flex'; }
}

function togglePlay() { const p = getActivePlayer(); if(p && p.paused) p.play(); else if(p) p.pause(); }
function updatePlayBtn() { if(playPauseBtn) playPauseBtn.innerHTML = isPlaying ? '<i class="fas fa-pause-circle"></i>' : '<i class="fas fa-play-circle"></i>'; }
function updateProgress() {
    const active = getActivePlayer(); if (!active) return;
    const { currentTime, duration } = active; if (isNaN(duration)) return;
    if (seekSlider && !isDraggingSlider) seekSlider.value = currentTime;
    if (currentTimeElem && !isDraggingSlider) currentTimeElem.textContent = formatTime(currentTime);
    if (crossfadeConfig.enabled && !isCrossfading && queueIndex < playQueue.length - 1) {
        const remaining = duration - currentTime;
        if (remaining <= crossfadeConfig.duration && remaining > 0.5) startCrossfade();
    }
}

function startCrossfade() {
    const nextItem = playQueue[queueIndex + 1]; if (!nextItem) return;
    isCrossfading = true;
    const outgoing = getActivePlayer();
    activePlayerId = activePlayerId === 'audio-player' ? 'audio-player-2' : 'audio-player';
    const incoming = getActivePlayer();
    incoming.src = getDownloadUrl(nextItem);
    incoming.volume = 0;
    incoming.play().catch(e => console.error("Crossfade error", e));
    currentTrack = nextItem; queueIndex++;
    if (playerTitle) playerTitle.textContent = nextItem.name || nextItem.song?.name || 'Unknown';
    if (playerImg) playerImg.src = getImageUrl(nextItem);
    updatePlayerLikeIcon();
    const steps = (crossfadeConfig.duration * 10), volStep = (lastVolume || 1) / steps;
    let count = 0;
    crossfadeInterval = setInterval(() => {
        count++;
        if (outgoing.volume > volStep) outgoing.volume -= volStep; else outgoing.volume = 0;
        if (incoming.volume < (lastVolume || 1) - volStep) incoming.volume += volStep; else incoming.volume = lastVolume || 1;
        if (count >= steps) { clearInterval(crossfadeInterval); isCrossfading = false; outgoing.pause(); outgoing.currentTime = 0; }
    }, 100);
}

function handleSongEnd(player) { if (player.id === activePlayerId && !isCrossfading) { isPlaying = false; updatePlayBtn(); if (seekSlider) seekSlider.value = 0; playNextSong(); } }
function playNextSong() { if (queueIndex > -1 && queueIndex < playQueue.length - 1) playSong(playQueue[queueIndex + 1], queueIndex + 1, playQueue); }

// --- Helpers ---
function getImageUrl(item) { if (item.song && item.song.img) { let i = item.song.img.big || item.song.img.small; return i.startsWith('/api/') ? API_BASE + i : i; } if (item.image) { if (Array.isArray(item.image)) return item.image[item.image.length - 1].link; else if (typeof item.image === 'string') return item.image; } return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='; }
function formatTime(v) { if (typeof v === 'object' && v !== null) { const s = v.hours * 3600 + v.minutes * 60 + v.seconds; return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`; } const m = Math.floor(v / 60) || 0, s = Math.floor(v % 60) || 0; return `${m}:${s < 10 ? '0' : ''}${s}`; }
function formatNumber(n) { if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'; return n; }
async function downloadResource(url, filename) {
    try {
        const r = await fetch(url);
        if (!r.ok) throw new Error("Direct fetch failed");
        const b = await r.blob();
        triggerDownload(b, filename);
        showToast("Download started!");
    } catch (e) {
        console.warn("Direct download failed, trying proxy...");
        try {
            const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(url);
            const r = await fetch(proxyUrl);
            if (!r.ok) throw new Error("Proxy fetch failed");
            const b = await r.blob();
            triggerDownload(b, filename);
            showToast("Download started (via Proxy)!");
        } catch (e2) {
            console.error("Proxy download failed:", e2);
            showToast("Download failed. Opening in new tab.");
            window.open(url, '_blank');
        }
    }
}

function triggerDownload(blob, filename) {
    const l = document.createElement("a");
    l.href = URL.createObjectURL(blob);
    l.download = filename;
    document.body.appendChild(l);
    document.body.removeChild(l);
    URL.revokeObjectURL(l.href);
}

// --- Settings UI ---
window.toggleSettingsMenu = function() { if (settingsDropdown) settingsDropdown.classList.toggle('hidden'); };
window.handleTransitionChange = function() { const val = transitionSelect.value; crossfadeConfig.enabled = (val === 'crossfade'); if (crossfadeConfig.enabled) { crossfadeSliderContainer.classList.remove('hidden'); crossfadeSliderContainer.style.display = 'flex'; } else { crossfadeSliderContainer.classList.add('hidden'); crossfadeSliderContainer.style.display = 'none'; } saveSettings(); };
function saveSettings() { localStorage.setItem('crossfadeConfig', JSON.stringify(crossfadeConfig)); }
document.addEventListener('click', (e) => { if (settingsDropdown && !settingsDropdown.classList.contains('hidden')) { const btn = document.getElementById('settings-btn'); if (btn && !btn.contains(e.target) && !settingsDropdown.contains(e.target)) settingsDropdown.classList.add('hidden'); } });

// Expose globals
window.handleSearch = handleSearch; window.showHome = showHome; window.openLikedSongs = openLikedSongs; window.openPlaylist = openPlaylist; window.addCurrentToPlaylist = addCurrentToPlaylist; window.toggleMute = toggleMute;
window.openCreatePlaylistModal = openCreatePlaylistModal; window.confirmCreatePlaylist = confirmCreatePlaylist; window.closeModals = closeModals; window.openEditPlaylistModal = openEditPlaylistModal; window.savePlaylistChanges = savePlaylistChanges; window.deletePlaylist = deletePlaylist;
window.triggerCoverUpload = triggerCoverUpload; window.closeCropper = closeCropper; window.submitCrop = submitCrop;