// Gestionnaire pour les boutons d'achat
document.addEventListener('DOMContentLoaded', function() {
    // Gestionnaire pour le plan mensuel
    const monthlyButton = document.querySelector('.plan-buy-button:not(.plan-buy-button-lifetime)');
    if (monthlyButton) {
        monthlyButton.addEventListener('click', function(e) {
            e.preventDefault();
            const overlay = createOverlay('payment_confirm_monthly.html');
            document.body.appendChild(overlay);
        });
    }

    // Gestionnaire pour le plan lifetime
    const lifetimeButton = document.querySelector('.plan-buy-button-lifetime');
    if (lifetimeButton) {
        lifetimeButton.addEventListener('click', function(e) {
            e.preventDefault();
            const overlay = createOverlay('payment_confirm_lifetime.html');
            document.body.appendChild(overlay);
        });
    }
});

// Fonction pour créer l'overlay
function createOverlay(url) {
    const overlay = document.createElement('div');
    overlay.className = 'payment-overlay';
    overlay.innerHTML = `
        <div class="overlay-content">
            <button class="close-overlay">&times;</button>
            <iframe src="${url}" frameborder="0"></iframe>
        </div>
    `;

    // Ajouter le style de l'overlay s'il n'existe pas déjà
    if (!document.querySelector('#overlay-style')) {
        const style = document.createElement('style');
        style.id = 'overlay-style';
        style.textContent = `
            .payment-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.75);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                animation: fadeIn 0.3s ease;
            }
            .overlay-content {
                position: relative;
                width: 90%;
                max-width: 800px;
                height: 90vh;
                background: white;
                border-radius: 12px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                animation: slideIn 0.3s ease;
            }
            .overlay-content iframe {
                width: 100%;
                height: 100%;
                border-radius: 12px;
            }
            .close-overlay {
                position: absolute;
                top: -40px;
                right: 0;
                background: white;
                border: none;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                font-size: 20px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            .close-overlay:hover {
                background: #f1f5f9;
            }
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideIn {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    // Gestionnaire pour fermer l'overlay
    const closeButton = overlay.querySelector('.close-overlay');
    closeButton.addEventListener('click', () => {
        overlay.remove();
    });

    // Fermer l'overlay en cliquant en dehors du contenu
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });

    return overlay;
}

// Fonction pour afficher les notifications
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    if (!document.querySelector('#notification-style')) {
        const style = document.createElement('style');
        style.id = 'notification-style';
        style.textContent = `
            .notification {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                padding: 12px 24px;
                border-radius: 8px;
                color: white;
                font-weight: 500;
                z-index: 10000;
                animation: slideUp 0.3s ease;
            }
            .notification.success { background-color: #10B981; }
            .notification.error { background-color: #EF4444; }
            @keyframes slideUp {
                from { transform: translate(-50%, 100%); opacity: 0; }
                to { transform: translate(-50%, 0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    setTimeout(() => {
        notification.remove();
    }, 3000);
}
