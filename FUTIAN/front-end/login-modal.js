(function () {
    // Create the modal HTML
    const modalHTML = `
        <div id="login-modal-overlay" class="modal-overlay">
            <div class="modal-box login-modal-box">
                <img src="Futia_LogoX.png" alt="Futia Logo" class="login-modal-logo">
                <h2 class="login-modal-title">Coming Soon</h2>
                <p class="login-modal-subtitle">We're working hard to bring you a secure and seamless login experience. Stay tuned!</p>
                <button id="login-modal-close" class="login-modal-close-btn">Got it</button>
            </div>
        </div>
    `;

    // Append to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const loginBtn = document.getElementById('login-signup-btn');
    const loginModalOverlay = document.getElementById('login-modal-overlay');
    const loginModalClose = document.getElementById('login-modal-close');

    if (loginBtn && loginModalOverlay && loginModalClose) {
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            loginModalOverlay.classList.add('show');
        });

        loginModalClose.addEventListener('click', (e) => {
            e.stopPropagation();
            loginModalOverlay.classList.remove('show');
        });

        loginModalOverlay.addEventListener('click', (e) => {
            if (e.target === loginModalOverlay) {
                e.stopPropagation();
                loginModalOverlay.classList.remove('show');
            }
        });
    }
})();
