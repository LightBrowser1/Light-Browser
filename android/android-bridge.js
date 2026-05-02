/*
File: android-bridge.js
Author: {amar_avda}
Copyright (c) 2026 {amar_avda}
Licensed under the GNU General Public License v3.0

PURPOSE:
  Creates a fake window.electronAPI on Android so renderer.js works
  without modification. Also manages the Android bottom bar and
  ensures the WebView never covers the bottom navigation bar.

HOW TO USE:
  In index.html, load BEFORE renderer.js:
  <script src="android-bridge.js"></script>
  <script src="renderer.js"></script>
*/

(function () {
    'use strict';

    // ── Detect environment ────────────────────────────────────────────────────
    // If real electronAPI exists, we're in Electron desktop — do nothing.
    if (window.electronAPI) return;

    const bridge = window.AndroidBridge || null;

    // ── Activate Android mode ─────────────────────────────────────────────────
    // Adds 'android-mode' class to <body> which mobile.css uses to apply
    // all Android-specific layout rules including the bottom bar.
    document.documentElement.classList.add('android-mode');
    document.body.classList.add('android-mode');

    // ── Event callback stores ─────────────────────────────────────────────────
    const _cb = {
        pageLoading:  [],
        pageLoaded:   [],
        pageNavigate: [],
        pageTitle:    [],
        pageError:    [],
        openNewTab:   [],
    };

    // ── Track browsing state ──────────────────────────────────────────────────
    let _isOnDashboard = true;  // true = showing dashboard, false = showing website
    let _currentUrl    = '';

    // ── Notify Java to resize WebView so it doesn't cover bottom bar ──────────
    // MainActivity.java must implement AndroidBridge.setWebViewBottomPadding(px)
    function setWebViewBounds() {
        if (!bridge || !bridge.setWebViewBottomPadding) return;
        // Bottom bar is 58px + safe area. Tell Java to shrink WebView by that much.
        const abbHeight = 58;
        bridge.setWebViewBottomPadding(abbHeight);
    }

    // ── Bottom bar button state ───────────────────────────────────────────────
    function updateBottomBar() {
        const backBtn    = document.getElementById('abb-back');
        const forwardBtn = document.getElementById('abb-forward');

        if (backBtn) {
            const canGoBack = bridge && bridge.canGoBack ? bridge.canGoBack() : false;
            backBtn.style.opacity = canGoBack ? '1' : '0.3';
        }
        if (forwardBtn) {
            const canGoForward = bridge && bridge.canGoForward ? bridge.canGoForward() : false;
            forwardBtn.style.opacity = canGoForward ? '1' : '0.3';
        }
    }

    // ── Show/hide the webview area overlay ────────────────────────────────────
    function showWebViewArea() {
        const area = document.getElementById('android-webview-area');
        if (area) area.style.display = 'block';
        _isOnDashboard = false;
    }

    function hideWebViewArea() {
        const area = document.getElementById('android-webview-area');
        if (area) area.style.display = 'none';
        _isOnDashboard = true;
    }

    // ── Go home (dashboard) ───────────────────────────────────────────────────
    // Called by the home button in the bottom bar.
    window.androidGoHome = function () {
        if (bridge && bridge.stopLoading) bridge.stopLoading();
        hideWebViewArea();

        const dashboard = document.getElementById('dashboard');
        if (dashboard) dashboard.style.display = 'flex';

        const urlInput = document.getElementById('url-input');
        if (urlInput) urlInput.value = '';

        _cb.pageLoaded.forEach(cb => cb({ url: '', title: 'Start Page' }));
        updateBottomBar();
    };

    // ── Fake electronAPI ──────────────────────────────────────────────────────
    window.electronAPI = {

        navigate(url) {
            _currentUrl = url;
            if (bridge && bridge.navigate) {
                bridge.navigate(url);
            } else {
                // Fallback for testing in a browser
                console.log('[AndroidBridge] navigate:', url);
            }
            showWebViewArea();

            const dashboard = document.getElementById('dashboard');
            if (dashboard) dashboard.style.display = 'none';

            const urlInput = document.getElementById('url-input');
            if (urlInput) urlInput.value = url;

            setWebViewBounds();
        },

        goBack() {
            if (bridge && bridge.goBack) bridge.goBack();
            updateBottomBar();
        },

        goForward() {
            if (bridge && bridge.goForward) bridge.goForward();
            updateBottomBar();
        },

        reload() {
            if (bridge && bridge.reload) bridge.reload();
            else if (!_isOnDashboard) console.log('[AndroidBridge] reload');
        },

        stopLoading() {
            if (bridge && bridge.stopLoading) bridge.stopLoading();
        },

        // No-ops (Android handles its own layout)
        showWebview(bool) { /* handled by navigate/androidGoHome */ },
        closeTab()        { if (bridge && bridge.stopLoading) bridge.stopLoading(); },
        updateBounds()    { setWebViewBounds(); },
        minimize()        {},
        maximize()        {},
        close()           { if (bridge && bridge.closeApp) bridge.closeApp(); },

        // ── Event subscriptions ───────────────────────────────────────────────
        onPageLoading(cb)  { _cb.pageLoading.push(cb); },
        onPageLoaded(cb)   { _cb.pageLoaded.push(cb); },
        onPageNavigate(cb) { _cb.pageNavigate.push(cb); },
        onPageTitle(cb)    { _cb.pageTitle.push(cb); },
        onPageError(cb)    { _cb.pageError.push(cb); },
        onOpenNewTab(cb)   { _cb.openNewTab.push(cb); },
        onShowWebview(cb)  { /* no-op */ },
    };

    // ── Callbacks called by MainActivity.java ─────────────────────────────────

    // Java calls this when WebView starts loading
    window.onAndroidPageStarted = function (url) {
        _currentUrl = url;
        _cb.pageLoading.forEach(cb => cb(true));
        _cb.pageNavigate.forEach(cb => cb({ url }));

        const urlInput = document.getElementById('url-input');
        if (urlInput) urlInput.value = url;
    };

    // Java calls this when WebView finishes loading
    window.onAndroidPageFinished = function (url, title) {
        _currentUrl = url;
        _cb.pageLoading.forEach(cb => cb(false));
        _cb.pageLoaded.forEach(cb => cb({ url, title: title || url }));
        if (title) _cb.pageTitle.forEach(cb => cb({ title }));

        const urlInput = document.getElementById('url-input');
        if (urlInput && url) urlInput.value = url;

        updateBottomBar();
    };

    // Java calls this on page error / no internet
    window.onAndroidPageError = function (url, errorCode, description) {
        _cb.pageLoading.forEach(cb => cb(false));
        _cb.pageError.forEach(cb => cb({ errorCode, errorDescription: description, url }));
        updateBottomBar();
    };

    // ── Intercept <a> clicks ──────────────────────────────────────────────────
    document.addEventListener('click', function (e) {
        const a = e.target.closest('a[href]');
        if (!a) return;
        const href = a.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript')) return;
        if (/^https?:\/\//i.test(href)) {
            e.preventDefault();
            window.electronAPI.navigate(href);
        }
    }, true);

    // ── Init on DOM ready ─────────────────────────────────────────────────────
    function init() {
        // Ensure dashboard is visible at start
        const dashboard = document.getElementById('dashboard');
        if (dashboard) dashboard.style.display = 'flex';

        // Bottom bar: initially dim back/forward since we're on dashboard
        updateBottomBar();

        // Tell Java WebView to shrink so bottom bar is always visible
        setWebViewBounds();

        // Patch renderer.js functions after it loads
        const _origShow = window.showDashboard;
        window.showDashboard = function () {
            const d = document.getElementById('dashboard');
            if (d) d.style.display = 'flex';
            hideWebViewArea();
            const urlInput = document.getElementById('url-input');
            if (urlInput) urlInput.value = '';
        };

        const _origHide = window.hideDashboard;
        window.hideDashboard = function () {
            const d = document.getElementById('dashboard');
            if (d) d.style.display = 'none';
            showWebViewArea();
        };

        console.log('[LightBrowser] Android bridge active');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();