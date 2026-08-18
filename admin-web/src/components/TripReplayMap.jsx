import { useEffect, useRef, useState } from "react";
import { ambulanceAdminApi } from "../api.js";
import { loadGoogleMaps } from "../lib/googleMaps.js";

function destFromTrip(trip, kind) {
  if (kind === "pickup") {
    if (typeof trip.pickupLat === "number" && typeof trip.pickupLng === "number") {
      return { location: { lat: trip.pickupLat, lng: trip.pickupLng } };
    }
    if (trip.pickupAddress) return { location: trip.pickupAddress };
    return null;
  }
  if (typeof trip.dropLat === "number" && typeof trip.dropLng === "number") {
    return { location: { lat: trip.dropLat, lng: trip.dropLng } };
  }
  if (trip.dropAddress) return { location: trip.dropAddress };
  return null;
}

function lastGps(trip) {
  const path = Array.isArray(trip.path) ? trip.path : [];
  const last = path[path.length - 1];
  if (last && typeof last.lat === "number" && typeof last.lng === "number") {
    return { lat: last.lat, lng: last.lng };
  }
  if (typeof trip.liveLat === "number" && typeof trip.liveLng === "number") {
    return { lat: trip.liveLat, lng: trip.liveLng };
  }
  if (typeof trip.startProofLat === "number" && typeof trip.startProofLng === "number") {
    return { lat: trip.startProofLat, lng: trip.startProofLng };
  }
  return null;
}

function minsBetween(a, b) {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round(ms / 60000);
}

function routeMins(g, origin, dest) {
  return new Promise((resolve) => {
    if (!origin || !dest) {
      resolve(null);
      return;
    }
    const svc = new g.maps.DirectionsService();
    svc.route(
      {
        origin,
        destination: dest.location,
        travelMode: g.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status !== "OK" || !result?.routes?.[0]?.legs?.[0]) {
          resolve(null);
          return;
        }
        const sec = result.routes[0].legs[0].duration?.value;
        resolve(typeof sec === "number" ? Math.round(sec / 60) : null);
      }
    );
  });
}

export default function TripReplayMap({ trip }) {
  const mapDivRef = useRef(null);
  const [needKey, setNeedKey] = useState(false);
  const [error, setError] = useState("");
  const [eta, setEta] = useState({ pickup: null, hospital: null, loading: false });

  const closed = ["Completed", "Cancelled", "Rejected"].includes(trip.tripStatus);
  const actualPickup = minsBetween(trip.enRoutePickupAt, trip.arrivedPickupAt);
  const actualHospital = minsBetween(trip.onboardAt || trip.enRouteDropAt, trip.arrivedDropAt);
  const path = (Array.isArray(trip.path) ? trip.path : []).filter(
    (p) => typeof p.lat === "number" && typeof p.lng === "number"
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await ambulanceAdminApi.mapsConfig();
        if (!cfg.googleMapsKey) {
          if (!cancelled) setNeedKey(true);
          return;
        }
        await loadGoogleMaps(cfg.googleMapsKey, () => {
          if (!cancelled) setError("Maps key reject. Billing + Maps JS + Directions API on karo.");
        });
        if (cancelled || !mapDivRef.current || !window.google?.maps) return;
        const g = window.google;
        const origin = lastGps(trip);
        const center = origin ||
          (typeof trip.pickupLat === "number"
            ? { lat: trip.pickupLat, lng: trip.pickupLng }
            : { lat: 22.9734, lng: 78.6569 });
        const map = new g.maps.Map(mapDivRef.current, {
          center,
          zoom: origin || path.length ? 13 : 5,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        const bounds = new g.maps.LatLngBounds();
        if (path.length >= 2) {
          const poly = new g.maps.Polyline({
            path: path.map((p) => ({ lat: p.lat, lng: p.lng })),
            strokeColor: "#0f766e",
            strokeWeight: 4,
            strokeOpacity: 0.9,
            map,
          });
          poly.getPath().forEach((ll) => bounds.extend(ll));
        } else if (origin) {
          bounds.extend(origin);
        }
        if (typeof trip.pickupLat === "number" && typeof trip.pickupLng === "number") {
          new g.maps.Marker({
            map,
            position: { lat: trip.pickupLat, lng: trip.pickupLng },
            label: "P",
            title: "Pickup",
          });
          bounds.extend({ lat: trip.pickupLat, lng: trip.pickupLng });
        }
        if (typeof trip.dropLat === "number" && typeof trip.dropLng === "number") {
          new g.maps.Marker({
            map,
            position: { lat: trip.dropLat, lng: trip.dropLng },
            label: "H",
            title: trip.hospitalName || "Hospital",
          });
          bounds.extend({ lat: trip.dropLat, lng: trip.dropLng });
        }
        if (origin) {
          new g.maps.Marker({
            map,
            position: origin,
            title: "Ambulance",
            icon: {
              path: g.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#2563eb",
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 2,
            },
          });
        }
        if (!bounds.isEmpty()) map.fitBounds(bounds, 48);

        if (!closed && origin) {
          setEta((e) => ({ ...e, loading: true }));
          const pickupDest = destFromTrip(trip, "pickup");
          const hospDest = destFromTrip(trip, "hospital");
          const [pickup, hospital] = await Promise.all([
            routeMins(g, origin, pickupDest),
            routeMins(g, origin, hospDest),
          ]);
          if (!cancelled) setEta({ pickup, hospital, loading: false });
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trip.id, trip.liveAt, path.length]);

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-slate-400 uppercase">Trip replay</div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <div className="text-[11px] text-slate-400">Pickup</div>
          <div className="font-semibold text-slate-800">
            {eta.loading ? "ETA…" : eta.pickup != null ? `${eta.pickup} min` : "—"}
            {actualPickup != null ? (
              <span className="ml-1 text-xs font-normal text-slate-500">actual {actualPickup} min</span>
            ) : null}
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <div className="text-[11px] text-slate-400">Hospital</div>
          <div className="font-semibold text-slate-800">
            {eta.loading ? "ETA…" : eta.hospital != null ? `${eta.hospital} min` : "—"}
            {actualHospital != null ? (
              <span className="ml-1 text-xs font-normal text-slate-500">actual {actualHospital} min</span>
            ) : null}
          </div>
        </div>
      </div>
      {needKey ? (
        <p className="text-xs text-amber-700">Google Maps key nahi hai — path replay ke liye .env mein key chahiye.</p>
      ) : null}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <div ref={mapDivRef} className="h-64 w-full rounded-xl border border-slate-200 bg-slate-100" />
      <p className="text-[11px] text-slate-400">
        {path.length ? `${path.length} GPS points` : "Is trip pe path abhi nahi — driver ping ke baad aayega."}
      </p>
    </div>
  );
}
