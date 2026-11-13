// repositories.js
(() => {
  const { $, esc, fmt, icon, toast, modal, skeletonRows, emptyRow } = UI;
  const body = $("#repos-body"), filter = $("#repos-filter");
  let state = { page: 1, search: new URLSearchParams(location.search).get("q") || "" };
  filter.value = state.search;

  async function load() {
    body.innerHTML = skeletonRows(6);
    try {
      const data = await API.repos.list({ page: state.page, search: state.search });
      $("#repos-summary").textContent = `${fmt.num(data.count)} repositories`;
      $("#repos-page-info").textContent = `${data.results.length} of ${data.count}`;
      $("#repos-prev").disabled = !data.previous; $("#repos-next").disabled = !data.next;
      body.innerHTML = data.results.length ? data.results.map((r) => `
        <tr>
          <td>
            <div class="row" style="gap:10px">
              <div class="repo-avatar repo-avatar--sm">${r.icon ? `<img src="${esc(r.icon)}" alt="">` : esc((r.name.split("/").pop()[0] || "?").toUpperCase())}</div>
              <div style="min-width:0">
                <a class="mono" href="/r/${esc(r.name)}/">${esc(r.name)}</a>
                ${r.is_public ? '<span class="badge" style="margin-left:6px">public</span>' : ""}
                ${r.description ? `<div class="small faint truncate" style="max-width:360px">${esc(r.description)}</div>` : ""}
              </div>
            </div>
          </td>
          <td class="num">${fmt.num(r.tag_count)}</td>
          <td class="num">${fmt.num(r.manifest_count)}</td>
          <td class="num">${fmt.bytes(r.size)}</td>
          <td class="muted">${fmt.ago(r.last_push)}</td>
          <td class="actions">
            <button class="btn btn--sm btn--icon" data-copy="${esc((window.REGISTRY_HOST || location.host) + "/" + r.name)}" title="Copy pull path">${icon("copy")}</button>
            <button class="btn btn--sm btn--icon" data-del="${esc(r.name)}" title="Delete">${icon("trash")}</button>
          </td>
        </tr>`).join("") : emptyRow(6, state.search ? "No repositories match" : "No repositories yet — push an image to create one");
    } catch (e) { body.innerHTML = emptyRow(6, "Failed to load: " + e.message); }
  }

  let t; filter.oninput = () => { clearTimeout(t); t = setTimeout(() => { state.search = filter.value.trim(); state.page = 1; load(); }, 250); };
  $("#repos-refresh").onclick = load;
  $("#repos-prev").onclick = () => { state.page--; load(); };
  $("#repos-next").onclick = () => { state.page++; load(); };

  body.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-del]"); if (!b) return;
    const name = b.dataset.del;
    if (await modal.confirm({ title: `Delete ${name}?`, body: `<p class="muted">All tags and manifest links in <code>${esc(name)}</code> will be removed. Blobs are kept until garbage collection.</p>`, confirmText: "Delete repository", danger: true })) {
      try { await API.repos.delete(name); toast("Repository deleted", "ok"); load(); } catch (ex) { toast(ex.message, "danger"); }
    }
  });


  load();
})();
