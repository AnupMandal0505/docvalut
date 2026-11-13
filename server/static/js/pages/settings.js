// settings.js
(() => {
  const { $, esc, fmt, badge, icon, toast, modal, emptyRow } = UI;
  const tab = location.hash.slice(1); if (tab) document.querySelector(`[data-tab="${tab}"]`)?.click();

  async function loadSettings() {
    const s = await API.settings.get();
    $("#s-host").value = s.host || ""; $("#s-name").value = s.name || ""; $("#s-anon-pull").checked = !!s.anon_pull; $("#s-auto-create").checked = !!s.auto_create; $("#s-enforce-unique").checked = !!s.enforce_unique;
    $("#s-ttl").value = s.ttl; $("#s-max-blob").value = s.max_blob || ""; $("#s-max-manifest").value = s.max_manifest || "";
    $("#st-media-root").textContent = s.media_root; $("#st-disk-total").textContent = fmt.bytes(s.disk_total); $("#st-disk-free").textContent = fmt.bytes(s.disk_free);
    $("#st-disk-bar").style.width = (100 - (s.disk_free / s.disk_total) * 100).toFixed(1) + "%";
    $("#about-version").textContent = s.version; $("#about-django").textContent = s.django; $("#about-python").textContent = s.python; $("#about-db").textContent = s.database;
  }
  async function loadUsers() {
    const users = await API.users.list();
    $("#users-body").innerHTML = users.map((u) => `<tr><td><strong>${esc(u.username)}</strong></td><td class="muted">${esc(u.email || "—")}</td><td><span class="badge ${u.role === "admin" ? "badge--info" : ""}">${esc(u.role)}</span></td><td>${badge(u.is_active ? "active" : "disabled")}</td><td class="muted">${fmt.ago(u.last_login)}</td>
      <td class="actions"><button class="btn btn--sm" data-edit-user='${esc(JSON.stringify(u))}'>Edit</button> <button class="btn btn--sm btn--icon" data-del-user="${u.id}">${icon("trash")}</button></td></tr>`).join("") || emptyRow(6, "No users");
  }
  async function loadTokens() {
    const toks = await API.tokens.list();
    $("#tokens-body").innerHTML = toks.map((t) => `<tr><td><strong>${esc(t.name)}</strong></td><td><span class="badge">${esc(t.scope)}</span></td><td class="mono small">${esc(t.repositories || "*")}</td><td class="muted">${fmt.ago(t.created_at)}</td><td class="muted">${t.expires_at ? fmt.date(t.expires_at).split(",")[0] : "never"}</td><td class="muted">${fmt.ago(t.last_used)}</td>
      <td class="actions"><button class="btn btn--sm btn--danger" data-revoke="${t.id}">Revoke</button></td></tr>`).join("") || emptyRow(7, "No tokens");
  }

  $("#settings-general").onsubmit = async (e) => { e.preventDefault(); await API.settings.update({ host: $("#s-host").value, name: $("#s-name").value, anon_pull: $("#s-anon-pull").checked, auto_create: $("#s-auto-create").checked, enforce_unique: $("#s-enforce-unique").checked }); toast("Saved", "ok"); };
  $("#settings-uploads").onsubmit = async (e) => { e.preventDefault(); await API.settings.update({ ttl: +$("#s-ttl").value, max_blob: $("#s-max-blob").value, max_manifest: $("#s-max-manifest").value }); toast("Saved", "ok"); };
  $("#st-verify").onclick = () => { $("#st-verify-result").innerHTML = '<span class="spinner"></span>'; setTimeout(() => ($("#st-verify-result").textContent = "Verification queued — results will appear in GC history."), 600); };
  $("#st-scan-orphans").onclick = () => toast("Orphan scan queued", "info");

  document.addEventListener("click", async (e) => {
    const ed = e.target.closest("[data-edit-user]"), du = e.target.closest("[data-del-user]"), rv = e.target.closest("[data-revoke]");
    if (ed) { const u = JSON.parse(ed.dataset.editUser); $("#modal-user-title").textContent = "Edit user"; $("#u-id").value = u.id; $("#u-username").value = u.username; $("#u-email").value = u.email || ""; $("#u-role").value = u.role; $("#u-active").checked = u.is_active; $("#u-password").value = ""; modal.open("modal-user"); }
    if (du && await modal.confirm({ title: "Delete user?", confirmText: "Delete", danger: true })) { await API.users.delete(du.dataset.delUser); toast("User deleted", "ok"); loadUsers(); }
    if (rv && await modal.confirm({ title: "Revoke token?", body: "<p class='muted'>Any CI job using it will start failing immediately.</p>", confirmText: "Revoke", danger: true })) { await API.tokens.revoke(rv.dataset.revoke); toast("Token revoked", "ok"); loadTokens(); }
    if (e.target.closest('[data-modal-open="modal-user"]')) { $("#modal-user-title").textContent = "Add user"; $("#user-form").reset(); $("#u-id").value = ""; }
    if (e.target.closest('[data-modal-open="modal-token"]')) { $("#token-form").reset(); $("#token-form-fields").classList.remove("hidden"); $("#token-created").classList.add("hidden"); $("#token-submit").classList.remove("hidden"); }
  });

  $("#user-form").onsubmit = async (e) => {
    e.preventDefault();
    const b = { username: $("#u-username").value.trim(), email: $("#u-email").value.trim(), role: $("#u-role").value, is_active: $("#u-active").checked }; if ($("#u-password").value) b.password = $("#u-password").value;
    try { $("#u-id").value ? await API.users.update($("#u-id").value, b) : await API.users.create(b); modal.close("modal-user"); toast("User saved", "ok"); loadUsers(); } catch (ex) { toast(ex.message, "danger"); }
  };
  $("#token-form").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const t = await API.tokens.create({ name: $("#t-name").value.trim(), scope: $("#t-scope").value, repositories: $("#t-repos").value.trim(), expires_days: $("#t-expires").value || null });
      $("#token-form-fields").classList.add("hidden"); $("#token-created").classList.remove("hidden"); $("#token-submit").classList.add("hidden");
      $("#token-value").textContent = t.token; $("#token-login-cmd").textContent = `echo "${t.token}" | docker login ${window.REGISTRY_HOST || location.host} -u ${t.name} --password-stdin`;
      loadTokens();
    } catch (ex) { toast(ex.message, "danger"); }
  };

  loadSettings(); loadUsers(); loadTokens();
})();
