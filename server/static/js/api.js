/**
 * api.js — thin DRF client. All pages talk to the backend through this.
 * Auth: token stored in localStorage under "registry.token"; sent as
 * `Authorization: Token <token>` (swap to Bearer if you use JWT).
 *
 * Endpoints below are a contract for the DRF side we build later.
 */
const API = (() => {
  const BASE = window.REGISTRY_API_BASE || "/api/v1";
  const TOKEN_KEY = "registry.token";

  const token = {
    get: () => localStorage.getItem(TOKEN_KEY),
    set: (t) => localStorage.setItem(TOKEN_KEY, t),
    clear: () => localStorage.removeItem(TOKEN_KEY),
  };

  async function request(method, path, { body, query, raw } = {}) {
    const url = new URL(BASE + path, location.origin);
    if (query) Object.entries(query).forEach(([k, v]) => v != null && v !== "" && url.searchParams.set(k, v));

    const headers = { Accept: "application/json" };
    if (body && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
    if (token.get()) headers["Authorization"] = `Token ${token.get()}`;

    const res = await fetch(url, {
      method, headers, credentials: "same-origin",
      body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
    });

    if (res.status === 401 && !location.pathname.startsWith("/login")) {
      token.clear();
      location.href = "/login/?next=" + encodeURIComponent(location.pathname);
      return;
    }
    if (raw) return res;
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error(data?.detail || res.statusText || "Request failed");
      err.status = res.status; err.data = data;
      throw err;
    }
    return data;
  }

  const get = (p, query) => request("GET", p, { query });
  const post = (p, body) => request("POST", p, { body });
  const patch = (p, body) => request("PATCH", p, { body });
  const put = (p, body) => request("PUT", p, { body });
  const del = (p) => request("DELETE", p);

  return {
    token, request, get, post, patch, put, del,

    // ---- resource helpers (contract) ---------------------------------
    auth: {
      login: (username, password) => post("/auth/login/", { username, password }),
      logout: () => post("/auth/logout/"),
      me: () => get("/auth/me/"),
    },
    stats: {
      overview: () => get("/stats/overview/"),
      activity: (limit = 10) => get("/stats/activity/", { limit }),
      storage: () => get("/stats/storage/"),
    },
    repos: {
      list: (q) => get("/repositories/", q),
      get: (name) => get(`/repositories/${encodeURIComponent(name)}/`),
      create: (body) => post("/repositories/", body),
      delete: (name) => del(`/repositories/${encodeURIComponent(name)}/`),
      tags: (name, q) => get(`/repositories/${encodeURIComponent(name)}/tags/`, q),
      manifests: (name, q) => get(`/repositories/${encodeURIComponent(name)}/manifests/`, q),
    },
    tags: {
      delete: (repo, tag) => del(`/repositories/${encodeURIComponent(repo)}/tags/${encodeURIComponent(tag)}/`),
      retag: (repo, tag, body) => patch(`/repositories/${encodeURIComponent(repo)}/tags/${encodeURIComponent(tag)}/`, body),
    },
    manifests: {
      get: (digest) => get(`/manifests/${digest}/`),
      delete: (digest) => del(`/manifests/${digest}/`),
    },
    blobs: {
      list: (q) => get("/blobs/", q),
      get: (digest) => get(`/blobs/${digest}/`),
      delete: (digest) => del(`/blobs/${digest}/`),
    },
    uploads: {
      list: (q) => get("/uploads/", q),
      abort: (id) => post(`/uploads/${id}/abort/`),
      delete: (id) => del(`/uploads/${id}/`),
      cleanup: () => post("/uploads/cleanup/"),
    },
    gc: {
      status: () => get("/gc/status/"),
      plan: () => post("/gc/plan/"),          // dry run → mark phase
      run: (body) => post("/gc/run/", body),  // sweep
      history: () => get("/gc/runs/"),
    },
    users: {
      list: () => get("/users/"),
      create: (b) => post("/users/", b),
      update: (id, b) => patch(`/users/${id}/`, b),
      delete: (id) => del(`/users/${id}/`),
    },
    tokens: {
      list: () => get("/tokens/"),
      create: (b) => post("/tokens/", b),
      revoke: (id) => del(`/tokens/${id}/`),
    },
    settings: {
      get: () => get("/settings/"),
      update: (b) => patch("/settings/", b),
    },
  };
})();
