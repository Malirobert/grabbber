chrome.action.onClicked.addListener((tab) => {
  console.log('Extension clicked on tab:', tab.url);
  
  // Injecter le script dans l'onglet actif
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: initGrabber
  });
});

function initGrabber() {
  console.log('Initializing Grabber.io');
  
  // Vérifier si le grabber existe déjà
  if (document.getElementById('grabber-io-button')) {
    console.log('Grabber already exists');
    return;
  }

  // Créer le bouton grabber
  const grabberButton = document.createElement('div');
  grabberButton.id = 'grabber-io-button';
  grabberButton.style.cssText = `
    position: fixed;
    z-index: 999999;
    top: 20px;
    right: 20px;
    width: 48px;
    height: 48px;
    background: #3B82F6;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: move;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    user-select: none;
  `;

  // Ajouter l'icône
  grabberButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  `;

  // Ajouter le badge
  const badge = document.createElement('div');
  badge.id = 'grabber-io-badge';
  badge.style.cssText = `
    position: absolute;
    top: -5px;
    right: -5px;
    background: #EF4444;
    color: white;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    display: none;
  `;
  grabberButton.appendChild(badge);

  // Rendre le bouton draggable
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;

  grabberButton.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);

  function dragStart(e) {
    initialX = e.clientX - currentX;
    initialY = e.clientY - currentY;
    isDragging = true;
    grabberButton.style.transition = 'none';
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;

      // Limiter le déplacement à l'intérieur de la fenêtre
      currentX = Math.max(0, Math.min(currentX, window.innerWidth - grabberButton.offsetWidth));
      currentY = Math.max(0, Math.min(currentY, window.innerHeight - grabberButton.offsetHeight));

      grabberButton.style.left = `${currentX}px`;
      grabberButton.style.top = `${currentY}px`;
    }
  }

  function dragEnd() {
    isDragging = false;
    grabberButton.style.transition = 'transform 0.2s';
  }

  // Initialiser la position
  currentX = window.innerWidth - grabberButton.offsetWidth - 20;
  currentY = 20;
  grabberButton.style.left = `${currentX}px`;
  grabberButton.style.top = `${currentY}px`;

  // Ajouter le bouton au body
  document.body.appendChild(grabberButton);

  // Ajouter l'événement de clic
  grabberButton.addEventListener('click', function(e) {
    if (!isDragging) {
      console.log('Grabber clicked!');
      // Ici, vous pouvez ajouter la logique pour détecter et télécharger les vidéos
      alert('Grabber.io is scanning for videos...');
    }
  });
}

// Vérifier et réinitialiser le quota à minuit
function checkAndResetQuota() {
    chrome.storage.local.get(['lastQuotaReset'], function(result) {
        const now = new Date();
        const lastReset = result.lastQuotaReset ? new Date(result.lastQuotaReset) : null;
        
        if (!lastReset || 
            now.getDate() !== lastReset.getDate() || 
            now.getMonth() !== lastReset.getMonth() || 
            now.getFullYear() !== lastReset.getFullYear()) {
            
            chrome.storage.local.set({
                dailyQuota: 0,
                lastQuotaReset: now.getTime()
            });
        }
    });
}

// Vérifier le quota toutes les minutes
setInterval(checkAndResetQuota, 60000);

// Ajouter la gestion du téléchargement
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'downloadVideo') {
        // Envoyer la requête à votre serveur backend
        fetch('http://localhost:5000/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: message.url
            })
        })
        .then(response => response.json())
        .then(data => {
            // Démarrer le téléchargement
            chrome.downloads.download({
                url: data.downloadUrl,
                filename: data.filename
            });
        })
        .catch(error => {
            console.error('Download error:', error);
            // Afficher une notification d'erreur
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon128.png',
                title: 'Download Error',
                message: 'Failed to download video. Please try again.'
            });
        });
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateProStatus') {
        chrome.storage.local.set({
            isPro: request.isPro,
            subscriptionEnd: request.subscriptionEnd
        });
    }
});