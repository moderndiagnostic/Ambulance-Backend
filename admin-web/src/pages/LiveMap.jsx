import { useEffect, useRef, useState } from "react";
import Topbar from "../components/Topbar.jsx";
import { ambulanceAdminApi } from "../api.js";
import { loadGoogleMaps } from "../lib/googleMaps.js";

const REFRESH_MS = 15000;
const INDIA = { lat: 22.9734, lng: 78.6569 };

function timeAgo(dateStr) {
  if (!dateStr) return "never";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function driverId(d) {
  return String(d._id || d.id);
}

function nextStop(trip) {
  if (!trip) return null;
  const pickup =
    typeof trip.pickupLat === "number" && typeof trip.pickupLng === "number"
      ? { lat: trip.pickupLat, lng: trip.pickupLng, label: "Pickup" }
      : null;
  const drop =
    typeof trip.dropLat === "number" && typeof trip.dropLng === "number"
      ? { lat: trip.dropLat, lng: trip.dropLng, label: trip.hospitalName || "Hospital" }
      : null;
  const toPickup = ["Assigned", "Accepted", "EnRoutePickup", "ArrivedPickup"].includes(trip.tripStatus);
  if (toPickup) return pickup;
  return drop;
}

export default function LiveMap() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapsReady, setMapsReady] = useState(false);
  const [needKey, setNeedKey] = useState(false);
  const [selected, setSelected] = useState(null);

  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef({ markers: {}, trails: {}, dest: null, dirRenderer: null });

  async function load() {
    try {
      const res = await ambulanceAdminApi.liveDrivers();
      const live = (res.drivers || []).filter(
        (d) => typeof d.currentLat === "number" && typeof d.currentLng === "number"
      );
      setDrivers(live);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await ambulanceAdminApi.mapsConfig();
        if (!cfg.googleMapsKey) {
          setNeedKey(true);
          setLoading(false);
          return;
        }
        await loadGoogleMaps(cfg.googleMapsKey, () => {
          setError(
            "Google Maps key reject hui. Cloud Console mein Billing ON karo, aur Maps JavaScript API + Directions API enable karo. Sirf .env mein key paste karna kaafi nahi."
          );
        });
        if (!cancelled) setMapsReady(true);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapsReady) return;
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [mapsReady]);

  useEffect(() => {
    if (!mapsReady || !mapDivRef.current || mapRef.current) return;
    mapRef.current = new window.google.maps.Map(mapDivRef.current, {
      center: INDIA,
      zoom: 5,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });
    overlaysRef.current.dirRenderer = new window.google.maps.DirectionsRenderer({
      map: mapRef.current,
      suppressMarkers: true,
      polylineOptions: { strokeColor: "#2563eb", strokeWeight: 4, strokeOpacity: 0.85 },
    });
  }, [mapsReady]);

  useEffect(() => {
    const map = mapRef.current;
    const g = window.google;
    if (!map || !g?.maps) return;
    const overlays = overlaysRef.current;
    const seen = new Set();

    drivers.forEach((d) => {
      const id = driverId(d);
      seen.add(id);
      const pos = { lat: d.currentLat, lng: d.currentLng };
      if (!overlays.markers[id]) {
        overlays.markers[id] = new g.maps.Marker({
          map,
          position: pos,
          title: d.name,
          icon: {
            path: g.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: "#dc2626",
            fillOpacity: 1,
            strokeColor: "#7f1d1d",
            strokeWeight: 2,
          },
        });
        overlays.markers[id].addListener("click", () => setSelected(id));
      } else {
        overlays.markers[id].setPosition(pos);
      }

      const path = (d.locationTrail || [])
        .filter((p) => typeof p.lat === "number" && typeof p.lng === "number")
        .map((p) => ({ lat: p.lat, lng: p.lng }));
      if (path.length) path.push(pos);
      if (!overlays.trails[id]) {
        overlays.trails[id] = new g.maps.Polyline({
          map,
          path,
          strokeColor: "#f97316",
          strokeOpacity: 0.8,
          strokeWeight: 3,
        });
      } else {
        overlays.trails[id].setPath(path);
      }
    });

    Object.keys(overlays.markers).forEach((id) => {
      if (!seen.has(id)) {
        overlays.markers[id].setMap(null);
        delete overlays.markers[id];
        overlays.trails[id]?.setMap(null);
        delete overlays.trails[id];
      }
    });

    if (drivers.length === 1) {
      map.setCenter({ lat: drivers[0].currentLat, lng: drivers[0].currentLng });
      map.setZoom(14);
    } else if (drivers.length > 1) {
      const b = new g.maps.LatLngBounds();
      drivers.forEach((d) => b.extend({ lat: d.currentLat, lng: d.currentLng }));
      map.fitBounds(b, 48);
    }
  }, [drivers]);

  useEffect(() => {
    const map = mapRef.current;
    const g = window.google;
    const overlays = overlaysRef.current;
    if (!map || !g?.maps) return;

    overlays.dest?.setMap(null);
    overlays.dest = null;
    overlays.dirRenderer?.set("directions", null);

    const d = drivers.find((x) => driverId(x) === selected);
    if (!d) return;

    map.panTo({ lat: d.currentLat, lng: d.currentLng });
    map.setZoom(15);

    const stop = nextStop(d.activeTrip);
    if (!stop) return;

    overlays.dest = new g.maps.Marker({
      map,
      position: { lat: stop.lat, lng: stop.lng },
      title: stop.label,
      label: { text: stop.label === "Pickup" ? "P" : "H", color: "white" },
    });

    const svc = new g.maps.DirectionsService();
    svc.route(
      {
        origin: { lat: d.currentLat, lng: d.currentLng },
        destination: { lat: stop.lat, lng: stop.lng },
        travelMode: g.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === "OK") overlays.dirRenderer.setDirections(result);
      }
    );
  }, [selected, drivers]);

  function focusOn(d) {
    setSelected(driverId(d));
  }

  return (
    <>
      <Topbar title="Live Map" subtitle="Google Maps — live GPS track, click a driver for route" />
      <div className="p-4 md:p-8 space-y-4">
        {needKey ? (
          <div className="rounded-lg bg-amber-50 text-amber-900 text-sm px-4 py-3 space-y-2">
            <p className="font-semibold">Google Maps API key chahiye</p>
            <ol className="list-decimal ml-4 space-y-1">
              <li>
                <a
                  className="underline"
                  href="https://console.cloud.google.com/google/maps-apis/credentials"
                  target="_blank"
                  rel="noreferrer"
                >
                  Google Cloud Console
                </a>{" "}
                → project → Credentials → API key
              </li>
              <li>
                Enable: <strong>Maps JavaScript API</strong> + <strong>Directions API</strong>
              </li>
              <li>
                <code className="text-xs">AmbulanceBackend/.env</code> mein likho{" "}
                <code>GOOGLE_MAPS_API_KEY=AIza...</code>
              </li>
              <li>Ambulance backend restart, phir ye page refresh</li>
            </ol>
          </div>
        ) : null}
        {error ? <div className="rounded-lg bg-rose-50 text-rose-700 text-sm px-4 py-3">{error}</div> : null}

        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500" />
          {loading ? "Loading…" : `${drivers.length} driver${drivers.length === 1 ? "" : "s"} live`}
          <span className="text-xs text-slate-300 ml-auto">Google Maps · refresh 15s</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="card overflow-hidden lg:col-span-3">
            <div ref={mapDivRef} style={{ height: "60vh", width: "100%", minHeight: 360 }} />
          </div>

          <div className="card p-3 space-y-1.5 max-h-[60vh] overflow-y-auto">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide px-1 pb-1">
              On duty now
            </div>
            {drivers.length === 0 && !loading && !needKey ? (
              <div className="text-sm text-slate-400 px-1 py-4 text-center">
                No drivers on duty with a GPS ping yet
              </div>
            ) : (
              drivers.map((d) => (
                <button
                  key={driverId(d)}
                  onClick={() => focusOn(d)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                    selected === driverId(d) ? "bg-rose-50 text-rose-700" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="font-medium">{d.name}</div>
                  <div className="text-xs text-slate-400">
                    {d.vehicleNumber || d.zone || "—"} · {timeAgo(d.lastLocationAt)}
                    {d.todayDistanceKm ? ` · ${d.todayDistanceKm} km` : ""}
                  </div>
                  {d.activeTrip ? (
                    <div className="text-xs text-indigo-500 mt-0.5">{d.activeTrip.tripStatus}</div>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
