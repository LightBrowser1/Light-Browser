/*
 * File: preload.js
 * Author: {amar_avda}
 * Copyright (c) 2026 {amar_avda}
 * Licensed under the GNU General Public License v3.0
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

    // ── Send to main ──────────────────────────────────────────────────────────
    navigate:       (url)  => ipcRenderer.send('navigate', { url }),
    goBack:         ()     => ipcRenderer.send('go-back'),
    goForward:      ()     => ipcRenderer.send('go-forward'),
    reload:         ()     => ipcRenderer.send('reload'),
    stopLoading:    ()     => ipcRenderer.send('stop-loading'),
    showWebview:    (bool) => ipcRenderer.send('show-webview', bool),
    closeTab:       ()     => ipcRenderer.send('close-tab'),

    // Window controls
    minimize:       ()     => ipcRenderer.send('window-minimize'),
    maximize:       ()     => ipcRenderer.send('window-maximize'),
    close:          ()     => ipcRenderer.send('window-close'),

    // ── Receive from main ─────────────────────────────────────────────────────
    onPageLoading:  (cb) => ipcRenderer.on('page-loading',  (_, v) => cb(v)),
    onPageLoaded:   (cb) => ipcRenderer.on('page-loaded',   (_, v) => cb(v)),
    onPageNavigate: (cb) => ipcRenderer.on('page-navigate', (_, v) => cb(v)),
    onPageTitle:    (cb) => ipcRenderer.on('page-title',    (_, v) => cb(v)),
    onPageError:    (cb) => ipcRenderer.on('page-error',    (_, v) => cb(v)),
    onShowWebview:  (cb) => ipcRenderer.on('show-webview',  (_, v) => cb(v)),
    onOpenNewTab:   (cb) => ipcRenderer.on('open-new-tab',  (_, v) => cb(v)),

    // ── Resource monitor ──────────────────────────────────────────────────────
    getProcessMetrics: () => ipcRenderer.invoke('get-process-metrics'),
});