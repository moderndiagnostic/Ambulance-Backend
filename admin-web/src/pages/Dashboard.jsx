import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import StatCard from "../components/StatCard.jsx";
import Badge from "../components/Badge.jsx";
import { ambulanceAdminApi } from "../api.js";

const STATUS_ORDER = [
  "Unassigned",
  "Assigned",
  "Accepted",
  "EnRoutePickup",
  "ArrivedPickup",
  "Onboard",
  "EnRouteDrop",
  "ArrivedDrop",
  "Completed",
  "Cancelled",
  "Rejected",
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    ambulanceAdminApi
      .dashboard()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const goTrips = (status) => {
    navigate(status ? `/trips?status=${encodeURIComponent(status)}` : "/trips");
  };

  const byStatus = data?.byStatus || {};
  const maxStatus = Math.max(1, ...STATUS_ORDER.map((s) => byStatus[s] || 0));

  return (
    <div>
      <Topbar title="Dashboard" subtitle="Live overview — trips, fleet, drivers, alerts" />
      <div className="p-4 md:p-8 space-y-6">
        {error ? (
          <div className="rounded-lg bg-rose-50 text-rose-700 text-sm px-4 py-3">{error}</div>
        ) : null}
        {loading ? (
          <p className="text-slate-500 text-sm">Loading…</p>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total trips" value={data.totalTrips} onClick={() => goTrips()} />
              <StatCard
                label="Completed"
                value={data.completed}
                hint={`${data.completionRate}%`}
                accent="green"
                onClick={() => goTrips("Completed")}
              />
              <StatCard
                label="Unassigned"
                value={data.unassigned}
                accent="amber"
                onClick={() => goTrips("Unassigned")}
              />
              <StatCard
                label="Active now"
                value={data.active}
                onClick={() => goTrips("Assigned")}
              />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Today's trips"
                value={data.todayTrips}
                hint={data.date}
                onClick={() => navigate("/daily-sheet")}
              />
              <StatCard
                label="On duty"
                value={`${data.drivers?.onDuty || 0} / ${data.drivers?.total || 0}`}
                onClick={() => navigate("/drivers")}
              />
              <StatCard
                label="Fleet available"
                value={`${data.fleet?.available || 0} / ${data.fleet?.total || 0}`}
                hint={data.fleet?.onTrip ? `${data.fleet.onTrip} on trip` : undefined}
                onClick={() => navigate("/fleet")}
              />
              <StatCard
                label="Live on map"
                value={data.drivers?.liveGps || 0}
                onClick={() => navigate("/live-map")}
              />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="KM mismatch"
                value={data.kmMismatchCount}
                accent={data.kmMismatchCount ? "amber" : "green"}
                hint="20%+"
                onClick={() => navigate("/daily-sheet")}
              />
              <StatCard
                label="Photos missing"
                value={data.photosMissingCount}
                accent={data.photosMissingCount ? "rose" : "green"}
                onClick={() => navigate("/daily-sheet")}
              />
              <StatCard
                label="Open check-ins"
                value={data.openCheckIns}
                onClick={() => navigate("/check-ins")}
              />
              <StatCard
                label="GPS km today"
                value={data.gpsKmToday}
                onClick={() => navigate("/kms")}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Trips by status</h3>
                <div className="space-y-3">
                  {STATUS_ORDER.every((s) => !byStatus[s]) ? (
                    <p className="text-sm text-slate-400">No trips yet</p>
                  ) : (
                    STATUS_ORDER.filter((s) => byStatus[s]).map((s) => (
                      <button key={s} onClick={() => goTrips(s)} className="w-full text-left group">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span className="font-medium text-slate-700 group-hover:text-brand-600">{s}</span>
                          <span>{byStatus[s]}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-brand-500 group-hover:bg-brand-600"
                            style={{ width: `${((byStatus[s] || 0) / maxStatus) * 100}%` }}
                          />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Recent trips</h3>
                {(data.recent || []).length === 0 ? (
                  <p className="text-sm text-slate-400">No trips yet</p>
                ) : (
                  <div className="space-y-2">
                    {(data.recent || []).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => goTrips(t.tripStatus)}
                        className="w-full flex items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-50 text-left"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-800 truncate">
                            {t.patientName}
                          </div>
                          <div className="text-xs text-slate-400 truncate">
                            {t.tripId} · {t.assignedDriverName || "Unassigned"}
                          </div>
                        </div>
                        <Badge>{t.tripStatus}</Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
