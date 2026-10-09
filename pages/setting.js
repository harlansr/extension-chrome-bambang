import {
    loadHoldings, saveHoldings, loadWebBookmarks, saveWebBookmarks, normalizeUrl, makeBookmark,
} from "../popup/utils.js";

const $ = (id) => document.getElementById(id);
const say = (text) => { $("msg").textContent = text; };

/* ---------- Sidebar ---------- */

function showPanel(name) {
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.panel === name));
    document.querySelectorAll(".panel").forEach((p) => { p.hidden = p.id !== `panel-${name}`; });
    history.replaceState(null, "", `#${name}`);
}

document.querySelectorAll(".nav-item").forEach((b) => b.addEventListener("click", () => showPanel(b.dataset.panel)));
showPanel(location.hash === "#bookmarks" ? "bookmarks" : "assets");

/* ---------- Aset ---------- */

(async () => {
    const h = await loadHoldings();
    $("h-usd").value = h.usd;
    $("h-gold").value = h.gold;
})();

$("holdings-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const usd = Math.max(0, Number($("h-usd").value) || 0);
    const gold = Math.max(0, Number($("h-gold").value) || 0);
    await saveHoldings({ usd, gold });
    $("saved").hidden = false;
    setTimeout(() => { $("saved").hidden = true; }, 1500);
});

/* ---------- Ikon ---------- */

const ICONS = {
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M17.9 17.9A10.1 10.1 0 0 1 12 19c-6.5 0-10-7-10-7a18 18 0 0 1 5.1-5.9M9.9 5.1A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-2.2 3.2M1 1l22 22"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/>',
};

function iconButton(icon, title, onClick, extraClass = "") {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `icon-btn ${extraClass}`.trim();
    btn.title = title;
    btn.setAttribute("aria-label", title);
    btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[icon]}</svg>`;
    btn.addEventListener("click", onClick);
    return btn;
}

/* ---------- Bookmark: daftar ---------- */

let bookmarks = [];

function faviconUrl(href) {
    const u = new URL(chrome.runtime.getURL("/_favicon/"));
    u.searchParams.set("pageUrl", href);
    u.searchParams.set("size", "16");
    return u.toString();
}

function renderList() {
    const list = $("bm-list");
    list.replaceChildren();


    if (!bookmarks.length) {
        list.append(Object.assign(document.createElement("div"), { className: "text-none", textContent: "Belum ada bookmark" }));
        return;
    }

    const groups = new Map();
    for (const b of bookmarks) {
        const g = b.group || "Umum";
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(b);
    }

    const names = [...groups.keys()];
    names.forEach((name, i) => {
        const head = document.createElement("div");
        head.className = "group-head";
        head.append(Object.assign(document.createElement("div"), { className: "group-label", textContent: name }));

        const rename = iconButton("edit", "Ubah nama grup", () => renameGroup(name));

        const up = Object.assign(document.createElement("button"), { className: "icon-btn", textContent: "▲", title: "Naikkan grup", disabled: i === 0 });
        up.addEventListener("click", () => moveGroup(name, -1));
        const down = Object.assign(document.createElement("button"), { className: "icon-btn", textContent: "▼", title: "Turunkan grup", disabled: i === names.length - 1 });
        down.addEventListener("click", () => moveGroup(name, 1));
        head.append(rename, up, down);
        enableDrop(head, () => ({ group: name, before: null }));

        list.append(head);
        for (const b of groups.get(name)) list.append(renderItem(b));
    });
}

async function renameGroup(name) {
    const next = prompt("Nama grup baru:", name)?.trim();
    if (!next || next === name) return;
    bookmarks.forEach((b) => { if ((b.group || "Umum") === name) b.group = next; });
    await saveWebBookmarks(bookmarks);
    renderList();
}

/* Drag & drop: seret bookmark ke bookmark lain (sisip sebelum) atau ke header grup (taruh di akhir grup). */
let dragId = null;

function enableDrop(el, target) {
    el.addEventListener("dragover", (e) => {
        if (!dragId) return;
        e.preventDefault();
        el.classList.add("drop-over");
    });
    el.addEventListener("dragleave", () => el.classList.remove("drop-over"));
    el.addEventListener("drop", async (e) => {
        e.preventDefault();
        el.classList.remove("drop-over");
        const { group, before } = target();
        await moveBookmark(dragId, group, before);
    });
}

async function moveBookmark(id, group, beforeId) {
    if (!id || id === beforeId) return;
    const order = [...new Set(bookmarks.map((b) => b.group || "Umum"))];
    const item = bookmarks.find((b) => b.id === id);
    if (!item) return;
    const rest = bookmarks.filter((b) => b.id !== id);
    item.group = group;
    let idx = beforeId ? rest.findIndex((b) => b.id === beforeId) : -1;
    if (idx < 0) {
        const last = rest.map((b) => (b.group || "Umum") === group).lastIndexOf(true);
        idx = last + 1;
    }
    rest.splice(idx, 0, item);
    bookmarks = order.flatMap((g) => rest.filter((b) => (b.group || "Umum") === g));
    await saveWebBookmarks(bookmarks);
    renderList();
}

async function toggleHidden(b) {
    b.hidden = !b.hidden;
    await saveWebBookmarks(bookmarks);
    renderList();
}

async function moveGroup(name, dir) {
    const order = [...new Set(bookmarks.map((b) => b.group || "Umum"))];
    const i = order.indexOf(name);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    bookmarks = order.flatMap((g) => bookmarks.filter((b) => (b.group || "Umum") === g));
    await saveWebBookmarks(bookmarks);
    renderList();
}

function renderItem(b) {
    const row = document.createElement("div");
    row.className = "bm-item" + (b.hidden ? " is-hidden" : "");
    row.draggable = true;
    row.addEventListener("dragstart", (e) => {
        dragId = b.id;
        e.dataTransfer.effectAllowed = "move";
        row.classList.add("dragging");
    });
    row.addEventListener("dragend", () => { dragId = null; row.classList.remove("dragging"); });
    enableDrop(row, () => ({ group: b.group || "Umum", before: b.id }));

    const icon = Object.assign(document.createElement("img"), { src: faviconUrl(b.href), alt: "" });

    const info = document.createElement("div");
    info.className = "bm-info";
    info.append(
        Object.assign(document.createElement("div"), { className: "bm-title", textContent: b.title }),
        Object.assign(document.createElement("div"), { className: "bm-url", textContent: b.href }),
    );

    const hide = b.hidden
        ? iconButton("eyeOff", "Tampilkan di popup", () => toggleHidden(b))
        : iconButton("eye", "Sembunyikan dari popup", () => toggleHidden(b));
    const edit = iconButton("edit", "Edit", () => startEdit(b));
    const del = iconButton("trash", "Hapus", () => removeBookmark(b), "danger");

    row.append(icon, info, hide, edit, del);
    return row;
}

async function refresh() {
    bookmarks = await loadWebBookmarks();
    renderList();
}

/* ---------- Bookmark: tambah / edit / hapus ---------- */

const NEW_GROUP = "__new__";

/** Isi dropdown grup dengan grup yang ada + opsi grup baru, lalu pilih `selected`. */
function fillGroupSelect(selected) {
    const names = [...new Set(bookmarks.map((b) => b.group || "Umum"))];
    if (!names.length) names.push("Umum");
    const select = $("bm-group");
    select.replaceChildren(
        ...names.map((g) => new Option(g, g)),
        new Option("+ Grup baru…", NEW_GROUP),
    );
    select.value = names.includes(selected) ? selected : names[0];
    $("bm-group-new").hidden = true;
    $("bm-group-new").value = "";
}

$("bm-group").addEventListener("change", () => {
    const isNew = $("bm-group").value === NEW_GROUP;
    $("bm-group-new").hidden = !isNew;
    if (isNew) $("bm-group-new").focus();
});

function resetForm() {
    fillGroupSelect();
    $("bm-form").reset();
    $("bm-id").value = "";
    $("bm-form-title").textContent = "Tambah bookmark";
    $("bm-submit").textContent = "Tambah";
    $("bm-error").hidden = true;
}

function closeDialog() {
    $("bm-dialog").close();
    resetForm();
}

$("add").addEventListener("click", () => {
    resetForm();
    $("bm-dialog").showModal();
    $("bm-title").focus();
});

function startEdit(b) {
    $("bm-id").value = b.id;
    $("bm-title").value = b.title;
    $("bm-href").value = b.href;
    fillGroupSelect(b.group || "Umum");
    $("bm-form-title").textContent = "Edit bookmark";
    $("bm-submit").textContent = "Simpan";
    $("bm-error").hidden = true;
    $("bm-dialog").showModal();
    $("bm-title").focus();
}

async function removeBookmark(b) {
    if (!confirm(`Hapus bookmark "${b.title}"?`)) return;
    bookmarks = bookmarks.filter((x) => x.id !== b.id);
    await saveWebBookmarks(bookmarks);
    renderList();
}

$("bm-cancel").addEventListener("click", closeDialog);
$("bm-dialog").addEventListener("cancel", resetForm);

$("bm-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = $("bm-title").value.trim();
    const href = normalizeUrl($("bm-href").value);
    const group = $("bm-group").value === NEW_GROUP
        ? $("bm-group-new").value.trim() || "Umum"
        : $("bm-group").value;
    const id = $("bm-id").value;

    const err = $("bm-error");
    if (!title) { err.textContent = "Judul wajib diisi"; err.hidden = false; return; }
    if (!href) { err.textContent = "URL tidak valid (harus http/https)"; err.hidden = false; return; }

    if (id) {
        const target = bookmarks.find((x) => x.id === id);
        if (target) Object.assign(target, { title, href, group });
    } else {
        bookmarks.push(makeBookmark({ title, href, group }));
    }
    await saveWebBookmarks(bookmarks);
    closeDialog();
    renderList();
});

/* ---------- Bookmark: ekspor / impor / kosongkan ---------- */

$("export").addEventListener("click", async () => {
    const blob = new Blob([JSON.stringify(bookmarks, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "bambang-bookmarks.json";
    a.click();
    URL.revokeObjectURL(a.href);
});

$("import").addEventListener("click", () => $("import-file").click());

$("import-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
        const data = JSON.parse(await file.text());
        if (!Array.isArray(data)) throw new Error("Format harus berupa array");

        const known = new Set(bookmarks.map((b) => b.href));
        let added = 0;
        for (const item of data) {
            const href = normalizeUrl(item?.href);
            const title = String(item?.title || "").trim();
            if (!href || !title || known.has(href)) continue;
            bookmarks.push(makeBookmark({ title, href, group: item.group }));
            known.add(href);
            added++;
        }
        await saveWebBookmarks(bookmarks);
        renderList();
        say(`${added} bookmark ditambahkan`);
    } catch (err) {
        say("Gagal impor: " + err.message);
    }
});

$("reset").addEventListener("click", async () => {
    if (!confirm("Hapus semua bookmark?")) return;
    bookmarks = [];
    await saveWebBookmarks(bookmarks);
    resetForm();
    renderList();
    say("Semua bookmark dihapus");
});

refresh();
