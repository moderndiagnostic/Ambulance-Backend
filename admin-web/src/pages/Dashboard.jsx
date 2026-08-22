import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import StatCard from "../components/StatCard.jsx";
import Badge from "../components/Badge.jsx";
import DateRangeBar from "../components/DateRangeBar.jsx";
import DonutChart, { RadialGauge } from "../components/DonutChart.jsx";
import { useDateRange } from "../hooks/useDateRange.js";
import { ambulanceAdminApi } from "../api.js";
import { SHOW_PATIENT } from "../showPatient.js";

const ACTIVE_STATUSES = [
  "Assigned",
  "Accepted",
  "EnRoutePickup",
  "ArrivedPickup",
  "Onboard",
  "EnRouteDrop",
  "ArrivedDrop",
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const { preset, range, applyPreset, setCustom } = useDateRange("30d");

  useEffect(() => {
    setLoading(true);
    setError("");
    ambulanceAdminApi
      .dashboard({ from: range.from, to: range.to })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [range]);

  const goTrips = (status) => {
    navigate(status ? `/trips?status=${encodeURIComponent(status)}` : "/trips");
  };

  const byStatus = data?.byStatus || {};
  const inProgress = ACTIVE_STATUSES.reduce((n, s) => n + (byStatus[s] || 0), 0);

  const outcomeSegments = [
    { label: "Completed", value: byStatus.Completed || 0, color: "#0f766e", status: "Completed" },
    { label: "In progress", value: inProgress, color: "#2563eb", status: "Assigned" },
    { label: "Unassigned", value: byStatus.Unassigned || 0, color: "#d97706", status: "Unassigned" },
    { label: "Cancelled", value: byStatus.Cancelled || 0, color: "#64748b", status: "Cancelled" },
    { label: "Rejected", value: byStatus.Rejected || 0, color: "#e11d48", status: "Rejected" },
  ];

  const fleetSegments = [
    { label: "Available", value: data?.fleet?.available || 0, color: "#0f766e" },
    { label: "On trip", value: data?.fleet?.onTrip || 0, color: "#2563eb" },
    { label: "Maintenance", value: data?.fleet?.maintenance || 0, color: "#d97706" },
  ];

  return (
    <div>
      <Topbar title="Dashboard" subtitle="Operations overview — date filter and circular analytics" />
      <div className="p-4 md:p-8 space-y-6">
        <DateRangeBar preset={preset} range={range} onPreset={applyPreset} onCustom={setCustom} />
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

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <DonutChart
                title="Trip mix"
                subtitle="Outcome split for selected dates"
                segments={outcomeSegments}
                centerValue={data.totalTrips}
                centerLabel="Trips"
                emptyText="No trips in this range"
                onSegmentClick={(s) => goTrips(s.status)}
              />
              <DonutChart
                title="Fleet status"
                subtitle="Live vehicle utilization"
                segments={fleetSegments}
                centerValue={data.fleet?.total || 0}
                centerLabel="Vehicles"
                emptyText="No vehicles"
                onSegmentClick={() => navigate("/fleet")}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <RadialGauge
                title="Completion rate"
                subtitle="Completed vs all trips in range"
                value={data.completionRate || 0}
                color="#0f766e"
                caption={`${data.completed || 0} of ${data.totalTrips || 0} completed`}
              />
              <div className="card p-5 lg:col-span-2">
                <h3 className="text-sm font-semibold text-slate-800 mb-1">Recent trips</h3>
                <p className="text-xs text-slate-400 mb-3">Latest activity in this date range</p>
                {(data.recent || []).length === 0 ? (
                  <p className="text-sm text-slate-400 py-8 text-center">No trips in this range</p>
                ) : (
                  <div className="space-y-1">
                    {(data.recent || []).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => goTrips(t.tripStatus)}
                        className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-slate-50 text-left"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-800 truncate">
                            {SHOW_PATIENT ? t.patientName || t.tripId || "Trip" : t.tripId || "Trip"}
                          </div>
                          <div className="text-xs text-slate-400 truncate">
                            {t.tripId} · {t.assignedDriverName || "Unassigned"}
                            {t.vehicleNumber ? ` · ${t.vehicleNumber}` : ""}
                          </div>
                        </div>
                        <Badge>{t.tripStatus}</Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
                label="Live on map"
                value={data.drivers?.liveGps || 0}
                onClick={() => navigate("/live-map")}
              />
              <StatCard
                label="GPS km (range)"
                value={data.gpsKmRange ?? data.gpsKmToday}
                onClick={() => navigate("/kms")}
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
                label="Fleet available"
                value={`${data.fleet?.available || 0} / ${data.fleet?.total || 0}`}
                hint={data.fleet?.onTrip ? `${data.fleet.onTrip} on trip` : undefined}
                onClick={() => navigate("/fleet")}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
