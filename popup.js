console.log('Popup.js chargé');

let auth;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Popup.js chargé');
    
    // Vérifier le quota au démarrage
    checkAndResetQuota();
    
    // Vérifier le quota toutes les minutes
    setInterval(checkAndResetQuota, 60000);

    // Gérer le clic sur le lien Pawns.app
    document.getElementById('pawnsLink').addEventListener('click', function(e) {
        e.preventDefault();
        chrome.tabs.create({ url: this.href });
    });

    const modeToggle = document.getElementById('modeToggle');
    const historyBox = document.getElementById('historyBox');
    const upgradeLink = document.getElementById('upgradeLink'); // Ajouté
    
    // Charger l'état du toggle
    chrome.storage.local.get(['isAIMode'], function(result) {
        modeToggle.checked = result.isAIMode || false;
    });

    // Gérer le toggle AI
    modeToggle.addEventListener('click', handleToggleClick);

    updateQuotaDisplay();
    loadHistory();
    setupQuotaRefresh();

    // Configuration Firebase
    const firebaseConfig = {
        apiKey: "AIzaSyBCBBxK5HfvM-imMZc_jQ_TVPogF25f0zU",
        authDomain: "grabber-53a87.firebaseapp.com",
        projectId: "grabber-53a87",
        storageBucket: "grabber-53a87.firebasestorage.app",
        messagingSenderId: "850057238917",
        appId: "1:850057238917:web:dd6020de32b822efcbccec",
        measurementId: "G-DLN5WMZ6F0"
    };

    // Initialiser Firebase
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();

    // Vérifier immédiatement si un compte existe
    chrome.storage.local.get('userInfo', (result) => {
        if (!result.userInfo) {
            // Si pas de compte, afficher directement le formulaire de connexion
            showAuthForm();
            // Désactiver le bouton Grabber
            disableGrabberFunctionality();
        } else {
            // Si compte existe, activer les fonctionnalités
            enableGrabberFunctionality();
            // Mettre à jour l'icône du profil
            updateProfileIcon(result.userInfo.initial);
        }
    });

    // Gestionnaire pour le bouton upgrade
    document.querySelector('.upgrade-text').addEventListener('click', () => {
        showGumroadModal();
    });

    // Vérifier le statut de l'abonnement au chargement
    checkSubscriptionStatus();
    // Vérifier toutes les heures
    setInterval(checkSubscriptionStatus, 3600000);
});

function checkAndResetQuota() {
    chrome.storage.local.get(['lastQuotaReset'], function(result) {
        const now = new Date();
        const lastReset = result.lastQuotaReset ? new Date(result.lastQuotaReset) : null;
        
        // Vérifier si c'est un nouveau jour
        if (!lastReset || 
            now.getDate() !== lastReset.getDate() || 
            now.getMonth() !== lastReset.getMonth() || 
            now.getFullYear() !== lastReset.getFullYear()) {
            
            // Réinitialiser le quota
            chrome.storage.local.set({
                dailyQuota: 0,
                lastQuotaReset: now.getTime()
            }, function() {
                // Mettre à jour l'affichage
                updateQuotaDisplay();
                // Afficher une notification
                showNotification('Daily quota has been reset! You have 10 new downloads available.');
            });
        }
    });
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        border-radius: 6px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        background: ${type === 'success' ? '#4CAF50' : '#dc2626'};
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        animation: slideUp 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideDown 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function showToggleMessage() {
    // Remove previous message if exists
    const existingMessage = document.querySelector('.toggle-premium-message');
    if (existingMessage) existingMessage.remove();
    const message = document.createElement('div');
    message.className = 'toggle-premium-message';
    message.textContent = 'Upgrade to Lifetime Plan and unlock unlimited Grabbber! Get exclusive access to Al agents and download as many videos as you want for life without restrictions !';
    document.body.appendChild(message);
    const toggle = document.querySelector('.switch');
    const toggleRect = toggle.getBoundingClientRect();
    message.style.position = 'absolute';
    message.style.left = `${toggleRect.left + (toggleRect.width/2)}px`;
    message.style.top = `${toggleRect.top - 10}px`;
    setTimeout(() => message.remove(), 2000);
}

const notificationStyle = `
    .notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #22c55e;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
    }
    
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }

    @keyframes slideUp {
        from { transform: translateX(-50%) translateY(100%); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }

    @keyframes slideDown {
        from { transform: translateX(-50%) translateY(0); opacity: 1; }
        to { transform: translateX(-50%) translateY(100%); opacity: 0; }
    }
`;

const toggleMessageStyle = `
    .toggle-premium-message {
        position: fixed;
        transform: translate(-50%, -100%);
        background: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        color: #666;
        box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        width: max-content;
        max-width: 200px;
        text-align: center;
        animation: fadeInMessage 0.2s ease;
        z-index: 10000;
    }

    .toggle-premium-message::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 6px solid white;
    }

    @keyframes fadeInMessage {
        from { 
            opacity: 0; 
            transform: translate(-50%, -90%);
        }
        to { 
            opacity: 1; 
            transform: translate(-50%, -100%);
        }
    }
`;

// S'assurer que le style est ajouté
if (!document.querySelector('#toggle-message-style')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'toggle-message-style';
    styleSheet.textContent = toggleMessageStyle;
    document.head.appendChild(styleSheet);
}

// Style CSS mis à jour
const toggleStyle = `
    .switch {
        position: relative;
        width: 60px;
        height: 30px;
        display: inline-block;
    }

    .slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #4285f4;
        border-radius: 34px;
    }

    .slider-ball {
        position: absolute;
        height: 24px;
        width: 24px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        border-radius: 50%;
        transition: transform 0.3s ease;
    }

    /* Supprimer toutes les autres transitions */
    input:checked + .slider {
        background-color: #3B82F6;
    }
`;

function handleAuthSuccess(user, password) {
    const initial = user.email.charAt(0).toUpperCase();
    
    // Sauvegarder dans le stockage local avec le mot de passe
    chrome.storage.local.set({
        'userInfo': {
            email: user.email,
            initial: initial,
            password: password // Sauvegarder le mot de passe
        }
    }, () => {
        // Mettre à jour l'icône
        updateProfileIcon(initial);
        
        // Fermer le modal
        document.getElementById('authModal').style.display = 'none';
        
        // Afficher une notification de succès
        showNotification('Account created successfully!');
    });
}

function updateProfileIcon(initial) {
    const profileBtn = document.getElementById('profileBtn');
    if (profileBtn) {
        // Mettre à jour l'icône
        profileBtn.innerHTML = `
            <div class="profile-initial" style="width: 24px; height: 24px; background: #3B82F6; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px;">
                ${initial}
            </div>
        `;

        // Réattacher l'event listener
        profileBtn.addEventListener('click', () => {
            console.log('Profile clicked'); // Pour debug
            chrome.storage.local.get('userInfo', (result) => {
                if (result.userInfo) {
                    showUserInfo(result.userInfo.email);
                } else {
                    showAuthForm();
                }
            });
        });
    }
}

function updateQuotaDisplay() {
    // Vérifier si l'utilisateur est pro
    chrome.storage.local.get(['isPro', 'dailyQuota'], function(result) {
        const quotaText = document.querySelector('.quota-text');
        if (!quotaText) return;

        if (result.isPro) {
            // Utilisateur pro - téléchargements illimités
            quotaText.innerHTML = `
                <i class="fas fa-infinity"></i> Pro Account: Unlimited downloads
                <div class="pro-buttons">
                    <div class="upgrade-pro-link" id="upgradeLink">
                        <i class="fas fa-crown"></i>
                        UPGRADE LIFETIME TO OWN GRABBBER
                    </div>
                </div>
            `;
            quotaText.style.color = '#4CAF50';
            
            // Ajouter l'event listener pour le bouton upgrade
            const upgradeLink = document.getElementById('upgradeLink');
            if (upgradeLink) {
                upgradeLink.addEventListener('click', function() {
                    chrome.windows.create({
                        url: chrome.runtime.getURL('payment.html'),
                        type: 'popup',
                        width: 600,
                        height: 800
                    });
                });
            }
        } else {
            // Utilisateur gratuit - afficher le quota utilisé
            const quotaUsed = result.dailyQuota || 0;
            quotaText.innerHTML = `<i class="fas fa-chart-pie"></i> Free quota: ${quotaUsed}/10 per day.`;
            
            // Changer la couleur en fonction du quota utilisé
            if (quotaUsed >= 8) {
                quotaText.style.color = '#dc2626';
            } else if (quotaUsed >= 5) {
                quotaText.style.color = '#f59e0b';
            } else {
                quotaText.style.color = '#4CAF50';
            }

            // Afficher le bouton d'upgrade si le quota est élevé
            const upgradeText = document.querySelector('.upgrade-text');
            if (upgradeText) {
                upgradeText.style.display = quotaUsed >= 7 ? 'block' : 'none';
            }

            // Si le quota est atteint, désactiver le bouton de téléchargement
            if (quotaUsed >= 10) {
                showNotification('Daily quota reached (10/10). Upgrade to Pro for unlimited downloads!', 'error');
            }
        }
    });
}

// Appeler cette fonction au chargement
document.addEventListener('DOMContentLoaded', function() {
    updateQuotaDisplay();
    loadHistory();
    loadHistory();
});

function loadHistory() {
    chrome.storage.local.get(['downloadHistory'], function(result) {
        const history = result.downloadHistory || [];
        
        if (history.length === 0) {
            historyBox.innerHTML = '<div class="no-history">No history yet</div>';
            return;
        }

        historyBox.innerHTML = history.map(item => `
            <div class="history-item">
                <img src="${item.thumbnail}" onerror="this.src='default-thumbnail.png'">
                <div class="history-info">
                    <div class="history-title">${item.title}</div>
                    <div class="history-date">${new Date(item.date).toLocaleDateString()}</div>
                </div>
            </div>
        `).join('');
    });
}

function setupQuotaRefresh() {
    // Vérifier si c'est un nouveau jour
    chrome.storage.local.get(['lastQuotaReset'], function(result) {
        const now = new Date().getTime();
        const lastReset = result.lastQuotaReset || 0;
        const dayInMs = 24 * 60 * 60 * 1000;

        if (now - lastReset > dayInMs) {
            chrome.storage.local.set({
                dailyQuota: 0,
                lastQuotaReset: now
            }, updateQuotaDisplay);
        }
    });
}

// Écouter les changements de storage pour mettre à jour l'interface
chrome.storage.onChanged.addListener(function(changes) {
    if (changes.dailyQuota) {
        updateQuotaDisplay();
    }
    if (changes.downloadHistory) {
        loadHistory();
    }
});

// Écouter les changements de storage pour mettre à jour l'interface
chrome.storage.onChanged.addListener(function(changes) {
    if (changes.dailyQuota) {
        // updateQuotaDisplay(); // Supprimer ou commenter cette ligne
    }
    if (changes.downloadHistory) {
        loadHistory();
    }
});

// checkAndResetQuota(); // Supprimer ou commenter cette ligne
// setInterval(checkAndResetQuota, 60000); // Supprimer ou commenter cette ligne

function showUserInfo(email) {
    const authModal = document.getElementById('authModal');
    const authContent = authModal.querySelector('.auth-content');
    
    // Récupérer les informations de l'utilisateur
    chrome.storage.local.get('userInfo', (result) => {
        const userInfo = result.userInfo || {};
        
        authContent.innerHTML = `
            <div class="auth-header">
                <h1 class="auth-title">Profile</h1>
                <span class="close-modal">&times;</span>
            </div>
            <div class="profile-info">
                <p>Username: ${userInfo.email}</p>
                <p>Password: ${userInfo.password}</p>
            </div>
            <button class="delete-btn" id="deleteAccountBtn" style="
                background-color: #dc2626;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                width: 100%;
                margin-top: 16px;
                font-weight: 500;
                transition: background-color 0.2s ease;
            ">
                Delete Account
            </button>
        `;

        // Réattacher les event listeners
        const closeModal = authContent.querySelector('.close-modal');
        if (closeModal) {
            closeModal.addEventListener('click', () => {
                authModal.style.display = 'none';
            });
        }

        const deleteBtn = document.getElementById('deleteAccountBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', handleDeleteAccount);
        }

        authModal.style.display = 'block';
    });
}

function showAuthForm() {
    const authModal = document.getElementById('authModal');
    const authContent = authModal.querySelector('.auth-content');
    
    authContent.innerHTML = `
        <div class="auth-header">
            <h1 class="auth-title" style="color: #4285f4;">Welcome to Grabbber</h1>
            <p class="auth-subtitle">Create an account to start downloading</p>
        </div>
        <form id="emailAuthForm" class="auth-form">
            <input type="email" placeholder="Email" required>
            <input type="password" placeholder="Password" required>
            <button type="submit" class="create-account-btn">
                Create Account
            </button>
        </form>
        <div class="auth-divider">
            <span>or</span>
        </div>
        <button id="googleAuthBtn" class="google-btn">
            <i class="fab fa-google" style="color: #4285f4;"></i>
            Sign up with Google
        </button>
    `;

    // Ajouter les styles pour le nouveau design
    const styles = `
        .auth-header {
            text-align: center;
            margin-bottom: 20px;
        }
        .auth-title {
            font-size: 24px;
            font-weight: bold;
            color: #1a1a1a;
            margin-bottom: 8px;
        }
        .auth-subtitle {
            color: #666;
            font-size: 14px;
        }
        .auth-form {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .create-account-btn {
            background: #3B82F6;
            color: white;
            padding: 12px;
            border-radius: 6px;
            border: none;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
        }
        .create-account-btn:hover {
            background: #2563EB;
        }
    `;

    if (!document.querySelector('#auth-styles')) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'auth-styles';
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }

    // Attacher les event listeners
    const form = document.getElementById('emailAuthForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = e.target.querySelector('input[type="email"]').value;
        const password = e.target.querySelector('input[type="password"]').value;

        try {
            const result = await auth.createUserWithEmailAndPassword(email, password);
            handleAuthSuccess(result.user, password);
            enableGrabberFunctionality();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    });

    // Afficher immédiatement le modal
    authModal.style.display = 'block';
}

async function handleDeleteAccount() {
    try {
        const user = auth.currentUser;
        if (user) {
            // Vérifier la méthode d'authentification utilisée
            const providers = user.providerData;
            let credential;

            if (providers[0].providerId === 'google.com') {
                // Ré-authentification avec Google
                const provider = new firebase.auth.GoogleAuthProvider();
                await user.reauthenticateWithPopup(provider);
            } else {
                // Pour l'authentification par email/password
                // Afficher un modal pour demander le mot de passe
                const password = await showPasswordConfirmDialog();
                credential = firebase.auth.EmailAuthProvider.credential(
                    user.email,
                    password
                );
                await user.reauthenticateWithCredential(credential);
            }

            // Procéder à la suppression
            await user.delete();
            
            // Nettoyer le stockage local
            chrome.storage.local.remove(['userInfo', 'proStatus']);
            
            // Restaurer l'interface par défaut
            resetInterface();
            
            showNotification('Account deleted successfully');
            showAuthForm();
        }
    } catch (error) {
        console.error('Delete Error:', error);
        showNotification('Error deleting account: ' + error.message, 'error');
    }
}

// Fonction pour afficher le dialog de confirmation du mot de passe
function showPasswordConfirmDialog() {
    return new Promise((resolve, reject) => {
        const authModal = document.getElementById('authModal');
        const authContent = authModal.querySelector('.auth-content');
        
        authContent.innerHTML = `
            <div class="auth-header">
                <h1 class="auth-title">Confirm Password</h1>
                <span class="close-modal">&times;</span>
            </div>
            <form id="passwordConfirmForm" class="auth-form">
                <p>Please enter your password to delete your account</p>
                <input type="password" placeholder="Password" required>
                <button type="submit" class="delete-confirm-btn" style="
                    background-color: #dc2626;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 6px;
                    cursor: pointer;
                    width: 100%;
                    margin-top: 16px;
                    font-weight: 500;
                    transition: background-color 0.2s ease;
                ">
                    Confirm Delete
                </button>
            </form>
        `;

        const form = document.getElementById('passwordConfirmForm');
        const closeBtn = authContent.querySelector('.close-modal');

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const password = e.target.querySelector('input[type="password"]').value;
            resolve(password);
            authModal.style.display = 'none';
        });

        closeBtn.addEventListener('click', () => {
            authModal.style.display = 'none';
            reject(new Error('Cancelled by user'));
        });

        authModal.style.display = 'block';
    });
}

// Fonction pour réinitialiser l'interface
function resetInterface() {
    const profileBtn = document.getElementById('profileBtn');
    if (profileBtn) {
        profileBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>
        `;
    }
}

function showGumroadModal() {
    // Ouvrir la page de paiement Gumroad dans une nouvelle fenêtre
    chrome.windows.create({
        url: 'https://grabbber.gumroad.com/l/znmdd',
        type: 'popup',
        width: 500,
        height: 700
    });
}

// Écouter les messages de Gumroad pour la confirmation d'achat
window.addEventListener('message', function(event) {
    if (event.data.purchaseComplete) {
        updateUIForProUser();
    }
});

function updateUIForProUser(startDate, endDate) {
    // Masquer les éléments gratuits
    const upgradeText = document.querySelector('.upgrade-text');
    if (upgradeText) {
        upgradeText.style.display = 'none';
    }

    const quotaText = document.querySelector('.quota-text');
    if (quotaText) {
        quotaText.innerHTML = '<i class="fas fa-infinity"></i> Pro Account: Unlimited downloads';
        quotaText.style.color = '#10B981';
    }

    // Activer les fonctionnalités Pro
    const modeToggle = document.getElementById('modeToggle');
    if (modeToggle) {
        modeToggle.disabled = false;
        modeToggle.parentElement.style.opacity = '1';
    }

    // Ajouter le badge Pro
    const header = document.querySelector('.header');
    if (header && !document.querySelector('.pro-badge')) {
        const proBadge = document.createElement('div');
        proBadge.className = 'pro-badge';
        proBadge.innerHTML = '<i class="fas fa-crown"></i> PRO';
        header.prepend(proBadge);
    }

    // Ajouter les informations d'abonnement
    const subscriptionInfo = document.createElement('div');
    subscriptionInfo.className = 'subscription-info';
    subscriptionInfo.innerHTML = `
        <div class="sub-details">
            <div class="sub-dates">
                <span><i class="fas fa-calendar-check"></i> Start: ${startDate}</span>
                <span><i class="fas fa-calendar-times"></i> End: ${endDate}</span>
            </div>
            <div class="sub-status">
                <i class="fas fa-check-circle"></i> Active
            </div>
        </div>
    `;

    // Ajouter les styles pour les nouvelles informations d'abonnement
    if (!document.querySelector('#pro-styles')) {
        const style = document.createElement('style');
        style.id = 'pro-styles';
        style.textContent = `
            .pro-badge {
                background: linear-gradient(135deg, #10B981 0%, #3B82F6 100%);
                color: white;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: bold;
                display: flex;
                align-items: center;
                gap: 6px;
                animation: slideIn 0.3s ease;
            }
            .subscription-info {
                margin-top: 16px;
                background: #f8fafc;
                border-radius: 8px;
                padding: 12px;
            }
            .sub-details {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .sub-dates {
                display: flex;
                justify-content: space-between;
                font-size: 12px;
                color: #64748b;
            }
            .sub-status {
                color: #10B981;
                font-weight: 500;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            @keyframes slideIn {
                from { transform: translateY(-10px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    // Ajouter les informations d'abonnement à l'interface
    const container = document.querySelector('.container');
    if (container) {
        const existingInfo = document.querySelector('.subscription-info');
        if (existingInfo) {
            existingInfo.remove();
        }
        container.appendChild(subscriptionInfo);
    }

    // Afficher une notification de bienvenue
    showNotification('Welcome to Grabbber Pro! Enjoy unlimited downloads!', 'success');
}

// Fonction pour vérifier le statut de l'abonnement
async function checkSubscriptionStatus() {
    try {
        const user = auth.currentUser;
        if (!user) {
            disableProFeatures();
            return;
        }

        // Vérifier d'abord dans le stockage local
        const { isPremium, premiumEndDate, lastVerification } = await new Promise(resolve => {
            chrome.storage.local.get(['isPremium', 'premiumEndDate', 'lastVerification'], resolve);
        });

        const now = Date.now();

        // Si nous avons vérifié il y a moins d'une heure et que l'abonnement est toujours valide
        if (lastVerification && now - lastVerification < 3600000 && isPremium && premiumEndDate > now) {
            enableProFeatures();
            return;
        }

        // Vérifier avec Firebase
        const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
        const userData = userDoc.data();

        if (userData && userData.isPremium && userData.premiumEndDate > now) {
            // Mettre à jour le stockage local
            chrome.storage.local.set({
                isPremium: true,
                premiumStartDate: userData.premiumStartDate,
                premiumEndDate: userData.premiumEndDate,
                subscriptionType: userData.subscriptionType,
                lastVerification: now
            });

            // Vérifier avec le serveur
            const response = await fetch('https://grabbber.onrender.com/api/verify-subscription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await user.getIdToken()}`
                }
            });

            const data = await response.json();

            if (data.valid) {
                enableProFeatures();
                updateProBadge(true);
                updateSubscriptionInfo(
                    new Date(userData.premiumStartDate).toLocaleDateString(),
                    new Date(userData.premiumEndDate).toLocaleDateString()
                );
            } else {
                await firebase.firestore().collection('users').doc(user.uid).update({
                    isPremium: false,
                    lastVerification: now
                });
                disableProFeatures();
                showNotification('Your premium subscription has expired', 'error');
            }
        } else {
            disableProFeatures();
            chrome.storage.local.set({
                isPremium: false,
                lastVerification: now
            });
        }
    } catch (error) {
        console.error('Error checking subscription:', error);
        showNotification('Error checking subscription status', 'error');
    }
}

// Activer les fonctionnalités Pro
function enableProFeatures() {
    // Activer le toggle AI
    const modeToggle = document.getElementById('modeToggle');
    if (modeToggle) {
        modeToggle.disabled = false;
    }

    // Masquer le texte de quota et le bouton upgrade
    const quotaText = document.querySelector('.quota-text');
    if (quotaText) {
        quotaText.style.display = 'none';
    }

    const upgradeText = document.querySelector('.upgrade-text');
    if (upgradeText) {
        upgradeText.style.display = 'none';
    }

    // Afficher le bouton Billing
    const billingButton = document.querySelector('.billing-button');
    if (billingButton) {
        billingButton.style.display = 'flex';
    }
}

// Désactiver les fonctionnalités Pro
function disableProFeatures() {
    // Désactiver le toggle AI
    const modeToggle = document.getElementById('modeToggle');
    if (modeToggle) {
        modeToggle.disabled = true;
        modeToggle.checked = false;
    }

    // Afficher le texte de quota et le bouton upgrade
    const quotaText = document.querySelector('.quota-text');
    if (quotaText) {
        quotaText.style.display = 'block';
        quotaText.textContent = `Free quota: ${quota}/10 per day.`;
    }

    const upgradeText = document.querySelector('.upgrade-text');
    if (upgradeText) {
        upgradeText.style.display = 'flex';
    }

    // Masquer le bouton Billing
    const billingButton = document.querySelector('.billing-button');
    if (billingButton) {
        billingButton.style.display = 'none';
    }

    // Réinitialiser le statut Pro dans le storage
    chrome.storage.local.remove('proStatus');
}

function disableGrabberFunctionality() {
    // Désactiver le bouton de téléchargement
    const downloadButton = document.querySelector('.download-button');
    if (downloadButton) {
        downloadButton.style.opacity = '0.5';
        downloadButton.style.cursor = 'not-allowed';
        
        // Ajouter l'event listener pour le message
        downloadButton.addEventListener('click', (e) => {
            e.preventDefault();
            showNotification('Create account first', 'error');
        });
    }

    // Désactiver le toggle AI
    const modeToggle = document.getElementById('modeToggle');
    if (modeToggle) {
        modeToggle.disabled = true;
        modeToggle.checked = false;
    }
}

function enableGrabberFunctionality() {
    // Activer le bouton de téléchargement
    const downloadButton = document.querySelector('.download-button');
    if (downloadButton) {
        downloadButton.style.opacity = '1';
        downloadButton.style.cursor = 'pointer';
        
        // Supprimer l'ancien event listener et ajouter le nouveau
        downloadButton.replaceWith(downloadButton.cloneNode(true));
        document.querySelector('.download-button').addEventListener('click', handleDownload);
    }

    // Réactiver le toggle AI (si l'utilisateur est Pro)
    chrome.storage.local.get('proStatus', (result) => {
        const modeToggle = document.getElementById('modeToggle');
        if (modeToggle && result.proStatus && result.proStatus.active) {
            modeToggle.disabled = false;
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    const upgradeLink = document.querySelector('.upgrade-pro-link');
    if (upgradeLink) {
        upgradeLink.addEventListener('click', function() {
            chrome.windows.create({
                url: chrome.runtime.getURL('payment.html'),
                type: 'popup',
                width: 600,
                height: 800
            });
        });
    }
});

function updateProStatus() {
    chrome.storage.local.get(['isPro', 'subscriptionStart', 'subscriptionEnd'], function(result) {
        const quotaText = document.querySelector('.quota-text');
        const upgradeLink = document.getElementById('upgradeLink');
        const activateCodeBtn = document.getElementById('activateCodeBtn');
        const subscriptionInfo = document.getElementById('subscriptionInfo');
        const proButtons = document.querySelector('.pro-buttons');

        if (result.isPro) {
            // Afficher le statut premium
            quotaText.firstChild.textContent = 'Pro Account: Unlimited downloads';
            proButtons.style.display = 'none';

            // Calculer les jours restants
            const endDate = new Date(result.subscriptionEnd);
            const now = new Date();
            const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

            // Formater les dates
            const startDate = new Date(result.subscriptionStart).toLocaleDateString();
            const endDateStr = endDate.toLocaleDateString();

            // Afficher les informations d'abonnement
            subscriptionInfo.textContent = `Subscribed: ${startDate} - ${daysLeft} days left - Expires: ${endDateStr}`;
            subscriptionInfo.style.display = 'block';

            // Si l'abonnement a expiré
            if (daysLeft <= 0) {
                chrome.storage.local.set({isPro: false}, function() {
                    updateProStatus(); // Mettre à jour l'interface
                });
            }
        } else {
            // Afficher le statut gratuit
            quotaText.innerHTML = '<i class="fas fa-chart-pie"></i> Free quota: 0/10 per day.';
            proButtons.style.display = 'flex';
            subscriptionInfo.style.display = 'none';
        }
    });
}

// Gestionnaire pour le bouton d'activation de code
document.getElementById('activateCodeBtn').addEventListener('click', function() {
    const modal = document.getElementById('codeModal');
    modal.style.display = 'block';
});

// Gestionnaire pour fermer la modale
document.querySelector('.close-modal').addEventListener('click', function() {
    document.getElementById('codeModal').style.display = 'none';
});

// Fermer la modale en cliquant en dehors
window.addEventListener('click', function(event) {
    const modal = document.getElementById('codeModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
});

async function activateCode(code) {
    try {
        const userEmail = firebase.auth().currentUser.email;
        if (!userEmail) {
            throw new Error('Utilisateur non connecté');
        }

        const codeRef = firebase.firestore().collection('premium_codes').doc(code.toUpperCase());
        const codeDoc = await codeRef.get();

        if (!codeDoc.exists) {
            throw new Error('Code invalide');
        }

        const codeData = codeDoc.data();
        const now = new Date();

        if (codeData.usedAt) {
            throw new Error('Code déjà utilisé');
        }

        if (now > codeData.expiresAt.toDate()) {
            throw new Error('Code expiré');
        }

        let expiresAt; // Déclarer la variable ici
        
        // Transaction Firestore pour l'activation
        await firebase.firestore().runTransaction(async (transaction) => {
            // Mettre à jour le code
            transaction.update(codeRef, {
                usedAt: firebase.firestore.FieldValue.serverTimestamp(),
                usedBy: userEmail,
                active: false
            });

            // Mettre à jour le statut premium de l'utilisateur
            const userRef = firebase.firestore().collection('users').doc(userEmail);
            expiresAt = new Date(); // Utiliser la variable déclarée plus haut
            expiresAt.setDate(expiresAt.getDate() + 30); // 30 jours de premium

            transaction.set(userRef, {
                isPro: true,
                premiumActivatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                premiumExpiresAt: expiresAt,
                activationCode: code
            }, { merge: true });
        });

        // Mettre à jour le stockage local
        chrome.storage.local.set({ isPro: true, subscriptionEnd: expiresAt.toISOString() });

        return { success: true, expiresAt: expiresAt.toISOString() };
    } catch (error) {
        console.error('Erreur d\'activation:', error);
        throw error;
    }
}

// Fonction pour vérifier le statut premium
async function checkPremiumStatus() {
    try {
        const userEmail = firebase.auth().currentUser.email;
        if (!userEmail) return false;

        const userDoc = await firebase.firestore().collection('users').doc(userEmail).get();
        if (!userDoc.exists) return false;

        const userData = userDoc.data();
        const now = new Date();
        const expiresAt = userData.premiumExpiresAt?.toDate();

        const isPro = userData.isPro && expiresAt && now < expiresAt;

        // Mettre à jour le stockage local
        chrome.storage.local.set({
            isPro: isPro,
            subscriptionEnd: expiresAt?.toISOString()
        });

        return isPro;
    } catch (error) {
        console.error('Erreur de vérification du statut premium:', error);
        return false;
    }
}

// Gestionnaire pour le bouton de soumission du code
document.getElementById('submitCode').addEventListener('click', async function() {
    const codeInput = document.getElementById('premiumCode');
    const code = codeInput.value.trim();

    if (!code) {
        showNotification('Please enter a valid code', 'error');
        return;
    }

    try {
        const result = await activateCode(code);
        showNotification('Premium access activated successfully!');
        document.getElementById('codeModal').style.display = 'none';
        codeInput.value = '';
        updateProStatus();
    } catch (error) {
        showNotification(error.message, 'error');
    }
});

// Fonction pour gérer le clic sur le toggle
function handleToggleClick(e) {
    e.preventDefault();
    
    // Show notification with the premium message
    showNotification('Upgrade to Lifetime Plan to unlock unlimited Grabbber! Get exclusive access to Al agents and download as many videos as you want for life without restrictions !', 'success');
    
    // Ouvrir payment.html
    chrome.windows.create({
        url: chrome.runtime.getURL('payment.html'),
        type: 'popup',
        width: 600,
        height: 800
    });
}

// Call on load and daily
updateProStatus();
setInterval(updateProStatus, 86400000);

// Handle refresh message from payment page and quota updates
chrome.runtime.onMessage.addListener(function(request) {
    if (request.action === "refreshPopup") {
        updateProStatus();
    } else if (request.action === "updateQuota") {
        updateQuotaDisplay();
    }
});

// Ajouter ces fonctions pour gérer dynamiquement le badge Pro
function updateProBadge(isPro) {
    const proBadge = document.createElement('div');
    proBadge.className = 'pro-badge';
    proBadge.innerHTML = '<i class="fas fa-crown"></i> PRO';
    document.querySelector('.header').prepend(proBadge);
}

function updateSubscriptionInfo(startDate, endDate) {
    const subInfo = document.createElement('div');
    subInfo.className = 'subscription-info';
    subInfo.innerHTML = `Subscribed: ${startDate} - Expires: ${endDate}`;
    document.querySelector('.header').append(subInfo);
}