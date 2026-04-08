/*
 * /*
 *  * File: main.js
 *  * Author: {amar_avda}
 *  * Copyright (c) 2026 {amar_avda}
 *  * Licensed under the GNU General Public License v3.0
 */

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
let browserView; // The actual web view that loads websites

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

    // Attach view to window but keep it hidden until a URL is loaded
    mainWindow.addBrowserView(browserView);
    updateBrowserViewBounds(); // Size it correctly

    // Resize BrowserView when window resizes
    mainWindow.on('resize', updateBrowserViewBounds);

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

function updateBrowserViewBounds() {
    if (!mainWindow || !browserView) return;
    const { width, height } = mainWindow.getContentBounds();
    const SIDEBAR_WIDTH = 65;
    const TOP_OFFSET    = 105; // tabs (45) + topnav (60)

    browserView.setBounds({
        x: SIDEBAR_WIDTH,
        y: TOP_OFFSET,
        width:  width  - SIDEBAR_WIDTH,
        height: height - TOP_OFFSET,
    });
}

// ── IPC: messages from renderer.js ────────────────────────────────────────────

// Navigate to a URL
ipcMain.on('navigate', (event, { url }) => {
    if (!url) return;
    browserView.webContents.loadURL(url).catch(err => {
        console.error('Navigation error:', err);
        mainWindow.webContents.send('page-error', { message: err.message });
    });
    // Show the BrowserView (it was hidden while on dashboard)
    mainWindow.webContents.send('show-webview', true);
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

// Show or hide the BrowserView (dashboard vs web page)
ipcMain.on('show-webview', (event, visible) => {
    if (visible) {
        updateBrowserViewBounds();
        mainWindow.addBrowserView(browserView);
    } else {
        mainWindow.removeBrowserView(browserView);
    }
});

// ── FIX: Gasenje zvuka i taba nasilno ───────────────────────────────────────
ipcMain.on('close-tab', () => {
    if (browserView) {
        browserView.webContents.stop(); // Odmah prekida sve procese (pa i zvuk)
        browserView.webContents.loadURL('about:blank'); // Čisti stranicu
        mainWindow.removeBrowserView(browserView); // Miče je sa ekrana
    }
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