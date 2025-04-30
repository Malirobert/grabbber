// Make elements draggable and keep them within viewport
function makeDraggable(element) {
    let isDragging = false;
    let offsetX, offsetY;
    
    element.addEventListener('mousedown', (e) => {
        // Don't start dragging if clicking on buttons or interactive elements
        if (e.target.closest('button, a, input, i')) return;
        
        isDragging = true;
        const rect = element.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        element.style.cursor = 'grabbing';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        let x = e.clientX - offsetX;
        let y = e.clientY - offsetY;
        
        // Keep element within viewport
        const elementWidth = element.offsetWidth;
        const elementHeight = element.offsetHeight;
        
        x = Math.max(0, Math.min(x, window.innerWidth - elementWidth));
        y = Math.max(0, Math.min(y, window.innerHeight - elementHeight));
        
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
        element.style.cursor = 'pointer';
    });
}
        
// Initialize elements
const grabberButton = document.getElementById('grabberButton');
const downloadPanel = document.getElementById('downloadPanel');
const selectedVideosList = document.getElementById('selectedVideosList');
const downloadAllButton = document.getElementById('downloadAll');
const minimizePanel = document.getElementById('minimizePanel');
const selectedCount = document.getElementById('selectedCount');
const emptyMessage = document.getElementById('emptyMessage');
const selectionBadge = document.getElementById('selectionBadge');

makeDraggable(grabberButton);
makeDraggable(downloadPanel);

let selectedVideos = [];
let videoHighlights = [];
let isSelectionModeActive = false;

// Modifier le style du bouton grabber pour le rendre entièrement cliquable
const grabberButtonStyle = `
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
`;

grabberButton.style.cssText += grabberButtonStyle;

// Améliorer la gestion des événements du grabber
let isDragging = false;
let startX, startY;

function handleGrabberClick(e) {
    e.stopPropagation();
    
    // Si on n'est pas en train de déplacer le grabber
    if (!isDragging) {
        if (isSelectionModeActive) {
            exitSelectionMode();
        } else {
            enterSelectionMode();
        }
    }
}

function handleGrabberMouseDown(e) {
    e.preventDefault();
    isDragging = false;
    startX = e.clientX - grabberButton.offsetLeft;
    startY = e.clientY - grabberButton.offsetTop;
    
    document.addEventListener('mousemove', handleGrabberMouseMove);
    document.addEventListener('mouseup', handleGrabberMouseUp);
}

function handleGrabberMouseMove(e) {
    isDragging = true;
    const x = e.clientX - startX;
    const y = e.clientY - startY;
    
    // Limiter le déplacement à l'intérieur de la fenêtre
    const maxX = window.innerWidth - grabberButton.offsetWidth;
    const maxY = window.innerHeight - grabberButton.offsetHeight;
    
    const newX = Math.max(0, Math.min(x, maxX));
    const newY = Math.max(0, Math.min(y, maxY));
    
    grabberButton.style.left = `${newX}px`;
    grabberButton.style.top = `${newY}px`;
    
    // Mettre à jour la position du panneau s'il est visible
    if (!downloadPanel.classList.contains('hidden')) {
        downloadPanel.style.left = `${newX}px`;
        downloadPanel.style.top = `${newY}px`;
    }
}

function handleGrabberMouseUp() {
    document.removeEventListener('mousemove', handleGrabberMouseMove);
    document.removeEventListener('mouseup', handleGrabberMouseUp);
    
    // Si c'était juste un clic (pas un drag), gérer le clic
    if (!isDragging) {
        handleGrabberClick(event);
    }
    
    setTimeout(() => {
        isDragging = false;
    }, 10);
}
        
function enterSelectionMode() {
    isSelectionModeActive = true;
    grabberButton.classList.add('active');
    
    const videos = document.querySelectorAll('iframe, video');
    
    if (videos.length === 0) {
        showNotification("No videos found on this page!", 'error');
        exitSelectionMode();
        return;
    }
    
    videos.forEach(video => {
        const container = video.closest('div');
        if (!container) return;
        
        let videoId, videoTitle, thumbnailUrl;
        
        if (video.tagName === 'IFRAME') {
            const src = video.getAttribute('src');
            const match = src.match(/embed\/([^?]+)/);
            videoId = match ? match[1] : null;
            thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
            
            const titleElement = container.querySelector('h3');
            videoTitle = titleElement ? titleElement.textContent : 'YouTube Video';
        } else {
            videoId = 'html5-' + Math.random().toString(36).substr(2, 9);
            videoTitle = container.querySelector('h3')?.textContent || 'HTML5 Video';
            thumbnailUrl = '';
        }
        
        container.classList.add('video-highlight');
        
        container.dataset.videoId = videoId;
        container.dataset.videoTitle = videoTitle;
        container.dataset.thumbnailUrl = thumbnailUrl;
        container.dataset.videoUrl = video.tagName === 'IFRAME' ? video.src : video.querySelector('source')?.src || '';
        
        container.addEventListener('click', handleVideoClick);
        
        videoHighlights.push(container);
    });
}
        
async function downloadWithYtDlp(video) {
    const downloadItem = document.getElementById(`download-item-${video.id}`);
    const progressBar = downloadItem.querySelector('.download-progress');
    const statusText = downloadItem.querySelector('.download-status');
    
    try {
        statusText.textContent = 'Starting download...';
        progressBar.style.width = '0%';
        
        // Faire la requête avec responseType 'blob'
        const response = await fetch('http://localhost:5000/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: video.url, id: video.id })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Obtenir le blob de la réponse
        const blob = await response.blob();
        
        // Créer un lien de téléchargement
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        // Obtenir le nom du fichier depuis les headers de la réponse
        const contentDisposition = response.headers.get('content-disposition');
        const fileName = contentDisposition
            ? contentDisposition.split('filename=')[1].replace(/"/g, '')
            : `video_${video.id}.mp4`;
        
        a.href = downloadUrl;
        a.download = fileName;
        
        // Déclencher le téléchargement
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Nettoyer l'URL
        window.URL.revokeObjectURL(downloadUrl);
        
        progressBar.style.width = '100%';
        statusText.textContent = 'Download complete';
        showNotification(`Downloaded: ${video.title}`, 'success');
        return true;

    } catch (error) {
        console.error(`Error downloading ${video.title}:`, error);
        statusText.textContent = 'Download failed';
        progressBar.style.backgroundColor = '#EF4444';
        showNotification(`Error downloading ${video.title}: ${error.message}`, 'error');
        return false;
    }
}
        
function handleVideoClick(e) {
    const container = e.currentTarget;
    const videoId = container.dataset.videoId;
    let videoUrl = container.dataset.videoUrl;
    
    if (container.classList.contains('selected')) {
        container.classList.remove('selected');
        selectedVideos = selectedVideos.filter(v => v.id !== videoId);
    } else {
        container.classList.add('selected');
        selectedVideos.push({
            id: videoId,
            title: container.dataset.videoTitle,
            thumbnail: container.dataset.thumbnailUrl,
            url: videoUrl
        });
        
        showNotification('Video added to list', 'success');
    }
    
    updateBadge();
    updateDownloadPanel();
    e.stopPropagation();
}
        
// S'assurer que le badge est cliquable
selectionBadge.style.cursor = 'pointer';
selectionBadge.style.pointerEvents = 'auto';

// Ajouter l'event listener pour le badge
selectionBadge.addEventListener('click', (e) => {
    e.stopPropagation();
    if (selectedVideos.length > 0) {
        // Obtenir la position actuelle du grabber
        const grabberRect = grabberButton.getBoundingClientRect();
        
        // Appliquer la même position au panneau de téléchargement
        downloadPanel.style.left = `${grabberRect.left}px`;
        downloadPanel.style.top = `${grabberRect.top}px`;
        
        // Cacher le grabber et montrer le panneau
        grabberButton.classList.add('hidden');
        downloadPanel.classList.remove('hidden');
        updateDownloadPanel();
    }
});
        
// Nouvelle fonction pour afficher les notifications
function showNotification(message, type = 'info') {
    // Créer l'élément de notification
    const notification = document.createElement('div');
    notification.className = `fixed bottom-4 right-4 p-4 rounded-lg shadow-lg ${
        type === 'success' ? 'bg-green-500' : 
        type === 'error' ? 'bg-red-500' : 
        'bg-blue-500'
    } text-white`;
    notification.textContent = message;

    // Ajouter au DOM
    document.body.appendChild(notification);

    // Supprimer après 3 secondes
    setTimeout(() => {
        notification.remove();
    }, 3000);
}
        
function exitSelectionMode() {
    isSelectionModeActive = false;
    grabberButton.classList.remove('active');
    
    videoHighlights.forEach(container => {
        if (!container.classList.contains('selected')) {
            container.classList.remove('video-highlight');
            container.removeEventListener('click', handleVideoClick);
        }
    });
    
    videoHighlights = videoHighlights.filter(container => 
        container.classList.contains('selected')
    );
}
        
function updateDownloadPanel() {
    selectedCount.textContent = selectedVideos.length;
    
    if (selectedVideos.length === 0) {
        emptyMessage.classList.remove('hidden');
        selectedVideosList.innerHTML = '';
        selectedVideosList.appendChild(emptyMessage);
        return;
    } else {
        emptyMessage.classList.add('hidden');
    }
    
    selectedVideosList.innerHTML = '';
    
    selectedVideos.forEach(video => {
        const videoItem = document.createElement('div');
        videoItem.className = 'p-4 border-b flex items-center download-item';
        videoItem.id = `download-item-${video.id}`;
        
        const thumbnail = video.thumbnail || 'placeholder-image.jpg';
        
        videoItem.innerHTML = `
            <img src="${thumbnail}" alt="${video.title}" class="video-thumbnail mr-3">
            <div class="flex-1 min-w-0">
                <h4 class="font-medium text-sm truncate">${video.title}</h4>
                <p class="text-gray-500 text-xs">${video.id}</p>
                <div class="download-status">Ready to download</div>
                <div class="download-progress"></div>
            </div>
            <button class="text-red-500 hover:text-red-700 mr-2" onclick="removeVideo('${video.id}')">
                <i class="fas fa-times"></i>
            </button>
            <button class="text-blue-500 hover:text-blue-700" onclick="downloadWithYtDlp(${JSON.stringify(video)})">
                <i class="fas fa-download"></i>
            </button>
        `;
        selectedVideosList.appendChild(videoItem);
    });
}
        
function updateBadge() {
    if (selectedVideos.length > 0) {
        selectionBadge.textContent = selectedVideos.length;
        selectionBadge.classList.remove('hidden');
    } else {
        selectionBadge.classList.add('hidden');
    }
}
        
// Modifier le gestionnaire de clic du bouton Download All
downloadAllButton.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (selectedVideos.length === 0) return;
    
    downloadAllButton.disabled = true;
    downloadAllButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Downloading...';

    try {
        console.log('Starting multiple downloads:', selectedVideos);
        const downloadPromises = selectedVideos.map(video => downloadWithYtDlp(video));
        const results = await Promise.all(downloadPromises);
        
        const successCount = results.filter(result => result).length;
        
        downloadAllButton.innerHTML = '<i class="fas fa-check mr-2"></i> Videos downloaded';
        showNotification(`${successCount} videos downloaded successfully`, 'success');
        
        // Ne supprimez que les vidéos téléchargées avec succès
        selectedVideos = selectedVideos.filter((_, index) => !results[index]);
        updateDownloadPanel();
        updateBadge();
        
        setTimeout(() => {
            downloadAllButton.disabled = false;
            downloadAllButton.innerHTML = '<i class="fas fa-download mr-2"></i> Download All';
            
            if (selectedVideos.length === 0) {
                downloadPanel.classList.add('hidden');
                grabberButton.classList.remove('hidden');
                exitSelectionMode();
            }
        }, 3000);

    } catch (error) {
        console.error('Error during multiple downloads:', error);
        showNotification('Error during downloads', 'error');
        downloadAllButton.disabled = false;
        downloadAllButton.innerHTML = '<i class="fas fa-download mr-2"></i> Download All';
    }
});
        
// Nouvelle fonction pour supprimer une vidéo
function removeVideo(videoId) {
    selectedVideos = selectedVideos.filter(v => v.id !== videoId);
    const container = videoHighlights.find(c => c.dataset.videoId === videoId);
    if (container) {
        container.classList.remove('selected');
    }
    updateDownloadPanel();
    updateBadge();
    
    if (selectedVideos.length === 0) {
        downloadPanel.classList.add('hidden');
        grabberButton.classList.remove('hidden');
    }
}

// Mettre à jour le comportement du bouton minimize
minimizePanel.addEventListener('click', (e) => {
    e.stopPropagation();
    const panelRect = downloadPanel.getBoundingClientRect();
    
    // Appliquer la position du panneau au grabber avant de le montrer
    grabberButton.style.left = `${panelRect.left}px`;
    grabberButton.style.top = `${panelRect.top}px`;
    
    downloadPanel.classList.add('hidden');
    grabberButton.classList.remove('hidden');
});

// Supprimer les anciens event listeners
grabberButton.removeEventListener('click', handleGrabberClick);
grabberButton.removeEventListener('mousedown', handleGrabberMouseDown);

// Ajouter les nouveaux event listeners
grabberButton.addEventListener('mousedown', handleGrabberMouseDown);

// Mettre à jour le style CSS
const style = document.createElement('style');
style.textContent = `
    .draggable {
        touch-action: none;
        user-select: none;
    }
    
    #grabberButton {
        cursor: pointer !important;
    }
    
    #grabberButton * {
        pointer-events: none;
    }
    
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
    
    #downloadPanel {
        transition: none; /* Désactiver la transition pour un placement instantané */
    }
`;
document.head.appendChild(style);

// Ajoutez au début du fichier
const styles = `
    .grabber-button {
        @apply fixed bottom-4 right-4 p-4 bg-blue-500 text-white rounded-full shadow-lg cursor-pointer;
    }
    .download-panel {
        @apply fixed p-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl;
    }
    .video-item {
        @apply flex items-center p-2 border-b;
    }
`;

// Injectez les styles
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);