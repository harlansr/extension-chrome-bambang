export async function getActiveTabURL() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
}

export function formatNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString('id-ID', { maximumFractionDigits: 2 }) : '-';
}

export const storageGet = (area, key) =>
    new Promise((resolve) => chrome.storage[area].get([key], (obj) => resolve(obj[key])));

export const storageSet = (area, key, value) =>
    new Promise((resolve) => chrome.storage[area].set({ [key]: value }, resolve));

/** Terima hanya http/https. Mengembalikan URL ternormalisasi atau null. */
export function normalizeUrl(raw) {
    let text = String(raw || '').trim();
    if (!text) return null;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) text = 'https://' + text;
    try {
        const url = new URL(text);
        return /^https?:$/.test(url.protocol) ? url.href : null;
    } catch {
        return null;
    }
}

const DEFAULT_BOOKMARKS = [
    { group: 'Project', title: 'Birdmate', href: 'https://docs.google.com/spreadsheets/d/1-3UJSgsnpfx8Phu30HV67aZvuYTuFINxcLfHWk7nQFk/edit?gid=0#gid=0' },
    { group: 'Project', title: 'Upgrade Medion', href: 'https://docs.google.com/spreadsheets/d/1iwH3t5xBtmzuTZywqFbJQqr4eMTli3EyuksfAvNckWs/edit?pli=1&gid=1991938989#gid=1991938989&fvid=1686224001' },
    { group: 'Project', title: 'Upgrade Medion - UAT', href: 'https://docs.google.com/spreadsheets/d/1i2gl9SPoQkaQzyXwJIVDHjj9DRpnttd4ZW0uAhXSsRM/edit?gid=269107226#gid=269107226&fvid=1708819942' },
    { group: 'Project', title: 'Upgrade Medion - UAT - PowerPoint', href: 'https://intitalenta-my.sharepoint.com/:p:/g/personal/irvan_firmansyah_intalogioffice_com/EfuIc7TKX19Kirbtm_iwZh0B1-dGlj6dek-Evsg2LlbzaQ?rtime=mQI3VwUL3kg' },
    { group: 'Chart', title: 'Emas', href: 'https://id.tradingview.com/symbols/XAUIDR/' },
    { group: 'Chart', title: 'GOTO', href: 'https://www.indopremier.com/#ipot/app/advanced-chart?code=GOTO' },
    { group: 'Chart', title: 'BMRI', href: 'https://www.indopremier.com/#ipot/app/advanced-chart?code=BMRI' },
];

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** Baca daftar bookmark; pertama kali dijalankan diisi dengan daftar bawaan. */
export async function loadWebBookmarks() {
    const stored = await storageGet('local', 'webBookmarks');
    if (Array.isArray(stored)) return stored;
    const seeded = DEFAULT_BOOKMARKS.map((b) => ({ ...b, id: newId() }));
    await storageSet('local', 'webBookmarks', seeded);
    return seeded;
}

export const saveWebBookmarks = (list) => storageSet('local', 'webBookmarks', list);

export function makeBookmark({ title, href, group }) {
    return { id: newId(), title: title.trim(), href, group: (group || '').trim() || 'Umum' };
}

export const DEFAULT_HOLDINGS = { usd: 0, gold: 25.6 };

export async function loadHoldings() {
    const stored = await storageGet('local', 'holdings');
    return { ...DEFAULT_HOLDINGS, ...(stored || {}) };
}

export const saveHoldings = (h) => storageSet('local', 'holdings', h);
