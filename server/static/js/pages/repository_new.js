// repository_new.js — /repositories/new/
(() => {
  const { $, esc, toast } = UI;
  const NAME_RE = /^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*$/;
  const ICON_MAX = 1024 * 1024, ICON_MIN = 64, ICON_TYPES = ["image/png", "image/jpeg", "image/webp"];
  const host = () => window.REGISTRY_HOST || location.host;

  const form = $("#new-repo-form"), nameEl = $("#repo-name"), descEl = $("#repo-description"), fileEl = $("#repo-icon");
  const nameErr = $("#repo-name-error"), iconErr = $("#icon-error"), formErr = $("#form-error"), submitBtn = $("#submit-btn");
  const preview = $("#icon-preview"), avatar = $("#preview-avatar");
  let iconFile = null;

  // ---- name ----------------------------------------------------------------
  function nameProblem(v) {
    if (!v) return "Name is required.";
    if (v.length > 100) return "Name must be 100 characters or fewer.";
    if (v !== v.toLowerCase()) return "Name must be lowercase.";
    if (!NAME_RE.test(v)) return "Only a-z, 0-9, and . _ - between characters; / separates namespaces.";
    return "";
  }
  function renderName() {
    const v = nameEl.value.trim();
    nameErr.textContent = v ? nameProblem(v) : "";
    const shown = v || "team-a/backend";
    $("#preview-name").textContent = shown;
    $("#preview-push").innerHTML = `docker tag myapp ${esc(host())}/${esc(shown)}:latest\ndocker push ${esc(host())}/${esc(shown)}:latest`;
    if (!iconFile) avatar.textContent = (shown.split("/").pop()[0] || "?").toUpperCase();
  }
  nameEl.addEventListener("input", renderName);
  document.addEventListener("registry:ready", renderName);

  // ---- description ---------------------------------------------------------
  descEl.addEventListener("input", () => {
    $("#repo-description-count").textContent = descEl.value.length;
    $("#preview-desc").textContent = descEl.value.trim() || "No description";
  });

  // ---- icon ----------------------------------------------------------------
  function setIcon(file) {
    iconErr.textContent = "";
    if (!file) return clearIcon();
    if (!ICON_TYPES.includes(file.type)) return (iconErr.textContent = "Use a PNG, JPEG or WebP image.");
    if (file.size > ICON_MAX) return (iconErr.textContent = "Image is larger than 1 MB.");
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      if (Math.min(img.width, img.height) < ICON_MIN) { URL.revokeObjectURL(url); iconErr.textContent = `Image must be at least ${ICON_MIN}×${ICON_MIN} px (got ${img.width}×${img.height}).`; return; }
      iconFile = file;
      preview.innerHTML = `<img src="${url}" alt="">`; preview.classList.add("has-image");
      avatar.innerHTML = `<img src="${url}" alt="">`;
      $("#icon-clear").classList.remove("hidden");
    };
    img.onerror = () => { URL.revokeObjectURL(url); iconErr.textContent = "Could not read that image."; };
    img.src = url;
  }
  function clearIcon() {
    iconFile = null; fileEl.value = "";
    preview.innerHTML = `${UI.icon("upload")}<span class="small">Drop or click</span>`; preview.classList.remove("has-image");
    $("#icon-clear").classList.add("hidden"); renderName();
  }
  $("#icon-choose").onclick = () => fileEl.click();
  preview.onclick = () => fileEl.click();
  preview.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileEl.click(); } };
  $("#icon-clear").onclick = clearIcon;
  fileEl.onchange = () => setIcon(fileEl.files[0]);
  ["dragenter", "dragover"].forEach((ev) => preview.addEventListener(ev, (e) => { e.preventDefault(); preview.classList.add("drag"); }));
  ["dragleave", "drop"].forEach((ev) => preview.addEventListener(ev, (e) => { e.preventDefault(); preview.classList.remove("drag"); }));
  preview.addEventListener("drop", (e) => setIcon(e.dataTransfer.files[0]));

  // ---- submit --------------------------------------------------------------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    formErr.classList.add("hidden");
    const name = nameEl.value.trim(), problem = nameProblem(name);
    if (problem) { nameErr.textContent = problem; nameEl.focus(); return; }
    if (iconErr.textContent) return;

    const body = new FormData();
    body.append("name", name);
    body.append("description", descEl.value.trim());
    if (iconFile) body.append("icon", iconFile, iconFile.name);

    submitBtn.disabled = true; submitBtn.innerHTML = '<span class="spinner"></span> Creating…';
    try {
      const repo = await API.repos.create(body);
      toast(`Created ${repo.name}`, "ok");
      location.href = `/r/${repo.name}/`;
    } catch (ex) {
      const d = ex.data || {};
      if (d.name) { nameErr.textContent = [].concat(d.name).join(" "); nameEl.focus(); }
      if (d.icon) iconErr.textContent = [].concat(d.icon).join(" ");
      if (!d.name && !d.icon) { $("#form-error-text").textContent = d.detail || ex.message || "Could not create repository."; formErr.classList.remove("hidden"); }
      submitBtn.disabled = false; submitBtn.innerHTML = `${UI.icon("plus")} Create repository`;
    }
  });

  renderName();
})();
