// manifest.js — /r/<repo>/manifests/<digest>/ or /r/<repo>/tags/<tag>/
(() => {
  const { $, esc, fmt, digest, icon, toast, modal } = UI;
  const m = location.pathname.match(/^\/r\/(.+?)\/(manifests|tags)\/([^/]+)\/?$/);
  const repo = decodeURIComponent(m[1]), kind = m[2], ref = decodeURIComponent(m[3]);
  const host = () => window.REGISTRY_HOST || location.host;
  $("#bc-repo").textContent = repo; $("#bc-repo").href = `/r/${repo}/`; $("#bc-ref").textContent = ref;
  $("#m-title").textContent = kind === "tags" ? `${repo}:${ref}` : `${repo}@${ref.slice(0, 19)}…`;
  document.title = `${repo}:${ref} · Registry`;

  const pretty = (s) => esc(s).replace(/"([^"]+)":/g, '<span class="kw">"$1"</span>:').replace(/: "([^"]*)"/g, ': <span class="str">"$1"</span>').replace(/: (\d+)/g, ': <span class="num">$1</span>');

  async function load() {
    const data = await API.manifests.get(ref); // backend resolves tag or digest
    const d = data.digest;
    $("#m-digest-full").innerHTML = `<span class="mono small">${esc(d)}</span>`;
    $("#m-digest").innerHTML = digest(d, 20);
    $("#m-media-type").textContent = data.media_type; $("#m-schema").textContent = data.schema_version;
    $("#m-size").textContent = fmt.bytes(data.size); $("#m-created").textContent = fmt.date(data.created_at);
    $("#m-repos").innerHTML = data.repositories.map((r) => `<a class="mono" href="/r/${esc(r)}/">${esc(r)}</a>`).join(", ");
    $("#m-tags").innerHTML = data.tags.length ? data.tags.map((t) => `<a href="/r/${esc(repo)}/tags/${esc(t)}/"><span class="badge badge--accent">${esc(t)}</span></a>`).join("") : '<span class="small faint">Untagged</span>';
    if (data.referenced_by?.length) $("#m-referenced-by").innerHTML = data.referenced_by.map((x) => digest(x, 16)).join("<br>");

    const isIndex = /index|manifest\.list/.test(data.media_type);
    $("#m-index-alert").classList.toggle("hidden", !isIndex); $("#m-platforms-card").classList.toggle("hidden", !isIndex);
    if (isIndex) $("#m-platforms-body").innerHTML = (data.manifests || []).map((p) => `<tr><td><span class="badge">${esc(p.platform)}</span></td><td>${digest(p.digest, 16)}</td><td class="small mono muted">${esc(p.media_type)}</td><td class="num">${fmt.bytes(p.size)}</td><td class="actions"><a class="btn btn--sm" href="/r/${esc(repo)}/manifests/${esc(p.digest)}/">Inspect</a></td></tr>`).join("");

    const layers = data.layers || [], max = Math.max(...layers.map((l) => l.size), 1);
    $("#m-layer-count").textContent = layers.length; $("#m-layer-total").textContent = fmt.bytes(layers.reduce((a, l) => a + l.size, 0));
    $("#m-layers").innerHTML = layers.map((l, i) => `
      <div class="layer"><div class="layer__idx">${i + 1}</div>
        <div style="min-width:0">${digest(l.digest, 24)}<div class="small faint mono mt-1" style="font-size:11px">${esc(l.media_type)}</div><div class="layer__bar"><span style="width:${(l.size / max) * 100}%"></span></div></div>
        <div class="num muted small">${fmt.bytes(l.size)}</div></div>`).join("") || '<div class="empty small">No layers (index manifest)</div>';

    const c = data.config || {};
    $("#m-config-digest").innerHTML = c.digest ? digest(c.digest, 16) : "";
    $("#cfg-platform").textContent = [c.architecture, c.os].filter(Boolean).join(" / ") || "—";
    $("#cfg-created").textContent = fmt.date(c.created);
    $("#cfg-entrypoint").textContent = JSON.stringify(c.Entrypoint ?? null); $("#cfg-cmd").textContent = JSON.stringify(c.Cmd ?? null);
    $("#cfg-workdir").textContent = c.WorkingDir || "—"; $("#cfg-user").textContent = c.User || "root (default)";
    $("#cfg-ports").innerHTML = Object.keys(c.ExposedPorts || {}).map((p) => `<span class="badge">${esc(p)}</span>`).join(" ") || "—";
    $("#cfg-labels").innerHTML = Object.entries(c.Labels || {}).map(([k, v]) => `<div class="small"><span class="mono muted">${esc(k)}</span> = <span class="mono">${esc(v)}</span></div>`).join("") || "—";
    $("#cfg-env").textContent = (c.Env || []).join("\n") || "—";
    $("#cfg-history").innerHTML = (c.history || []).map((h, i) => `<div class="feed__item"><div class="feed__icon">${i + 1}</div><div class="mono small" style="overflow-wrap:anywhere">${esc(h.created_by)}</div><div class="feed__time">${h.empty_layer ? "no layer" : ""}</div></div>`).join("");
    $("#cfg-raw").innerHTML = pretty(JSON.stringify(c, null, 2));
    $("#m-raw").innerHTML = pretty(data.raw || "");

    $("#m-pull").onclick = () => navigator.clipboard.writeText(`docker pull ${host()}/${repo}${kind === "tags" ? ":" + ref : "@" + d}`).then(() => toast("Pull command copied", "ok"));
    $("#m-copy-raw").onclick = () => navigator.clipboard.writeText(data.raw || "").then(() => toast("Copied", "ok", 1200));
    $("#m-download").onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data.raw], { type: data.media_type })); a.download = d.replace("sha256:", "") + ".json"; a.click(); };
    $("#m-delete").onclick = async () => { if (await modal.confirm({ title: "Delete manifest?", body: `<p class="muted">Fails if any tag still references it (<code>PROTECT</code>).</p>`, confirmText: "Delete", danger: true })) { try { await API.manifests.delete(d); location.href = `/r/${repo}/`; } catch (ex) { toast(ex.message, "danger"); } } };
    $("#retag-form").onsubmit = async (e) => { e.preventDefault(); try { await API.tags.retag(repo, $("#retag-name").value.trim(), { manifest: d }); modal.close("modal-retag"); toast("Tag added", "ok"); load(); } catch (ex) { toast(ex.message, "danger"); } };
  }
  load().catch((e) => toast(e.message, "danger"));
})();
