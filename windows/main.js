/*
 * File: main.js
 * Author: {amar_avda}
 * Copyright (c) 2026 {amar_avda}
 * Licensed under the GNU General Public License v3.0
 */

const { app, BrowserWindow, BrowserView, ipcMain, session } = require('electron');
const path = require('path');

// ── Ad Blocker: blocked domain list ──────────────────────────────────────────
const AD_DOMAINS = [
    'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
    'adservice.google.', 'pagead2.googlesyndication.com', 'ads.google.com',
    'adnxs.com', 'amazon-adsystem.com', 'media.net', 'outbrain.com',
    'taboola.com', 'revcontent.com', 'criteo.com', 'pubmatic.com',
    'rubiconproject.com', 'openx.net', 'appnexus.com', 'moatads.com',
    'serving-sys.com', 'advertising.com', 'yieldmo.com', 'smartadserver.com',
    'adsafeprotected.com', 'adsrvr.org', 'adroll.com', 'scorecardresearch.com',
    'quantserve.com', 'contextweb.com', 'lijit.com', 'sovrn.com',
    'sharethrough.com', 'triplelift.com', 'indexww.com', '33across.com',
    'casalemedia.com', 'emxdgt.com', 'rhythmone.com', 'undertone.com',
    'yieldlab.net', 'googletagmanager.com', 'google-analytics.com',
    'analytics.google.com', 'hotjar.com', 'segment.io', 'segment.com',
    'mixpanel.com', 'amplitude.com', 'heap.io', 'fullstory.com',
    'mouseflow.com', 'logrocket.com', 'clarity.ms', 'bat.bing.com',
    'facebook.com/tr', 'connect.facebook.net', 'snap.licdn.com',
    'px.ads.linkedin.com', 'ad.doubleclick.net', 'stats.g.doubleclick.net',
    'youtube.com/api/stats/ads', 'youtube.com/pagead/', 'youtube.com/ptracking',
    'youtube.com/youtubei/v1/log_event', 'youtubei/v1/player/ad_break',
    'yt3.ggpht.com/ytad', 'googleads.g.doubleclick.net',
    'static.doubleclick.net', 'ad.youtube.com', 's.youtube.com/api/stats/ads',
    'www.youtube.com/get_video_info?ad',
];

const AD_REGEX = new RegExp(
    AD_DOMAINS.map(d => d.replace(/\./g, '\\.').replace(/\//g, '\\/')).join('|'),
    'i'
);

let mainWindow;
let browserView;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 800,
        minHeight: 500,
        frame: false,
        backgroundColor: '#0a0a0c',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webviewTag: true,
            allowRunningInsecureContent: false,
        },
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        show: false,
    });

    mainWindow.loadFile('index.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // ── BrowserView ───────────────────────────────────────────────────────────
    browserView = new BrowserView({
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            allowRunningInsecureContent: false,
            webSecurity: true,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
    });

    mainWindow.addBrowserView(browserView);
    updateBrowserViewBounds();

    // Recompute bounds on every resize/maximize/restore
    mainWindow.on('resize',      updateBrowserViewBounds);
    mainWindow.on('maximize',    updateBrowserViewBounds);
    mainWindow.on('unmaximize',  updateBrowserViewBounds);
    mainWindow.on('enter-full-screen', updateBrowserViewBounds);
    mainWindow.on('leave-full-screen', updateBrowserViewBounds);

    // ── Page events → renderer ────────────────────────────────────────────────
    browserView.webContents.on('did-start-loading', () => {
        mainWindow.webContents.send('page-loading', true);
    });

    browserView.webContents.on('did-stop-loading', () => {
        mainWindow.webContents.send('page-loading', false);
        const url   = browserView.webContents.getURL();
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

    // ── Offline / error detection ─────────────────────────────────────────────
    browserView.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        if (errorCode === -3) return; // ERR_ABORTED = user pressed stop, ignore
        mainWindow.webContents.send('page-error', {
            errorCode,
            errorDescription,
            url: validatedURL,
        });
    });

    browserView.webContents.setWindowOpenHandler(({ url }) => {
        mainWindow.webContents.send('open-new-tab', { url });
        return { action: 'deny' };
    });
}

// ── BrowserView bounds ────────────────────────────────────────────────────────
// Sits below tab bar (45px) + top nav (60px) = 105px from top
// And to the right of sidebar (65px)
function updateBrowserViewBounds() {
    if (!mainWindow || !browserView) return;
    const { width, height } = mainWindow.getContentBounds();
    const SIDEBAR_WIDTH = 65;
    const TOP_OFFSET    = 137;

    browserView.setBounds({
        x:      SIDEBAR_WIDTH,
        y:      TOP_OFFSET,
        width:  Math.max(0, width  - SIDEBAR_WIDTH),
        height: Math.max(0, height - TOP_OFFSET),
    });
}

// ── IPC: messages from renderer ───────────────────────────────────────────────

ipcMain.on('navigate', (event, { url }) => {
    if (!url) return;
    browserView.webContents.loadURL(url).catch(err => {
        mainWindow.webContents.send('page-error', {
            errorCode: -1,
            errorDescription: err.message,
            url,
        });
    });
    mainWindow.webContents.send('show-webview', true);
});

ipcMain.on('go-back',      () => { if (browserView.webContents.canGoBack())    browserView.webContents.goBack(); });
ipcMain.on('go-forward',   () => { if (browserView.webContents.canGoForward()) browserView.webContents.goForward(); });
ipcMain.on('reload',       () => browserView.webContents.reload());
ipcMain.on('stop-loading', () => browserView.webContents.stop());

ipcMain.on('show-webview', (event, visible) => {
    if (visible) {
        updateBrowserViewBounds();
        mainWindow.addBrowserView(browserView);
    } else {
        mainWindow.removeBrowserView(browserView);
    }
});

ipcMain.on('close-tab', () => {
    if (browserView) {
        browserView.webContents.stop();
        browserView.webContents.loadURL('about:blank');
        mainWindow.removeBrowserView(browserView);
    }
});

// ── Window controls (frameless window) ───────────────────────────────────────
ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow.close());

// ── Resource monitor ─────────────────────────────────────────────────────────
ipcMain.handle('get-process-metrics', () => {
    const metrics = app.getAppMetrics();
    const mem     = process.memoryUsage();
    return {
        processes: metrics.map(m => ({
            pid:    m.pid,
            type:   m.type,
            cpu:    m.cpu    ? parseFloat(m.cpu.percentCPUUsage.toFixed(1))  : 0,
            memory: m.memory ? Math.round(m.memory.workingSetSize / 1024)    : 0,
        })),
        totalRamMB: Math.round(mem.rss / 1024 / 1024),
    };
});

// ── Session setup ─────────────────────────────────────────────────────────────
function setupSession() {
    const ses = session.defaultSession;

    // 1. AD BLOCKER
    ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
        callback({ cancel: AD_REGEX.test(details.url) });
    });

    // 2. FINGERPRINTING PROTECTION + header spoofing
    ses.webRequest.onBeforeSendHeaders({ urls: ['<all_urls>'] }, (details, callback) => {
        const h = details.requestHeaders;

        // Spoof UA to standard Chrome on Windows 10
        h['User-Agent']      = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
        h['Accept-Language'] = 'en-US,en;q=0.9';

        // Remove Electron signature
        delete h['X-Electron-Version'];

        // Remove Client Hints that leak real hardware/OS info
        delete h['Sec-CH-UA-Platform-Version'];
        delete h['Sec-CH-UA-Arch'];
        delete h['Sec-CH-UA-Bitness'];
        delete h['Sec-CH-UA-Full-Version-List'];
        delete h['Sec-CH-UA-Model'];
        delete h['Sec-CH-UA-Full-Version'];
        delete h['Sec-CH-Device-Memory'];

        // Replace Client Hints with spoofed values matching our UA
        h['Sec-CH-UA']          = '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"';
        h['Sec-CH-UA-Mobile']   = '?0';
        h['Sec-CH-UA-Platform'] = '"Windows"';

        callback({ requestHeaders: h });
    });

    // 3. PERMISSIONS
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