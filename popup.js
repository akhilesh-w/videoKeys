// VideoKeys — Popup Script

document.addEventListener('DOMContentLoaded', async () => {
    const globalToggle = document.getElementById('globalToggle');
    const siteRow = document.getElementById('siteRow');
    const siteDot = document.getElementById('siteDot');
    const siteName = document.getElementById('siteName');
    const siteToggle = document.getElementById('siteToggle');
    const statusIcon = document.getElementById('statusIcon');
    const statusText = document.getElementById('statusText');
    const shortcutsToggle = document.getElementById('shortcutsToggle');
    const shortcutsList = document.getElementById('shortcutsList');
    const chevron = document.getElementById('chevron');

    let currentDomain = '';
    let state = { globalEnabled: true, domainEnabled: true, enabled: true };

    // ─── Get current tab info ─────────────

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url) {
            const url = new URL(tab.url);
            currentDomain = url.hostname;
            siteName.textContent = currentDomain;

            // Check if it's YouTube
            if (currentDomain.includes('youtube.com')) {
                siteName.textContent = currentDomain + ' (native shortcuts)';
                siteToggle.style.display = 'none';
            }

            // Get state
            state = await chrome.runtime.sendMessage({
                type: 'GET_STATE',
                domain: currentDomain,
            });

            updateUI();

            // Try to get video count from content script
            try {
                const response = await chrome.tabs.sendMessage(tab.id, { type: 'QUERY_VIDEOS' });
                if (response && response.count > 0) {
                    statusIcon.textContent = '●';
                    statusIcon.classList.add('active');
                    statusText.textContent = `${response.count} video${response.count > 1 ? 's' : ''} detected`;
                }
            } catch {
                // Content script not loaded on this page
            }
        } else {
            siteName.textContent = 'No active page';
            siteToggle.style.display = 'none';
        }
    } catch {
        siteName.textContent = 'Unable to detect page';
        siteToggle.style.display = 'none';
    }

    // ─── UI Updates ───────────────────────

    function updateUI() {
        globalToggle.checked = state.globalEnabled;

        if (state.domainEnabled) {
            siteDot.classList.remove('disabled');
            siteToggle.textContent = 'Enabled';
            siteToggle.classList.remove('disabled');
        } else {
            siteDot.classList.add('disabled');
            siteToggle.textContent = 'Disabled';
            siteToggle.classList.add('disabled');
        }

        if (!state.globalEnabled) {
            siteDot.classList.add('disabled');
        }
    }

    // ─── Event Handlers ──────────────────

    globalToggle.addEventListener('change', async () => {
        state.globalEnabled = globalToggle.checked;
        state.enabled = state.globalEnabled && state.domainEnabled;
        await chrome.runtime.sendMessage({
            type: 'SET_GLOBAL_ENABLED',
            enabled: globalToggle.checked,
        });
        updateUI();
    });

    siteToggle.addEventListener('click', async () => {
        const response = await chrome.runtime.sendMessage({
            type: 'TOGGLE_DOMAIN',
            domain: currentDomain,
        });
        if (response) {
            state.domainEnabled = !state.domainEnabled;
            state.enabled = state.globalEnabled && state.domainEnabled;

            // Also send directly to the active tab
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab) {
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'STATE_CHANGED',
                        enabled: state.enabled,
                    }).catch(() => { });
                }
            } catch { }

            updateUI();
        }
    });

    // Shortcuts accordion
    shortcutsToggle.addEventListener('click', () => {
        shortcutsList.classList.toggle('open');
        chevron.classList.toggle('open');
    });
});
