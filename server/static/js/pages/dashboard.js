// dashboard.js
(() => {
  const { $, esc, fmt, digest, icon, skeletonRows, emptyRow } = UI;

  async function load() {
    $("#recent-pushes").innerHTML = skeletonRows(5, 4);
    const [s, activity] = await Promise.all([API.stats.overview(), API.stats.activity(8)]);

    $("#stat-repos").textContent = fmt.num(s.repositories);
    $("#stat-tags").textContent = fmt.num(s.tags);
    $("#stat-blobs").textContent = fmt.num(s.blobs);
    $("#stat-storage").textContent = fmt.bytes(s.storage_bytes);
    $("#stat-storage-delta").textContent = s.storage_delta || "";
    $("#stat-storage-delta").className = "stat__delta up";

    const total = s.disk_free + s.storage_bytes || 1;
    const pct = (b) => Math.max(1, (b / total) * 100).toFixed(1) + "%";
    $("#storage-blobs-size").textContent = fmt.bytes(s.blobs_bytes); $("#storage-blobs-bar").style.width = pct(s.blobs_bytes);
    $("#storage-uploads-size").textContent = fmt.bytes(s.uploads_bytes); $("#storage-uploads-bar").style.width = pct(s.uploads_bytes);
    $("#storage-orphan-size").textContent = fmt.bytes(s.orphan_bytes); $("#storage-orphan-bar").style.width = pct(s.orphan_bytes);
    $("#storage-free").textContent = fmt.bytes(s.disk_free);

    $("#uploads-pending").textContent = s.uploads.pending; $("#uploads-completed").textContent = s.uploads.completed; $("#uploads-aborted").textContent = s.uploads.aborted;
    $("#sys-version").textContent = s.version; $("#sys-db").textContent = s.database; $("#sys-last-gc").textContent = fmt.ago(s.last_gc);

    $("#recent-pushes").innerHTML = s.recent?.length ? s.recent.map((t) => `
      <tr>
        <td><a class="mono" href="/r/${esc(t.repository)}/">${esc(t.repository)}</a></td>
        <td><a href="/r/${esc(t.repository)}/tags/${esc(t.name)}/"><span class="badge badge--accent">${esc(t.name)}</span></a></td>
        <td>${digest(t.manifest)}</td>
        <td class="num">${fmt.bytes(t.size)}</td>
        <td class="muted">${fmt.ago(t.updated_at)}</td>
      </tr>`).join("") : emptyRow(5, "No pushes yet");

    const iconFor = { push: ["upload", "accent"], delete: ["trash", "danger"], gc: ["broom", "ok"], user: ["users", ""] };
    $("#activity-feed").innerHTML = activity.map((a) => { const [ic, cls] = iconFor[a.type] || ["box", ""]; return `
      <div class="feed__item"><div class="feed__icon ${cls}">${icon(ic)}</div><div class="small">${esc(a.text)}</div><div class="feed__time">${fmt.ago(a.at)}</div></div>`; }).join("") || '<div class="empty small">No activity</div>';
  }

  $("#dash-refresh").onclick = load;
  load();
})();
