/*
 * /*
 *  * File: tabs.js
 *  * Author: {amar_avda}
 *  * Copyright (c) 2026 {amar_avda}
 *  * Licensed under the GNU General Public License v3.0
 */

// ================================
// SEARCH ENGINE MANAGER
// ================================

const SEARCH_ENGINES = {
    duckduckgo: {
        name: "DuckDuckGo",
        url: "https://duckduckgo.com/?q=",
        icon: "fa-solid fa-duck",
        homepage: "https://duckduckgo.com"
    },
    google: {
        name: "Google",
        url: "https://www.google.com/search?q=",
        icon: "fa-brands fa-google",
        homepage: "https://www.google.com"
    },
    bing: {
        name: "Bing",
        url: "https://www.bing.com/search?q=",
        icon: "fa-brands fa-microsoft",
        homepage: "https://www.bing.com"
    },
    brave: {
        name: "Brave Search",
        url: "https://search.brave.com/search?q=",
        icon: "fa-solid fa-shield-halved",
        homepage: "https://search.brave.com"
    },
    ecosia: {
        name: "Ecosia",
        url: "https://www.ecosia.org/search?q=",
        icon: "fa-solid fa-leaf",
        homepage: "https://www.ecosia.org"
    }
};

// Load saved engine from localStorage, default to DuckDuckGo
let currentEngineKey = localStorage.getItem("searchEngine") || "duckduckgo";

function getCurrentEngine() {
    return SEARCH_ENGINES[currentEngineKey] || SEARCH_ENGINES.duckduckgo;
}

function setSearchEngine(key) {
    if (SEARCH_ENGINES[key]) {
        currentEngineKey = key;
        localStorage.setItem("searchEngine", key);
        updateEngineIndicator();
        closeEngineMenu();
    }
}

function updateEngineIndicator() {
    const indicator = document.getElementById("engine-indicator");
    if (indicator) {
        const engine = getCurrentEngine();
        indicator.title = `Search engine: ${engine.name}. Click to change.`;
        indicator.innerHTML = `<i class="${engine.icon}"></i>`;
    }
}

// Build and show/hide the engine picker dropdown
function toggleEngineMenu() {
    let menu = document.getElementById("engine-menu");
    if (menu) {
        menu.remove();
        return;
    }

    menu = document.createElement("div");
    menu.id = "engine-menu";
    menu.innerHTML = `
        <div class="engine-menu-header">Search Engine</div>
        ${Object.entries(SEARCH_ENGINES).map(([key, engine]) => `
            <div class="engine-option ${key === currentEngineKey ? 'active' : ''}" onclick="setSearchEngine('${key}')">
                <i class="${engine.icon}"></i>
                <span>${engine.name}</span>
                ${key === currentEngineKey ? '<i class="fa-solid fa-check engine-check"></i>' : ''}
            </div>
        `).join("")}
    `;

    // Position below the search bar
    const topNav = document.querySelector(".top-nav");
    if (topNav) {
        topNav.appendChild(menu);
    }

    // Close when clicking outside
    setTimeout(() => {
        document.addEventListener("click", function outsideClick(e) {
            if (!menu.contains(e.target) && e.target.id !== "engine-indicator") {
                menu.remove();
                document.removeEventListener("click", outsideClick);
            }
        });
    }, 0);
}

function closeEngineMenu() {
    const menu = document.getElementById("engine-menu");
    if (menu) menu.remove();
}

// ================================
// NAVIGATION
// ================================

function navigate(manualInput) {
    const urlInput = document.getElementById("url-input");
    const input = (manualInput || (urlInput ? urlInput.value : "")).trim();

    if (!input) return "";

    const engine = getCurrentEngine();
    let finalUrl;

    // Check if it's a URL or a search query
    const isUrl = /^(https?:\/\/)/.test(input) ||
                  (/\.[a-z]{2,}(\/|$)/i.test(input) && !input.includes(" "));

    if (isUrl) {
        finalUrl = input.startsWith("http") ? input : "https://" + input;
    } else {
        finalUrl = engine.url + encodeURIComponent(input);
    }

    loadUrl(finalUrl);

    // Sync top bar input
    if (urlInput) urlInput.value = finalUrl;

    return finalUrl;
}

function loadUrl(url) {
    const frame = document.getElementById("content-frame");
    const dashboard = document.getElementById("dashboard");

    if (frame) {
        frame.src = url;
        frame.style.display = "block";
    }
    if (dashboard) {
        dashboard.style.display = "none";
    }
}

function showDashboard() {
    const frame = document.getElementById("content-frame");
    const dashboard = document.getElementById("dashboard");
    const urlInput = document.getElementById("url-input");

    if (frame) frame.style.display = "none";
    if (dashboard) dashboard.style.display = "flex";
    if (urlInput) urlInput.value = "";
}

// ================================
// TAB MANAGER
// ================================

class TabManager {
    constructor() {
        this.tabs = [];
        this.activeTabId = null;
        this.tabCounter = 0;
        this.tabData = {}; // stores { url, title } per tab id

        this.tabBar = document.getElementById("tab-bar");
        this.newTabBtn = document.getElementById("new-tab-btn");

        if (!this.tabBar) {
            console.error("Error: #tab-bar not found!");
            return;
        }

        this.init();
    }

    init() {
        if (this.newTabBtn) {
            this.newTabBtn.addEventListener("click", () => {
                this.createNewTab("Start Page");
                showDashboard();
            });
        }
        this.createNewTab("Start Page");
        showDashboard(); // Always start on dashboard
    }

    createNewTab(title = "New Tab") {
        this.tabCounter++;
        const tabId = `tab-${this.tabCounter}`;

        this.tabs.push({ id: tabId, title });
        this.tabData[tabId] = { url: "", title };

        this.setActiveTab(tabId);
        showDashboard(); // Each new tab opens the dashboard
    }

    closeTab(tabId, event) {
        if (event) event.stopPropagation();

        this.tabs = this.tabs.filter(tab => tab.id !== tabId);
        delete this.tabData[tabId];

        if (this.tabs.length === 0) {
            this.createNewTab("Start Page");
        } else if (this.activeTabId === tabId) {
            // Switch to last remaining tab
            const lastTab = this.tabs[this.tabs.length - 1];
            this.setActiveTab(lastTab.id);

            // Restore that tab's URL or show dashboard
            const data = this.tabData[lastTab.id];
            if (data && data.url) {
                loadUrl(data.url);
                const urlInput = document.getElementById("url-input");
                if (urlInput) urlInput.value = data.url;
            } else {
                showDashboard();
            }
        } else {
            this.renderTabs();
        }
    }

    setActiveTab(tabId) {
        this.activeTabId = tabId;
        this.renderTabs();
    }

    updateActiveTabData(url, title) {
        if (!this.activeTabId) return;

        if (this.tabData[this.activeTabId]) {
            this.tabData[this.activeTabId].url = url;
            this.tabData[this.activeTabId].title = title;
        }

        const tab = this.tabs.find(t => t.id === this.activeTabId);
        if (tab) {
            tab.title = title;
            this.renderTabs();
        }
    }

    renderTabs() {
        if (!this.tabBar) return;
        this.tabBar.innerHTML = "";

        this.tabs.forEach(tab => {
            const el = document.createElement("div");
            el.className = `tab ${tab.id === this.activeTabId ? "active" : ""}`;

            el.innerHTML = `
                <span class="tab-title">${tab.title}</span>
                <i class="fa-solid fa-xmark tab-close"></i>
            `;

            el.addEventListener("click", () => {
                this.setActiveTab(tab.id);
                const data = this.tabData[tab.id];
                if (data && data.url) {
                    loadUrl(data.url);
                    const urlInput = document.getElementById("url-input");
                    if (urlInput) urlInput.value = data.url;
                } else {
                    showDashboard();
                }
            });

            const closeBtn = el.querySelector(".tab-close");
            closeBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.closeTab(tab.id, e);
            });

            this.tabBar.appendChild(el);
        });
    }
}

// ================================
// INIT & EVENT LISTENERS
// ================================

document.addEventListener("DOMContentLoaded", () => {
    const tabManager = new TabManager();
    const urlInput = document.getElementById("url-input");
    const centralInput = document.getElementById("central-url-input");
    const searchBtn = document.querySelector(".search-btn");

    // Inject engine indicator button into search bar
    injectEngineIndicator();
    updateEngineIndicator();

    // --- Top bar search ---
    if (urlInput) {
        urlInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                const finalUrl = navigate();
                const title = extractTitle(finalUrl);
                tabManager.updateActiveTabData(finalUrl, title);
                urlInput.blur();
            }
        });
    }

    // --- Central dashboard search bar ---
    function doSearch() {
        const rawValue = centralInput ? centralInput.value.trim() : "";
        if (!rawValue) return;

        const finalUrl = navigate(rawValue);
        const title = extractTitle(finalUrl);
        tabManager.updateActiveTabData(finalUrl, title);

        if (urlInput) urlInput.value = finalUrl;
        if (centralInput) centralInput.value = "";
    }

    if (centralInput) {
        centralInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") doSearch();
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener("click", doSearch);
    }
});

// ================================
// HELPERS
// ================================

function extractTitle(url) {
    try {
        return new URL(url).hostname.replace("www.", "");
    } catch {
        return url;
    }
}

function injectEngineIndicator() {
    const searchBar = document.querySelector(".search-bar");
    if (!searchBar || document.getElementById("engine-indicator")) return;

    const btn = document.createElement("button");
    btn.id = "engine-indicator";
    btn.className = "engine-indicator-btn";
    btn.title = "Change search engine";
    btn.onclick = toggleEngineMenu;
    btn.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i>`;

    // Insert before the input
    const input = searchBar.querySelector("input");
    searchBar.insertBefore(btn, input);

    // Hide the original static icon if present
    const staticIcon = searchBar.querySelector("i:not(#engine-indicator i)");
    if (staticIcon) staticIcon.style.display = "none";
}

function openSettings() {
    window.location.href = "settings.html";
}