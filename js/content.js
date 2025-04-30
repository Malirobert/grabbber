// Variables globales
let selectedVideos = [];
let isSelectionMode = false;
let wasSelectionModeActive = false;
let currentSite = '';
let isUserAuthenticated = false;

// Déterminer le site actuel
function detectCurrentSite() {
    const url = window.location.hostname;
    if (url.includes('youtube.com')) return 'youtube';
    if (url.includes('pornhub.com')) return 'pornhub';
    if (url.includes('xvideos.com')) return 'xvideos';
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('instagram.com')) return 'instagram';
    return 'other';
}

// Sélecteurs spécifiques à chaque plateforme
const platformSelectors = {
    youtube: {
        videoContainers: 'ytd-rich-item-renderer, ytd-compact-video-renderer',
        titleSelector: '#video-title',
        linkSelector: 'a#thumbnail',
        idExtractor: (url) => url.split('v=')[1]?.split('&')[0] || Date.now().toString(),
        thumbnailTemplate: (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`
    },
    pornhub: {
        videoContainers: '.videoBox, .pcVideoListItem, .videoblock',
        titleSelector: '.title a, .videoTitle',
        linkSelector: 'a.linkVideoThumb, a.videoPreviewBg',
        idExtractor: (url) => (url.match(/viewkey=([a-zA-Z0-9]+)/) || url.match(/\/view_video\.php\?viewkey=([a-zA-Z0-9]+)/) || [])[1] || Date.now().toString(),
        thumbnailTemplate: (id) => `https://di.phncdn.com/videos/${id}/(m=eafTGgaaaa)(mh=nEqKBF9JFpMLFCsG)1.jpg`
    },
    xvideos: {
        videoContainers: '.thumb-block, .video-box',
        titleSelector: '.title a, .video-title',
        linkSelector: 'a[href*="/video"]',
        idExtractor: (url) => (url.match(/\/video(\d+)\//) || [])[1] || Date.now().toString(),
        thumbnailTemplate: (id) => `https://img-hw.xvideos-cdn.com/videos/thumbs169/${id}/1.jpg`
    },
    tiktok: {
        videoContainers: 'div[class*="DivVideoWrapper"]',
        titleSelector: '[data-e2e="browse-video-desc"], [data-e2e="video-desc"]',
        urlSelector: 'input[data-e2e="copy-link-input"]',
        authorSelector: 'h3[data-e2e="video-author-uniqueid"]',
        thumbnailSelector: 'img[src*="tiktok"]',
        idExtractor: (url) => {
            const match = url.match(/video\/(\d+)/) || [];
            return match[1] || Date.now().toString();
        }
    },
    instagram: {
        videoContainers: 'article:has(video), div._aagw:has(video), div[role="button"]:has(video), div._ab8w:has(div._aatk), div[role="presentation"], a[href*="/reel/"]',
        titleSelector: '._a9zc h1, ._a9zr h1, ._aaqt',
        authorSelector: 'div._aacl._aacs._aact._aacx._aada a',
        thumbnailSelector: 'img._aagt',
        urlSelector: 'a[href*="/reel/"], a[href*="/p/"]',
        idExtractor: (url) => {
            const reelMatch = url.split('/reel/')[1]?.split('/')[0];
            const postMatch = url.split('/p/')[1]?.split('/')[0];
            return reelMatch || postMatch || Date.now().toString();
        }
    }
};

// Styles pour l'interface - standardisation pour tous les sites
const styles = `
    .video-highlight {
        position: relative;
        outline: 3px solid rgba(59, 130, 246, 0.5);
        border-radius: 4px;
        transition: all 0.2s;
        cursor: pointer;
    }
    .video-highlight:hover {
        outline-color: rgba(59, 130, 246, 0.8);
    }
    .video-highlight.selected {
        outline-color: rgba(16, 185, 129, 0.8);
    }
    .video-highlight::after {
        content: "select";
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(59, 130, 246, 0.9);
        color: white;
        padding: 4px 12px;
        border-radius: 20px;
        font-weight: bold;
        font-size: 12px;
        opacity: 0;
        transition: opacity 0.2s;
        z-index: 10000;
        pointer-events: none;
    }
    .video-highlight:hover::after {
        opacity: 1;
    }
    .video-highlight::before,
    .video-highlight .selection-indicator {
        display: none !important;
    }
    #grabber-button {
        position: fixed;
        z-index: 9999;
        width: 48px;
        height: 48px;
        background: #3B82F6;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: move;
        top: 20px;
        right: 20px;
        transition: transform 0.2s;
        font-size: 18px;
    }
    #grabber-button.active {
        transform: scale(1.1);
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3);
    }
    #grabber-badge {
        position: absolute;
        top: -5px;
        right: -5px;
        background: #EF4444;
        color: white;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        display: none;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        cursor: pointer;
    }
    #download-panel {
        position: fixed;
        z-index: 9999;
        width: 320px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: none;
    }
    .panel-header {
        background: #4287f5;
        color: white;
        padding: 12px;
        font-size: 16px;
        border-radius: 8px 8px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .video-item {
        display: flex;
        padding: 12px 8px;
        gap: 8px;
        align-items: center;
        border-bottom: 1px solid #eee;
        width: 100%;
        box-sizing: border-box;
    }
    .video-thumbnail {
        width: 80px;
        height: 45px;
        border-radius: 4px;
        object-fit: cover;
    }
    /* Ajustement spécial pour les vignettes Instagram */
    .video-item[data-platform="instagram"] .video-thumbnail {
        width: 45px;
        height: 80px;
        object-fit: cover;
    }
    .video-info {
        flex: 1;
        min-width: 0;
        max-width: 170px;
        padding-right: 5px;
    }
    .video-title {
        font-size: 13px;
        margin-bottom: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 160px;
        line-height: 1.2;
    }
    .video-status {
        color: #666;
        font-size: 12px;
    }
    .action-buttons {
        display: flex;
        gap: 8px;
    }
    .delete-button {
        color: #ef4444;
        font-size: 20px;
        font-weight: bold;
        background: none;
        border: none;
        cursor: pointer;
        padding: 0 5px;
        margin-left: auto;
        min-width: 24px;
    }
    .delete-button:hover {
        color: #dc2626;
    }
    .download-all-button {
        background: #22c55e;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 12px;
        width: calc(100% - 24px);
        margin: 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-weight: 500;
    }
    .download-all-button:hover {
        background: #16a34a;
    }
    .download-all-button.downloading {
        background: #16a34a;
        cursor: wait;
    }
    #minimize-panel {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 4px 8px;
        font-size: 24px;
        font-weight: bold;
        line-height: 0.5;
        letter-spacing: -2px;
        width: 40px;
        text-align: center;
    }
    #minimize-panel:hover {
        opacity: 0.8;
    }
    .notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #22c55e;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        animation: slideIn 0.3s ease, fadeOut 0.3s ease 2s forwards;
    }
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
    #video-list {
        max-height: 300px;
        overflow-y: auto;
        overflow-x: hidden;
        scrollbar-width: thin;
    }
    #video-list::-webkit-scrollbar {
        width: 6px;
        height: 6px;
    }
    #video-list::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 3px;
    }
    #video-list::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 3px;
    }
    #video-list::-webkit-scrollbar-thumb:hover {
        background: #555;
    }
    /* Ajustement spécifique pour Instagram */
    .instagram-reel-highlight {
        position: relative !important;
        outline: 3px solid rgba(0, 123, 255, 0.8) !important;
        outline-offset: -3px !important;
        cursor: pointer !important;
        transition: all 0.3s ease !important;
        z-index: 1 !important;
    }
    
    .instagram-reel-highlight:hover {
        outline-color: rgba(0, 123, 255, 1) !important;
        box-shadow: 0 0 15px rgba(0, 123, 255, 0.4) !important;
    }
    
    .instagram-reel-highlight.selected {
        outline-color: rgba(40, 167, 69, 1) !important;
        box-shadow: 0 0 15px rgba(40, 167, 69, 0.4) !important;
    }
    
    .instagram-reel-highlight::after {
        content: "select" !important;
        position: absolute !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        background: rgba(0, 123, 255, 0.9) !important;
        color: white !important;
        padding: 8px 16px !important;
        border-radius: 20px !important;
        font-weight: bold !important;
        font-size: 14px !important;
        opacity: 0 !important;
        transition: opacity 0.2s !important;
        z-index: 10000 !important;
        pointer-events: none !important;
    }
    
    .instagram-reel-highlight:hover::after {
        opacity: 1 !important;
    }
    /* Style pour les icônes dans le grabber-button */
    #grabber-button i {
        font-size: 19px !important;
    }
    /* Styles spécifiques pour TikTok */
    .tiktok-feed-highlight {
        position: relative !important;
        outline: 3px solid rgba(59, 130, 246, 0.5) !important;
        outline-offset: -3px !important;
        border-radius: 8px !important;
        transition: all 0.2s !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
    }

    .tiktok-feed-highlight::after {
        content: "select" !important;
        position: absolute !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        background: rgba(59, 130, 246, 0.9) !important;
        color: white !important;
        padding: 8px 16px !important;
        border-radius: 20px !important;
        font-weight: bold !important;
        font-size: 16px !important;
        opacity: 0 !important;
        transition: opacity 0.2s !important;
        z-index: 999999 !important;
        pointer-events: none !important;
    }

    .tiktok-feed-highlight:hover::after {
        opacity: 1 !important;
    }

    .tiktok-feed-highlight.selected {
        outline-color: rgba(16, 185, 129, 0.8) !important;
    }

    /* Style pour la page de profil TikTok */
    .tiktok-profile-highlight {
        position: relative !important;
        outline: 3px solid rgba(59, 130, 246, 0.5) !important;
        outline-offset: -3px !important;
        border-radius: 4px !important;
        margin: 2px !important;
        transition: all 0.2s !important;
    }

    .tiktok-profile-highlight.selected {
        outline-color: rgba(16, 185, 129, 0.8) !important;
    }

    /* Style pour les reels dans la grille */
    ._aagv {
        position: relative !important;
    }
    
    .instagram-grid-highlight {
        position: relative !important;
        outline: 3px solid rgba(0, 123, 255, 0.8) !important;
        outline-offset: -3px !important;
        cursor: pointer !important;
        transition: all 0.3s ease !important;
        z-index: 1 !important;
    }
    
    .instagram-grid-highlight:hover {
        outline-color: rgba(0, 123, 255, 1) !important;
        box-shadow: 0 0 15px rgba(0, 123, 255, 0.4) !important;
    }
    
    .instagram-grid-highlight.selected {
        outline-color: rgba(40, 167, 69, 1) !important;
        box-shadow: 0 0 15px rgba(40, 167, 69, 0.4) !important;
    }
    
    .instagram-grid-highlight::after {
        content: "select" !important;
        position: absolute !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        background: rgba(0, 123, 255, 0.9) !important;
        color: white !important;
        padding: 8px 16px !important;
        border-radius: 20px !important;
        font-weight: bold !important;
        font-size: 14px !important;
        opacity: 0 !important;
        transition: opacity 0.2s !important;
        z-index: 10000 !important;
        pointer-events: none !important;
    }
    
    .instagram-grid-highlight:hover::after {
        opacity: 1 !important;
    }
`;

// Ajouter un style pour l'overlay YouTube
const youtubeStyles = `
    .selection-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 9999;
        cursor: pointer;
    }
    ytd-rich-item-renderer, ytd-compact-video-renderer {
        position: relative;
    }
`;

// Fonction pour rendre un élément draggable
function makeDraggable(element) {
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let startTime;
    let startX;
    let startY;
    const moveThreshold = 5; // Seuil de mouvement en pixels

    element.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
        if (e.target.tagName === 'BUTTON') return;
        
        startTime = Date.now();
        startX = e.clientX;
        startY = e.clientY;
        initialX = e.clientX - element.offsetLeft;
        initialY = e.clientY - element.offsetTop;
        isDragging = true;
    }

    function drag(e) {
        if (!isDragging) return;
        
        const moveX = Math.abs(e.clientX - startX);
        const moveY = Math.abs(e.clientY - startY);
        
        // Si le mouvement dépasse le seuil, c'est un drag
        if (moveX > moveThreshold || moveY > moveThreshold) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            
            // Limiter le déplacement à l'intérieur de la fenêtre
            currentX = Math.max(0, Math.min(currentX, window.innerWidth - element.offsetWidth));
            currentY = Math.max(0, Math.min(currentY, window.innerHeight - element.offsetHeight));

            element.style.left = `${currentX}px`;
            element.style.top = `${currentY}px`;
        }
    }

    function dragEnd(e) {
        const moveX = Math.abs(e.clientX - startX);
        const moveY = Math.abs(e.clientY - startY);
        const isClick = moveX < moveThreshold && moveY < moveThreshold;

        if (isDragging && isClick && element.id === 'grabber-button') {
            if (!isUserAuthenticated) {
                showNotification('Create account first', 'error');
            } else if (e.target.closest('#grabber-badge')) {
                showDownloadPanel(e);
            } else {
            toggleSelectionMode(e);
        }
        }

        isDragging = false;
    }
}

// Fonction pour activer le mode sélection
function toggleSelectionMode(e) {
    if (!isUserAuthenticated) {
        e.preventDefault();
        e.stopPropagation();
        showNotification('Create account first', 'error');
        return;
    }

    e.preventDefault();
    e.stopPropagation();
    
    isSelectionMode = !isSelectionMode;
    const grabberButton = document.getElementById('grabber-button');
    
    if (isSelectionMode) {
        grabberButton.classList.add('active');
        detectAndHighlightVideos();
        
        // Spécifique à YouTube: désactiver temporairement les prévisualisations en capturant les événements
        if (currentSite === 'youtube') {
            // Ajouter un overlay global pour capturer les événements de prévisualisation
            if (!document.getElementById('global-preview-blocker')) {
                const globalBlocker = document.createElement('div');
                globalBlocker.id = 'global-preview-blocker';
                globalBlocker.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 9;
                    pointer-events: none;
                `;
                document.body.appendChild(globalBlocker);
            }
            
            // Désactiver toutes les prévisualisations YouTube
            document.querySelectorAll('ytd-thumbnail').forEach(thumb => {
                if (!thumb.dataset.originalPointerEvents) {
                    thumb.dataset.originalPointerEvents = window.getComputedStyle(thumb).pointerEvents;
                }
                thumb.style.pointerEvents = 'none';
            });
        }
    } else {
        grabberButton.classList.remove('active');
        removeHighlights();
        
        // Réactiver les prévisualisations YouTube
        if (currentSite === 'youtube') {
            document.querySelectorAll('ytd-thumbnail').forEach(thumb => {
                if (thumb.dataset.originalPointerEvents) {
                    thumb.style.pointerEvents = thumb.dataset.originalPointerEvents;
                } else {
                    thumb.style.pointerEvents = '';
                }
            });
            
            // Masquer tous les overlays de sélection
            document.querySelectorAll('.selection-overlay').forEach(overlay => {
                overlay.style.display = 'none';
            });
            
            // Réactiver tous les liens
            document.querySelectorAll('.video-highlight a').forEach(link => {
                if (link.dataset.originalPointerEvents) {
                    link.style.pointerEvents = link.dataset.originalPointerEvents;
                } else {
                    link.style.pointerEvents = '';
                }
            });
            
            // Supprimer le bloqueur global
            const globalBlocker = document.getElementById('global-preview-blocker');
            if (globalBlocker) {
                globalBlocker.remove();
            }
        }
    }
}

// Fonction pour détecter et mettre en surbrillance les vidéos - améliorée pour Instagram
function detectAndHighlightVideos() {
    currentSite = detectCurrentSite();
    const siteConfig = platformSelectors[currentSite];
    
    if (currentSite === 'instagram') {
        const observer = new MutationObserver((mutations) => {
            const videos = document.querySelectorAll(siteConfig.videoContainers);
            videos.forEach(video => {
                if (!video.dataset.processed) {
                    video.dataset.processed = 'true';
                    
                    // Déterminer si c'est un Reel ou un post normal
                    const isReel = video.matches('a[href*="/reel/"]') || video.closest('a[href*="/reel/"]');
                    
                    // Appliquer la classe appropriée
                    video.classList.add(isReel ? 'instagram-reel-highlight' : 'video-highlight');
                    
                    // Vérifier si déjà sélectionné
                    const videoUrl = isReel ? 
                        video.href || video.closest('a[href*="/reel/"]')?.href :
                        video.querySelector('a[href*="/p/"]')?.href;
                        
                    if (videoUrl && selectedVideos.some(v => v.url === videoUrl)) {
                        video.classList.add('selected');
                    }
                    
                    video.addEventListener('click', handleVideoSelection);
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true
        });
        
        // Application initiale
        const videos = document.querySelectorAll(siteConfig.videoContainers);
        videos.forEach(video => {
            if (!video.dataset.processed) {
                video.dataset.processed = 'true';
                const isReel = video.matches('a[href*="/reel/"]') || video.closest('a[href*="/reel/"]');
                video.classList.add(isReel ? 'instagram-reel-highlight' : 'video-highlight');
                video.addEventListener('click', handleVideoSelection);
            }
        });
    }
    
    if (currentSite === 'tiktok') {
        // Modifier l'observer pour TikTok
        const observer = new MutationObserver((mutations) => {
            const videos = document.querySelectorAll(siteConfig.videoContainers);
            videos.forEach(video => {
                if (!video.classList.contains('tiktok-feed-highlight')) {
                    video.classList.add('tiktok-feed-highlight');
                    
                    // Vérifier si cette vidéo est déjà sélectionnée
                    const videoUrl = window.location.href;
                    const isSelected = selectedVideos.some(v => v.url === videoUrl);
                    if (isSelected) {
                        video.classList.add('selected');
                    }
                    
                    // Créer un overlay pour la sélection
                    if (!video.querySelector('.tiktok-selection-overlay')) {
                        const overlay = document.createElement('div');
                        overlay.className = 'tiktok-selection-overlay';
                        overlay.style.cssText = `
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            z-index: 1000;
                        `;
                        
                        video.style.position = 'relative';
                        video.appendChild(overlay);
                        
                        // Ajouter l'événement de clic
                        video.addEventListener('click', handleVideoSelection);
                    }
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
        });
    }
    
    if (!siteConfig) {
        console.log('Site not supported:', currentSite);
        return;
    }
    
    const videos = document.querySelectorAll(siteConfig.videoContainers);
    console.log(`Videos found on ${currentSite}:`, videos.length);
    
    videos.forEach(video => {
        if (!video.classList.contains('video-highlight')) {
            // Ajouter la classe appropriée selon le type de page TikTok
            if (currentSite === 'tiktok') {
                const isProfilePage = window.location.pathname.includes('/');
                video.classList.add(isProfilePage ? 'tiktok-profile-highlight' : 'tiktok-feed-highlight');
            } else {
            video.classList.add('video-highlight');
            }
            
            video.removeEventListener('click', handleVideoSelection);
            video.addEventListener('click', handleVideoSelection);
            
            // Désactiver les événements par défaut pour TikTok
            if (currentSite === 'tiktok') {
                const clickableElements = video.querySelectorAll('a, button');
                clickableElements.forEach(element => {
                    if (!element.dataset.originalPointerEvents) {
                        element.dataset.originalPointerEvents = window.getComputedStyle(element).pointerEvents;
                    }
                    element.style.pointerEvents = 'none';
                });
            }
        }
    });

    // Gestion spéciale pour YouTube
    if (currentSite === 'youtube' && isSelectionMode) {
        // Désactiver tous les événements de preview
        document.querySelectorAll('ytd-thumbnail, ytd-rich-item-renderer, ytd-compact-video-renderer').forEach(element => {
            element.style.pointerEvents = 'none';
            
            // Permettre les clics sur toute la zone de la vidéo
            const videoWrapper = element.closest(siteConfig.videoContainers);
            if (videoWrapper) {
                videoWrapper.style.pointerEvents = 'auto';
                videoWrapper.style.cursor = 'pointer';
                
                // Créer un overlay transparent pour capturer les clics
                if (!videoWrapper.querySelector('.selection-overlay')) {
                    const overlay = document.createElement('div');
                    overlay.className = 'selection-overlay';
                    overlay.style.cssText = `
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        z-index: 9999;
                        background: transparent;
                    `;
                    videoWrapper.style.position = 'relative';
                    videoWrapper.appendChild(overlay);
                    overlay.addEventListener('click', handleVideoSelection);
                }
        }
    });
    }
}

// Fonction pour gérer la sélection d'une vidéo - notification en anglais
function handleVideoSelection(e) {
    if (!isSelectionMode) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    let videoElement = e.currentTarget;
    if (!videoElement) return;
    
    if (currentSite === 'tiktok') {
        const videoUrl = window.location.href;
        const videoData = extractVideoData(videoElement);
        const isAlreadySelected = selectedVideos.some(v => v.url === videoUrl);
        
        if (!isAlreadySelected) {
            videoElement.classList.add('selected');
            selectedVideos.push({
                ...videoData,
                url: videoUrl // S'assurer que l'URL est correcte
            });
            showNotification('Video added to selection');
        } else {
            // Désélectionner la vidéo
            selectedVideos = selectedVideos.filter(v => v.url !== videoUrl);
            videoElement.classList.remove('selected');
            showNotification('Video removed from selection');
        }
        
        updateBadge();
        const downloadPanel = document.getElementById('download-panel');
        if (downloadPanel.style.display === 'block') {
            updateDownloadPanel();
        }
        return;
    }
    
    // stopImmediatePropagation uniquement pour YouTube
    if (currentSite === 'youtube') {
        e.stopImmediatePropagation();
    }

    // Trouver l'élément vidéo parent si l'événement vient de l'overlay (pour YouTube)
    if (videoElement.classList.contains('selection-overlay')) {
        videoElement = videoElement.closest('.video-highlight');
    }
    
    if (!videoElement) return;
    
    if (!videoElement.classList.contains('selected')) {
        const videoData = extractVideoData(videoElement);
        videoElement.classList.add('selected');
        selectedVideos.push(videoData);
        showNotification('Video added to selection');
        updateBadge();
        
        // Si le panneau est visible, mettre à jour directement
        const downloadPanel = document.getElementById('download-panel');
        if (downloadPanel.style.display === 'block') {
            updateDownloadPanel();
        }
    } else {
        // Si déjà sélectionné, on peut aussi implémenter une désélection
        deselectVideo(videoElement);
        showNotification('Video removed from selection');
    }
}

// Fonction pour extraire les données de la vidéo
function extractVideoData(element) {
    const siteConfig = platformSelectors[currentSite];
    
    if (currentSite === 'instagram') {
        const isReel = element.matches('a[href*="/reel/"]') || element.closest('a[href*="/reel/"]');
        const url = isReel ? 
            element.href || element.closest('a[href*="/reel/"]')?.href :
            element.querySelector('a[href*="/p/"]')?.href;
            
        if (!url) return null;
        
        const titleElement = element.querySelector('._a9zc h1, ._a9zr h1, ._aaqt');
        const thumbnailElement = element.querySelector('img._aagt') || element.querySelector('img[sizes="1px"]');
        const authorElement = element.querySelector('div._aacl._aacs._aact._aacx._aada a');
        
        const videoId = platformSelectors.instagram.idExtractor(url);
        
        return {
            title: titleElement ? titleElement.textContent.trim() : `Instagram ${isReel ? 'Reel' : 'Video'} ${videoId}`,
            url: url,
            id: videoId,
            platform: 'instagram',
            thumbnail: thumbnailElement?.src || '',
            author: authorElement ? authorElement.textContent.trim() : ''
        };
    }
    
    if (currentSite === 'tiktok') {
        const titleElement = element.querySelector(siteConfig.titleSelector);
        const authorElement = element.querySelector(siteConfig.authorSelector);
        const thumbnailElement = element.querySelector(siteConfig.thumbnailSelector);
        
        return {
            title: titleElement ? titleElement.textContent.trim() : `TikTok Video`,
            url: window.location.href, // Utiliser l'URL actuelle
            id: siteConfig.idExtractor(window.location.href),
            platform: currentSite,
            thumbnail: thumbnailElement?.src || '',
            author: authorElement ? authorElement.textContent.trim() : ''
        };
    }
    
    if (!siteConfig) {
        return {
            title: 'Unknown video',
            url: window.location.href,
            id: Date.now().toString(),
            platform: currentSite
        };
    }
    
    let titleElement = element.querySelector(siteConfig.titleSelector);
    let linkElement = element.querySelector(siteConfig.linkSelector);
    let url = '';
    let id = Date.now().toString();
    let thumbnail = '';
    
    // Logique pour chaque plateforme
    if (currentSite === 'youtube') {
    if (linkElement) {
        url = linkElement.href;
            // Trouver la miniature YouTube
            const thumbnailImg = element.querySelector('img[src*="i.ytimg.com"]');
            thumbnail = thumbnailImg ? thumbnailImg.src : '';
        try {
            id = siteConfig.idExtractor(url);
                // Si pas de miniature trouvée, utiliser le template
                if (!thumbnail) {
                    thumbnail = siteConfig.thumbnailTemplate(id);
                }
        } catch (e) {
                console.error('Error extracting YouTube data:', e);
            }
        }
    } else if (currentSite === 'pornhub') {
        if (linkElement) {
            url = linkElement.href;
            // Trouver la miniature Pornhub
            const thumbnailImg = element.querySelector('img[data-thumb_url], img[src*="phncdn"]');
            thumbnail = thumbnailImg ? (thumbnailImg.getAttribute('data-thumb_url') || thumbnailImg.src) : '';
            try {
                id = siteConfig.idExtractor(url);
                if (!thumbnail) {
                    thumbnail = siteConfig.thumbnailTemplate(id);
                }
            } catch (e) {
                console.error('Error extracting Pornhub data:', e);
            }
        }
    } else if (currentSite === 'xvideos') {
        if (linkElement) {
            url = linkElement.href;
            // Trouver la miniature XVideos
            const thumbnailImg = element.querySelector('img[data-src], img[src*="xvideos"]');
            thumbnail = thumbnailImg ? (thumbnailImg.getAttribute('data-src') || thumbnailImg.src) : '';
            try {
                id = siteConfig.idExtractor(url);
                if (!thumbnail) {
                    thumbnail = siteConfig.thumbnailTemplate(id);
                }
            } catch (e) {
                console.error('Error extracting XVideos data:', e);
            }
        }
    } else if (currentSite === 'tiktok') {
        // Garder la logique existante pour TikTok
        return {
            title: titleElement ? titleElement.textContent.trim() : `Video on ${currentSite}`,
            url: url,
            id: id,
            platform: currentSite,
            thumbnail: element.querySelector('img[src*="tiktok"]')?.src || ''
        };
    }
    
    return {
        title: titleElement ? titleElement.textContent.trim() : `Video on ${currentSite}`,
        url: url,
        id: id,
        platform: currentSite,
        thumbnail: thumbnail
    };
}

// Fonction pour mettre à jour le badge
function updateBadge() {
    const badge = document.getElementById('grabber-badge');
    if (selectedVideos.length > 0) {
        badge.textContent = selectedVideos.length;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

// Fonction pour enlever les surlignages
function removeHighlights() {
    document.querySelectorAll('.video-highlight').forEach(video => {
        if (!video.classList.contains('selected')) {
            video.classList.remove('video-highlight');
            video.removeEventListener('click', handleVideoSelection);
            
            // Pour YouTube uniquement, gérer les overlays
            if (currentSite === 'youtube') {
                // Supprimer l'overlay si présent
                const overlay = video.querySelector('.selection-overlay');
                if (overlay) {
                    overlay.remove();
                }
                
                // Restaurer les liens pour YouTube
                const links = video.querySelectorAll('a');
                links.forEach(link => {
                    if (link.dataset.originalPointerEvents) {
                        link.style.pointerEvents = link.dataset.originalPointerEvents;
                    } else {
                        link.style.pointerEvents = '';
                    }
                });
            }
        }
    });
}

// Fonction pour afficher le panneau de téléchargement
function showDownloadPanel(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const downloadPanel = document.getElementById('download-panel');
    const grabberButton = document.getElementById('grabber-button');
    wasSelectionModeActive = isSelectionMode;

    // Always ensure the grabber button is visible before getting its position
    grabberButton.style.display = 'flex';
    void grabberButton.offsetWidth; // Force reflow

    const rect = grabberButton.getBoundingClientRect();
    console.log('Grabber position:', rect.top, rect.left);

    downloadPanel.style.position = 'fixed';
    downloadPanel.style.top = `${rect.top}px`;
    downloadPanel.style.left = `${rect.left}px`;
    downloadPanel.style.right = '';
    downloadPanel.style.bottom = '';
    downloadPanel.style.display = 'block';
    grabberButton.style.display = 'none';
    updateDownloadPanel();
}

// Fonction pour mettre à jour le panneau de téléchargement - standardisation en anglais
function updateDownloadPanel() {
    const downloadPanel = document.getElementById('download-panel');
    downloadPanel.innerHTML = `
        <div id="banner-ad-top" style="display: flex; justify-content: center; margin: 8px 0;"></div>
        <div class="panel-header">
            Selected Videos (${selectedVideos.length})
            <button id="minimize-panel">---</button>
        </div>
        <div id="video-list">
            ${selectedVideos.map(video => {
                const siteConfig = platformSelectors[video.platform];
                let thumbnailUrl = '';
                
                // Gestion spéciale des thumbnails pour Instagram
                if (video.platform === 'instagram') {
                    // Utiliser l'image de la vidéo/reel
                    thumbnailUrl = video.thumbnail || '';
                    if (!thumbnailUrl) {
                        // Chercher l'image dans le DOM si pas déjà stockée
                        const videoElement = document.querySelector(`a[href*="${video.id}"]`);
                        if (videoElement) {
                            const img = videoElement.querySelector('img._aagt, img[sizes="1px"]');
                            thumbnailUrl = img ? img.src : '';
                        }
                    }
                } else {
                    thumbnailUrl = video.thumbnail || '';
                }
                
                const status = 'Ready to download';
                
                return `
                <div class="video-item" data-video-id="${video.id}" data-platform="${video.platform}">
                    <img src="${thumbnailUrl}" class="video-thumbnail" 
                         style="${video.platform === 'instagram' ? 'width: 45px; height: 80px; object-fit: cover;' : ''}"
                         onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"80\" height=\"45\" viewBox=\"0 0 80 45\"><rect width=\"80\" height=\"45\" fill=\"%23eee\"/><text x=\"40\" y=\"22.5\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-family=\"sans-serif\" font-size=\"12\" fill=\"%23999\">${video.platform}</text></svg>'">
                    <div class="video-info">
                        <div class="video-title" title="${video.title}">
                            ${video.title}
                        </div>
                        <div class="video-status">
                            ${status} (${video.platform})
                        </div>
                    </div>
                    <button class="delete-button" data-video-id="${video.id}" data-platform="${video.platform}">×</button>
                </div>
                `;
            }).join('')}
        </div>
        <div id="banner-ad-bottom" style="display: flex; justify-content: center; margin: 8px 0;"></div>
        ${selectedVideos.length > 0 ? `
            <button id="download-all" class="download-all-button">
                <i class="fas fa-download"></i> Download All
            </button>
        ` : ''}
    `;

    // Inject banner ads
    injectBannerAd('banner-ad-top');
    injectBannerAd('banner-ad-bottom');

    // Ajouter les événements pour les boutons de suppression
    const deleteButtons = downloadPanel.querySelectorAll('.delete-button');
    deleteButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const videoId = e.target.dataset.videoId;
            const platform = e.target.dataset.platform;
            removeVideo(videoId, platform);
        });
    });

    // Réattacher les autres événements
    document.getElementById('minimize-panel').addEventListener('click', minimizePanel);
    if (selectedVideos.length > 0) {
        document.getElementById('download-all').addEventListener('click', downloadAllVideos);
    }
}

// Ajouter ces fonctions pour gérer le quota et l'historique
function updateQuota() {
    chrome.storage.local.get(['dailyQuota', 'lastQuotaReset'], function(result) {
        const now = new Date().getTime();
        const lastReset = result.lastQuotaReset || 0;
        const dayInMs = 24 * 60 * 60 * 1000;

        // Réinitialiser le quota si c'est un nouveau jour
        if (now - lastReset > dayInMs) {
            chrome.storage.local.set({
                dailyQuota: 0,
                lastQuotaReset: now
            });
        }

        const currentQuota = result.dailyQuota || 0;
        if (currentQuota >= 10) {
            showNotification('Daily quota reached.');
            return false;
        }
        return true;
    });
}

function incrementQuota() {
    chrome.storage.local.get(['dailyQuota'], function(result) {
        const newQuota = (result.dailyQuota || 0) + 1;
        chrome.storage.local.set({ dailyQuota: newQuota });
    });
}

function addToHistory(videoData) {
    chrome.storage.local.get(['downloadHistory'], function(result) {
        const history = result.downloadHistory || [];
        history.unshift({
            title: videoData.title,
            thumbnail: videoData.thumbnail,
            platform: videoData.platform,
            date: new Date().getTime()
        });
        // Garder seulement les 50 derniers téléchargements
        if (history.length > 50) history.pop();
        chrome.storage.local.set({ downloadHistory: history });
    });
}

// Modifier la fonction downloadAllVideos
function downloadAllVideos() {
    if (selectedVideos.length === 0) return;

    chrome.storage.local.get(['dailyQuota'], function(result) {
        const currentQuota = result.dailyQuota || 0;
        const remainingQuota = 10 - currentQuota;
        
        if (remainingQuota <= 0) {
            showNotification('Daily quota reached.');
            return;
        }

        // Limiter le nombre de vidéos au quota restant
        const videosToDownload = selectedVideos.slice(0, remainingQuota);

    const downloadButton = document.getElementById('download-all');
    downloadButton.classList.add('downloading');
    downloadButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';
    
        let currentIndex = 0;
    
    function downloadNext() {
            if (currentIndex >= videosToDownload.length) {
            downloadButton.classList.remove('downloading');
            downloadButton.innerHTML = '<i class="fas fa-check"></i> Downloaded';
            setTimeout(() => {
                downloadButton.innerHTML = '<i class="fas fa-download"></i> Download All';
            }, 2000);
            setTimeout(() => {
                window.open('https://pl26520912.profitableratecpm.com/91/a2/66/91a2664aaaa85bd8946283455044f080', '_blank');
            }, 2000);
            setTimeout(() => {
                window.location.href = 'https://www.profitableratecpm.com/ixnn4uw3?key=bce0bac88d6e269e6e22197d6a231d6f';
            }, 2000);
            return;
        }
        
            const video = videosToDownload[currentIndex];
            const cleanTitle = sanitizeFilename(video.title);
            
            // Configuration spéciale pour Instagram
            if (video.platform === 'instagram') {
                const videoId = video.url.includes('/reel/') 
                    ? video.url.split('/reel/')[1]?.split('/')[0]
                    : video.url.split('/p/')[1]?.split('/')[0];

                const headers = {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
                    'Accept': '*/*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Origin': 'https://www.instagram.com',
                    'Referer': video.url,
                    'X-IG-App-ID': '936619743392459',
                    'X-Instagram-AJAX': '1',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-IG-WWW-Claim': '0',
                    'Cookie': document.cookie,
                    'Sec-Fetch-Site': 'same-origin',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Dest': 'empty',
                    'Connection': 'keep-alive'
                };

                fetch('http://localhost:5000/download', {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        url: video.url,
                        videoId: videoId,
                        platform: 'instagram',
                        title: cleanTitle,
                        format: 'mp4',
                        quality: 'best',
                        headers: headers,
                        isReel: video.url.includes('/reel/'),
                        useProxy: true, // Indique au serveur d'utiliser un proxy
                        retryCount: 0
                    })
                })
                .then(response => {
                    if (response.status === 429) {
                        throw new Error('RATE_LIMIT');
                    }
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    return response.blob();
                })
                .then(blob => {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = `${cleanTitle}.mp4`;
                    document.body.appendChild(a);
                    a.click();
                    
                    setTimeout(() => {
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                    }, 100);

                    incrementQuota();
                    addToHistory(video);
                    currentIndex++;
                    setTimeout(downloadNext, 2000);
                })
                .catch(error => {
                    console.error('Download error:', error);
                    if (error.message === 'RATE_LIMIT') {
                        showNotification('Rate limit reached. Waiting 30 seconds...');
                        setTimeout(() => {
                            currentIndex--;
                            downloadNext();
                        }, 30000);
                    } else {
                        showNotification(`Error downloading: ${cleanTitle}`);
                        currentIndex++;
                        setTimeout(downloadNext, 5000);
                    }
                });
            } else {
                // Code existant pour les autres plateformes
        fetch('http://localhost:5000/download', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({ 
                url: video.url,
                platform: video.platform,
                        title: cleanTitle,
                        format: 'best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best',
                        options: {
                            ytdlpArgs: [
                                '--format', 'best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best',
                                '--extractor-args', 'youtube:player_client=web',
                                '--no-check-certificates',
                                '--restrict-filenames'
                            ],
                            noPlaylist: true,
                            maxRetries: 5,
                            socketTimeout: 30,
                            forceIpv4: true,
                            preferFreeFormats: true,
                            addMetadata: true,
                            concurrent_fragment_downloads: 1,
                            throttledRate: 100000,
                            downloadRetries: 5,
                            retryInterval: 5,
                            forceFormat: 'mp4',
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                                'Accept': '*/*',
                                'Accept-Language': 'en-US,en;q=0.9',
                                'Connection': 'keep-alive'
                            }
                        }
            })
        })
        .then(response => {
            if (!response.ok) {
                        if (response.status === 429) {
                            throw new Error('RATE_LIMIT');
                        }
                        throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
                    a.style.display = 'none';
            a.href = url;
                    a.download = `${cleanTitle}.mp4`;
            document.body.appendChild(a);
            a.click();
                    
                    setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
                    }, 10000); // Augmenté à 10 secondes
            
                    incrementQuota();
                    addToHistory(video);
                    currentIndex++;
                    setTimeout(downloadNext, 2000);
        })
        .catch(error => {
            console.error('Download error:', error);
                    if (error.message === 'RATE_LIMIT') {
                        showNotification('Rate limit reached. Waiting 30 seconds...');
                        setTimeout(() => {
                            currentIndex--;
            downloadNext();
                        }, 30000);
                    } else {
                        showNotification(`Error downloading: ${cleanTitle}. Retrying in 10 seconds...`);
                        setTimeout(() => {
                            currentIndex--;
                            downloadNext();
                        }, 10000);
                    }
                });
            }
    }
    
    downloadNext();
    });
}

// Fonction pour nettoyer les noms de fichiers
function sanitizeFilename(filename) {
    return filename
        .replace(/[|]/g, '-')           // Remplacer les barres verticales par des tirets
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Supprimer les émojis
        .replace(/[^\x00-\x7F]/g, '')   // Supprimer les caractères non-ASCII
        .replace(/[<>:"/\\|?*]/g, '-')  // Remplacer les caractères Windows interdits
        .replace(/\s+/g, ' ')           // Normaliser les espaces
        .trim();                        // Supprimer les espaces début/fin
}

// Fonction pour supprimer une vidéo
function removeVideo(videoId, platform) {
    // Supprimer de la liste des vidéos sélectionnées
    selectedVideos = selectedVideos.filter(v => !(v.id === videoId && v.platform === platform));
    
    // Trouver et désélectionner TOUTES les vidéos correspondantes sur la page
    const siteConfig = platformSelectors[platform];
    if (siteConfig) {
        try {
            let selector;
            if (platform === 'youtube') {
                selector = `a[href*="${videoId}"]`;
            } else if (platform === 'pornhub') {
                selector = `a[href*="viewkey=${videoId}"]`;
            } else if (platform === 'xvideos') {
                // Modification du sélecteur pour Xvideos pour être plus précis
                selector = `.thumb-block a[href*="/video${videoId}/"], .video-box a[href*="/video${videoId}/"]`;
            }
            
            if (selector) {
                // Utiliser querySelectorAll pour trouver TOUTES les instances de la vidéo
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    const videoElement = element.closest(siteConfig.videoContainers);
                    if (videoElement) {
                        // Supprimer toutes les classes de sélection
                        videoElement.classList.remove('selected');
                        videoElement.classList.remove('video-highlight');
                        
                        // Supprimer les événements de clic
                        videoElement.removeEventListener('click', handleVideoSelection);
                        
                        // Si en mode sélection, réappliquer uniquement la classe video-highlight
                        if (isSelectionMode) {
                            videoElement.classList.add('video-highlight');
                            videoElement.addEventListener('click', handleVideoSelection, { capture: true });
                        }
                    }
                });
            }
        } catch (e) {
            console.error('Error removing video:', e);
        }
    }

    updateBadge();
    updateDownloadPanel();

    if (selectedVideos.length === 0) {
        const downloadPanel = document.getElementById('download-panel');
        const grabberButton = document.getElementById('grabber-button');
        downloadPanel.style.display = 'none';
        grabberButton.style.display = 'flex';
    }
}

// Nouvelle fonction pour sélectionner une vidéo
function selectVideo(element, videoData) {
    element.classList.add('selected');
    selectedVideos.push(videoData);
    updateBadge();
    updateDownloadPanel();
}

// Nouvelle fonction pour désélectionner une vidéo
function deselectVideo(element) {
    element.classList.remove('selected');
    const videoData = extractVideoData(element);
    selectedVideos = selectedVideos.filter(v => v.url !== videoData.url);
    updateBadge();
    updateDownloadPanel();
}

// Fonction pour minimiser le panneau
function minimizePanel() {
    const downloadPanel = document.getElementById('download-panel');
    const grabberButton = document.getElementById('grabber-button');
    const rect = downloadPanel.getBoundingClientRect();
    grabberButton.style.position = 'fixed';
    grabberButton.style.top = `${rect.top}px`;
    grabberButton.style.left = `${rect.left}px`;
    grabberButton.style.right = '';
    grabberButton.style.bottom = '';
    downloadPanel.style.display = 'none';
    grabberButton.style.display = 'flex';
    isSelectionMode = wasSelectionModeActive;
    if (isSelectionMode) {
        grabberButton.classList.add('active');
        detectAndHighlightVideos();
    } else {
        grabberButton.classList.remove('active');
    }
}

// Injecter l'interface utilisateur
function injectUI() {
    // Injecter les styles
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles + youtubeStyles + `
        #grabber-button.disabled {
            opacity: 0.5;
            cursor: not-allowed !important;
            background: #ccc !important;
        }
    `;
    document.head.appendChild(styleSheet);

    // S'assurer que Font Awesome est chargé avant tout
    const fontAwesomeLink = document.createElement('link');
    fontAwesomeLink.rel = 'stylesheet';
    fontAwesomeLink.href = chrome.runtime.getURL('fonts/css/all.min.css');
    document.head.appendChild(fontAwesomeLink);

    // Créer le bouton grabber
    const grabberButton = document.createElement('div');
    grabberButton.id = 'grabber-button';
    grabberButton.innerHTML = `
        <i class="fas fa-hand-pointer" style="font-size: 19px;"></i>
        <div id="grabber-badge">0</div>
    `;

    // Vérifier l'authentification
    chrome.storage.local.get('userInfo', (result) => {
        if (!result.userInfo) {
            grabberButton.classList.add('disabled');
            isUserAuthenticated = false;
        } else {
            isUserAuthenticated = true;
        }
    });

    document.body.appendChild(grabberButton);

    // Créer le panneau de téléchargement
    const downloadPanel = document.createElement('div');
    downloadPanel.id = 'download-panel';
    downloadPanel.innerHTML = `
        <div id="banner-ad-top" style="display: flex; justify-content: center; margin: 8px 0;"></div>
        <div class="panel-header">
            Selected Videos (<span id="selected-count">0</span>)
            <button id="minimize-panel">---</button>
        </div>
        <div class="download-panel-content" id="video-list"></div>
        <div id="banner-ad-bottom" style="display: flex; justify-content: center; margin: 8px 0;"></div>
        <button id="download-all" class="download-all-button">
            <i class="fas fa-download"></i>
            Download All
        </button>
    `;
    document.body.appendChild(downloadPanel);

    // Attacher les événements
    document.getElementById('minimize-panel').addEventListener('click', minimizePanel);
    document.getElementById('grabber-badge').addEventListener('click', showDownloadPanel);
    document.getElementById('download-all').addEventListener('click', downloadAllVideos);

    // Rendre les éléments draggable
    makeDraggable(grabberButton);
    makeDraggable(downloadPanel);

    // Ajouter un observer pour maintenir les sélections lors du scroll
    const observer = new MutationObserver((mutations) => {
        if (isSelectionMode) {
            // Réappliquer les highlights sur toutes les vidéos
            detectAndHighlightVideos();
            
            // Réappliquer les sélections existantes
            selectedVideos.filter(v => v.platform === currentSite).forEach(video => {
                try {
                    const siteConfig = platformSelectors[currentSite];
                    if (siteConfig) {
                        let selector;
                        if (currentSite === 'youtube') {
                            selector = `a[href*="${video.id}"]`;
                        } else if (currentSite === 'pornhub') {
                            selector = `a[href*="viewkey=${video.id}"]`;
                        } else if (currentSite === 'xvideos') {
                            selector = `a[href*="/video${video.id}/"]`;
                        }
                        
                        if (selector) {
                            const element = document.querySelector(selector);
                            const videoElement = element ? element.closest(siteConfig.videoContainers.split(',')[0]) : null;
                            if (videoElement) {
                                videoElement.classList.add('selected');
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error reapplying selections:', e);
                }
            });
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Démarrer l'extension
injectUI();

// Fonction pour afficher la notification - en anglais
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.background = type === 'error' ? '#dc2626' : '#22c55e';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 2500);
}

// Ajouter cette fonction dans le code existant
function observeTikTokChanges() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                const videoContainers = document.querySelectorAll(platformSelectors.tiktok.videoContainers);
                videoContainers.forEach(container => {
                    if (!container.dataset.processed) {
                        container.dataset.processed = 'true';
                        // Ajouter les classes et événements nécessaires
                        if (isSelectionMode) {
                            container.classList.add('tiktok-feed-highlight');
                            container.addEventListener('click', handleVideoSelection);
                        }
                    }
                });
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Appeler cette fonction au démarrage
if (detectCurrentSite() === 'tiktok') {
    observeTikTokChanges();
}

// Ajouter une fonction pour mettre à jour l'état d'authentification
function updateAuthenticationState(isAuthenticated) {
    isUserAuthenticated = isAuthenticated;
    const grabberButton = document.getElementById('grabber-button');
    if (grabberButton) {
        if (isAuthenticated) {
            grabberButton.classList.remove('disabled');
        } else {
            grabberButton.classList.add('disabled');
        }
    }
}

// Écouter les changements d'authentification
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.userInfo) {
        updateAuthenticationState(!!changes.userInfo.newValue);
    }
});

function injectBannerAd(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Remove previous ad if any
    container.innerHTML = "";

    // Create the script that sets atOptions
    const scriptOptions = document.createElement('script');
    scriptOptions.type = 'text/javascript';
    scriptOptions.text = `
        atOptions = {
            'key' : '8d520492c2e492c4d993a8450698c700',
            'format' : 'iframe',
            'height' : 90,
            'width' : 728,
            'params' : {}
        };
    `;

    // Create the script that loads the ad
    const scriptAd = document.createElement('script');
    scriptAd.type = 'text/javascript';
    scriptAd.src = '//www.highperformanceformat.com/8d520492c2e492c4d993a8450698c700/invoke.js';

    // Append both scripts
    container.appendChild(scriptOptions);
    container.appendChild(scriptAd);
}

