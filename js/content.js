// Variables globales
let selectedVideos = [];
let isSelectionMode = false;
let wasSelectionModeActive = false;
let currentSite = '';
let isUserAuthenticated = false;
let isPremium = false;
let downloadStates = {};
let downloadInProgress = false;  // Nouvelle variable pour suivre l'état global du téléchargement

// Au début du fichier, ajouter la constante pour l'URL du serveur
const SERVER_URL = 'https://grabbber.onrender.com';

// Vérifier le statut premium
chrome.storage.local.get(['isPro', 'subscriptionEnd'], function(result) {
    if (result.isPro && result.subscriptionEnd) {
        const endDate = new Date(result.subscriptionEnd);
        const now = new Date();
        isPremium = now < endDate;
    }
});

// Écouter les changements de statut premium
chrome.storage.onChanged.addListener((changes) => {
    if (changes.isPro || changes.subscriptionEnd) {
        chrome.storage.local.get(['isPro', 'subscriptionEnd'], function(result) {
            if (result.isPro && result.subscriptionEnd) {
                const endDate = new Date(result.subscriptionEnd);
                const now = new Date();
                isPremium = now < endDate;
            } else {
                isPremium = false;
            }
        });
    }
});

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
        padding: 8px;
        gap: 8px;
        align-items: flex-start;
        border-bottom: 1px solid #eee;
    }

    .video-thumbnail {
        width: 80px;
        height: 45px;
        border-radius: 4px;
        object-fit: cover;
        flex-shrink: 0;
    }

    .video-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        padding: 4px 0;
    }

    .video-title {
        font-size: 13px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 160px;
        margin-bottom: 4px;
    }

    .video-status {
        color: #666;
        font-size: 11px;
        white-space: nowrap;
    }

    .delete-button {
        color: #ef4444;
        font-size: 18px;
        font-weight: bold;
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        margin-top: 2px;
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
    .download-all-button.disabled {
    background: #cccccc !important;
    cursor: not-allowed !important;
    opacity: 0.7 !important;
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
        opacity: 1;
        transition: opacity 0.3s ease;
    }
    #minimize-panel[disabled] {
        opacity: 0.5;
        pointer-events: none;
    }
    #minimize-panel:hover {
        opacity: 0.8;
    }
    .notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgb(34, 197, 94);
        color: white;
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 11px;
        max-width: 160px;
        text-align: center;
        z-index: 10000;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        opacity: 0.9;
        animation: slideIn 0.3s ease, fadeOut 0.3s ease 2s forwards;
    }
    .notification.error {
        background: rgb(220, 38, 38);
    }
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 0.9; }
    }
    @keyframes fadeOut {
        from { opacity: 0.9; }
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

    /* Style pour le bouton Upgrade to Pro */
    .upgrade-pro-button {
        display: flex;
        align-items: center;
        gap: 6px;
        background: linear-gradient(45deg, #ff6b6b, #ff8787);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.3s ease;
        border: none;
        margin: 12px;
        width: calc(100% - 24px);
    }

    .upgrade-pro-button:hover {
        background: linear-gradient(45deg, #ff5252, #ff6b6b);
        transform: translateY(-1px);
    }

    .upgrade-pro-button i {
        font-size: 14px;
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
    
    if (currentSite === 'youtube') {
        initializeDownloadButton();
    }
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
    e.preventDefault();
    e.stopPropagation();
    
    const downloadPanel = document.getElementById('download-panel');
    const grabberButton = document.getElementById('grabber-button');
    wasSelectionModeActive = isSelectionMode;

    // Restaurer l'état de téléchargement
    const savedDownloadInProgress = localStorage.getItem('downloadInProgress');
    if (savedDownloadInProgress) {
        downloadInProgress = savedDownloadInProgress === 'true';
    }
    const savedStates = localStorage.getItem('downloadStates');
    if (savedStates) {
        downloadStates = JSON.parse(savedStates);
    }

    grabberButton.style.display = 'flex';
    void grabberButton.offsetWidth;

    const rect = grabberButton.getBoundingClientRect();
    downloadPanel.style.position = 'fixed';
    downloadPanel.style.top = `${rect.top}px`;
    downloadPanel.style.left = `${rect.left}px`;
    downloadPanel.style.right = '';
    downloadPanel.style.bottom = '';
    downloadPanel.style.display = 'block';
    grabberButton.style.display = 'none';

    // Force la réinitialisation du bouton Download All
    const downloadButton = document.querySelector('.download-all-button');
    if (downloadButton) {
        downloadInProgress = false;
        downloadButton.disabled = false;
        downloadButton.innerHTML = '<i class="fas fa-download"></i> Download All';
    }

    updateDownloadPanel();
}

// Modifier la fonction updateDownloadPanel pour utiliser downloadInProgress
function updateDownloadPanel() {
    const downloadPanel = document.getElementById('download-panel');
    
    downloadPanel.innerHTML = `
        <div class="panel-header">
            Selected Videos (${selectedVideos.length})
            <button id="minimize-panel">---</button>
        </div>
        <div id="video-list">
            ${selectedVideos.map(video => {
                const downloadState = downloadStates[video.id] || 'ready';
                const statusText = {
                    'ready': 'Ready to download',
                    'downloading': 'Downloading...',
                    'completed': 'Downloaded',
                    'error': 'Failed to download'
                }[downloadState];
                
                const statusClass = {
                    'ready': '',
                    'downloading': 'text-blue-500',
                    'completed': '#4CAF50',
                    'error': '#f44336'
                }[downloadState];

                const siteConfig = platformSelectors[video.platform];
                let thumbnailUrl = video.thumbnail || '';
                
                if (video.platform === 'instagram' && !thumbnailUrl) {
                    const videoElement = document.querySelector(`a[href*="${video.id}"]`);
                    if (videoElement) {
                        const img = videoElement.querySelector('img._aagt, img[sizes="1px"]');
                        thumbnailUrl = img ? img.src : '';
                    }
                }
                
                return `
                <div class="video-item">
                    <img src="${thumbnailUrl}" class="video-thumbnail" 
                         style="${video.platform === 'instagram' ? 'width: 45px; height: 80px; object-fit: cover;' : ''}"
                         onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\\"http://www.w3.org/2000/svg\\\" width=\\\"80\\\" height=\\\"45\\\" viewBox=\\\"0 0 80 45\\\"><rect width=\\\"80\\\" height=\\\"45\\\" fill=\\\"%23eee\\\"/><text x=\\\"40\\\" y=\\\"22.5\\\" text-anchor=\\\"middle\\\" dominant-baseline=\\\"middle\\\" font-family=\\\"sans-serif\\\" font-size=\\\"12\\\" fill=\\\"%23999\\\">${video.platform}</text></svg>'">
                    <div class="video-info">
                        <div class="video-title" title="${video.title}">${video.title}</div>
                        <div class="video-status ${statusClass}">${statusText} (${video.platform})</div>
                    </div>
                    <button class="delete-button" data-video-id="${video.id}" data-platform="${video.platform}">×</button>
                </div>`;
            }).join('')}
        </div>
        ${selectedVideos.length > 0 ? `
            <button id="download-all" class="download-all-button${downloadInProgress ? ' downloading' : ''}"${downloadInProgress ? ' disabled' : ''}>
                ${downloadInProgress ? '<i class="fas fa-spinner fa-spin"></i> Downloading...' : '<i class="fas fa-download"></i> Download All'}
            </button>
        ` : ''}
    `;

    // Add event listeners
    const deleteButtons = downloadPanel.querySelectorAll('.delete-button');
    deleteButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const videoId = e.target.dataset.videoId;
            const platform = e.target.dataset.platform;
            delete downloadStates[videoId];
            saveDownloadStates();
            removeVideo(videoId, platform);
        });
    });

    document.getElementById('minimize-panel').addEventListener('click', minimizePanel);
    
    const downloadAllButton = document.getElementById('download-all');
    if (downloadAllButton) {
        if (downloadInProgress) {
            downloadAllButton.disabled = true;
            downloadAllButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';
        } else {
            downloadAllButton.disabled = false;
            downloadAllButton.innerHTML = '<i class="fas fa-download"></i> Download All';
            // Ajouter l'écouteur d'événement uniquement si le bouton n'est pas en cours de téléchargement
            downloadAllButton.addEventListener('click', downloadAllVideos);
        }
    }
}

// Fonctions pour gérer le quota et l'historique

async function checkQuota() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['isPro', 'dailyQuota'], function(result) {
            if (result.isPro) {
                resolve({ canDownload: true });
            } else {
                const currentQuota = result.dailyQuota || 0;
                resolve({
                    canDownload: currentQuota < 10,
                    currentQuota: currentQuota
                });
            }
        });
    });
}

async function incrementQuota() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['dailyQuota'], function(result) {
            const newQuota = (result.dailyQuota || 0) + 1;
            chrome.storage.local.set({ dailyQuota: newQuota }, function() {
                resolve(newQuota);
            });
        });
    });
}


function addToHistory(videoData) {
    chrome.storage.local.get(['downloadHistory'], function(result) {
        const history = result.downloadHistory || [];
        history.unshift({
            title: videoData.title,
            thumbnail: videoData.thumbnail,
            platform: videoData.platform || 'unknown',
            date: new Date().getTime()
        });
        
        // Limiter à 50 entrées max
        if (history.length > 50) history.pop();
        
        chrome.storage.local.set({ downloadHistory: history });
    });
}

async function downloadAllVideos() {
    const downloadButton = document.querySelector('.download-all-button');
    const minimizeBtn = document.getElementById('minimize-panel');
    if (!downloadButton || downloadButton.disabled || downloadInProgress) return;
    
    // Vérifier le quota avant de commencer
    const quotaCheck = await checkQuota();
    if (!quotaCheck.canDownload) {
        showNotification('Daily quota reached (10/10). Upgrade to Pro for unlimited downloads!', 'error');
        return;
    }

    const videos = selectedVideos;
    if (videos.length === 0) return;

    // Vérifier si le nombre de vidéos dépasse le quota restant pour les utilisateurs gratuits
    if (!quotaCheck.isPro && (quotaCheck.currentQuota + videos.length) > 10) {
        const remainingDownloads = 10 - quotaCheck.currentQuota;
        showNotification(`You can only download ${remainingDownloads} more videos today. Upgrade to Pro for unlimited downloads!`, 'warning');
        return;
    }
    
    downloadInProgress = true;
    downloadButton.disabled = true;
    downloadButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';
    
    if (minimizeBtn) {
        minimizeBtn.style.opacity = '0.5';
        minimizeBtn.style.pointerEvents = 'none';
    }
    
    try {
        for (let i = 0; i < videos.length; i++) {
            const video = videos[i];
            const videoItem = document.querySelector(`[data-video-id="${video.id}"]`)?.closest('.video-item');
            const statusElement = videoItem?.querySelector('.video-status');
            
            // Vérifier à nouveau le quota pour chaque vidéo
            const currentQuotaCheck = await checkQuota();
            if (!currentQuotaCheck.canDownload) {
                showNotification('Daily quota reached. Upgrade to Pro for unlimited downloads!', 'error');
                break;
            }
            
            if (statusElement) {
                statusElement.textContent = 'Downloading...';
                statusElement.style.color = '#666';
            }
            
            try {
                const response = await fetch(`${SERVER_URL}/download`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        url: video.url,
                        id: video.id,
                        platform: video.platform,
                        title: sanitizeFilename(video.title)
                    })
                });

                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `${sanitizeFilename(video.title)}.mp4`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);

                // Incrémenter le quota après un téléchargement réussi
                const proStatus = await new Promise(resolve => {
                    chrome.storage.local.get(['isPro'], result => resolve(result.isPro));
                });
                if (!proStatus) {
                    await incrementQuota();
                    // Forcer la mise à jour de l'affichage du quota
                    chrome.runtime.sendMessage({ action: 'updateQuota' });
                }

                if (statusElement) {
                    statusElement.textContent = 'Downloaded';
                    statusElement.style.color = '#4CAF50';
                }
                addToHistory(video);
                showNotification(`Downloaded: ${video.title}`, 'success');
            } catch (error) {
                console.error(`Error downloading ${video.title}:`, error);
                if (statusElement) {
                    statusElement.textContent = 'Failed to download';
                    statusElement.style.color = '#f44336';
                }
                showNotification(`Error downloading: ${video.title}`, 'error');
            }
            
            const currentButton = document.querySelector('.download-all-button');
            if (currentButton) {
                currentButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';
                currentButton.disabled = true;
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    } finally {
        downloadInProgress = false;
        const finalButton = document.querySelector('.download-all-button');
        if (finalButton) {
            finalButton.disabled = false;
            finalButton.innerHTML = '<i class="fas fa-download"></i> Download All';
            showNotification('All downloads completed', 'success');
        }
        
        if (minimizeBtn) {
            minimizeBtn.style.opacity = '1';
            minimizeBtn.style.pointerEvents = 'auto';
        }
    }
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
    if (downloadInProgress) return; // Empêche la minimisation pendant le téléchargement
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
    wasSelectionModeActive = isSelectionMode;
    
    // Sauvegarder l'état
    localStorage.setItem('wasMinimized', 'true');
    localStorage.setItem('downloadInProgress', downloadInProgress.toString());
    localStorage.setItem('grabberPosition', JSON.stringify({
        top: rect.top,
        left: rect.left
    }));
    localStorage.setItem('downloadStates', JSON.stringify(downloadStates));
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

    loadDownloadStates();  // Charger les états au démarrage
    
    // Restore minimized state if needed
    const wasMinimized = localStorage.getItem('wasMinimized');
    if (wasMinimized === 'true') {
        const position = JSON.parse(localStorage.getItem('grabberPosition') || '{}');
        const grabberButton = document.getElementById('grabber-button');
        if (position.top && position.left) {
            grabberButton.style.position = 'fixed';
            grabberButton.style.top = `${position.top}px`;
            grabberButton.style.left = `${position.left}px`;
        }
    }
}

// Démarrer l'extension
injectUI();

// Fonction pour afficher la notification - en anglais
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'success' ? '#22c55e' : '#dc2626'};
        color: white;
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 11px;
        max-width: 160px;
        text-align: center;
        z-index: 10000;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        opacity: 0.9;
        animation: slideIn 0.3s ease, fadeOut 0.3s ease 2s forwards;
    `;
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

// Charger l'état des téléchargements au démarrage
function loadDownloadStates() {
    const savedStates = localStorage.getItem('downloadStates');
    if (savedStates) {
        downloadStates = JSON.parse(savedStates);
        updateDownloadPanel();
    }
}

// Fonction pour sauvegarder l'état des téléchargements
function saveDownloadStates() {
    localStorage.setItem('downloadStates', JSON.stringify(downloadStates));
}

// Ajouter l'initialisation au démarrage
document.addEventListener('DOMContentLoaded', () => {
    loadDownloadStates();
    
    // Restore minimized state if needed
    const wasMinimized = localStorage.getItem('wasMinimized');
    if (wasMinimized === 'true') {
        const position = JSON.parse(localStorage.getItem('grabberPosition') || '{}');
        const grabberButton = document.getElementById('grabber-button');
        if (position.top && position.left) {
            grabberButton.style.position = 'fixed';
            grabberButton.style.top = `${position.top}px`;
            grabberButton.style.left = `${position.left}px`;
        }
    }

    // Vérifier le statut premium et les limites
    chrome.storage.local.get(['isPro', 'subscriptionEnd', 'dailyQuota'], function(result) {
        if (result.isPro && result.subscriptionEnd) {
            const endDate = new Date(result.subscriptionEnd);
            const now = new Date();
            isPremium = now < endDate;
        }

        // Mettre à jour l'interface en fonction du statut
        if (!isPremium && result.dailyQuota >= 10) {
            const downloadButton = document.querySelector('.download-all-button');
            if (downloadButton) {
                downloadButton.disabled = true;
                downloadButton.classList.add('disabled');
                downloadButton.title = 'Daily download limit reached. Upgrade to Premium for unlimited downloads!';
            }
        }
    });
});

// Fonction pour vérifier et mettre à jour le quota
function checkAndUpdateQuota(callback) {
    if (isPremium) {
        // Les utilisateurs premium n'ont pas de limite
        callback(true);
        return;
    }

    chrome.storage.local.get(['dailyQuota', 'lastQuotaReset'], function(result) {
        const now = new Date();
        const lastReset = result.lastQuotaReset ? new Date(result.lastQuotaReset) : null;
        const quota = result.dailyQuota || 0;

        // Vérifier si c'est un nouveau jour
        if (!lastReset || 
            now.getDate() !== lastReset.getDate() || 
            now.getMonth() !== lastReset.getMonth() || 
            now.getFullYear() !== lastReset.getFullYear()) {
            
            // Réinitialiser le quota
            chrome.storage.local.set({
                dailyQuota: 1,
                lastQuotaReset: now.getTime()
            }, () => callback(true));
        } else if (quota >= 10) {
            // Limite atteinte
            callback(false);
        } else {
            // Incrémenter le quota
            chrome.storage.local.set({
                dailyQuota: quota + 1
            }, () => callback(true));
        }
    });
}

// Fonction pour réinitialiser l'état du bouton de téléchargement
function resetDownloadButtonState() {
    const downloadButton = document.querySelector('.download-all-button');
    if (downloadButton) {
        downloadButton.disabled = false;
        downloadButton.innerHTML = '<i class="fas fa-download"></i> Download All';
        downloadInProgress = false;

        // Vérifier les limites de téléchargement pour les utilisateurs non premium
        if (!isPremium) {
            chrome.storage.local.get(['dailyQuota'], function(result) {
                const quota = result.dailyQuota || 0;
                if (quota >= 10) {
                    downloadButton.disabled = true;
                    downloadButton.classList.add('disabled');
                    downloadButton.title = 'Daily download limit reached. Upgrade to Premium for unlimited downloads!';
                }
            });
        }
    }
}

// Ajouter un observateur pour le bouton de téléchargement
function initializeDownloadButton() {
    const downloadButton = document.querySelector('.download-all-button');
    if (downloadButton) {
        if (downloadButton.innerHTML.includes('Downloading...')) {
            resetDownloadButtonState();
        }

        // Ajouter le gestionnaire de clic
        downloadButton.addEventListener('click', function(e) {
            if (!isPremium) {
                // Vérifier le quota avant de télécharger
                checkAndUpdateQuota((canDownload) => {
                    if (!canDownload) {
                        e.preventDefault();
                        e.stopPropagation();
                        showNotification('Daily download limit reached. Upgrade to Premium for unlimited downloads!', 'error');
                    }
                });
            }
        });
    }
}

// Observer le bouton de téléchargement
document.addEventListener('DOMContentLoaded', () => {
    initializeDownloadButton();
});

