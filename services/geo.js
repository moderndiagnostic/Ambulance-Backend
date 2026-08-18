function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function ymd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayRange(dateKey) {
  const [y, m, d] = String(dateKey).split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  return { start, end };
}

function odoTripKm(startKm, endKm) {
  if (startKm == null || endKm == null) return null;
  const start = Number(startKm);
  const end = Number(endKm);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, Math.round((end - start) * 10) / 10);
}

/** GPS vs odometer — alert when both have km and difference is 20%+ of odometer. */
function kmMismatch(gpsKm, odoKm, threshold = 0.2) {
  const gps = Number(gpsKm);
  const odo = Number(odoKm);
  if (!Number.isFinite(gps) || !Number.isFinite(odo) || gps < 0.5 || odo < 0.5) {
    return { alert: false, pct: null, gpsKm: Number.isFinite(gps) ? gps : null, odoKm: Number.isFinite(odo) ? odo : null };
  }
  const pct = Math.abs(gps - odo) / odo;
  return {
    alert: pct >= threshold,
    pct: Math.round(pct * 1000) / 10,
    gpsKm: gps,
    odoKm: odo,
  };
}

const MAX_TRIP_PATH = 500;
const MIN_PATH_STEP_KM = 0.015;

function appendTripPath(trip, lat, lng, at = new Date()) {
  const path = Array.isArray(trip.path) ? trip.path : [];
  const last = path[path.length - 1];
  if (last && typeof last.lat === "number" && typeof last.lng === "number") {
    const d = haversineKm(last.lat, last.lng, lat, lng);
    if (d < MIN_PATH_STEP_KM) return;
    if (d <= 3) {
      trip.gpsKm = Math.round(((trip.gpsKm || 0) + d) * 100) / 100;
    }
  }
  path.push({ lat, lng, at });
  trip.path = path.slice(-MAX_TRIP_PATH);
}

module.exports = { haversineKm, ymd, dayRange, odoTripKm, kmMismatch, appendTripPath };
