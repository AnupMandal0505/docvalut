// _common.js — runs on every app page: fills topbar user + sidebar counters.
(async () => {
  const { $, esc } = UI;
  try {
    const me = await API.auth.me();
    $("#topbar-username").textContent = me.username;
    $("#topbar-role").textContent = me.role;
    $("#topbar-avatar").textContent = me.username.slice(0, 2).toUpperCase();
  } catch { /* 401 handled by api.js */ }
  try {
    const s = await API.stats.overview();
    $("#nav-count-repos").textContent = s.repositories ?? "";
    const p = s.uploads?.pending || 0;
    $("#nav-count-uploads").textContent = p || ""; if (!p) $("#nav-count-uploads").classList.add("hidden");
    $("#sidebar-version").textContent = "v" + s.version;
    window.REGISTRY_HOST = s.host || location.host;
    UI.$$(".registry-host").forEach((el) => (el.textContent = window.REGISTRY_HOST));
    document.dispatchEvent(new CustomEvent("registry:ready", { detail: s }));
  } catch { $("#sidebar-health").className = "badge badge--danger"; $("#sidebar-health").innerHTML = '<span class="dot"></span> unreachable'; }

  // "/" focuses global search
  document.addEventListener("keydown", (e) => { if (e.key === "/" && !/input|textarea|select/i.test(e.target.tagName)) { e.preventDefault(); $("#global-search")?.focus(); } });
  $("#global-search")?.addEventListener("keydown", (e) => { if (e.key === "Enter") location.href = `/repositories/?q=${encodeURIComponent(e.target.value)}`; });
})();
