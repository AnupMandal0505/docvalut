/**
 * ui.js — shared UI behaviours: toasts, modals, dropdowns, tabs, copy,
 * formatting helpers, sidebar toggle, theme, active-nav highlighting.
 */
const UI = (() => {
  // ---- formatting -----------------------------------------------------
  const fmt = {
    bytes(n) {
      if (n == null) return "—";
      const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0;
      while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
      return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
    },
    num(n) { return n == null ? "—" : Number(n).toLocaleString(); },
    shortDigest(d, n = 12) { return d ? d.replace(/^sha256:/, "").slice(0, n) : "—"; },
    ago(iso) {
      if (!iso) return "—";
      const s = (Date.now() - new Date(iso)) / 1000;
      if (s < 60) return "just now";
      if (s < 3600) return `${Math.floor(s / 60)}m ago`;
      if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
      if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
      return new Date(iso).toLocaleDateString();
    },
    date(iso) { return iso ? new Date(iso).toLocaleString() : "—"; },
  };

  // ---- DOM helpers ----------------------------------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const html = (strings, ...vals) => strings.reduce((a, s, i) => a + s + (i < vals.length ? vals[i] : ""), "");

  function digest(d, n = 12) {
    return `<span class="digest" title="${esc(d)}">${esc(fmt.shortDigest(d, n))}
      <span class="copy" data-copy="${esc(d)}" title="Copy">${icon("copy")}</span></span>`;
  }

  function badge(status) {
    const map = { completed: "ok", pending: "warn", aborted: "danger", active: "ok", expired: "danger", running: "accent", failed: "danger", ok: "ok" };
    return `<span class="badge badge--${map[status] || ""}"><span class="dot"></span>${esc(status)}</span>`;
  }

  function skeletonRows(cols, rows = 5) {
    return Array.from({ length: rows }, () => `<tr>${Array.from({ length: cols }, () => `<td><span class="skeleton">loading…</span></td>`).join("")}</tr>`).join("");
  }

  function emptyRow(cols, msg = "Nothing here yet.") {
    return `<tr><td colspan="${cols}"><div class="empty"><h3>${esc(msg)}</h3></div></td></tr>`;
  }

  // ---- toasts ---------------------------------------------------------
  function toast(message, type = "info", ms = 3500) {
    const host = $("#toasts");
    if (!host) return;
    const el = document.createElement("div");
    el.className = `toast toast--${type}`;
    el.innerHTML = `<span>${esc(message)}</span><button class="close" aria-label="Dismiss">✕</button>`;
    el.querySelector(".close").onclick = () => el.remove();
    host.appendChild(el);
    if (ms) setTimeout(() => el.remove(), ms);
  }

  // ---- modal ----------------------------------------------------------
  const modal = {
    open(id) { $(`#${id}`)?.classList.add("open"); },
    close(id) { $(`#${id}`)?.classList.remove("open"); },
    closeAll() { $$(".modal-backdrop.open").forEach((m) => m.classList.remove("open")); },
    /** Generic confirm dialog. Returns a Promise<boolean>. */
    confirm({ title = "Are you sure?", body = "", confirmText = "Confirm", danger = false } = {}) {
      return new Promise((resolve) => {
        const m = $("#modal-confirm"); if (!m) return resolve(window.confirm(title));
        $(".modal__title", m).textContent = title;
        $(".modal__body", m).innerHTML = body;
        const ok = $("[data-confirm-ok]", m);
        ok.textContent = confirmText;
        ok.className = `btn ${danger ? "btn--danger" : "btn--primary"}`;
        const done = (v) => { m.classList.remove("open"); ok.onclick = null; resolve(v); };
        ok.onclick = () => done(true);
        $$("[data-modal-close]", m).forEach((b) => (b.onclick = () => done(false)));
        m.classList.add("open");
      });
    },
  };

  // ---- global delegated behaviours ----------------------------------
  function init() {
    // active nav
    const path = location.pathname.replace(/\/+$/, "") || "/";
    $$(".nav-item").forEach((a) => {
      const href = a.getAttribute("href").replace(/\/+$/, "") || "/";
      if (href === "/" ? path === "/" : path.startsWith(href)) a.classList.add("active");
    });

    // theme
    const saved = localStorage.getItem("registry.theme");
    if (saved) document.documentElement.dataset.theme = saved;

    document.addEventListener("click", (e) => {
      const t = e.target.closest("[data-copy], [data-modal-open], [data-modal-close], [data-dropdown], [data-tab], [data-toggle-sidebar], [data-toggle-theme], [data-logout]");
      // close open dropdowns on outside click
      if (!e.target.closest(".dropdown")) $$(".dropdown.open").forEach((d) => d.classList.remove("open"));
      if (!t) return;

      if (t.dataset.copy != null) {
        navigator.clipboard.writeText(t.dataset.copy).then(() => toast("Copied to clipboard", "ok", 1500));
      }
      if (t.dataset.modalOpen) modal.open(t.dataset.modalOpen);
      if (t.hasAttribute("data-modal-close")) t.closest(".modal-backdrop")?.classList.remove("open");
      if (t.hasAttribute("data-dropdown")) t.closest(".dropdown").classList.toggle("open");
      if (t.dataset.tab) {
        const group = t.closest("[data-tabs]");
        $$(".tab", group).forEach((x) => x.classList.toggle("active", x === t));
        $$(".tab-panel", group.parentElement).forEach((p) => p.classList.toggle("active", p.dataset.panel === t.dataset.tab));
      }
      if (t.hasAttribute("data-toggle-sidebar")) $(".sidebar")?.classList.toggle("open");
      if (t.hasAttribute("data-toggle-theme")) {
        const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
        document.documentElement.dataset.theme = next; localStorage.setItem("registry.theme", next);
      }
      if (t.hasAttribute("data-logout")) { API.token.clear(); location.href = "/login/"; }
    });

    document.addEventListener("keydown", (e) => { if (e.key === "Escape") modal.closeAll(); });
    $$(".modal-backdrop").forEach((m) => m.addEventListener("click", (e) => { if (e.target === m) m.classList.remove("open"); }));
  }

  // ---- icons (inline SVG, stroke) -------------------------------------
  const ICONS = {
    copy: '<path d="M8 8h10v10H8z"/><path d="M6 16H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    box: '<path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
    tag: '<path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><circle cx="7" cy="7" r="1.5"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    upload: '<path d="M12 16V4"/><path d="m6 10 6-6 6 6"/><path d="M4 20h16"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
    more: '<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    alert: '<path d="M12 9v4m0 4h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 9.2-9.2M15 5l3 3"/>',
    terminal: '<path d="m4 17 6-6-6-6"/><path d="M12 19h8"/>',
    download: '<path d="M12 4v12"/><path d="m6 10 6 6 6-6"/><path d="M4 20h16"/>',
    external: '<path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v7H3V3h7"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    broom: '<path d="m13 11 7-7"/><path d="M11 13 4 20"/><path d="m9 9 6 6-4 4-6-6Z"/>',
  };
  function icon(name, cls = "") {
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
  }
  // replace <i data-icon="name"></i> placeholders in static HTML
  function hydrateIcons(root = document) {
    $$("[data-icon]", root).forEach((el) => { el.outerHTML = icon(el.dataset.icon, el.className); });
  }

  document.addEventListener("DOMContentLoaded", () => { hydrateIcons(); init(); });

  return { fmt, $, $$, esc, html, digest, badge, skeletonRows, emptyRow, toast, modal, icon, hydrateIcons };
})();
