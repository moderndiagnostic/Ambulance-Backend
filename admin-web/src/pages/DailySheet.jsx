import { Fragment, useEffect, useState } from "react";
import Topbar from "../components/Topbar.jsx";
import { ambulanceAdminApi } from "../api.js";
import { downloadExcel } from "../lib/excel.js";

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function photoLabel(code) {
  if (code === "start_odometer") return "start odo";
  if (code === "start_vehicle") return "start vehicle";
  if (code === "end_odometer") return "end odo";
  return code;
}

function fmtTime(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function fmtDateTime(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "";
  }
}

function num(v, fallback = "") {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function fileSlug(name) {
  return String(name || "driver")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "driver";
}

function summaryHeaders() {
  return [
    "Date",
    "Driver",
    "Vehicle",
    "Check-in",
    "Check-out",
    "Duty hours",
    "Open check-in",
    "Trips",
    "Completed",
    "Cancelled",
    "Unassigned",
    "Shift odo km",
    "Trip odo km",
    "GPS km (trips)",
    "GPS km (shift)",
    "KM mismatch",
    "Photos missing",
  ];
}

function summaryRow(date, r) {
  return [
    date,
    r.driverName || "",
    (r.vehicles || []).join(", "),
    fmtDateTime(r.checkInAt),
    fmtDateTime(r.checkOutAt),
    num(r.dutyHours, ""),
    r.openCheckIn ? "Yes" : "No",
    num(r.tripCount, 0),
    num(r.completedCount, 0),
    num(r.cancelledCount, 0),
    num(r.unassignedCount, 0),
    num(r.shiftOdoKm, ""),
    num(r.tripOdoKm ?? r.odoKm, ""),
    num(r.gpsKm, 0),
    num(r.shiftGpsKm, 0),
    num(r.kmMismatchCount, 0),
    num(r.photosMissingCount, 0),
  ];
}

function tripHeaders() {
  return [
    "Date",
    "Driver",
    "Vehicle",
    "Trip ID",
    "Patient",
    "Mobile",
    "Status",
    "Type",
    "Pickup",
    "Drop",
    "GPS km",
    "Trip odo km",
    "KM mismatch %",
    "Photos missing",
    "Created",
    "Completed",
  ];
}

function tripRows(date, drivers) {
  const out = [];
  for (const r of drivers) {
    for (const t of r.trips || []) {
      out.push([
        date,
        r.driverName || t.assignedDriverName || "",
        t.vehicleNumber || (r.vehicles || []).join(", "),
        t.tripId || "",
        t.patientName || "",
        t.mobileNumber || "",
        t.tripStatus || "",
        t.requestedType || "",
        t.pickupAddress || "",
        [t.hospitalName, t.dropAddress].filter(Boolean).join(" · "),
        num(t.gpsKm, 0),
        num(t.odoKm, ""),
        t.kmMismatch ? num(t.kmMismatchPct, "") : "",
        (t.photosMissing || []).map(photoLabel).join(", "),
        fmtDateTime(t.createdAt),
        fmtDateTime(t.completedAt),
      ]);
    }
  }
  return out;
}

function exportDrivers(date, drivers, filename) {
  downloadExcel(filename, [
    { name: "Summary", headers: summaryHeaders(), rows: drivers.map((r) => summaryRow(date, r)) },
    { name: "Trips", headers: tripHeaders(), rows: tripRows(date, drivers) },
  ]);
}

export default function DailySheet() {
  const [date, setDate] = useState(todayKey);
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState({});

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await ambulanceAdminApi.dailySheet({ date });
      setRows(res.rows || []);
      setTotals(res.totals || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [date]);

  return (
    <div>
      <Topbar
        title="Daily sheet"
        subtitle="Duty hours, cancelled / unassigned, shift vs trip vs GPS km"
      />
      <div className="p-4 md:p-8 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-slate-500">
            Date
            <input
              type="date"
              className="input ml-2 inline-block w-auto"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <button
            className="btn-primary"
            disabled={!rows.length}
            onClick={() => exportDrivers(date, rows, `ambulance-daily-${date}-all.xls`)}
          >
            Download all (Excel)
          </button>
        </div>
        {totals ? (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
              {totals.drivers} drivers · {totals.trips} trips
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
              {totals.completed || 0} completed
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
              {totals.cancelled || 0} cancelled
            </span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">
              {totals.unassigned || 0} unassigned
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
              Shift odo {totals.shiftOdoKm || 0} · Trip odo {totals.tripOdoKm || 0} · GPS {totals.gpsKm} km
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
              Photos missing {totals.photosMissing} · KM mismatch {totals.kmMismatch}
              {totals.openCheckIns ? ` · ${totals.openCheckIns} open check-in` : ""}
            </span>
          </div>
        ) : null}
        {error ? <p className="text-rose-600 text-sm">{error}</p> : null}
        {loading ? (
          <p className="text-slate-400 text-sm">Loading…</p>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium">Driver</th>
                    <th className="px-4 py-2 font-medium">Check-in / out</th>
                    <th className="px-4 py-2 font-medium">Duty hrs</th>
                    <th className="px-4 py-2 font-medium">Trips</th>
                    <th className="px-4 py-2 font-medium">Cancelled</th>
                    <th className="px-4 py-2 font-medium">Unassigned</th>
                    <th className="px-4 py-2 font-medium">Shift odo</th>
                    <th className="px-4 py-2 font-medium">Trip odo</th>
                    <th className="px-4 py-2 font-medium">GPS km</th>
                    <th className="px-4 py-2 font-medium">Flags</th>
                    <th className="px-4 py-2 font-medium text-right">Excel</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const key = String(r.driverId || r.driverName);
                    const expanded = !!open[key];
                    const tripOdo = r.tripOdoKm ?? r.odoKm;
                    return (
                      <Fragment key={key}>
                        <tr className="border-t border-slate-100 hover:bg-slate-50">
                          <td
                            className="px-4 py-3 cursor-pointer"
                            onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))}
                          >
                            <div className="font-semibold">{r.driverName}</div>
                            <div className="text-[11px] text-slate-400">
                              {(r.vehicles || []).join(", ") || "—"}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div>{fmtTime(r.checkInAt)} → {fmtTime(r.checkOutAt)}</div>
                            {r.openCheckIn ? (
                              <div className="text-[11px] font-medium text-amber-700">Open</div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            {r.dutyHours != null ? r.dutyHours : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {r.tripCount}
                            <span className="text-slate-400"> · {r.completedCount} done</span>
                          </td>
                          <td className="px-4 py-3">{r.cancelledCount || 0}</td>
                          <td className="px-4 py-3">{r.unassignedCount || 0}</td>
                          <td className="px-4 py-3">
                            {r.shiftOdoKm != null ? r.shiftOdoKm : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {tripOdo != null ? Number(tripOdo).toFixed(1) : "—"}
                          </td>
                          <td className="px-4 py-3">{Number(r.gpsKm || 0).toFixed(1)}</td>
                          <td className="px-4 py-3 text-xs">
                            {r.kmMismatchCount ? (
                              <div className="text-amber-700 font-medium">KM {r.kmMismatchCount}</div>
                            ) : null}
                            {r.photosMissingCount ? (
                              <div className="text-rose-600 font-medium">Photos {r.photosMissingCount}</div>
                            ) : null}
                            {!r.kmMismatchCount && !r.photosMissingCount ? (
                              <span className="text-slate-300">—</span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              className="text-xs font-medium text-brand-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                exportDrivers(
                                  date,
                                  [r],
                                  `ambulance-daily-${date}-${fileSlug(r.driverName)}.xls`
                                );
                              }}
                            >
                              Download
                            </button>
                          </td>
                        </tr>
                        {expanded
                          ? (r.trips || []).map((t) => (
                              <tr key={t.id} className="bg-slate-50/80 border-t border-slate-100">
                                <td className="px-4 py-2 pl-8 text-xs" colSpan={3}>
                                  <span className="font-medium text-brand-600">{t.tripId}</span>{" "}
                                  {t.patientName} · {t.tripStatus}
                                </td>
                                <td className="px-4 py-2 text-xs" colSpan={3}>
                                  {t.pickupAddress || "—"}
                                </td>
                                <td className="px-4 py-2 text-xs">—</td>
                                <td className="px-4 py-2 text-xs">
                                  {t.odoKm != null ? t.odoKm : "—"}
                                </td>
                                <td className="px-4 py-2 text-xs">{Number(t.gpsKm || 0).toFixed(1)}</td>
                                <td className="px-4 py-2 text-xs" colSpan={2}>
                                  {t.kmMismatch ? (
                                    <span className="text-amber-700">KM {t.kmMismatchPct}%</span>
                                  ) : null}
                                  {(t.photosMissing || []).length ? (
                                    <span className="text-rose-600">
                                      {t.kmMismatch ? " · " : ""}
                                      {(t.photosMissing || []).map(photoLabel).join(", ")}
                                    </span>
                                  ) : !t.kmMismatch ? (
                                    "—"
                                  ) : null}
                                </td>
                              </tr>
                            ))
                          : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rows.length === 0 ? (
              <p className="px-4 py-8 text-sm text-slate-400 text-center">Is date pe koi trip / check-in nahi</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
