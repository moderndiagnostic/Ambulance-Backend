function apiBase() {
  const raw = String(import.meta.env.VITE_API_BASE ?? "/v1/api").trim();
  return (raw.replace(/\/+$/, "") || "/v1/api");
}

/** Photo /uploads paths — if API is on another host, prefix that origin. */
export function mediaUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const base = apiBase();
  const rel = path.startsWith("/") ? path : `/${path}`;
  if (/^https?:\/\//i.test(base)) {
    try {
      return `${new URL(base).origin}${rel}`;
    } catch {
      return rel;
    }
  }
  return rel;
}

const TOKEN_KEY = "ambulance_admin_token";
const USER_KEY = "ambulance_admin_user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setSession(token, userdata) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(userdata || {}));
}
export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${apiBase()}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (res.status === 401) {
    clearSession();
    if (!location.pathname.endsWith("/login")) {
      location.href = "/admin/login";
    }
  }

  if (!res.ok) {
    const err = new Error(data?.message || data?.msg || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function qs(params = {}) {
  return new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ""))
  ).toString();
}

export const authApi = {
  login: (email, password, keepLoggedIn = true) =>
    request("/login", { method: "POST", body: { email, password, keepLoggedIn } }),
};

export const ambulanceAdminApi = {
  ambulances: () => request("/admin/ambulances"),
  createAmbulance: (payload) => request("/admin/ambulances", { method: "POST", body: payload }),
  updateAmbulance: (id, payload) =>
    request(`/admin/ambulances/${id}`, { method: "PUT", body: payload }),
  drivers: () => request("/admin/ambulance-drivers"),
  createDriver: (payload) =>
    request("/admin/ambulance-drivers", { method: "POST", body: payload }),
  updateDriver: (id, payload) =>
    request(`/admin/ambulance-drivers/${id}`, { method: "PUT", body: payload }),
  trips: (params = {}) => {
    const q = qs(params);
    return request(`/admin/ambulance-trips${q ? `?${q}` : ""}`);
  },
  trip: (id) => request(`/admin/ambulance-trips/${id}`),
  createTrip: (payload) => request("/admin/ambulance-trips", { method: "POST", body: payload }),
  updateTrip: (id, payload) =>
    request(`/admin/ambulance-trips/${id}`, { method: "PUT", body: payload }),
  assignTrip: (id, payload) =>
    request(`/admin/ambulance-trips/${id}/assign`, { method: "PUT", body: payload }),
  cancelTrip: (id, reason) =>
    request(`/admin/ambulance-trips/${id}/cancel`, {
      method: "PUT",
      body: { reason },
    }),
  managers: () => request("/managers"),
  createManager: (payload) => request("/managers", { method: "POST", body: payload }),
  setManagerStatus: (id, isActive) =>
    request(`/managers/${id}/status`, { method: "PUT", body: { isActive } }),
  resetManagerPassword: (id, password) =>
    request(`/managers/${id}/reset-password`, { method: "PUT", body: { password } }),
  shifts: (params = {}) => {
    const q = qs(params);
    return request(`/admin/shifts${q ? `?${q}` : ""}`);
  },
  kms: (params = {}) => {
    const q = qs(params);
    return request(`/admin/kms${q ? `?${q}` : ""}`);
  },
  liveDrivers: () => request("/admin/live-drivers"),
  mapsConfig: () => request("/admin/maps-config"),
  dailySheet: (params = {}) => {
    const q = qs(params);
    return request(`/admin/daily-sheet${q ? `?${q}` : ""}`);
  },
  dashboard: (params = {}) => {
    const q = qs(params);
    return request(`/admin/dashboard${q ? `?${q}` : ""}`);
  },
};
