// VideoKeys — Content Script
// YouTube keyboard shortcuts for any HTML5 video

(function () {
    'use strict';

    // ─── State ──────────────────────────────────────────────
    let enabled = true;
    let activeVideo = null;
    let allVideos = [];
    let overlayTimeout = null;

    // ─── Video Detection ────────────────────────────────────

    function findAllVideos() {
        allVideos = Array.from(document.querySelectorAll('video')).filter(
            (v) => v.offsetWidth > 0 && v.offsetHeight > 0
        );
        if (allVideos.length > 0 && !allVideos.includes(activeVideo)) {
            activeVideo = getBestVideo();
        }
    }

    function getBestVideo() {
        // Prefer a video that's currently playing
        const playing = allVideos.find((v) => !v.paused && !v.ended);
        if (playing) return playing;

        // Prefer the most visible video in the viewport
        let best = null;
        let bestArea = 0;
        for (const video of allVideos) {
            const rect = video.getBoundingClientRect();
            const visibleWidth = Math.max(
                0,
                Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0)
            );
            const visibleHeight = Math.max(
                0,
                Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)
            );
            const area = visibleWidth * visibleHeight;
            if (area > bestArea) {
                bestArea = area;
                best = video;
            }
        }
        return best || allVideos[0] || null;
    }

    // Track which video the user interacts with
    function trackVideoInteraction(e) {
        const video = e.target.closest('video') || findVideoAncestor(e.target);
        if (video && allVideos.includes(video)) {
            activeVideo = video;
        }
    }

    // Some sites wrap videos in layers of divs — walk up to find the video container
    function findVideoAncestor(el) {
        let current = el;
        for (let i = 0; i < 5; i++) {
            if (!current || !current.parentElement) return null;
            current = current.parentElement;
            const v = current.querySelector('video');
            if (v) return v;
        }
        return null;
    }

    // Observe DOM for dynamically added videos
    const observer = new MutationObserver((mutations) => {
        let shouldRefresh = false;
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeName === 'VIDEO' || (node.querySelector && node.querySelector('video'))) {
                    shouldRefresh = true;
                    break;
                }
            }
            if (shouldRefresh) break;
        }
        if (shouldRefresh) {
            findAllVideos();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Also re-detect on scroll (twitter infinite scroll)
    let scrollTimer;
    window.addEventListener(
        'scroll',
        () => {
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
                findAllVideos();
                activeVideo = getBestVideo();
            }, 200);
        },
        { passive: true }
    );

    // Click/hover tracking
    document.addEventListener('click', trackVideoInteraction, true);
    document.addEventListener('mouseover', trackVideoInteraction, { passive: true });

    // Initial scan
    findAllVideos();

    // ─── Overlay Feedback ───────────────────────────────────

    function ensureOverlayPositioning(container) {
        if (!container) return null;
        const style = window.getComputedStyle(container);
        if (style.position === 'static') {
            container.style.position = 'relative';
        }
        return container;
    }

    function getVideoContainer(video) {
        const fullscreenHost = document.fullscreenElement;
        if (fullscreenHost && (fullscreenHost === video || fullscreenHost.contains(video))) {
            return ensureOverlayPositioning(fullscreenHost);
        }

        // Find a positioned parent or create a wrapper
        let container = video.parentElement;
        while (container && container !== document.body) {
            const style = window.getComputedStyle(container);
            if (
                style.position === 'relative' ||
                style.position === 'absolute' ||
                style.position === 'fixed'
            ) {
                return ensureOverlayPositioning(container);
            }
            container = container.parentElement;
        }

        // Fallback: use the video's direct parent and make it relative
        const parent = video.parentElement;
        return ensureOverlayPositioning(parent);
    }

    function showOverlay(video, icon, text, extra) {
        const container = getVideoContainer(video);
        if (!container) return;

        // Remove any existing overlay
        const existing = container.querySelector('.vk-overlay');
        if (existing) existing.remove();
        clearTimeout(overlayTimeout);

        const overlay = document.createElement('div');
        overlay.className = 'vk-overlay';

        let html = '';
        if (icon) html += `<span class="vk-overlay-icon">${icon}</span>`;
        if (text) html += `<span class="vk-overlay-text">${text}</span>`;
        if (extra) html += extra;
        overlay.innerHTML = html;

        container.appendChild(overlay);

        // Trigger show animation
        requestAnimationFrame(() => {
            overlay.classList.add('vk-show');
        });

        // Fade out
        overlayTimeout = setTimeout(() => {
            overlay.classList.remove('vk-show');
            overlay.classList.add('vk-fade');
            setTimeout(() => overlay.remove(), 400);
        }, 700);
    }

    function volumeBar(volume) {
        const pct = Math.round(volume * 100);
        return `<div class="vk-volume-bar"><div class="vk-volume-fill" style="width:${pct}%"></div></div>`;
    }

    function speedPill(rate) {
        return `<span class="vk-speed-pill">${rate}x</span>`;
    }

    function progressBar(video) {
        if (!video.duration || !isFinite(video.duration) || video.duration <= 0) return '';
        const pct = Math.max(0, Math.min(100, (video.currentTime / video.duration) * 100));
        return `<div class="vk-progress-wrap"><div class="vk-progress-bar" style="width:${pct}%"></div></div>`;
    }

    // ─── Input Guard ────────────────────────────────────────

    function isTyping() {
        const el = document.activeElement;
        if (!el) return false;
        const tag = el.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
        if (el.isContentEditable) return true;
        // Twitter's tweet compose box
        if (el.getAttribute('role') === 'textbox') return true;
        return false;
    }

    // ─── Keyboard Handler ──────────────────────────────────

    function handleKeydown(e) {
        if (!enabled) return;
        if (isTyping()) return;

        const video = activeVideo || getBestVideo();
        if (!video) return;

        // Don't intercept if modifier keys are held (except shift for speed)
        if (e.ctrlKey || e.altKey || e.metaKey) return;

        let handled = false;
        const key = e.key;
        const code = e.code;

        switch (key) {
            case ' ':
            case 'k':
            case 'K': {
                if (video.paused) {
                    video.play();
                    showOverlay(video, '▶', 'Play');
                } else {
                    video.pause();
                    showOverlay(video, '⏸', 'Paused');
                }
                handled = true;
                break;
            }

            case 'j':
            case 'J': {
                video.currentTime = Math.max(0, video.currentTime - 10);
                showOverlay(video, '⏪', '-10s', progressBar(video));
                handled = true;
                break;
            }

            case 'l':
            case 'L': {
                video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
                showOverlay(video, '⏩', '+10s', progressBar(video));
                handled = true;
                break;
            }

            case 'ArrowLeft': {
                video.currentTime = Math.max(0, video.currentTime - 5);
                showOverlay(video, '⏪', '-5s', progressBar(video));
                handled = true;
                break;
            }

            case 'ArrowRight': {
                video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 5);
                showOverlay(video, '⏩', '+5s', progressBar(video));
                handled = true;
                break;
            }

            case 'ArrowUp': {
                video.volume = Math.min(1, video.volume + 0.05);
                showOverlay(video, '🔊', `${Math.round(video.volume * 100)}%`, volumeBar(video.volume));
                handled = true;
                break;
            }

            case 'ArrowDown': {
                video.volume = Math.max(0, video.volume - 0.05);
                const volIcon = video.volume === 0 ? '🔇' : '🔉';
                showOverlay(video, volIcon, `${Math.round(video.volume * 100)}%`, volumeBar(video.volume));
                handled = true;
                break;
            }

            case 'm':
            case 'M': {
                video.muted = !video.muted;
                showOverlay(video, video.muted ? '🔇' : '🔊', video.muted ? 'Muted' : 'Unmuted');
                handled = true;
                break;
            }

            case 'f':
            case 'F': {
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                    showOverlay(video, '⛶', 'Exit Fullscreen');
                } else {
                    (video.parentElement || video).requestFullscreen().catch(() => {
                        video.requestFullscreen().catch(() => { });
                    });
                    showOverlay(video, '⛶', 'Fullscreen');
                }
                handled = true;
                break;
            }

            case '>': {
                // Shift + >
                if (e.shiftKey) {
                    video.playbackRate = Math.min(4, video.playbackRate + 0.25);
                    showOverlay(video, '⏩', 'Speed', speedPill(video.playbackRate));
                    handled = true;
                }
                break;
            }

            case '<': {
                // Shift + <
                if (e.shiftKey) {
                    video.playbackRate = Math.max(0.25, video.playbackRate - 0.25);
                    showOverlay(video, '⏪', 'Speed', speedPill(video.playbackRate));
                    handled = true;
                }
                break;
            }

            case ',': {
                // Frame back (when paused)
                if (video.paused) {
                    video.currentTime = Math.max(0, video.currentTime - 1 / 30);
                    showOverlay(video, '◀', 'Frame -1');
                    handled = true;
                }
                break;
            }

            case '.': {
                // Frame forward (when paused)
                if (video.paused) {
                    video.currentTime += 1 / 30;
                    showOverlay(video, '▶', 'Frame +1');
                    handled = true;
                }
                break;
            }

            default: {
                // Number keys 0-9 for percentage seek
                if (key >= '0' && key <= '9' && !e.shiftKey) {
                    const pct = parseInt(key) / 10;
                    if (video.duration && isFinite(video.duration)) {
                        video.currentTime = video.duration * pct;
                        showOverlay(video, '⏭', `${parseInt(key) * 10}%`, progressBar(video));
                        handled = true;
                    }
                }
                break;
            }
        }

        if (handled) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
    }

    // Use capture phase to intercept before site handlers
    document.addEventListener('keydown', handleKeydown, true);

    // ─── Communication with Background ─────────────────────

    // Get initial state
    const domain = window.location.hostname;
    chrome.runtime.sendMessage({ type: 'GET_STATE', domain }, (response) => {
        if (response) {
            enabled = response.enabled;
        }
    });

    // Listen for state changes
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'STATE_CHANGED') {
            enabled = message.enabled;
        }
        if (message.type === 'QUERY_VIDEOS') {
            findAllVideos();
            sendResponse({
                count: allVideos.length,
                hasActive: !!activeVideo,
            });
        }
        return true;
    });
})();
