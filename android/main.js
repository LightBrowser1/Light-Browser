/*
File: main.js
Author: {amar_avda}
Copyright (c) {2026} {amar_avda}
Licensed under the GNU General Public License v3.0
*/

const { app, BrowserWindow, BrowserView, ipcMain, session } = require('electron');
const path = require('path');

// ── Ad Blocker: blocked domain list ──────────────────────────────────────────
// Covers generic ad networks, trackers, and YouTube-specific ad endpoints.
// Uses substring matching — if any of these strings appear in the request URL,
// the request is cancelled before it leaves the machine.

const AD_DOMAINS = [
    // ── Generic ad networks ──
    'doubleclick.net',
    'googlesyndication.com',
    'googleadservices.com',
    'adservice.google.',
    'pagead2.googlesyndication.com',
    'ads.google.com',
    'adnxs.com',
    'amazon-adsystem.com',
    'media.net',
    'outbrain.com',
    'taboola.com',
    'revcontent.com',
    'criteo.com',
    'pubmatic.com',
    'rubiconproject.com',
    'openx.net',
    'appnexus.com',
    'moatads.com',
    'serving-sys.com',
    'advertising.com',
    'yieldmo.com',
    'smartadserver.com',
    'adsafeprotected.com',
    'adsrvr.org',
    'adroll.com',
    'scorecardresearch.com',
    'quantserve.com',
    'contextweb.com',
    'lijit.com',
    'sovrn.com',
    'sharethrough.com',
    'triplelift.com',
    'indexww.com',
    '33across.com',
    'casalemedia.com',
    'emxdgt.com',
    'rhythmone.com',
    'undertone.com',
    'yieldlab.net',

    // ── Trackers ──
    'googletagmanager.com',
    'google-analytics.com',
    'analytics.google.com',
    'hotjar.com',
    'segment.io',
    'segment.com',
    'mixpanel.com',
    'amplitude.com',
    'heap.io',
    'fullstory.com',
    'mouseflow.com',
    'logrocket.com',
    'clarity.ms',
    'bat.bing.com',
    'facebook.com/tr',      // FB pixel
    'connect.facebook.net', // FB SDK (ads)
    'snap.licdn.com',
    'px.ads.linkedin.com',
    'ad.doubleclick.net',
    'stats.g.doubleclick.net',

    // ── YouTube ad endpoints ──
    // These are the URLs YouTube uses to fetch, measure, and trigger pre/mid/post-roll ads.
    'youtube.com/api/stats/ads',
    'youtube.com/pagead/',
    'youtube.com/ptracking',
    'youtube.com/youtubei/v1/log_event',
    'youtubei/v1/player/ad_break',
    'yt3.ggpht.com/ytad',       // YouTube ad thumbnails
    'googleads.g.doubleclick.net',
    'static.doubleclick.net',
    'ad.youtube.com',
    's.youtube.com/api/stats/ads',
    'www.youtube.com/get_video_info?ad',
];

// Pre-build a single RegExp for fast matching (much faster than looping strings)
const AD_REGEX = new RegExp(
    AD_DOMAINS.map(d => d.replace(/\./g, '\\.').replace(/\//g, '\\/')).join('|'),
    'i'
);

let mainWindow;
let browserView;       // The actual web engine
let browserViewVisible = false; // Track whether BrowserView is currently shown

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 800,
        minHeight: 500,
        frame: false,           // Remove default OS frame (we have our own UI)
        backgroundColor: '#0a0a0c',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webviewTag: true,           // Allow <webview> tags
            allowRunningInsecureContent: false,
        },
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        show: false, // Don't flash white before load
    });

    // Load the main browser UI
    mainWindow.loadFile('index.html');

    // Show window smoothly when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // ── BrowserView: the real web engine ──────────────────────────────────────
    // BrowserView renders actual websites INSIDE the window, bypassing iframe
    // restrictions (CORS, X-Frame-Options, CSP — all ignored by BrowserView).

    browserView = new BrowserView({
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            allowRunningInsecureContent: false,
            webSecurity: true,
            // Spoof a real Chrome user-agent so sites don't block us
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
    });

    // Don't add BrowserView yet — it stays hidden until a URL is loaded.
    // This prevents it from covering the dashboard on startup.

    // Resize BrowserView whenever the window changes size or maximises
    mainWindow.on('resize', () => {
        updateBrowserViewBounds();
    });

    // ── Forward page events to renderer ───────────────────────────────────────

    browserView.webContents.on('did-start-loading', () => {
        mainWindow.webContents.send('page-loading', true);
    });

    browserView.webContents.on('did-stop-loading', () => {
        mainWindow.webContents.send('page-loading', false);
        const url = browserView.webContents.getURL();
        const title = browserView.webContents.getTitle();
        mainWindow.webContents.send('page-loaded', { url, title });
    });

    browserView.webContents.on('did-navigate', (event, url) => {
        mainWindow.webContents.send('page-navigate', { url });
    });

    browserView.webContents.on('did-navigate-in-page', (event, url) => {
        mainWindow.webContents.send('page-navigate', { url });
    });

    browserView.webContents.on('page-title-updated', (event, title) => {
        mainWindow.webContents.send('page-title', { title });
    });

    // Handle new windows (target="_blank" links)
    browserView.webContents.setWindowOpenHandler(({ url }) => {
        // Instead of opening a new OS window, tell renderer to open a new tab
        mainWindow.webContents.send('open-new-tab', { url });
        return { action: 'deny' };
    });
}

// ── Calculate where the BrowserView should sit ────────────────────────────────
// It must appear BELOW the tab bar (45px) and top nav (60px) = 105px from top
// and to the RIGHT of the sidebar (65px).

// Mobile breakpoint must match mobile.css @media value
const MOBILE_BREAKPOINT = 768;

function isMobileLayout() {
    if (!mainWindow) return false;
    return mainWindow.getContentBounds().width <= MOBILE_BREAKPOINT;
}

function updateBrowserViewBounds() {
    if (!mainWindow || !browserView) return;
    const { width, height } = mainWindow.getContentBounds();

    let x, y, bvWidth, bvHeight;

    if (isMobileLayout()) {
        // Mobile layout — must match mobile.css exactly:
        //   tabs-outer-container: 38px
        //   top-nav:              52px
        //   sidebar (bottom nav): 56px  ← fixed at bottom, not subtracted from y
        const TAB_HEIGHT    = 38;
        const TOPNAV_HEIGHT = 52;
        const BOTTOM_NAV    = 56;
        const TOP_OFFSET    = TAB_HEIGHT + TOPNAV_HEIGHT; // 90px from top

        x        = 0;
        y        = TOP_OFFSET;          // BrowserView starts below tab+nav bars
        bvWidth  = width;               // full width (no sidebar on the side)
        bvHeight = height - TOP_OFFSET - BOTTOM_NAV; // stops above bottom nav bar
    } else {
        // Desktop layout — must match style.css exactly:
        //   sidebar:   65px wide on the left
        //   tabs:      45px tall
        //   top-nav:   60px tall
        const SIDEBAR_WIDTH = 65;
        const TAB_HEIGHT    = 45;
        const TOPNAV_HEIGHT = 60;
        const TOP_OFFSET    = TAB_HEIGHT + TOPNAV_HEIGHT; // 105px from top

        x        = SIDEBAR_WIDTH;               // starts to the right of sidebar
        y        = TOP_OFFSET;                  // starts below tab bar + nav bar
        bvWidth  = width  - SIDEBAR_WIDTH;      // sidebar stays visible on left
        bvHeight = height - TOP_OFFSET;         // fills rest of screen downward
    }

    browserView.setBounds({
        x,
        y,
        width:  Math.max(bvWidth,  100),
        height: Math.max(bvHeight, 100),
    });
}

// ── BrowserView show/hide helpers ────────────────────────────────────────────
// Centralised here so there's ONE place that manages addBrowserView/remove.
// This avoids the bug where calling addBrowserView twice renders it behind the UI.

function showBrowserView() {
    if (!mainWindow || !browserView) return;

    updateBrowserViewBounds(); // always recalculate position first

    if (!browserViewVisible) {
        // setTopBrowserView ensures it renders ON TOP of everything else
        mainWindow.addBrowserView(browserView);
        mainWindow.setTopBrowserView(browserView);
        browserViewVisible = true;
    } else {
        // Already added — just make sure it's on top and bounds are fresh
        mainWindow.setTopBrowserView(browserView);
    }
}

function hideBrowserView() {
    if (!mainWindow || !browserView) return;
    if (browserViewVisible) {
        mainWindow.removeBrowserView(browserView);
        browserViewVisible = false;
    }
}

// ── IPC: messages from renderer.js ────────────────────────────────────────────

// Navigate to a URL
ipcMain.on('navigate', (event, { url }) => {
    if (!url) return;

    // Make sure BrowserView is attached and in the right position BEFORE loading
    showBrowserView();

    browserView.webContents.loadURL(url).catch(err => {
        console.error('Navigation error:', err);
        mainWindow.webContents.send('page-error', { message: err.message });
    });
});

// Go back
ipcMain.on('go-back', () => {
    if (browserView.webContents.canGoBack()) {
        browserView.webContents.goBack();
    }
});

// Go forward
ipcMain.on('go-forward', () => {
    if (browserView.webContents.canGoForward()) {
        browserView.webContents.goForward();
    }
});

// Reload
ipcMain.on('reload', () => {
    browserView.webContents.reload();
});

// Stop loading
ipcMain.on('stop-loading', () => {
    browserView.webContents.stop();
});

// Show or hide the BrowserView (called from renderer showDashboard/hideDashboard)
ipcMain.on('show-webview', (event, visible) => {
    if (visible) {
        showBrowserView();
    } else {
        hideBrowserView();
    }
});

// Renderer reports window resize (e.g. orientation change on Android)
ipcMain.on('update-bounds', () => {
    updateBrowserViewBounds();
});

// Window controls (since we use frameless window)
ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow.close());

// ── Session: adblocker + custom headers + permissions ────────────────────────

function setupSession() {
    const ses = session.defaultSession;

    // 1. AD BLOCKER ─────────────────────────────────────────────────────────────
    // Runs before every network request. If the URL matches our regex, cancel it.
    // This fires at the network layer — the page never even gets a response.
    ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
        const block = AD_REGEX.test(details.url);
        if (block) {
            // Uncomment the next line to see what's being blocked in the console:
            // console.log('[AdBlock] Blocked:', details.url);
        }
        callback({ cancel: block });
    });

    // 2. SPOOF HEADERS ──────────────────────────────────────────────────────────
    // Makes Light Browser look like a real Chrome install so sites don't serve
    // degraded pages or bot-detection challenges.
    ses.webRequest.onBeforeSendHeaders({ urls: ['<all_urls>'] }, (details, callback) => {
        details.requestHeaders['User-Agent'] =
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
        details.requestHeaders['Accept-Language'] = 'en-US,en;q=0.9';
        // Remove the Electron signature header that some sites block on
        delete details.requestHeaders['X-Electron-Version'];
        callback({ requestHeaders: details.requestHeaders });
    });

    // 3. PERMISSIONS ────────────────────────────────────────────────────────────
    ses.setPermissionRequestHandler((webContents, permission, callback) => {
        const allowed = ['media', 'geolocation', 'notifications', 'fullscreen', 'clipboard-read'];
        callback(allowed.includes(permission));
    });
}

app.whenReady().then(() => {
    setupSession();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});