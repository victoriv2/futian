// FUTIAN Front-end - Updated for Railway backend
// Note: Ensure BASE_URL is set on Railway for image paths
// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchContainer = document.querySelector('.search-container');
const menuButton = document.querySelector('.menu-button');
const container = document.querySelector('.container');
const sidebar = document.querySelector('.sidebar');

const sendButton = document.getElementById('send-button');
const chatContainer = document.getElementById('chat-container');
const chatMessages = document.querySelector('.chat-messages');
const newChatButton = document.querySelector('.new-chat-button');
const historyList = document.getElementById('history-list');

const renameOverlay = document.getElementById('rename-modal-overlay');
const deleteOverlay = document.getElementById('delete-modal-overlay');
const renameInput = document.getElementById('rename-input');
const confirmRenameBtn = document.getElementById('confirm-rename-btn');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const renameCancelBtn = document.getElementById('rename-cancel-btn');
const deleteCancelBtn = document.getElementById('delete-cancel-btn');

const globalSearchBtn = document.getElementById('global-search-btn');
const globalSearchOverlay = document.getElementById('global-search-modal-overlay');
const globalSearchInput = document.getElementById('global-search-input');
const globalSearchResults = document.getElementById('global-search-results');
const globalSearchCloseBtn = document.getElementById('global-search-close-btn');

// Search Library Modal Elements
const searchLibraryBtn = document.querySelectorAll('.sidebar-button')[3]; // "Search Library" button (4th button)
const searchLibraryOverlay = document.getElementById('search-library-modal-overlay');
const searchLibraryQuestions = document.getElementById('search-library-questions');
const searchLibraryCloseBtn = document.getElementById('search-library-close-btn');
let suggestedQuestions = [];

// Settings Modal Elements
const settingsBtn = document.querySelector('.sidebar-footer .sidebar-button:first-child');
const settingsOverlay = document.getElementById('settings-modal-overlay');
const settingsCloseBtn = document.getElementById('settings-close-btn');

if (settingsBtn && settingsOverlay && settingsCloseBtn) {
    const settingsNavPanel = document.getElementById('settings-nav-panel');
    const settingsContentPanel = document.getElementById('settings-content-panel');
    const settingsNavBtns = document.querySelectorAll('.settings-nav-btn');
    const settingsContentSections = document.querySelectorAll('.settings-content-section');
    const settingsBackBtns = document.querySelectorAll('.settings-back-btn');
    const deleteAllChatsBtn = document.getElementById('delete-all-chats-btn');

    // Check if we're on mobile
    const isMobile = () => window.innerWidth <= 800;

    // Function to show a section
    const showSection = (sectionName) => {
        // Remove active class from all nav buttons
        settingsNavBtns.forEach(btn => btn.classList.remove('active'));

        // Hide all content sections
        settingsContentSections.forEach(section => section.classList.remove('active'));

        // Find and activate the clicked nav button
        const activeNavBtn = document.querySelector(`.settings-nav-btn[data-section="${sectionName}"]`);
        if (activeNavBtn) {
            activeNavBtn.classList.add('active');
        }

        // Find and show the corresponding content section
        const activeSection = document.querySelector(`.settings-content-section[data-section="${sectionName}"]`);
        if (activeSection) {
            activeSection.classList.add('active');
        }

        // Mobile: Hide nav panel and show content panel
        if (isMobile()) {
            settingsNavPanel.classList.add('mobile-hidden');
            settingsContentPanel.classList.add('mobile-visible');
        }
    };

    // Function to go back to nav panel (mobile only)
    const goBackToNav = () => {
        if (isMobile()) {
            settingsNavPanel.classList.remove('mobile-hidden');
            settingsContentPanel.classList.remove('mobile-visible');
        }
    };

    // Open settings modal
    settingsBtn.addEventListener('click', () => {
        settingsOverlay.classList.add('show');

        // Reset mobile states
        settingsNavPanel.classList.remove('mobile-hidden');
        settingsContentPanel.classList.remove('mobile-visible');

        // Show appearance section by default (desktop only)
        if (!isMobile()) {
            showSection('appearance');
        }
    });

    // Close settings modal
    settingsCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsOverlay.classList.remove('show');
        // Reset mobile states
        goBackToNav();
    });

    settingsOverlay.addEventListener('click', (e) => {
        if (e.target === settingsOverlay) {
            e.stopPropagation();
            settingsOverlay.classList.remove('show');
            // Reset mobile states
            goBackToNav();
        }
    });

    // Add click listeners to all nav buttons
    settingsNavBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.getAttribute('data-section');
            if (section) {
                showSection(section);
            }
        });
    });

    // Add click listeners to all back buttons
    settingsBackBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            goBackToNav();
        });
    });

    // --- THEME SWITCHING FUNCTIONALITY ---
    const themeButtons = document.querySelectorAll('.theme-option-btn[data-theme]');
    const lightModeStylesheet = document.getElementById('light-mode-stylesheet');

    // Function to apply theme
    const applyTheme = (theme) => {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        let shouldUseLightMode = false;

        if (theme === 'light') {
            shouldUseLightMode = true;
        } else if (theme === 'dark') {
            shouldUseLightMode = false;
        } else if (theme === 'system') {
            shouldUseLightMode = !prefersDark;
        }

        // Apply or remove light mode
        if (shouldUseLightMode) {
            if (lightModeStylesheet) lightModeStylesheet.disabled = false;
            document.documentElement.classList.add('light-mode');
        } else {
            if (lightModeStylesheet) lightModeStylesheet.disabled = true;
            document.documentElement.classList.remove('light-mode');
        }

        // Update button selected states
        themeButtons.forEach(btn => {
            if (btn.getAttribute('data-theme') === theme) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
    };

    // Initialize theme from localStorage
    const initTheme = () => {
        const savedTheme = localStorage.getItem('futianTheme') || 'system';
        applyTheme(savedTheme);
    };

    // Add click listeners to theme buttons
    themeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.getAttribute('data-theme');
            localStorage.setItem('futianTheme', theme);
            applyTheme(theme);
        });
    });

    // Listen for system theme changes (for 'system' mode)
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            const savedTheme = localStorage.getItem('futianTheme') || 'system';
            if (savedTheme === 'system') {
                applyTheme('system');
            }
        });
    }

    // Initialize theme on page load
    initTheme();

    // Delete all chats button handler
    if (deleteAllChatsBtn) {
        deleteAllChatsBtn.addEventListener('click', () => {
            const deleteAllOverlay = document.getElementById('delete-all-modal-overlay');
            const confirmDeleteAllBtn = document.getElementById('confirm-delete-all-btn');
            const deleteAllCancelBtn = document.getElementById('delete-all-cancel-btn');

            if (deleteAllOverlay && confirmDeleteAllBtn && deleteAllCancelBtn) {
                deleteAllOverlay.classList.add('show');

                const closeDeleteAllModal = () => {
                    deleteAllOverlay.classList.remove('show');
                };

                deleteAllCancelBtn.onclick = (e) => {
                    e.stopPropagation();
                    closeDeleteAllModal();
                };

                deleteAllOverlay.onclick = (e) => {
                    if (e.target === deleteAllOverlay) {
                        e.stopPropagation();
                        closeDeleteAllModal();
                    }
                };

                confirmDeleteAllBtn.onclick = (e) => {
                    e.stopPropagation();
                    localStorage.removeItem('futianChatHistory');
                    resetChat();
                    renderHistorySidebar();
                    closeDeleteAllModal();
                    settingsOverlay.classList.remove('show');
                };
            }
        });
    }

    // Handle window resize
    window.addEventListener('resize', () => {
        // If switching from mobile to desktop, reset mobile states
        if (!isMobile()) {
            settingsNavPanel.classList.remove('mobile-hidden');
            settingsContentPanel.classList.remove('mobile-visible');
            // Show appearance by default if no section is active
            const hasActiveSection = Array.from(settingsContentSections).some(
                section => section.classList.contains('active')
            );
            if (!hasActiveSection) {
                showSection('appearance');
            }
        }
    });
}



let targetChatId = null;

const initialHeight = searchInput.scrollHeight;
let currentChatId = null;
let selectedChatIdFromSearch = null;

// Abort controller for stopping bot responses
let currentAbortController = null;
let isGenerating = false;

const debounce = (func, delay) => {
    let timeoutId;
    return function (...args) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
};

const highlightMatch = (text, query) => {
    if (!query) return text;
    const safeQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp('(' + safeQuery + ')', 'gi');
    return text.replace(regex, '<strong>$1</strong>');
};

// --- DESKTOP/TABLET SIDEBAR STATE PERSISTENCE ---
// Initialize sidebar state from localStorage
const initSidebarState = () => {
    const width = window.innerWidth;

    // Desktop (>800px)
    if (width > 800) {
        const isCollapsed = localStorage.getItem('futianSidebarCollapsed') === 'true';
        if (isCollapsed) {
            sidebar.classList.add('collapsed');
            container.classList.add('expanded');
        } else {
            sidebar.classList.remove('collapsed');
            container.classList.remove('expanded');
        }
        // Remove the FOUC prevention class now that JS has loaded
        document.documentElement.classList.remove('sidebar-collapsed-preference');
    }
};

// Call on page load
initSidebarState();

menuButton.addEventListener('click', (event) => {
    const width = window.innerWidth;

    // Desktop (>800px): Toggle collapsed/expanded
    if (width > 800) {
        container.classList.toggle('expanded');
        sidebar.classList.toggle('collapsed');

        // Save state to localStorage
        const isNowCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('futianSidebarCollapsed', isNowCollapsed.toString());

        // Reset scroll if we just collapsed it
        if (isNowCollapsed) {
            const sidebarContent = document.querySelector('.sidebar-content');
            if (sidebarContent) sidebarContent.scrollTop = 0;
        }
    }
    // Mobile (<=800px): Toggle active class (off-canvas)
    else {
        sidebar.classList.toggle('active');
        event.stopPropagation();

        // Reset scroll if we just closed it (removed active class)
        if (!sidebar.classList.contains('active')) {
            const sidebarContent = document.querySelector('.sidebar-content');
            if (sidebarContent) sidebarContent.scrollTop = 0;
        }
    }
});

document.addEventListener('click', (event) => {
    const isModalActive = renameOverlay.classList.contains('show') ||
        deleteOverlay.classList.contains('show') ||
        globalSearchOverlay.classList.contains('show') ||
        (settingsOverlay && settingsOverlay.classList.contains('show'));

    const isClickInsideSidebar = sidebar.contains(event.target);
    const isClickOnMenuButton = menuButton.contains(event.target);
    const width = window.innerWidth;

    // Mobile (<=800px): Close sidebar when clicking outside
    if (width <= 800) {
        if (sidebar.classList.contains('active') && !isClickInsideSidebar && !isClickOnMenuButton && !isModalActive) {
            sidebar.classList.remove('active');
            const sidebarContent = document.querySelector('.sidebar-content');
            if (sidebarContent) sidebarContent.scrollTop = 0;
        }
    }

    // Close history menu when clicking outside
    if (!event.target.closest('.history-options-btn') && !event.target.closest('.history-menu')) {
        document.querySelectorAll('.history-menu').forEach(menu => {
            menu.classList.remove('show');
        });
        // Remove menu-open highlight from all wrappers
        document.querySelectorAll('.history-wrapper.menu-open').forEach(wrapper => {
            wrapper.classList.remove('menu-open');
        });
    }
});

window.addEventListener('resize', () => {
    const width = window.innerWidth;

    // Clean up classes when switching between Desktop and Mobile
    if (width > 800) {
        // Desktop: Remove mobile active class
        sidebar.classList.remove('active');
    } else {
        // Mobile: Ensure desktop collapsed/expanded logic doesn't interfere if needed
        // (Usually fine as CSS handles the display, but good to know)
    }
});

const copyToClipboard = (button, text) => {
    navigator.clipboard.writeText(text).then(() => {
        const originalContent = button.innerHTML;
        button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="action-icon"><path d="M20 6 9 17l-5-5"/></svg> Copied!`;
        button.disabled = true;
        setTimeout(() => {
            button.innerHTML = originalContent;
            button.disabled = false;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
};

// History Header Button Logic
const historyHeaderBtn = document.getElementById('history-header');
const historyMainBtn = document.getElementById('history-main-btn');
const historyToggleBtn = document.getElementById('history-toggle-btn');
const historyChevron = document.getElementById('history-chevron');
const historyToggleText = document.getElementById('history-toggle-text');

// Initialize history visibility from localStorage
const initHistoryVisibility = () => {
    const isHistoryHidden = localStorage.getItem('futianHistoryHidden') === 'true';
    if (isHistoryHidden) {
        historyList.classList.add('hidden');
        if (historyChevron) {
            // Change to chevron-up (hidden state)
            historyChevron.innerHTML = '<path d="m18 15-6-6-6 6"/>';
        }
        if (historyToggleText) {
            historyToggleText.textContent = 'Show';
        }
    } else {
        historyList.classList.remove('hidden');
        if (historyChevron) {
            // Chevron-down (visible state)
            historyChevron.innerHTML = '<path d="m6 9 6 6 6-6"/>';
        }
        if (historyToggleText) {
            historyToggleText.textContent = 'Hide';
        }
    }
};

// Call on page load
initHistoryVisibility();

// Main button click - scroll to history section
if (historyMainBtn) {
    historyMainBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent closing sidebar if clicking inside

        // 1. Open sidebar if on mobile/collapsed
        const width = window.innerWidth;
        if (width <= 800) {
            sidebar.classList.add('active');
        } else {
            // Expand sidebar on desktop if collapsed
            if (sidebar.classList.contains('collapsed')) {
                sidebar.classList.remove('collapsed');
                container.classList.remove('expanded');
                localStorage.setItem('futianSidebarCollapsed', 'false');
            }
        }

        // 2. Scroll to history section
        const sidebarContent = document.querySelector('.sidebar-content');
        if (sidebarContent && historyHeaderBtn) {
            const targetPosition = historyHeaderBtn.offsetTop;
            sidebarContent.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    });
}

// Toggle button click - hide/show history list
if (historyToggleBtn) {
    historyToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent closing sidebar if clicking inside

        // Toggle history visibility
        const isCurrentlyHidden = historyList.classList.contains('hidden');

        if (isCurrentlyHidden) {
            // Show history
            historyList.classList.remove('hidden');
            localStorage.setItem('futianHistoryHidden', 'false');
            if (historyChevron) {
                // Chevron-down (visible state)
                historyChevron.innerHTML = '<path d="m6 9 6 6 6-6"/>';
            }
            if (historyToggleText) {
                historyToggleText.textContent = 'Hide';
            }
        } else {
            // Hide history
            historyList.classList.add('hidden');
            localStorage.setItem('futianHistoryHidden', 'true');
            if (historyChevron) {
                // Chevron-up (hidden state)
                historyChevron.innerHTML = '<path d="m18 15-6-6-6 6"/>';
            }
            if (historyToggleText) {
                historyToggleText.textContent = 'Show';
            }
        }
    });
}

const autoExpandInput = () => {
    searchInput.style.height = 'auto';
    const currentScrollHeight = searchInput.scrollHeight;
    searchInput.style.height = `${currentScrollHeight}px`;
    if (currentScrollHeight > initialHeight) {
        searchContainer.classList.add('expanded');
    } else {
        searchContainer.classList.remove('expanded');
    }
};

const editMessage = (messageElement) => {
    const textToEdit = messageElement.textContent;
    searchInput.value = textToEdit;
    autoExpandInput();
    searchInput.focus();
    // Message wrapper stays visible - not removed
};

const renderUserMessage = (text) => {
    const userMessageWrapper = document.createElement('div');
    userMessageWrapper.classList.add('user-message-wrapper');
    const userMessage = document.createElement('div');
    userMessage.classList.add('message', 'user-message');
    userMessage.textContent = text;
    const actionsContainer = document.createElement('div');
    actionsContainer.classList.add('message-actions');
    const copyButton = document.createElement('button');
    copyButton.classList.add('action-button');
    copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="action-icon"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg> Copy`;
    copyButton.addEventListener('click', () => {
        copyToClipboard(copyButton, userMessage.textContent);
    });
    const editButton = document.createElement('button');
    editButton.classList.add('action-button');
    editButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="action-icon"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"/></svg> Edit`;
    editButton.addEventListener('click', () => {
        editMessage(userMessage);
    });
    actionsContainer.appendChild(copyButton);
    actionsContainer.appendChild(editButton);
    userMessageWrapper.appendChild(userMessage);
    userMessageWrapper.appendChild(actionsContainer);
    chatMessages.appendChild(userMessageWrapper);
    userMessage.addEventListener('click', () => {
        userMessageWrapper.classList.toggle('active');
        if (userMessageWrapper.classList.contains('active')) {
            setTimeout(() => {
                userMessageWrapper.classList.remove('active');
            }, 5000);
        }
    });
}
const createBotMessageElement = (text) => {
    const botMessageWrapper = document.createElement('div');
    botMessageWrapper.classList.add('bot-message-wrapper');
    // Store raw text for history replacement
    botMessageWrapper.dataset.rawText = text;
    const botMessage = document.createElement('div');
    botMessage.classList.add('message', 'bot-message');

    // Use marked library to parse Markdown (handles bold, tables, etc.)
    // Configure marked to preserve absolute URLs
    marked.setOptions({
        baseUrl: 'http://localhost:8000/',
        breaks: true
    });

    // --- Robust Math Handling with Placeholders ---
    const mathBlocks = [];

    // Helper to store math and return placeholder
    const storeMath = (math, isDisplay) => {
        const id = `MATH_BLOCK_${mathBlocks.length}`;
        mathBlocks.push({ id, math, isDisplay });
        return id;
    };

    let processedText = text;

    // A. Handle standard block math $$ ... $$
    processedText = processedText.replace(/\$\$([\s\S]*?)\$\$/g, (match, content) => {
        return storeMath(content, true);
    });

    // B. Handle LaTeX block math \[ ... \]
    processedText = processedText.replace(/\\\[([\s\S]*?)\\\]/g, (match, content) => {
        return storeMath(content, true);
    });

    // C. Handle "AI style" block math [ ... ]
    processedText = processedText.replace(/\[\s*([\s\S]*?)\s*\](?!\()/g, (match, content) => {
        if (content.includes('\\')) {
            return storeMath(content, true);
        }
        return match;
    });

    // D. Handle LaTeX inline math \( ... \)
    processedText = processedText.replace(/\\\(([\s\S]*?)\\\)/g, (match, content) => {
        return storeMath(content, false);
    });

    // E. Handle "AI style" inline math ( ... )
    processedText = processedText.replace(/\(([^)]*?\\.[^)]*?)\)/g, (match, content) => {
        return storeMath(content, false);
    });

    // F. Handle single dollar inline math $ ... $
    processedText = processedText.replace(/(?<!\$)\$(?!\$)([^$\n]+?)(?<!\$)\$(?!\$)/g, (match, content) => {
        return storeMath(content, false);
    });

    // Parse Markdown
    let htmlContent = marked.parse(processedText);

    // Restore Math
    mathBlocks.forEach(({ id, math, isDisplay }) => {
        const delimiter = isDisplay ? '$$' : '\\(';
        const closer = isDisplay ? '$$' : '\\)';
        htmlContent = htmlContent.replace(id, `${delimiter}${math}${closer}`);
    });

    botMessage.innerHTML = htmlContent;

    // Render Math (KaTeX)
    if (window.renderMathInElement) {
        renderMathInElement(botMessage, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '\\(', right: '\\)', display: false },
                { left: '$', right: '$', display: false }
            ],
            throwOnError: false
        });
    }

    // --- Image Grid Logic ---
    const allParagraphs = botMessage.querySelectorAll('p');
    allParagraphs.forEach(p => {
        const images = Array.from(p.querySelectorAll('img'));
        if (images.length > 1) {
            const grid = document.createElement('div');
            grid.className = 'image-grid';
            grid.classList.add(`img-count-${images.length}`);
            const clone = p.cloneNode(true);
            clone.querySelectorAll('img').forEach(img => img.remove());
            const text = clone.textContent.trim();
            if (text.length < 5) {
                images.forEach(img => grid.appendChild(img));
                p.parentNode.replaceChild(grid, p);
            } else {
                images.forEach(img => grid.appendChild(img));
                p.parentNode.insertBefore(grid, p.nextSibling);
            }
        }
    });

    const paragraphs = Array.from(botMessage.querySelectorAll('p'));
    let imageGroup = [];

    const wrapImages = (group) => {
        if (group.length === 0) return;
        const grid = document.createElement('div');
        grid.className = 'image-grid';
        group[0].parentNode.insertBefore(grid, group[0]);
        group.forEach(p => {
            const images = Array.from(p.querySelectorAll('img'));
            images.forEach(img => grid.appendChild(img));
            p.remove();
        });
        const imageCount = grid.querySelectorAll('img').length;
        grid.classList.add(`img-count-${imageCount}`);
    };

    paragraphs.forEach(p => {
        const images = p.querySelectorAll('img');
        if (images.length > 0) {
            const clone = p.cloneNode(true);
            clone.querySelectorAll('img').forEach(img => img.remove());
            const text = clone.textContent.trim();
            if (text.length === 0 || text === '.' || text === ':') {
                imageGroup.push(p);
            } else {
                if (imageGroup.length > 0) {
                    wrapImages(imageGroup);
                    imageGroup = [];
                }
            }
        } else {
            if (imageGroup.length > 0) {
                wrapImages(imageGroup);
                imageGroup = [];
            }
        }
    });
    if (imageGroup.length > 0) wrapImages(imageGroup);

    // --- Action Buttons ---
    const botActionsContainer = document.createElement('div');
    botActionsContainer.classList.add('message-actions', 'bot-message-actions');

    const botCopyButton = document.createElement('button');
    botCopyButton.classList.add('action-button');
    botCopyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="action-icon"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg> Copy`;
    botCopyButton.addEventListener('click', () => {
        copyToClipboard(botCopyButton, botMessage.textContent);
    });

    const botRetryButton = document.createElement('button');
    botRetryButton.classList.add('action-button');
    botRetryButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="action-icon"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg> Retry`;

    botRetryButton.addEventListener('click', async () => {
        // Capture the chat ID where the retry was initiated
        const activeChatId = currentChatId;
        // Capture the old text for history replacement
        const oldText = botMessageWrapper.dataset.rawText;

        // Find the user message that triggered this bot response
        let target = botMessageWrapper.previousElementSibling;
        while (target && !target.classList.contains('user-message-wrapper')) {
            target = target.previousElementSibling;
        }

        if (target) {
            const userText = target.querySelector('.user-message').textContent;

            // Store the position of this bot message wrapper
            const nextSibling = botMessageWrapper.nextElementSibling;
            const parentElement = botMessageWrapper.parentElement;

            // Remove current bot response
            botMessageWrapper.remove();

            // Show loading indicator in the SAME position
            const loadingId = 'loading-retry-' + Date.now();
            const loadingWrapper = document.createElement('div');
            loadingWrapper.classList.add('bot-message-wrapper');
            loadingWrapper.id = loadingId;
            loadingWrapper.innerHTML = `
                <div class="message bot-message">
                    <span class="typing-indicator">
                        <span class="thinking-text">Thinking</span><span class="dots"><span>.</span><span>.</span><span>.</span></span>
                    </span>
                </div>
            `;

            // Insert loading at the original position
            if (nextSibling) {
                parentElement.insertBefore(loadingWrapper, nextSibling);
            } else {
                parentElement.appendChild(loadingWrapper);
            }

            try {
                // Fetch response from backend
                const response = await fetch('https://futian-production.up.railway.app/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: userText,
                        history: [] // Simplified history for retry
                    })
                });

                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }

                const data = await response.json();
                const botResponse = data.response;

                // Update history for the CORRECT chat, REPLACING the old message
                updateChatHistory('bot', botResponse, activeChatId, oldText);

                // Check if we are still in the same chat
                if (currentChatId === activeChatId) {
                    // Create new bot message using the REUSABLE function
                    const newBotWrapper = createBotMessageElement(botResponse);

                    if (document.body.contains(loadingWrapper)) {
                        // Standard case: Loading spinner is still there, replace it
                        loadingWrapper.replaceWith(newBotWrapper);

                        // Auto-scroll
                        chatContainer.scrollTop = chatContainer.scrollHeight;

                        // Add click to toggle active state
                        const newBotMessage = newBotWrapper.querySelector('.bot-message');
                        newBotMessage.addEventListener('click', () => {
                            newBotWrapper.classList.toggle('active');
                            if (newBotWrapper.classList.contains('active')) {
                                setTimeout(() => {
                                    newBotWrapper.classList.remove('active');
                                }, 5000);
                            }
                        });
                    } else {
                        // Edge case: User switched chats and came back. 
                        // The loading spinner is gone (replaced by old message from history).
                        // Since we updated history, reloading the chat will show the new message.
                        loadChat(activeChatId);
                    }
                } else {
                    console.log('User switched chat during retry. Saved to history but did not render.');
                    // Remove loading wrapper if it somehow exists in the wrong view (unlikely)
                    if (document.body.contains(loadingWrapper)) {
                        loadingWrapper.remove();
                    }
                }

            } catch (error) {
                console.error('Retry error:', error);

                let errorMessage = "⚠️ I apologize, but I encountered an error while retrying. ";
                if (error.message.includes('Failed to fetch')) {
                    errorMessage += "The backend server might not be running.";
                } else {
                    errorMessage += `Error: ${error.message}`;
                }

                // Update history with error, REPLACING the old message
                updateChatHistory('bot', errorMessage, activeChatId, oldText);

                // Only render error if in same chat
                if (currentChatId === activeChatId) {
                    const errorWrapper = createBotMessageElement(errorMessage);

                    if (document.body.contains(loadingWrapper)) {
                        loadingWrapper.replaceWith(errorWrapper);
                    } else {
                        // User switched away and back, reload to show error state
                        loadChat(activeChatId);
                    }
                } else {
                    if (document.body.contains(loadingWrapper)) {
                        loadingWrapper.remove();
                    }
                }
            }
        } else {
            alert("Could not retry: Original message not found.");
        }
    });

    botActionsContainer.appendChild(botCopyButton);
    botActionsContainer.appendChild(botRetryButton);
    botMessageWrapper.appendChild(botMessage);
    botMessageWrapper.appendChild(botActionsContainer);

    // Add click to toggle active state
    botMessage.addEventListener('click', () => {
        botMessageWrapper.classList.toggle('active');
        if (botMessageWrapper.classList.contains('active')) {
            setTimeout(() => {
                botMessageWrapper.classList.remove('active');
            }, 5000);
        }
    });

    return botMessageWrapper;
};

const renderBotMessage = (text) => {
    const botMessageWrapper = createBotMessageElement(text);
    chatMessages.appendChild(botMessageWrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;
};

const getHistory = () => {
    return JSON.parse(localStorage.getItem('futianChatHistory')) || [];
}
const saveHistory = (history) => {
    localStorage.setItem('futianChatHistory', JSON.stringify(history));
}
const updateChatHistory = (role, text, chatId = currentChatId, oldTextToReplace = null) => {
    let history = getHistory();
    let chatIndex = -1;
    if (chatId) {
        chatIndex = history.findIndex(c => c.id === chatId);
    }
    if (chatIndex === -1) {
        // If we have a chatId but it's not in history, we should probably create it properly
        // But if chatId is null (new chat), we generate a new one
        const newId = chatId || Date.now();
        currentChatId = newId; // Update current if we just created it
        const newChat = {
            id: newId,
            title: text,
            messages: [{ role, text }]
        };
        history.unshift(newChat);
    } else {
        // If we have an old text to replace, try to find it
        let replaced = false;
        if (oldTextToReplace) {
            // Search backwards to find the most recent matching message
            for (let i = history[chatIndex].messages.length - 1; i >= 0; i--) {
                if (history[chatIndex].messages[i].role === role && history[chatIndex].messages[i].text === oldTextToReplace) {
                    history[chatIndex].messages[i].text = text;
                    replaced = true;
                    break;
                }
            }
        }

        if (!replaced) {
            history[chatIndex].messages.push({ role, text });
        }

        const updatedChat = history.splice(chatIndex, 1)[0];
        history.unshift(updatedChat);
    }
    saveHistory(history);
    renderHistorySidebar();
}

const removeLastMessageFromHistory = () => {
    let history = getHistory();
    if (!currentChatId) return;
    const chatIndex = history.findIndex(c => c.id === currentChatId);
    if (chatIndex !== -1) {
        const chat = history[chatIndex];
        if (chat.messages.length > 0) {
            chat.messages.pop();
            saveHistory(history);
        }
    }
}
const loadChat = (id) => {
    const history = getHistory();
    const chat = history.find(c => c.id == id);
    if (!chat) return;
    currentChatId = chat.id;
    chatMessages.innerHTML = '';
    chat.messages.forEach(msg => {
        if (msg.role === 'user') {
            renderUserMessage(msg.text);
        } else {
            renderBotMessage(msg.text);
        }
    });

    chatContainer.scrollTop = chatContainer.scrollHeight;
    renderHistorySidebar();

    // Only close sidebar on mobile (off-canvas menu)
    // Tablet and desktop: sidebar stays open
    if (window.innerWidth <= 800) {
        sidebar.classList.remove('active');
    }
    showVersionText();
}

// Load chat and scroll to the first message containing the search query
const loadChatAndScrollToMatch = (chatId, searchQuery) => {
    const history = getHistory();
    const chat = history.find(c => c.id == chatId);
    if (!chat) return;

    currentChatId = chat.id;
    chatMessages.innerHTML = '';

    let matchingMessageIndex = -1;
    const queryLower = searchQuery.toLowerCase();

    // First, find the index of the first matching message
    for (let i = 0; i < chat.messages.length; i++) {
        if (chat.messages[i].text.toLowerCase().includes(queryLower)) {
            matchingMessageIndex = i;
            break;
        }
    }

    // Also check for title match (which would be the first message)
    if (matchingMessageIndex === -1 && chat.title.toLowerCase().includes(queryLower)) {
        matchingMessageIndex = 0;
    }

    // Render all messages
    chat.messages.forEach((msg, index) => {
        if (msg.role === 'user') {
            renderUserMessage(msg.text);
        } else {
            renderBotMessage(msg.text);
        }
    });

    renderHistorySidebar();

    // Only close sidebar on mobile (off-canvas menu)
    if (window.innerWidth <= 800) {
        sidebar.classList.remove('active');
    }
    showVersionText();

    // If we found a matching message, scroll to it with a highlight effect
    if (matchingMessageIndex !== -1) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
            const allMessages = chatMessages.querySelectorAll('.user-message-wrapper, .bot-message-wrapper');
            if (allMessages[matchingMessageIndex]) {
                const targetMessage = allMessages[matchingMessageIndex];

                // Scroll to the message
                targetMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Add a highlight effect after 1.5 seconds delay
                setTimeout(() => {
                    targetMessage.classList.add('search-highlight');

                    // Remove highlight after animation completes (1.5s for 3 pulses)
                    setTimeout(() => {
                        targetMessage.classList.remove('search-highlight');
                    }, 1600);
                }, 1500);
            }
        }, 100);
    } else {
        // No match found (shouldn't happen), just scroll to bottom
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

const closeModals = () => {
    renameOverlay.classList.remove('show');
    deleteOverlay.classList.remove('show');
    targetChatId = null;
};

renameCancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeModals();
});
deleteCancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeModals();
});
renameOverlay.addEventListener('click', (e) => {
    if (e.target === renameOverlay) {
        e.stopPropagation();
        closeModals();
    }
});
deleteOverlay.addEventListener('click', (e) => {
    if (e.target === deleteOverlay) {
        e.stopPropagation();
        closeModals();
    }
});
renameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmRenameBtn.click();
});
const renameChat = (id) => {
    const history = getHistory();
    const chat = history.find(c => c.id == id);
    if (chat) {
        targetChatId = id;
        renameInput.value = chat.title;
        renameOverlay.classList.add('show');
        setTimeout(() => renameInput.focus(), 100);
    }
};
confirmRenameBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (targetChatId) {
        const newTitle = renameInput.value.trim();
        if (newTitle) {
            let history = getHistory();
            const chatIndex = history.findIndex(c => c.id == targetChatId);
            if (chatIndex !== -1) {
                history[chatIndex].title = newTitle;
                saveHistory(history);
                renderHistorySidebar();
            }
        }
        closeModals();
    }
});
const deleteChat = (id) => {
    targetChatId = id;
    deleteOverlay.classList.add('show');
};
confirmDeleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (targetChatId) {
        let history = getHistory();
        history = history.filter(c => c.id != targetChatId);
        saveHistory(history);
        if (currentChatId == targetChatId) {
            resetChat();
        } else {
            renderHistorySidebar();
        }
        closeModals();
    }
});

const renderHistorySidebar = () => {
    const history = getHistory();
    historyList.innerHTML = '';
    history.forEach(chat => {
        const wrapper = document.createElement('div');
        wrapper.classList.add('history-wrapper');
        if (chat.id === currentChatId) {
            wrapper.classList.add('active');
        }
        const btn = document.createElement('button');
        btn.classList.add('history-item');
        btn.title = chat.title;
        btn.innerHTML = `<span class="title-span">${chat.title}</span>`;

        btn.addEventListener('mouseenter', () => {
            const span = btn.querySelector('.title-span');
            if (span.scrollWidth > btn.clientWidth) {
                span.dataset.originalText = span.textContent;
                const gap = 20;
                span.innerHTML = `${span.textContent}<span style="display:inline-block; width: ${gap}px;"></span>${span.textContent}`;
                span.style.width = 'max-content';
                span.style.display = 'inline-block';
                span.style.verticalAlign = 'top'; // Match CSS to prevent jump
                span.style.lineHeight = '20px'; // Enforce consistency
                const scrollDistance = (span.scrollWidth - gap) / 2 + gap;
                const duration = scrollDistance / 30;
                span.style.setProperty('--scroll-distance', `-${scrollDistance}px`);
                span.style.animation = `marquee ${duration}s linear infinite`;
                btn.classList.add('is-sliding');
            }
        });

        btn.addEventListener('mouseleave', () => {
            const span = btn.querySelector('.title-span');
            if (span.dataset.originalText) {
                span.style.animation = 'none';
                span.textContent = span.dataset.originalText;
                span.style.width = '100%';
                span.style.display = 'block';
                span.style.removeProperty('--scroll-distance');
                delete span.dataset.originalText;
                btn.classList.remove('is-sliding');
            }
        });
        btn.addEventListener('click', () => loadChat(chat.id));
        const optionsBtn = document.createElement('button');
        optionsBtn.classList.add('history-options-btn');
        optionsBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="1"></circle>
                        <circle cx="12" cy="5" r="1"></circle>
                        <circle cx="12" cy="19" r="1"></circle>
                    </svg>
                `;
        const menu = document.createElement('div');
        menu.classList.add('history-menu');

        const renameBtn = document.createElement('button');
        renameBtn.textContent = 'Rename';
        renameBtn.classList.add('history-menu-item');
        renameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.remove('show');
            wrapper.classList.remove('menu-open');
            renameChat(chat.id);
        });
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.classList.add('history-menu-item');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.remove('show');
            wrapper.classList.remove('menu-open');
            deleteChat(chat.id);
        });
        menu.appendChild(renameBtn);
        menu.appendChild(deleteBtn);
        optionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();

            // Remove menu-open class from all other wrappers
            document.querySelectorAll('.history-wrapper.menu-open').forEach(w => {
                if (w !== wrapper) w.classList.remove('menu-open');
            });

            document.querySelectorAll('.history-menu').forEach(m => {
                if (m !== menu) m.classList.remove('show');
            });

            // Smart positioning logic
            const rect = optionsBtn.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;

            // If less than 200px space below, drop up
            if (spaceBelow < 200) {
                menu.classList.add('drop-up');
            } else {
                menu.classList.remove('drop-up');
            }

            menu.classList.toggle('show');
            // Toggle menu-open class to highlight the wrapper
            wrapper.classList.toggle('menu-open', menu.classList.contains('show'));
        });
        wrapper.appendChild(btn);
        wrapper.appendChild(optionsBtn);
        wrapper.appendChild(menu);
        historyList.appendChild(wrapper);
    });
}

// Helper function to strip markdown formatting for search
const stripMarkdown = (text) => {
    return text
        .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove bold **text**
        .replace(/\*([^*]+)\*/g, '$1')       // Remove italic *text*
        .replace(/__([^_]+)__/g, '$1')       // Remove bold __text__
        .replace(/_([^_]+)_/g, '$1')         // Remove italic _text_
        .replace(/~~([^~]+)~~/g, '$1')       // Remove strikethrough
        .replace(/`([^`]+)`/g, '$1')         // Remove inline code
        .replace(/```[\s\S]*?```/g, '')      // Remove code blocks
        .replace(/^#+\s*/gm, '')             // Remove heading markers
        .replace(/^[\-\*]\s*/gm, '')         // Remove list markers
        .replace(/^\d+\.\s*/gm, '')          // Remove numbered list markers
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Replace links with text
        .replace(/!\[([^\]]+)\]\([^)]+\)/g, '')   // Remove images
        .replace(/\n+/g, ' ')                // Replace newlines with spaces
        .replace(/\s+/g, ' ')                // Normalize whitespace
        .trim();
};

const performGlobalSearch = () => {
    const query = globalSearchInput.value.toLowerCase().trim();
    const history = getHistory();
    globalSearchResults.innerHTML = '';
    selectedChatIdFromSearch = null;
    if (query.length < 1) {
        globalSearchResults.innerHTML = '<p style="color: #666; font-size: 14px;">Start typing to see results.</p>';
        return;
    }
    const results = [];
    history.forEach(chat => {
        let matchText = '';
        let matched = false;
        if (chat.title.toLowerCase().includes(query)) {
            matchText = `Title Match: ${highlightMatch(chat.title, query)}`;
            matched = true;
        }
        if (!matched) {
            for (const msg of chat.messages) {
                // Strip markdown to search plain text
                const plainText = stripMarkdown(msg.text);
                if (plainText.toLowerCase().includes(query)) {
                    const startIndex = plainText.toLowerCase().indexOf(query);
                    const contextStart = Math.max(0, startIndex - 30);
                    const contextEnd = Math.min(plainText.length, startIndex + query.length + 50);
                    let snippet = plainText.substring(contextStart, contextEnd);
                    if (contextStart > 0) snippet = '...' + snippet;
                    if (contextEnd < plainText.length) snippet = snippet + '...';
                    matchText = `Text Match: ${highlightMatch(snippet, query)}`;
                    matched = true;
                    break;
                }
            }
        }
        if (matched) {
            results.push({
                id: chat.id,
                title: chat.title,
                match: matchText,
                searchQuery: query
            });
        }
    });
    if (results.length === 0) {
        globalSearchResults.innerHTML = '<p style="color: #666; font-size: 14px;">No results found in your history.</p>';
        return;
    }
    results.forEach(result => {
        const item = document.createElement('button');
        item.classList.add('search-result-item');
        item.dataset.chatId = result.id;
        item.innerHTML = `
                    <span class="result-chat-title">${result.title}</span>
                    <span class="result-match-text"><span class="match-text-span">${result.match}</span></span>
                `;
        const matchTextWrapper = item.querySelector('.result-match-text');
        const matchTextSpan = item.querySelector('.match-text-span');
        item.addEventListener('mouseenter', () => {
            const matchTextWrapper = item.querySelector('.result-match-text');
            const matchTextSpan = item.querySelector('.match-text-span');
            if (matchTextSpan.scrollWidth > matchTextWrapper.clientWidth) {
                matchTextSpan.dataset.originalHtml = matchTextSpan.innerHTML;
                const gap = 20;
                matchTextSpan.innerHTML = `${matchTextSpan.innerHTML}<span style="display:inline-block; width: ${gap}px;"></span>${matchTextSpan.innerHTML}`;
                matchTextSpan.style.width = 'max-content';
                matchTextSpan.style.display = 'inline-block';
                const scrollDistance = (matchTextSpan.scrollWidth - gap) / 2 + gap;
                const duration = scrollDistance / 30;
                matchTextSpan.style.setProperty('--scroll-distance', `-${scrollDistance}px`);
                matchTextSpan.style.animation = `marquee ${duration}s linear infinite`;
            }
        });

        item.addEventListener('mouseleave', () => {
            const matchTextSpan = item.querySelector('.match-text-span');
            if (matchTextSpan.dataset.originalHtml) {
                matchTextSpan.style.animation = 'none';
                matchTextSpan.innerHTML = matchTextSpan.dataset.originalHtml;
                matchTextSpan.style.width = '100%';
                matchTextSpan.style.display = 'block';
                matchTextSpan.style.removeProperty('--scroll-distance');
                delete matchTextSpan.dataset.originalHtml;
            }
        });
        item.addEventListener('click', () => {
            loadChatAndScrollToMatch(result.id, result.searchQuery);
            closeGlobalSearchModal();
        });
        globalSearchResults.appendChild(item);
    });
    if (results.length > 0) {
        // Removed auto-selection of first item per user request
        selectedChatIdFromSearch = null;
    }
};

const openGlobalSearchModal = () => {
    globalSearchOverlay.classList.add('show');
    globalSearchInput.value = '';
    globalSearchResults.innerHTML = '<p style="color: #666; font-size: 14px;">Start typing to see results.</p>';
    selectedChatIdFromSearch = null;
    setTimeout(() => globalSearchInput.focus(), 100);
};
const closeGlobalSearchModal = () => {
    globalSearchOverlay.classList.remove('show');
    selectedChatIdFromSearch = null;
};

const fetchBotResponse = async (userText) => {
    // Show a temporary loading message with animation
    const loadingId = 'loading-' + Date.now();
    const loadingWrapper = document.createElement('div');
    loadingWrapper.classList.add('bot-message-wrapper');
    loadingWrapper.id = loadingId;
    loadingWrapper.innerHTML = `
        <div class="message bot-message">
            <span class="typing-indicator">
                <span class="thinking-text">Thinking</span><span class="dots"><span>.</span><span>.</span><span>.</span></span>
            </span>
        </div>
    `;
    chatMessages.appendChild(loadingWrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Create abort controller for this request
    currentAbortController = new AbortController();
    isGenerating = true;
    updateSendButton();

    // Record start time for performance tracking
    const startTime = Date.now();

    // Capture the current chat ID at the start of the request
    const activeChatId = currentChatId;

    try {
        // Get history for context
        const history = getHistory();
        const currentChat = history.find(c => c.id === activeChatId);
        // Exclude the last message which is the current user message we just added
        const previousMessages = currentChat ? currentChat.messages.slice(0, -1) : [];

        const response = await fetch('https://futian-production.up.railway.app/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: userText,
                history: previousMessages
            }),
            signal: currentAbortController.signal
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();

        // Remove loading message
        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) loadingElement.remove();

        // Log performance
        const responseTime = Date.now() - startTime;
        console.log(`✅ Response received in ${responseTime}ms (${(responseTime / 1000).toFixed(2)}s)`);

        // Update history for the chat that initiated the request
        updateChatHistory('bot', data.response, activeChatId);

        // Only render if the user is still looking at the same chat
        if (currentChatId === activeChatId) {
            renderBotMessage(data.response);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        } else {
            console.log('User switched chat, saved response to history but did not render.');
        }

        // Reset state
        isGenerating = false;
        currentAbortController = null;
        updateSendButton();

    } catch (error) {
        // Reset state
        isGenerating = false;
        currentAbortController = null;
        updateSendButton();

        // If aborted, don't show error
        if (error.name === 'AbortError') {
            console.log('Request was cancelled by user');
            return;
        }
        console.error('❌ Error fetching response:', error);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);

        // Remove loading message
        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) loadingElement.remove();

        let errorMessage = "I'm sorry, I'm having trouble connecting to the server. ";

        // Provide more specific error messages
        if (error.message.includes('Failed to fetch')) {
            errorMessage += "The backend server might not be running. Please start the backend using 'python backend/main.py'.";
        } else if (error.message.includes('Network response was not ok')) {
            errorMessage += "The server returned an error. Please check the backend logs.";
        } else {
            errorMessage += `Error: ${error.message}`;
        }

        console.error('📝 Displaying error message to user:', errorMessage);

        // Update history with error
        updateChatHistory('bot', errorMessage, activeChatId);

        // Only render error if user is still on the same chat
        if (currentChatId === activeChatId) {
            renderBotMessage(errorMessage);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }
};

// Function to update send button state
const updateSendButton = () => {
    if (isGenerating) {
        sendButton.textContent = 'Stop';
        sendButton.classList.add('stop-mode');
    } else {
        sendButton.textContent = 'Send';
        sendButton.classList.remove('stop-mode');
    }
};

const sendMessage = () => {
    // If generating, stop the current request
    if (isGenerating && currentAbortController) {
        currentAbortController.abort();
        const loadingElements = document.querySelectorAll('[id^="loading-"]');
        loadingElements.forEach(el => el.remove());
        isGenerating = false;
        currentAbortController = null;
        updateSendButton();
        return;
    }

    if (isListening && recognition) {
        recognition.stop();
    }
    const messageText = searchInput.value.trim();
    if (messageText !== '') {
        renderUserMessage(messageText);
        updateChatHistory('user', messageText);
        searchInput.value = '';
        searchInput.style.height = 'auto';
        searchContainer.classList.remove('expanded');
        chatContainer.scrollTop = chatContainer.scrollHeight;
        fetchBotResponse(messageText);
    }
};
const resetChat = () => {
    currentChatId = null;
    chatMessages.innerHTML = '';
    searchInput.value = '';
    searchInput.style.height = 'auto';
    searchContainer.classList.remove('expanded');
    renderHistorySidebar();
    showVersionText();
};

newChatButton.addEventListener('click', resetChat);

// Keyboard shortcut: Shift + N for new chat
document.addEventListener('keydown', (e) => {
    // Check if Shift + N is pressed
    if (e.shiftKey && (e.key === 'N' || e.key === 'n')) {
        // Don't trigger if user is typing in an input field
        const activeElement = document.activeElement;
        const isTyping = activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable;

        // Also check if any modal is open
        const isModalOpen = renameOverlay.classList.contains('show') ||
            deleteOverlay.classList.contains('show') ||
            globalSearchOverlay.classList.contains('show') ||
            (settingsOverlay && settingsOverlay.classList.contains('show')) ||
            searchLibraryOverlay.classList.contains('show');

        if (!isTyping && !isModalOpen) {
            e.preventDefault();
            resetChat();
            searchInput.focus(); // Focus on input after creating new chat
        }
    }
});

searchInput.addEventListener('input', autoExpandInput);

searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        // Only trigger send from Enter key if NOT currently generating
        // This prevents accidental stop/cancellation
        if (!isGenerating) {
            sendMessage();
        }
    }
});

sendButton.addEventListener('click', sendMessage);

// Prevent Enter key on Send/Stop button from cancelling generation
sendButton.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && isGenerating) {
        e.preventDefault();
        e.stopPropagation();
    }
});

globalSearchBtn.addEventListener('click', openGlobalSearchModal);

globalSearchInput.addEventListener('input', debounce(performGlobalSearch, 300));

globalSearchCloseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeGlobalSearchModal();
});
globalSearchOverlay.addEventListener('click', (e) => {
    if (e.target === globalSearchOverlay) {
        e.stopPropagation();
        closeGlobalSearchModal();
    }
});

globalSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeGlobalSearchModal();
        return;
    }
    const results = Array.from(globalSearchResults.querySelectorAll('.search-result-item'));
    if (results.length === 0) return;
    let selectedIndex = results.findIndex(r => r.classList.contains('selected'));
    let newIndex = selectedIndex;
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        newIndex = (selectedIndex + 1) % results.length;
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        newIndex = (selectedIndex - 1 + results.length) % results.length;
    } else if (e.key === 'Enter' && selectedChatIdFromSearch) {
        e.preventDefault();
        loadChat(selectedChatIdFromSearch);
        closeGlobalSearchModal();
        return;
    }
    if (newIndex !== selectedIndex) {
        results.forEach((r, index) => {
            r.classList.remove('selected');
            if (index === newIndex) {
                r.classList.add('selected');
                selectedChatIdFromSearch = r.dataset.chatId;
                r.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }
});

// Speech Recognition Setup
const micButton = document.querySelector('.mic-button');
const micIcon = document.querySelector('.mic-icon');
let recognition = null;
let isListening = false;
let silenceTimer = null;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    const resetSilenceTimer = () => {
        clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
            if (isListening) {
                recognition.stop();
            }
        }, 15000); // 15 seconds timeout
    };

    // Re-implementing onresult with the logic above
    let baseInputValue = '';

    recognition.onstart = () => {
        isListening = true;
        micIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
        micButton.classList.add('active');
        baseInputValue = searchInput.value;
        if (baseInputValue.length > 0 && !baseInputValue.endsWith(' ')) {
            baseInputValue += ' ';
        }
        resetSilenceTimer();
    };

    recognition.onend = () => {
        isListening = false;
        micIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/></svg>';
        micButton.classList.remove('active');
        clearTimeout(silenceTimer);
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        isListening = false;
        micIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/></svg>';
        micButton.classList.remove('active');
        clearTimeout(silenceTimer);
    };

    recognition.onresult = (event) => {
        resetSilenceTimer(); // Reset timer on speech input
        let transcript = '';
        for (let i = 0; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
        }
        searchInput.value = baseInputValue + transcript;
        autoExpandInput();
    };
} else {
    console.log('Speech Recognition API not supported in this browser.');
    micButton.style.display = 'none'; // Hide if not supported
}

const toggleSpeechRecognition = () => {
    if (!recognition) return;

    if (isListening) {
        recognition.stop(); // Stops listening, fires onend
    } else {
        recognition.start();
    }
};

micButton.addEventListener('click', toggleSpeechRecognition);

micButton.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (isListening && recognition) {
            recognition.stop();
        } else {
            // Only send if not generating 
            if (!isGenerating) {
                sendMessage();
            }
        }
    }
});

// ===== SEARCH LIBRARY MODAL FUNCTIONS =====

// Fetch suggested questions from backend
const fetchSuggestedQuestions = async () => {
    try {
        const response = await fetch('https://futian-production.up.railway.app/generate-questions');
        if (!response.ok) {
            throw new Error('Failed to fetch questions');
        }
        const data = await response.json();
        suggestedQuestions = data.questions || [];
        displaySuggestedQuestions();
    } catch (error) {
        console.error('Error fetching suggested questions:', error);
        // Show error message instead of fallback questions
        searchLibraryQuestions.innerHTML = `
            <p style="color: #ff6b6b; font-size: 14px; text-align: center; padding: 20px;">
                ❌ Failed to load suggested questions.<br>
                Please check that the backend is running.
            </p>
        `;
    }
};

// Display questions in the modal
const displaySuggestedQuestions = () => {
    searchLibraryQuestions.innerHTML = '';

    suggestedQuestions.forEach((question, index) => {
        const questionBtn = document.createElement('button');
        questionBtn.classList.add('suggested-question-btn');
        questionBtn.textContent = question;
        questionBtn.dataset.question = question;

        questionBtn.addEventListener('click', () => {
            // Start new chat with this question
            resetChat();
            searchInput.value = question;
            closeSearchLibraryModal();
            sendMessage();
        });

        searchLibraryQuestions.appendChild(questionBtn);
    });
};

// Open Search Library modal
const openSearchLibraryModal = () => {
    searchLibraryOverlay.classList.add('show');
    fetchSuggestedQuestions();
};

// Close Search Library modal
const closeSearchLibraryModal = () => {
    searchLibraryOverlay.classList.remove('show');
};

// Event Listeners for Search Library
searchLibraryBtn.addEventListener('click', openSearchLibraryModal);

searchLibraryCloseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeSearchLibraryModal();
});

searchLibraryOverlay.addEventListener('click', (e) => {
    if (e.target === searchLibraryOverlay) {
        e.stopPropagation();
        closeSearchLibraryModal();
    }
});

window.addEventListener('load', () => {
    autoExpandInput();
    renderHistorySidebar();
});

// Modify sendMessage to stop recognition if active
// Since sendMessage is defined earlier in the file, we would modify it directly there.
// For example:
// const sendMessage = () => {
//     if (isListening) {
//         recognition.stop(); // Stop speech recognition when message is sent
//     }
//     const messageText = searchInput.value.trim();
//     if (messageText !== '') {
//         renderUserMessage(messageText);
//         updateChatHistory('user', messageText);
//         searchInput.value = '';
//         searchInput.style.height = 'auto';
//         searchContainer.classList.remove('expanded');
//         chatContainer.scrollTop = chatContainer.scrollHeight;
//         simulateBotResponse(messageText);
//     }
// Image Modal Logic
const imageModalOverlay = document.createElement('div');
imageModalOverlay.classList.add('image-modal-overlay');
imageModalOverlay.innerHTML = `
    <span class="image-modal-close">&times;</span>
    <img class="image-modal-content" src="" alt="Expanded Image">
    <div class="zoom-controls">
        <button class="zoom-btn" id="zoom-out">-</button>
        <button class="zoom-btn" id="zoom-in">+</button>
    </div>
`;
document.body.appendChild(imageModalOverlay);

const imageModalContent = imageModalOverlay.querySelector('.image-modal-content');
const imageModalClose = imageModalOverlay.querySelector('.image-modal-close');
const zoomInBtn = imageModalOverlay.querySelector('#zoom-in');
const zoomOutBtn = imageModalOverlay.querySelector('#zoom-out');

let currentZoom = 1;
let currentTranslateX = 0;
let currentTranslateY = 0;
let isDragging = false;
let startX = 0;
let startY = 0;
let initialDistance = 0;

const updateTransform = () => {
    imageModalContent.style.transform = `translate(${currentTranslateX}px, ${currentTranslateY}px) scale(${currentZoom})`;
};

const resetImageState = () => {
    currentZoom = 1;
    currentTranslateX = 0;
    currentTranslateY = 0;
    updateTransform();
};

const closeImageModal = () => {
    imageModalOverlay.classList.remove('show');
    setTimeout(() => {
        imageModalOverlay.style.display = 'none';
        resetImageState();
    }, 300);
};

imageModalClose.addEventListener('click', closeImageModal);
imageModalOverlay.addEventListener('click', (e) => {
    if (e.target === imageModalOverlay) {
        closeImageModal();
    }
});

// Button Zoom
zoomInBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentZoom += 0.2;
    updateTransform();
});

zoomOutBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentZoom > 0.4) {
        currentZoom -= 0.2;
        updateTransform();
    }
});

// --- Pan and Pinch Logic ---

// Mouse Events (Desktop)
imageModalContent.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isDragging = true;
    startX = e.clientX - currentTranslateX;
    startY = e.clientY - currentTranslateY;
    imageModalContent.style.transition = 'none'; // Disable transition for direct control
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    currentTranslateX = e.clientX - startX;
    currentTranslateY = e.clientY - startY;
    updateTransform();
});

window.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        imageModalContent.style.transition = 'transform 0.1s ease-out'; // Re-enable smooth transition
    }
});

// Touch Events (Mobile)
imageModalContent.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        // Single touch: Pan
        isDragging = true;
        startX = e.touches[0].clientX - currentTranslateX;
        startY = e.touches[0].clientY - currentTranslateY;
        imageModalContent.style.transition = 'none';
    }
});

imageModalContent.addEventListener('touchmove', (e) => {
    e.preventDefault(); // Prevent scrolling background
    if (e.touches.length === 1 && isDragging) {
        // Pan
        currentTranslateX = e.touches[0].clientX - startX;
        currentTranslateY = e.touches[0].clientY - startY;
        updateTransform();
    }
});

imageModalContent.addEventListener('touchend', () => {
    isDragging = false;
    imageModalContent.style.transition = 'transform 0.1s ease-out';
});

// Event Delegation for Chat Images
chatMessages.addEventListener('click', (e) => {
    if (e.target.tagName === 'IMG' && e.target.closest('.bot-message')) {
        imageModalOverlay.style.display = 'flex';
        // Trigger reflow
        void imageModalOverlay.offsetWidth;
        imageModalOverlay.classList.add('show');
        imageModalContent.src = e.target.src;
        resetImageState();
    }
});

// --- DESKTOP/TABLET: Click on sidebar empty space to toggle ---
sidebar.addEventListener('click', (e) => {
    const width = window.innerWidth;

    // Check if click was on the sidebar itself, not on a button or interactive element
    const clickedOnButton = e.target.closest('button, a, .history-item, .history-wrapper, .history-menu');
    if (clickedOnButton) return;

    // Desktop mode (width > 800px)
    if (width > 800) {
        // Toggle sidebar collapsed state
        sidebar.classList.toggle('collapsed');
        container.classList.toggle('expanded');

        // Save state to localStorage
        const isNowCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('futianSidebarCollapsed', isNowCollapsed.toString());

        // Reset scroll if we just collapsed it
        if (isNowCollapsed) {
            const sidebarContent = document.querySelector('.sidebar-content');
            if (sidebarContent) sidebarContent.scrollTop = 0;
        }
    }
});

// --- SWIPE GESTURES TO OPEN/CLOSE SIDEBAR ---
let touchStartX = 0;
let touchEndX = 0;
let swipeTarget = null;
const swipeThreshold = 50; // Minimum distance for a swipe

// --- DOUBLE-TAP TO CLOSE SIDEBAR (Mobile) ---
let lastTapTime = 0;
const doubleTapThreshold = 3000; // 3 seconds

sidebar.addEventListener('click', (e) => {
    const width = window.innerWidth;

    // Only for mobile view
    if (width <= 800 && sidebar.classList.contains('active')) {
        // Check if click was on blank space (not on a button or interactive element)
        const clickedOnButton = e.target.closest('button, a, .history-item, .history-wrapper, .history-menu');
        if (clickedOnButton) return;

        const currentTime = Date.now();

        // Check if this is a double-tap (second tap within 3 seconds)
        if (currentTime - lastTapTime <= doubleTapThreshold) {
            // Double-tap detected - close sidebar
            sidebar.classList.remove('active');
            const sidebarContent = document.querySelector('.sidebar-content');
            if (sidebarContent) sidebarContent.scrollTop = 0;
            lastTapTime = 0; // Reset
        } else {
            // First tap - record the time
            lastTapTime = currentTime;
        }
    }
});

// Helper to check if element is interactive (should not trigger swipe)
const isInteractiveElement = (element) => {
    if (!element) return false;
    const tagName = element.tagName.toLowerCase();
    // Exclude inputs, textareas, links (but allow buttons to be swipeable)
    if (['input', 'textarea', 'a', 'select'].includes(tagName)) return true;
    // Exclude elements inside modals and search bar only (not the whole chat container)
    if (element.closest('.modal-overlay, .search-bar, .settings-modal-container, .search-container')) return true;
    return false;
};

// Swipe on document to open sidebar (swipe left-to-right from left edge)
document.addEventListener('touchstart', (e) => {
    swipeTarget = e.target;
    touchStartX = e.changedTouches[0].screenX;
}, { passive: true });

document.addEventListener('touchend', (e) => {
    // Skip if touching interactive elements
    if (isInteractiveElement(swipeTarget)) return;

    touchEndX = e.changedTouches[0].screenX;
    const swipeDistance = touchEndX - touchStartX;

    // Mobile: Swipe left-to-right (open sidebar) - only if starting from left edge
    if (window.innerWidth <= 800) {
        if (swipeDistance > swipeThreshold && touchStartX < 50 && !sidebar.classList.contains('active')) {
            sidebar.classList.add('active');
        }
    }
    // Desktop: Swipe left-to-right (expand sidebar if collapsed) - from left edge
    else {
        if (swipeDistance > swipeThreshold && touchStartX < 50 && sidebar.classList.contains('collapsed')) {
            sidebar.classList.remove('collapsed');
            container.classList.remove('expanded');
            localStorage.setItem('futianSidebarCollapsed', 'false');
        }
    }
}, { passive: true });

// Swipe on sidebar to open/close it
sidebar.addEventListener('touchstart', (e) => {
    swipeTarget = e.target;
    touchStartX = e.changedTouches[0].screenX;
}, { passive: true });

sidebar.addEventListener('touchend', (e) => {
    // Skip if touching inputs (but allow buttons and history items for swipe)
    if (swipeTarget && swipeTarget.closest('input, textarea')) return;

    touchEndX = e.changedTouches[0].screenX;
    const swipeDistanceRight = touchEndX - touchStartX; // Positive = swipe right (expand)
    const swipeDistanceLeft = touchStartX - touchEndX;  // Positive = swipe left (collapse)
    const width = window.innerWidth;

    // Mobile: Swipe right-to-left (close sidebar/menu bar)
    if (width <= 800) {
        if (swipeDistanceLeft > swipeThreshold && sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
            const sidebarContent = document.querySelector('.sidebar-content');
            if (sidebarContent) sidebarContent.scrollTop = 0;
        }
    }
    // Desktop mode
    else {
        // Swipe left-to-right on collapsed sidebar (expand it)
        if (swipeDistanceRight > swipeThreshold && sidebar.classList.contains('collapsed')) {
            sidebar.classList.remove('collapsed');
            container.classList.remove('expanded');
            localStorage.setItem('futianSidebarCollapsed', 'false');
        }
        // Swipe right-to-left on expanded sidebar (collapse it)
        else if (swipeDistanceLeft > swipeThreshold && !sidebar.classList.contains('collapsed')) {
            sidebar.classList.add('collapsed');
            container.classList.add('expanded');
            localStorage.setItem('futianSidebarCollapsed', 'true');
            const sidebarContent = document.querySelector('.sidebar-content');
            if (sidebarContent) sidebarContent.scrollTop = 0;
        }
    }
}, { passive: true });

// Additional swipe handler for main container/menu bar area
const mainContainer = document.querySelector('.container');
let containerTouchStartX = 0;
let containerTouchEndX = 0;

mainContainer.addEventListener('touchstart', (e) => {
    containerTouchStartX = e.changedTouches[0].screenX;
}, { passive: true });

mainContainer.addEventListener('touchend', (e) => {
    // Skip if touching interactive elements
    if (isInteractiveElement(e.target)) return;

    containerTouchEndX = e.changedTouches[0].screenX;
    const swipeDistance = containerTouchEndX - containerTouchStartX;
    const width = window.innerWidth;

    // Mobile mode (<=800px)
    if (width <= 800) {
        // Swipe left-to-right on main container (open menu bar)
        if (swipeDistance > swipeThreshold && !sidebar.classList.contains('active')) {
            sidebar.classList.add('active');
        }
        // Swipe right-to-left on main container (close menu bar if open)
        else if (swipeDistance < -swipeThreshold && sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
            const sidebarContent = document.querySelector('.sidebar-content');
            if (sidebarContent) sidebarContent.scrollTop = 0;
        }
    }
    // Desktop mode (>1024px)
    else {
        // Swipe left-to-right (expand sidebar if collapsed)
        if (swipeDistance > swipeThreshold && sidebar.classList.contains('collapsed')) {
            sidebar.classList.remove('collapsed');
            container.classList.remove('expanded');
            localStorage.setItem('futianSidebarCollapsed', 'false');
        }
        // Swipe right-to-left (collapse sidebar if expanded)
        else if (swipeDistance < -swipeThreshold && !sidebar.classList.contains('collapsed')) {
            sidebar.classList.add('collapsed');
            container.classList.add('expanded');
            localStorage.setItem('futianSidebarCollapsed', 'true');
            const sidebarContent = document.querySelector('.sidebar-content');
            if (sidebarContent) sidebarContent.scrollTop = 0;
        }
    }
}, { passive: true });

// --- TYPEWRITER EFFECT FOR VERSION TEXT ---
const versionTextEl = document.getElementById('version-text');
const versionString = "FUTIAN version 1.0";
let versionTypingInterval = null;
let isVersionVisible = false;

// Function to animate enter (Left -> Right)
function showVersionText() {
    if (isVersionVisible) return;
    isVersionVisible = true;

    if (versionTypingInterval) clearInterval(versionTypingInterval);

    // Start appearing
    versionTypingInterval = setInterval(() => {
        const currentText = versionTextEl.textContent;
        if (currentText.length < versionString.length) {
            versionTextEl.textContent = versionString.substring(0, currentText.length + 1);
        } else {
            clearInterval(versionTypingInterval);
            versionTypingInterval = null;
        }
    }, 50);
}

// Function to animate leave (Right -> Left)
function hideVersionText() {
    if (!isVersionVisible) return;
    isVersionVisible = false;

    if (versionTypingInterval) clearInterval(versionTypingInterval);

    // Start disappearing
    versionTypingInterval = setInterval(() => {
        const currentText = versionTextEl.textContent;
        if (currentText.length > 0) {
            versionTextEl.textContent = currentText.substring(0, currentText.length - 1);
        } else {
            clearInterval(versionTypingInterval);
            versionTypingInterval = null;
        }
    }, 30);
}

// Initial Load
setTimeout(showVersionText, 500);

// Input listener
searchInput.addEventListener('input', () => {
    if (searchInput.value.length > 0) {
        hideVersionText();
    } else {
        showVersionText();
    }
});