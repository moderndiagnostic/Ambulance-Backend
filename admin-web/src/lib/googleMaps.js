export function loadGoogleMaps(key, onAuthFail) {
  if (window.google?.maps) return Promise.resolve();
  if (window.__gmapsLoading) return window.__gmapsLoading;
  window.gm_authFailure = () => {
    if (typeof onAuthFail === "function") onAuthFail();
  };
  window.__gmapsLoading = new Promise((resolve, reject) => {
    const cb = "__gmapsReady";
    window[cb] = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=${cb}`;
    s.async = true;
    s.onerror = () => reject(new Error("Google Maps script failed to load"));
    document.head.appendChild(s);
  });
  return window.__gmapsLoading;
}
