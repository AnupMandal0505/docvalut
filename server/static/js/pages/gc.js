// gc.js
(() => {
  const { $, esc, fmt, digest, badge, toast, modal, emptyRow, skeletonRows } = UI;
  let plan = null;

  async function status() {
    const s = await API.gc.status();
    $("#gc-stat-manifests").textContent = fmt.num(s.unreferenced_manifests);
    $("#gc-stat-blobs").textContent = fmt.num(s.unreferenced_blobs);
    $("#gc-stat-reclaim").textContent = fmt.bytes(s.reclaimable_bytes);
    $("#gc-stat-last").textContent = fmt.ago(s.last_run);
    $("#gc-running-alert").style.display = s.running ? "" : "none";
    $("#gc-running-phase").textContent = s.phase || "";
  }
  async function history() {
    const h = await API.gc.history();
    $("#gc-history").innerHTML = h.length ? h.map((r) => `<tr><td>${fmt.date(r.started_at)}</td><td><span class="badge ${r.mode === "sweep" ? "badge--danger" : ""}">${esc(r.mode)}</span></td><td>${badge(r.status)}</td><td class="num">${r.manifests}</td><td class="num">${r.blobs}</td><td class="num">${fmt.bytes(r.reclaimed)}</td><td class="muted">${esc(r.duration)}</td></tr>`).join("") : emptyRow(7, "No runs yet");
  }

  $("#gc-plan").onclick = async () => {
    const b = $("#gc-plan"); b.disabled = true; b.innerHTML = '<span class="spinner"></span> Marking…';
    ["#gc-plan-blobs", "#gc-plan-manifests", "#gc-plan-uploads"].forEach((s) => ($(s).innerHTML = skeletonRows(4, 3)));
    try {
      plan = await API.gc.plan();
      const reclaim = plan.blobs.reduce((a, x) => a + x.size, 0);
      $("#gc-plan-meta").textContent = `${plan.blobs.length} blobs · ${plan.manifests.length} manifests · ${plan.uploads.length} stale uploads · ${fmt.bytes(reclaim)} reclaimable`;
      $("#gc-plan-blobs").innerHTML = plan.blobs.map((x) => `<tr><td>${digest(x.digest, 20)}</td><td class="num">${fmt.bytes(x.size)}</td><td class="muted">${fmt.ago(x.last_referenced)}</td><td class="small muted">${esc(x.reason)}</td></tr>`).join("") || emptyRow(4, "Nothing to sweep");
      $("#gc-plan-manifests").innerHTML = plan.manifests.map((x) => `<tr><td>${digest(x.digest, 20)}</td><td class="mono">${esc(x.repository)}</td><td class="small mono muted">${esc(x.media_type.split("/").pop())}</td><td><span class="badge badge--warn">${esc(x.reason)}</span></td></tr>`).join("") || emptyRow(4, "Nothing to sweep");
      $("#gc-plan-uploads").innerHTML = plan.uploads.map((x) => `<tr><td class="mono small">${x.id.slice(0, 8)}…</td><td class="mono">${esc(x.repository)}</td><td class="num">${fmt.bytes(x.temp_size)}</td><td class="muted">${fmt.ago(x.updated_at)}</td></tr>`).join("") || emptyRow(4, "No stale uploads");
      $("#gc-run").disabled = !(plan.blobs.length || plan.manifests.length || plan.uploads.length);
      toast("Dry run complete", "ok");
    } catch (e) { toast(e.message, "danger"); }
    b.disabled = false; b.innerHTML = `${UI.icon("search")} Dry run (mark)`;
  };

  $("#gc-run").onclick = async () => {
    const reclaim = plan.blobs.reduce((a, x) => a + x.size, 0);
    if (!await modal.confirm({ title: "Sweep now?", body: `<p class="muted">Permanently deletes <strong>${plan.blobs.length}</strong> blobs (${fmt.bytes(reclaim)}), <strong>${plan.manifests.length}</strong> manifests and <strong>${plan.uploads.length}</strong> upload sessions. Pushes are blocked while running.</p>`, confirmText: "Sweep", danger: true })) return;
    $("#gc-running-alert").style.display = ""; $("#gc-run").disabled = true;
    try {
      await API.gc.run({ grace_seconds: +$("#gc-grace").value, untagged_manifests: $("#gc-untagged").checked, stale_uploads: $("#gc-stale-uploads").checked, verify: $("#gc-verify").checked });
      toast("Sweep complete", "ok"); plan = null; $("#gc-plan-meta").textContent = "Run a dry run to see what would be deleted.";
      ["#gc-plan-blobs", "#gc-plan-manifests", "#gc-plan-uploads"].forEach((s) => ($(s).innerHTML = emptyRow(4, "No plan yet")));
    } catch (e) { toast(e.message, "danger"); }
    $("#gc-running-alert").style.display = "none"; status(); history();
  };

  status(); history();
})();
