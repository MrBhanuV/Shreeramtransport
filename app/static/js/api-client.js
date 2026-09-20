/*
 * api-client.js -- thin fetch wrapper for the new FastAPI backend.
 * NEW file (not part of the original decomposition). Centralizes JWT
 * storage + header injection + 401 handling.
 */
const SRT_JWT_KEY = "srt_jwt_v1";

const SrtApi = (() => {
  function getToken() {
    try {
      return sessionStorage.getItem(SRT_JWT_KEY) || "";
    } catch (e) {
      return "";
    }
  }
  function setToken(token) {
    try {
      if (token) sessionStorage.setItem(SRT_JWT_KEY, token);
      else sessionStorage.removeItem(SRT_JWT_KEY);
      localStorage.removeItem(SRT_JWT_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  async function request(method, path, body) {
    const headers = { "Content-Type": "application/json" };
    const token = getToken();
    if (token) headers["Authorization"] = "Bearer " + token;
    const res = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
      setToken("");
      throw Object.assign(new Error("Session expired, please sign in again."), {
        status: 401,
      });
    }
    let data = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = text;
      }
    }
    if (!res.ok) {
      const message =
        data && data.detail
          ? data.detail
          : "Request failed (" + res.status + ")";
      throw Object.assign(new Error(message), { status: res.status, data });
    }
    return data;
  }

  return {
    getToken,
    setToken,
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    put: (path, body) => request("PUT", path, body),
    del: (path) => request("DELETE", path),
    login: (email, password) =>
      request("POST", "/api/auth/login", { email, password }),
    me: () => request("GET", "/api/auth/me"),
  };
})();
