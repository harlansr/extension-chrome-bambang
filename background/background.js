const isWatchUrl = (url) => {
    try {
        const u = new URL(url);
        return /(^|\.)youtube\.com$/.test(u.hostname) && u.pathname === "/watch" && u.searchParams.has("v");
    } catch {
        return false;
    }
};

const notifyTab = (tabId, url) => {
    const videoId = new URL(url).searchParams.get("v");
    chrome.tabs.sendMessage(tabId, { type: "NEW", videoId }, () => {
        // content script belum siap (mis. tab dibuka sebelum extension dimuat) -> abaikan
        void chrome.runtime.lastError;
    });
};

// YouTube adalah SPA: pindah video hanya mengubah URL tanpa status 'complete'
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if ((changeInfo.status === "complete" || changeInfo.url) && tab.url && isWatchUrl(tab.url)) {
        notifyTab(tabId, tab.url);
    }
});
