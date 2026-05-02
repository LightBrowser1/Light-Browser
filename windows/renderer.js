/*
 * File: renderer.js
 * Author: {amar_avda}
 * Copyright (c) 2026 {amar_avda}
 * Licensed under the GNU General Public License v3.0
 */

// ── Search Engine Manager ─────────────────────────────────────────────────────

const SEARCH_ENGINES = {
    duckduckgo: { name: 'DuckDuckGo',   url: 'https://duckduckgo.com/?q=',         icon: 'fa-solid fa-shield-dog' },
    google:     { name: 'Google',       url: 'https://www.google.com/search?q=',   icon: 'fa-brands fa-google' },
    bing:       { name: 'Bing',         url: 'https://www.bing.com/search?q=',     icon: 'fa-brands fa-microsoft' },
    brave:      { name: 'Brave Search', url: 'https://search.brave.com/search?q=', icon: 'fa-solid fa-shield-halved' },
    ecosia:     { name: 'Ecosia',       url: 'https://www.ecosia.org/search?q=',   icon: 'fa-solid fa-leaf' },
    startpage:  { name: 'Startpage',    url: 'https://www.startpage.com/search?q=',icon: 'fa-solid fa-star' },
};

let currentEngineKey = localStorage.getItem('searchEngine') || 'duckduckgo';

function getEngine() {
    return SEARCH_ENGINES[currentEngineKey] || SEARCH_ENGINES.duckduckgo;
}

function buildUrl(input) {
    input = input.trim();
    if (!input) return null;
    if (/^https?:\/\//i.test(input)) return input;
    if (/^[^\s]+\.[a-z]{2,}(\/.*)?$/i.test(input) && !input.includes(' ')) return 'https://' + input;
    return getEngine().url + encodeURIComponent(input);
}

// ── Tab Manager ───────────────────────────────────────────────────────────────

class TabManager {
    constructor() {
        this.tabs     = [];
        this.activeId = null;
        this.counter  = 0;
        this.tabBar   = document.getElementById('tab-bar');
        this.newTabBtn= document.getElementById('new-tab-btn');

        if (!this.tabBar) { console.error('#tab-bar missing'); return; }
        this._init();
    }

    _init() {
        this.newTabBtn?.addEventListener('click', () => this.newTab());
        this.newTab();
    }

    newTab(url = null, title = 'Start Page') {
        const id = `tab-${++this.counter}`;
        this.tabs.push({ id, title: url ? (title || this._hostFromUrl(url)) : 'Start Page', url: url || '', loading: false });
        this.activeId = id;
        this.render();
        if (url) this._navigateTo(url);
        else showDashboard();
    }

    closeTab(id, e) {
        if (e) e.stopPropagation();
        const idx = this.tabs.findIndex(t => t.id === id);
        if (idx === -1) return;
        const closingActive = (this.activeId === id);
        this.tabs.splice(idx, 1);
        window.electronAPI?.closeTab();
        if (this.tabs.length === 0) { this.newTab(); return; }
        if (closingActive) {
            const next = this.tabs[Math.max(0, idx - 1)];
            this.activeId = next.id;
            this.render();
            if (next.url) this._navigateTo(next.url);
            else showDashboard();
        } else {
            this.render();
        }
    }

    switchTo(id) {
        if (this.activeId === id) return;
        const tab = this.tabs.find(t => t.id === id);
        if (!tab) return;
        this.activeId = id;
        this.render();
        if (tab.url) this._navigateTo(tab.url);
        else showDashboard();
    }

    updateActive(patch) {
        const tab = this._active();
        if (!tab) return;
        Object.assign(tab, patch);
        this.render();
    }

    _active() { return this.tabs.find(t => t.id === this.activeId); }

    _navigateTo(url) {
        window.electronAPI?.navigate(url);
        hideOfflinePage();
        hideDashboard();
        const urlInput = document.getElementById('url-input');
        if (urlInput) urlInput.value = url;
        this.updateActive({ url, loading: true });
    }

    _hostFromUrl(url) {
        try { return new URL(url).hostname.replace('www.', ''); }
        catch { return url; }
    }

    render() {
        if (!this.tabBar) return;
        this.tabBar.innerHTML = '';
        this.tabs.forEach(tab => {
            const el = document.createElement('div');
            el.className = `tab${tab.id === this.activeId ? ' active' : ''}`;
            el.innerHTML = `
                ${tab.loading
                    ? '<i class="fa-solid fa-circle-notch tab-spinner"></i>'
                    : '<i class="fa-solid fa-globe tab-favicon"></i>'}
                <span class="tab-title">${tab.title}</span>
                <i class="fa-solid fa-xmark tab-close"></i>
            `;
            el.addEventListener('click', () => this.switchTo(tab.id));
            el.querySelector('.tab-close').addEventListener('click', e => {
                e.stopPropagation();
                this.closeTab(tab.id, e);
            });
            this.tabBar.appendChild(el);
        });
    }
}

// ── Dashboard / offline show-hide ─────────────────────────────────────────────

function showDashboard() {
    const dashboard = document.getElementById('dashboard');
    if (dashboard) dashboard.style.display = 'flex';
    hideOfflinePage();
    window.electronAPI?.showWebview(false);
    window.electronAPI?.closeTab();
    const urlInput = document.getElementById('url-input');
    if (urlInput) urlInput.value = '';
}

function hideDashboard() {
    const dashboard = document.getElementById('dashboard');
    if (dashboard) dashboard.style.display = 'none';
    window.electronAPI?.showWebview(true);
}

function showOfflinePage(url) {
    const op = document.getElementById('offline-page');
    const ou = document.getElementById('offline-url');
    if (op) op.style.display = 'flex';
    if (ou) ou.textContent = url || '';
    // Hide the dashboard and BrowserView behind
    const dashboard = document.getElementById('dashboard');
    if (dashboard) dashboard.style.display = 'none';
    window.electronAPI?.showWebview(false);
}

function hideOfflinePage() {
    const op = document.getElementById('offline-page');
    if (op) op.style.display = 'none';
}

// ── Navigation ────────────────────────────────────────────────────────────────

function navigate(input, tabManager) {
    const url = buildUrl(input);
    if (!url) return;
    tabManager._navigateTo(url);
}

// ── Engine picker ─────────────────────────────────────────────────────────────

function injectEngineIndicator() {
    const searchBar = document.querySelector('.top-nav .search-bar');
    if (!searchBar || document.getElementById('engine-indicator')) return;
    const btn = document.createElement('button');
    btn.id        = 'engine-indicator';
    btn.className = 'engine-indicator-btn';
    btn.innerHTML = `<i class="${getEngine().icon}"></i>`;
    btn.onclick   = toggleEngineMenu;
    const oldIcon = searchBar.querySelector('i');
    if (oldIcon) oldIcon.style.display = 'none';
    searchBar.insertBefore(btn, searchBar.querySelector('input'));
}

function toggleEngineMenu() {
    const existing = document.getElementById('engine-menu');
    if (existing) { existing.remove(); return; }
    const menu = document.createElement('div');
    menu.id = 'engine-menu';
    menu.innerHTML = `
        <div class="engine-menu-header">Search Engine</div>
        ${Object.entries(SEARCH_ENGINES).map(([key, e]) => `
            <div class="engine-option ${key === currentEngineKey ? 'active' : ''}" data-key="${key}">
                <i class="${e.icon}"></i>
                <span>${e.name}</span>
                ${key === currentEngineKey ? '<i class="fa-solid fa-check engine-check"></i>' : ''}
            </div>
        `).join('')}
    `;
    menu.querySelectorAll('.engine-option').forEach(opt => {
        opt.addEventListener('click', () => {
            currentEngineKey = opt.dataset.key;
            localStorage.setItem('searchEngine', currentEngineKey);
            const btn = document.getElementById('engine-indicator');
            if (btn) btn.innerHTML = `<i class="${getEngine().icon}"></i>`;
            menu.remove();
        });
    });
    const topNav = document.querySelector('.top-nav');
    if (topNav) { topNav.style.position = 'relative'; topNav.appendChild(menu); }
    setTimeout(() => {
        document.addEventListener('click', function handler(e) {
            if (!menu.contains(e.target) && e.target.id !== 'engine-indicator') {
                menu.remove();
                document.removeEventListener('click', handler);
            }
        });
    }, 0);
}

// ── Nav buttons ───────────────────────────────────────────────────────────────

function injectNavButtons() {
    const container = document.querySelector('.search-container');
    if (!container || document.getElementById('nav-back')) return;
    const arrows = document.createElement('div');
    arrows.className = 'nav-arrows';
    arrows.innerHTML = `
        <button class="icon-btn" id="nav-back"    onclick="window.electronAPI?.goBack()"><i class="fa-solid fa-arrow-left"></i></button>
        <button class="icon-btn" id="nav-forward" onclick="window.electronAPI?.goForward()"><i class="fa-solid fa-arrow-right"></i></button>
        <button class="icon-btn" id="nav-reload"  onclick="window.electronAPI?.reload()"><i class="fa-solid fa-rotate-right"></i></button>
    `;
    container.prepend(arrows);
}

// ── Resource Monitor ──────────────────────────────────────────────────────────

let rmInterval = null;

function toggleResourceMonitor() {
    const rm = document.getElementById('resource-monitor');
    if (!rm) return;
    const isVisible = rm.style.display !== 'none';
    if (isVisible) {
        rm.style.display = 'none';
        if (rmInterval) { clearInterval(rmInterval); rmInterval = null; }
    } else {
        rm.style.display = 'block';
        updateResourceMonitor();
        rmInterval = setInterval(updateResourceMonitor, 2000);
    }
}

async function updateResourceMonitor() {
    const body = document.getElementById('rm-body');
    if (!body || !window.electronAPI?.getProcessMetrics) return;
    try {
        const data = await window.electronAPI.getProcessMetrics();
        const totalCPU = data.processes.reduce((s, p) => s + parseFloat(p.cpu), 0);
        const cpuPct   = Math.min(100, totalCPU).toFixed(1);
        const ramMB    = data.totalRamMB;

        const cpuClass  = cpuPct > 80 ? 'crit' : cpuPct > 50 ? 'warn' : '';
        const ramClass  = ramMB  > 500 ? 'crit' : ramMB  > 250 ? 'warn' : '';

        const processRows = data.processes.slice(0, 6).map(p => `
            <div class="rm-process-row">
                <span class="rm-process-type">${p.type}</span>
                <span class="rm-process-mem">${p.memory} MB</span>
            </div>
        `).join('');

        body.innerHTML = `
            <div class="rm-stat">
                <div class="rm-stat-header">
                    <span>CPU Usage</span>
                    <span class="rm-stat-val">${cpuPct}%</span>
                </div>
                <div class="rm-bar-track">
                    <div class="rm-bar-fill ${cpuClass}" style="width:${cpuPct}%"></div>
                </div>
            </div>
            <div class="rm-stat">
                <div class="rm-stat-header">
                    <span>Memory (RAM)</span>
                    <span class="rm-stat-val">${ramMB} MB</span>
                </div>
                <div class="rm-bar-track">
                    <div class="rm-bar-fill ${ramClass}" style="width:${Math.min(100, ramMB / 10)}%"></div>
                </div>
            </div>
            <div class="rm-process-list">
                <div class="rm-process-label">Processes</div>
                ${processRows}
            </div>
        `;
    } catch {
        body.innerHTML = '<div class="rm-loading" style="color:#ff4747">Failed to load metrics</div>';
    }
}

// ── Open settings / extensions ────────────────────────────────────────────────

function openSettings() {
    window.location.href = 'settings.html';
}

function openExtensions() {
    window.location.href = 'settings.html?page=extensions';
}

// ── DOMContentLoaded ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    const tabManager   = new TabManager();
    const urlInput     = document.getElementById('url-input');
    const centralInput = document.getElementById('central-url-input');
    const searchBtn    = document.querySelector('.search-btn');

    injectEngineIndicator();
    injectNavButtons();

    urlInput?.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            navigate(urlInput.value, tabManager);
            urlInput.blur();
        }
    });

    function doSearch() {
        const raw = centralInput?.value.trim();
        if (!raw) return;
        navigate(raw, tabManager);
        if (centralInput) centralInput.value = '';
    }

    centralInput?.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
    searchBtn?.addEventListener('click', doSearch);

    document.querySelectorAll('.link-card:not(.add-link)').forEach(card => {
        card.addEventListener('click', e => {
            e.preventDefault();
            const url = card.getAttribute('href');
            if (url && url !== '#') navigate(url, tabManager);
        });
    });

    // ── IPC events ────────────────────────────────────────────────────────────

    window.electronAPI?.onPageLoading(isLoading => {
        const btn = document.getElementById('nav-reload');
        if (btn) {
            btn.innerHTML = isLoading
                ? '<i class="fa-solid fa-xmark"></i>'
                : '<i class="fa-solid fa-rotate-right"></i>';
            btn.onclick = isLoading
                ? () => window.electronAPI?.stopLoading()
                : () => window.electronAPI?.reload();
        }
        tabManager.updateActive({ loading: isLoading });
    });

    window.electronAPI?.onPageLoaded(({ url, title }) => {
        hideOfflinePage();
        if (urlInput) {
            urlInput.value = (url === 'about:blank') ? '' : url;
            if (url === 'about:blank') urlInput.placeholder = 'Search or type URL...';
        }
        let cleanTitle = (title && title !== 'about:blank') ? title : 'Start Page';
        if (cleanTitle === 'Start Page' && url && url !== 'about:blank') {
            cleanTitle = tabManager._active()?._hostFromUrl(url) || url;
        }
        tabManager.updateActive({ url, title: cleanTitle, loading: false });
    });

    window.electronAPI?.onPageNavigate(({ url }) => {
        hideOfflinePage();
        if (urlInput) {
            urlInput.value = (url === 'about:blank') ? '' : url;
            if (url === 'about:blank') urlInput.placeholder = 'Search or type URL...';
        }
        tabManager.updateActive({ url });
    });

    window.electronAPI?.onPageTitle(({ title }) => {
        if (title && title !== 'about:blank') tabManager.updateActive({ title });
    });

    // ── OFFLINE / ERROR handling ───────────────────────────────────────────────
    window.electronAPI?.onPageError(({ errorCode, errorDescription, url }) => {
        tabManager.updateActive({ loading: false });
        // Only show offline page for real network failures, not navigation aborts
        if (errorCode && errorCode !== -3) {
            showOfflinePage(url);
            tabManager.updateActive({ title: 'No Connection' });
        }
    });

    window.electronAPI?.onOpenNewTab(({ url }) => {
        tabManager.newTab(url);
    });
});