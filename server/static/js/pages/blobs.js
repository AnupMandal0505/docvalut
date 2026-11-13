// blobs.js
(() => {
  const { $, esc, fmt, digest, icon, toast, modal, skeletonRows, emptyRow } = UI;
  const body = $("#blobs-body");
  const q = () => ({ search: $("#blobs-filter").value.trim(), kind: $("#blobs-kind").value, ref: $("#blobs-ref").value });

  async function load() {
    body.innerHTML = skeletonRows(7);
    const data = await API.blobs.list(q());
    const total = data.results.reduce((a, b) => a + b.size, 0), orphan = data.results.filter((b) => !b.refs);
    $("#blobs-summary").textContent = `${fmt.num(data.count)} blobs`;
    $("#blob-stat-count").textContent = fmt.num(data.count); $("#blob-stat-size").textContent = fmt.bytes(total);
    $("#blob-stat-dedup").textContent = fmt.bytes(data.results.reduce((a, b) => a + Math.max(0, b.refs - 1) * b.size, 0));
    $("#blob-stat-orphan").textContent = `${orphan.length}`; $("#blob-stat-orphan-delta").textContent = fmt.bytes(orphan.reduce((a, b) => a + b.size, 0)) + " reclaimable";
    $("#blobs-page-info").textContent = `${data.results.length} of ${data.count}`;
    body.innerHTML = data.results.length ? data.results.map((b) => `
      <tr>
        <td><a href="#" data-blob="${esc(b.digest)}">${digest(b.digest, 16)}</a></td>
        <td><span class="badge ${b.kind === "config" ? "badge--info" : ""}">${esc(b.kind)}</span></td>
        <td class="num">${fmt.bytes(b.size)}</td>
        <td class="num">${b.refs ? b.refs : '<span class="badge badge--danger">0</span>'}</td>
        <td class="mono small faint truncate" style="max-width:260px" title="${esc(b.storage_path)}">${esc(b.storage_path)}</td>
        <td class="muted">${fmt.ago(b.created_at)}</td>
        <td class="actions"><button class="btn btn--sm btn--icon" data-del="${esc(b.digest)}" title="Delete" ${b.refs ? "disabled" : ""}>${icon("trash")}</button></td>
      </tr>`).join("") : emptyRow(7, "No blobs match");
  }

  async function openBlob(d) {
    const b = await API.blobs.get(d);
    $("#blob-d-digest").innerHTML = digest(b.digest, 64); $("#blob-d-size").textContent = `${fmt.bytes(b.size)} (${fmt.num(b.size)} bytes)`;
    $("#blob-d-path").textContent = b.storage_path; $("#blob-d-created").textContent = fmt.date(b.created_at);
    $("#blob-d-integrity").innerHTML = b.verified === false ? '<span class="badge badge--danger">digest mismatch</span>' : '<span class="badge badge--ok">file present</span>';
    $("#blob-d-refs").innerHTML = (b.referenced_by || []).map((r) => `<tr><td><a class="mono" href="/r/${esc(r.repository)}/">${esc(r.repository)}</a></td><td>${digest(r.manifest, 16)}</td><td>${r.tags.map((t) => `<span class="badge badge--accent">${esc(t)}</span>`).join(" ")}</td></tr>`).join("") || emptyRow(3, "Unreferenced — eligible for GC");
    $("#blob-d-delete").disabled = !!(b.referenced_by || []).length;
    $("#blob-d-delete").onclick = async () => { if (await modal.confirm({ title: "Delete blob?", body: "<p class='muted'>Removes the file and DB row. Irreversible.</p>", confirmText: "Delete", danger: true })) { await API.blobs.delete(d); modal.closeAll(); toast("Blob deleted", "ok"); load(); } };
    modal.open("modal-blob");
  }

  body.addEventListener("click", async (e) => {
    const v = e.target.closest("[data-blob]"), del = e.target.closest("[data-del]");
    if (v) { e.preventDefault(); openBlob(v.dataset.blob); }
    if (del && await modal.confirm({ title: "Delete blob?", confirmText: "Delete", danger: true })) { await API.blobs.delete(del.dataset.del); toast("Deleted", "ok"); load(); }
  });
  let t; $("#blobs-filter").oninput = () => { clearTimeout(t); t = setTimeout(load, 250); };
  $("#blobs-kind").onchange = load; $("#blobs-ref").onchange = load; $("#blobs-refresh").onclick = load;
  load();
})();
