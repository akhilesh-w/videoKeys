// VideoKeys — Background Service Worker

// Default settings
const DEFAULT_SETTINGS = {
    globalEnabled: true,
    disabledDomains: [],
};

// Initialize settings on install
chrome.runtime.onInstalled.addListener(async () => {
    const existing = await chrome.storage.sync.get('settings');
    if (!existing.settings) {
        await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
    }
    updateBadge(true);
});

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_STATE') {
        getStateForDomain(message.domain).then(sendResponse);
        return true; // async response
    }

    if (message.type === 'SET_GLOBAL_ENABLED') {
        chrome.storage.sync.get('settings', (data) => {
            const settings = data.settings || DEFAULT_SETTINGS;
            settings.globalEnabled = message.enabled;
            chrome.storage.sync.set({ settings }, () => {
                updateBadge(message.enabled);
                // Notify all tabs
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach((tab) => {
                        chrome.tabs.sendMessage(tab.id, {
                            type: 'STATE_CHANGED',
                            enabled: message.enabled,
                        }).catch(() => { });
                    });
                });
                sendResponse({ success: true });
            });
        });
        return true;
    }

    if (message.type === 'TOGGLE_DOMAIN') {
        chrome.storage.sync.get('settings', (data) => {
            const settings = data.settings || DEFAULT_SETTINGS;
            const idx = settings.disabledDomains.indexOf(message.domain);
            if (idx >= 0) {
                settings.disabledDomains.splice(idx, 1);
            } else {
                settings.disabledDomains.push(message.domain);
            }
            chrome.storage.sync.set({ settings }, () => {
                const enabled = settings.globalEnabled && !settings.disabledDomains.includes(message.domain);
                // Notify the specific tab
                if (sender.tab) {
                    chrome.tabs.sendMessage(sender.tab.id, {
                        type: 'STATE_CHANGED',
                        enabled,
                    }).catch(() => { });
                }
                sendResponse({ success: true, enabled });
            });
        });
        return true;
    }

    if (message.type === 'VIDEO_DETECTED') {
        // Content script found a video — could update badge in future
        sendResponse({ success: true });
        return false;
    }
});

// Get enabled state for a specific domain
async function getStateForDomain(domain) {
    const data = await chrome.storage.sync.get('settings');
    const settings = data.settings || DEFAULT_SETTINGS;
    const domainDisabled = settings.disabledDomains.includes(domain);
    return {
        globalEnabled: settings.globalEnabled,
        domainEnabled: !domainDisabled,
        enabled: settings.globalEnabled && !domainDisabled,
    };
}

// Update extension badge
function updateBadge(enabled) {
    chrome.action.setBadgeText({ text: enabled ? '' : 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: enabled ? '#6366f1' : '#666' });
}

// Listen for tab updates to set badge
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url) {
            const url = new URL(tab.url);
            const state = await getStateForDomain(url.hostname);
            updateBadge(state.enabled);
        }
    } catch (e) {
        // Tab might not have a URL (e.g. chrome:// pages)
    }
});
