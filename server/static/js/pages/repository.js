// repository.js — /r/<name>/
(() => {
  const { $, esc, fmt, digest, badge, icon, toast, modal, skeletonRows, emptyRow } = UI;
  const repo = decodeURIComponent(location.pathname.replace(/^\/r\//, "").replace(/\/$/, ""));
  const host = () => window.REGISTRY_HOST || location.host;
  document.title = `${repo} · Registry`;
  ["#bc-repo", "#repo-name"].forEach((s) => ($(s).textContent = repo));
  $("#repo-settings-name").value = repo;
  $("#repo-api-link").href = `/v2/${repo}/tags/list`;
  $("#repo-copy-name").onclick = () => navigator.clipboard.writeText(`${host()}/${repo}`).then(() => toast("Copied", "ok", 1200));

  async function loadMeta() {
    const r = await API.repos.get(repo);
    $("#repo-desc").textContent = r.description || "No description";
    $("#repo-stat-tags").textContent = fmt.num(r.tag_count);
    $("#repo-stat-manifests").textContent = fmt.num(r.manifest_count);
    $("#repo-stat-size").textContent = fmt.bytes(r.size);
    $("#repo-stat-pushed").textContent = fmt.ago(r.last_push);
    $("#repo-settings-desc").value = r.description || "";
    $("#repo-settings-public").checked = !!r.is_public;
    $("#repo-settings-immutable").checked = !!r.immutable_tags;
  }

  async function loadTags() {
    const body = $("#tags-body"); body.innerHTML = skeletonRows(7);
    const data = await API.repos.tags(repo, { search: $("#tags-filter").value.trim() });
    $("#tags-page-info").textContent = `${data.results.length} of ${data.count}`;
    $("#pull-tag").innerHTML = data.results.map((t) => `<option>${esc(t.name)}</option>`).join("");
    updatePull();
    body.innerHTML = data.results.length ? data.results.map((t) => `
      <tr>
        <td><a href="/r/${esc(repo)}/tags/${esc(t.name)}/"><span class="badge badge--accent">${esc(t.name)}</span></a></td>
        <td>${digest(t.manifest)}</td>
        <td class="small muted mono">${esc(t.media_type.split("/").pop().replace("vnd.", "").replace("+json", ""))}</td>
        <td>${(t.platforms || []).map((p) => `<span class="badge">${esc(p)}</span>`).join(" ")}</td>
        <td class="num">${fmt.bytes(t.size)}</td>
        <td class="muted">${fmt.ago(t.updated_at)}</td>
        <td class="actions">
          <button class="btn btn--sm btn--icon" data-copy="docker pull ${esc(host())}/${esc(repo)}:${esc(t.name)}" title="Copy pull command">${icon("terminal")}</button>
          <button class="btn btn--sm btn--icon" data-del-tag="${esc(t.name)}" title="Delete tag">${icon("trash")}</button>
        </td>
      </tr>`).join("") : emptyRow(7, "No tags");
  }

  async function loadManifests() {
    const body = $("#manifests-body"); body.innerHTML = skeletonRows(7);
    const data = await API.repos.manifests(repo, { search: $("#manifests-filter").value.trim() });
    $("#manifests-page-info").textContent = `${data.results.length} of ${data.count}`;
    body.innerHTML = data.results.length ? data.results.map((m) => `
      <tr>
        <td><a href="/r/${esc(repo)}/manifests/${esc(m.digest)}/">${digest(m.digest, 16)}</a></td>
        <td class="small muted mono">${esc(m.media_type.split("/").pop().replace("vnd.", "").replace("+json", ""))}</td>
        <td>${m.tags.length ? m.tags.map((t) => `<span class="badge badge--accent">${esc(t)}</span>`).join(" ") : '<span class="badge badge--warn">untagged</span>'}</td>
        <td class="num">${m.layers}</td>
        <td class="num">${fmt.bytes(m.size)}</td>
        <td class="muted">${fmt.ago(m.created_at)}</td>
        <td class="actions"><button class="btn btn--sm btn--icon" data-del-manifest="${esc(m.digest)}" title="Delete manifest" ${m.tags.length ? "disabled" : ""}>${icon("trash")}</button></td>
      </tr>`).join("") : emptyRow(7, "No manifests");
  }

  async function loadUploads() {
    const body = $("#repo-uploads-body"); body.innerHTML = skeletonRows(6, 3);
    const data = await API.uploads.list({ repository: repo });
    body.innerHTML = data.results.length ? data.results.map((u) => `
      <tr><td class="mono small">${esc(u.id.slice(0, 8))}…</td><td>${badge(u.status)}</td><td class="num">${fmt.bytes(u.offset)}</td><td class="muted">${fmt.ago(u.created_at)}</td><td class="muted">${fmt.ago(u.updated_at)}</td>
      <td class="actions">${u.status === "pending" ? `<button class="btn btn--sm btn--danger" data-abort="${u.id}">Abort</button>` : ""}</td></tr>`).join("") : emptyRow(6, "No upload sessions for this repository");
  }

  function updatePull() { $("#pull-cmd").textContent = `docker pull ${host()}/${repo}:${$("#pull-tag").value || "latest"}`; }
  $("#pull-tag").onchange = updatePull;
  $("#pull-copy").onclick = () => navigator.clipboard.writeText($("#pull-cmd").textContent).then(() => toast("Copied", "ok", 1200));

  document.addEventListener("click", async (e) => {
    const dt = e.target.closest("[data-del-tag]"), dm = e.target.closest("[data-del-manifest]"), ab = e.target.closest("[data-abort]");
    if (dt && await modal.confirm({ title: `Delete tag ${dt.dataset.delTag}?`, body: "<p class='muted'>The manifest stays pullable by digest until GC.</p>", confirmText: "Delete tag", danger: true })) { await API.tags.delete(repo, dt.dataset.delTag); toast("Tag deleted", "ok"); loadTags(); loadMeta(); }
    if (dm && await modal.confirm({ title: "Delete manifest?", body: "<p class='muted'>Removes the manifest from this repository. Blobs are reclaimed by GC.</p>", confirmText: "Delete", danger: true })) { await API.manifests.delete(dm.dataset.delManifest); toast("Manifest deleted", "ok"); loadManifests(); loadMeta(); }
    if (ab) { await API.uploads.abort(ab.dataset.abort); toast("Upload aborted", "ok"); loadUploads(); }
  });

  const delRepo = async () => { if (await modal.confirm({ title: `Delete ${repo}?`, body: "<p class='muted'>This removes all tags, manifest links and upload sessions.</p>", confirmText: "Delete repository", danger: true })) { await API.repos.delete(repo); location.href = "/repositories/"; } };
  $("#repo-delete").onclick = delRepo; $("#repo-delete-2").onclick = delRepo;
  $("#repo-delete-tags").onclick = async () => { if (await modal.confirm({ title: "Delete all tags?", confirmText: "Delete tags", danger: true })) { toast("Not implemented yet", "warn"); } };
  $("#repo-settings-form").onsubmit = async (e) => { e.preventDefault(); toast("Saved", "ok"); };

  let t1, t2;
  $("#tags-filter").oninput = () => { clearTimeout(t1); t1 = setTimeout(loadTags, 250); };
  $("#manifests-filter").oninput = () => { clearTimeout(t2); t2 = setTimeout(loadManifests, 250); };
  $("#tags-refresh").onclick = loadTags; $("#manifests-refresh").onclick = loadManifests;

  loadMeta(); loadTags(); loadManifests(); loadUploads();
})();
