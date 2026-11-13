// uploads.js
(() => {
  const { $, esc, fmt, badge, icon, toast, modal, skeletonRows, emptyRow } = UI;
  const body = $("#uploads-body"); let timer;

  async function load(silent) {
    if (!silent) body.innerHTML = skeletonRows(8);
    const data = await API.uploads.list({ status: $("#uploads-status").value, search: $("#uploads-filter").value.trim() });
    const rows = data.results, pending = rows.filter((u) => u.status === "pending");
    $("#up-stat-pending").textContent = pending.length;
    $("#up-stat-expired").textContent = pending.filter((u) => Date.now() - new Date(u.updated_at) > 86400e3).length;
    $("#up-stat-temp").textContent = fmt.bytes(rows.filter((u) => u.status !== "completed").reduce((a, u) => a + u.offset, 0));
    $("#up-stat-completed").textContent = rows.filter((u) => u.status === "completed").length;
    $("#uploads-page-info").textContent = `${rows.length} of ${data.count}`;
    body.innerHTML = rows.length ? rows.map((u) => { const pct = u.expected_size ? Math.min(100, (u.offset / u.expected_size) * 100) : null; return `
      <tr>
        <td class="mono small" title="${u.id}">${u.id.slice(0, 8)}…</td>
        <td><a class="mono" href="/r/${esc(u.repository)}/">${esc(u.repository)}</a></td>
        <td>${badge(u.status)}</td>
        <td>${pct == null ? '<span class="small faint">unknown length</span>' : `<div class="progress ${u.status === "completed" ? "ok" : u.status === "aborted" ? "danger" : ""}"><span style="width:${pct}%"></span></div><div class="small faint mt-1">${pct.toFixed(0)}%</div>`}</td>
        <td class="num">${fmt.bytes(u.offset)}</td>
        <td class="muted">${fmt.ago(u.created_at)}</td>
        <td class="muted">${fmt.ago(u.updated_at)}</td>
        <td class="actions">${u.status === "pending" ? `<button class="btn btn--sm btn--danger" data-abort="${u.id}">Abort</button>` : `<button class="btn btn--sm btn--icon" data-del="${u.id}" title="Remove record">${icon("trash")}</button>`}</td>
      </tr>`; }).join("") : emptyRow(8, "No upload sessions");
  }

  body.addEventListener("click", async (e) => {
    const ab = e.target.closest("[data-abort]"), del = e.target.closest("[data-del]");
    if (ab && await modal.confirm({ title: "Abort upload?", body: "<p class='muted'>The client will receive 404 on its next PATCH/PUT and the temp file is deleted.</p>", confirmText: "Abort", danger: true })) { await API.uploads.abort(ab.dataset.abort); toast("Aborted", "ok"); load(true); }
    if (del) { await API.uploads.delete(del.dataset.del); load(true); }
  });
  $("#uploads-cleanup").onclick = async () => { if (await modal.confirm({ title: "Clean up expired sessions?", body: "<p class='muted'>Marks pending sessions older than the TTL as aborted and removes their temp files.</p>", confirmText: "Clean up", danger: true })) { const r = await API.uploads.cleanup(); toast(`Removed ${r.removed} sessions`, "ok"); load(); } };
  $("#uploads-refresh").onclick = () => load();
  $("#uploads-status").onchange = () => load();
  let t; $("#uploads-filter").oninput = () => { clearTimeout(t); t = setTimeout(load, 250); };
  $("#uploads-live").onchange = (e) => { clearInterval(timer); if (e.target.checked) timer = setInterval(() => load(true), 5000); };
  document.addEventListener("registry:ready", () => { $("#uploads-ttl").textContent = "Session TTL: 24h"; });
  load();
})();
