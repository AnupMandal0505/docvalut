// login.js
(() => {
  const { $, toast } = UI;
  const form = $("#login-form"), err = $("#login-error"), errText = $("#login-error-text"), btn = $("#login-submit");
  $("#registry-host").textContent = location.host;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.classList.add("hidden"); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Signing in…';
    try {
      const data = await API.auth.login($("#username").value.trim(), $("#password").value);
      API.token.set(data.token);
      const next = new URLSearchParams(location.search).get("next");
      location.href = next && next.startsWith("/") ? next : "/";
    } catch (ex) {
      errText.textContent = ex.status === 400 || ex.status === 401 ? "Invalid username or password." : (ex.message || "Could not sign in.");
      err.classList.remove("hidden");
    } finally { btn.disabled = false; btn.textContent = "Sign in"; }
  });
})();
