import {
    formatNumber, getActiveTabURL, storageGet, storageSet,
    normalizeUrl, loadWebBookmarks, saveWebBookmarks, makeBookmark, loadHoldings,
} from "./utils.js";

const $ = (id) => document.getElementById(id);

let price_list = {};
let holdings = { usd: 0, gold: 0 };
let webBookmarks = [];

$('open-settings').addEventListener('click', () => chrome.runtime.openOptionsPage());

/////////////////// WEB BOOKMARK ///////////////////

const bookmarksWebElement = $("web-bookmark");
const searchInput = $("search");

const renderWebBookmarks = () => {
    bookmarksWebElement.textContent = "";

    searchInput.hidden = webBookmarks.length < 6;
    $("group-list").replaceChildren(
        ...[...new Set(webBookmarks.map((b) => b.group))].map((g) => new Option(g))
    );

    const q = searchInput.value.trim().toLowerCase();
    const shown = webBookmarks.filter((b) => !b.hidden && (
        !q || `${b.group} ${b.title} ${b.href}`.toLowerCase().includes(q)));

    if (!shown.length) {
        const empty = document.createElement("div");
        empty.className = "text-none";
        empty.textContent = q ? "Tidak ada hasil" : "Belum ada bookmark";
        bookmarksWebElement.appendChild(empty);
        return;
    }

    const groups = new Map();
    shown.forEach((b) => {
        if (!groups.has(b.group)) groups.set(b.group, []);
        groups.get(b.group).push(b);
    });

    [...groups.keys()].forEach((group) => {
        const label = document.createElement("div");
        label.className = "group-label";
        label.textContent = group;
        bookmarksWebElement.appendChild(label);
        groups.get(group).forEach((b) => bookmarksWebElement.appendChild(createWebBookmark(b)));
    });
};

const createWebBookmark = (bookmark) => {
    const row = document.createElement("div");
    row.className = "bookmark";

    const icon = document.createElement("img");
    icon.className = "favicon";
    icon.alt = "";
    icon.src = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(bookmark.href)}&size=16`;
    icon.addEventListener("error", () => { icon.style.visibility = "hidden"; });

    const title = document.createElement("div");
    title.className = "bookmark-title";
    title.textContent = bookmark.title;
    title.title = bookmark.href;
    title.addEventListener("click", () => chrome.tabs.create({ url: bookmark.href }));
    // klik tengah / ctrl-klik: buka tanpa menutup popup terlalu cepat
    title.addEventListener("auxclick", (e) => {
        if (e.button === 1) chrome.tabs.create({ url: bookmark.href, active: false });
    });

    row.append(icon, title);
    return row;
};

searchInput.addEventListener("input", renderWebBookmarks);

/////////////////// ADD FORM ///////////////////

const addForm = $("add-form");
const addError = $("add-error");

const showError = (msg) => {
    addError.textContent = msg || "";
    addError.hidden = !msg;
};

$("toggle-add").addEventListener("click", () => {
    addForm.hidden = !addForm.hidden;
    if (!addForm.hidden) $("add-title").focus();
});

$("add-current").addEventListener("click", async () => {
    const tab = await getActiveTabURL();
    if (!tab) return;
    $("add-title").value = (tab.title || "").slice(0, 60);
    $("add-url").value = tab.url || "";
});

addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const href = normalizeUrl($("add-url").value);
    const title = $("add-title").value.trim();
    if (!title) return showError("Judul wajib diisi");
    if (!href) return showError("URL tidak valid (harus http/https)");
    if (webBookmarks.some((b) => b.href === href)) return showError("URL sudah ada di daftar");

    webBookmarks.push(makeBookmark({ title, href, group: $("add-group").value }));
    await saveWebBookmarks(webBookmarks);
    addForm.reset();
    showError("");
    addForm.hidden = true;
    renderWebBookmarks();
});

/////////////////// YOUTUBE BOOKMARK ///////////////////

const conYoutube = $("container-youtube");

const sendToTab = (tabId, message) =>
    new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, message, (res) => {
            // content script mungkin belum aktif (tab belum di-refresh)
            void chrome.runtime.lastError;
            resolve(res);
        });
    });

const formatTime = (t) => {
    const s = Math.max(0, Math.floor(Number(t) || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const mm = String(m).padStart(2, "0"), ss = String(sec).padStart(2, "0");
    return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
};

const addNewBookmark = (bookmarksElement, bookmark) => {
    const row = document.createElement("div");
    row.className = "bookmark";

    const title = document.createElement("div");
    title.className = "bookmark-title";
    title.textContent = `${formatTime(bookmark.time)} — ${bookmark.desc}`;
    title.addEventListener("click", async () => {
        const tab = await getActiveTabURL();
        if (tab) sendToTab(tab.id, { type: "PLAY", value: bookmark.time });
    });

    const del = document.createElement("button");
    del.className = "icon-btn danger";
    del.title = "Hapus";
    del.textContent = "×";
    del.addEventListener("click", async () => {
        const tab = await getActiveTabURL();
        const list = tab && await sendToTab(tab.id, { type: "DELETE", value: bookmark.time });
        if (Array.isArray(list)) viewBookmarks(list);
        else row.remove();
    });

    row.append(title, del);
    bookmarksElement.appendChild(row);
};

const viewBookmarks = (currentBookmarks = []) => {
    const bookmarksElement = $("yt-bookmarks");
    bookmarksElement.textContent = "";

    if (!currentBookmarks.length) {
        const empty = document.createElement("div");
        empty.className = "text-none";
        empty.textContent = "Belum ada bookmark";
        bookmarksElement.appendChild(empty);
        return;
    }
    currentBookmarks.forEach((b) => addNewBookmark(bookmarksElement, b));
};

/////////////////// PRICE ///////////////////

const txtUSD = $("current_usd");
const txtGold = $("current_gold");
const txtUSD_own = $("current_usd_own");
const txtGold_own = $("current_gold_own");
const backendNote = $("backend-note");
const txtUpdated = $("price-updated");

const setTrend = (el, now, before) => {
    el.classList.remove("text-warning", "text-up", "text-down");
    if (!Number.isFinite(before) || now === before) return;
    el.classList.add(now > before ? "text-up" : "text-down");
};

const showUpdated = () => {
    if (!price_list.updated) return;
    txtUpdated.textContent = "Diperbarui " + new Date(price_list.updated)
        .toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
};

const showUSD = (value) => {
    txtUSD.textContent = formatNumber(value);
    txtUSD_own.textContent = formatNumber(value * holdings.usd);
};

const showGold = (value) => {
    txtGold.textContent = formatNumber(value);
    txtGold_own.textContent = formatNumber((price_list.goldBuyback || value) * holdings.gold);
};

const fetchJson = async (url, options = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        if (!response.ok) {
            const err = new Error(`HTTP ${response.status}`);
            err.status = response.status;
            throw err;
        }
        return await response.json();
    } finally {
        clearTimeout(timer);
    }
};

const BACKEND_URL = "http://127.0.0.1:8080";

const getPrice = async () => {
    const btn = $("refresh-price");
    btn.classList.add("spin");
    btn.disabled = true;
    try {
        const data = await fetchJson(`${BACKEND_URL}/api/prices`);
        backendNote.hidden = true;

        if (data.usd > 0) {
            const usd = Math.round(data.usd);
            showUSD(usd);
            setTrend(txtUSD, usd, price_list.usd);
            price_list.usd = usd;
        }
        if (data.gold > 0) {
            const gold = Math.round(data.gold);
            price_list.goldBuyback = Math.round(data.goldBuyback) || 0;
            showGold(gold);
            setTrend(txtGold, gold, price_list.gold);
            price_list.gold = gold;
        }
        price_list.updated = data.updated ? Date.parse(data.updated) : Date.now();
        await storageSet("local", "price", price_list);
        showUpdated();
    } catch (error) {
        // backend mati / belum dijalankan: tetap tampilkan harga tersimpan
        backendNote.hidden = false;
        console.error("Gagal memuat harga:", error);
    } finally {
        btn.classList.remove("spin");
        btn.disabled = false;
    }
};

$("refresh-price").addEventListener("click", getPrice);

[txtUSD_own, txtGold_own].forEach((el) =>
    el.addEventListener("click", () => el.classList.toggle("text-blur")));

/////////////////// INIT ///////////////////

document.addEventListener("DOMContentLoaded", async () => {
    [webBookmarks, holdings, price_list] = await Promise.all([
        loadWebBookmarks(),
        loadHoldings(),
        storageGet("local", "price").then((p) => p || {}),
    ]);

    renderWebBookmarks();

    // tampilkan harga tersimpan dulu, lalu perbarui
    if (price_list.usd) { showUSD(price_list.usd); txtUSD.classList.add("text-warning"); }
    if (price_list.gold) { showGold(price_list.gold); txtGold.classList.add("text-warning"); }
    showUpdated();
    getPrice();

    // YouTube
    const activeTab = await getActiveTabURL();
    let currentVideo = null;
    try {
        const url = new URL(activeTab?.url || "");
        if (/(^|\.)youtube\.com$/.test(url.hostname) && url.pathname === "/watch") {
            currentVideo = url.searchParams.get("v");
        }
    } catch { /* URL tidak valid (mis. halaman chrome://) */ }

    if (currentVideo) {
        conYoutube.hidden = false;
        const raw = await storageGet("sync", currentVideo);
        let list = [];
        try { list = raw ? JSON.parse(raw) : []; } catch { /* data rusak */ }
        viewBookmarks(Array.isArray(list) ? list : []);
    }
});
