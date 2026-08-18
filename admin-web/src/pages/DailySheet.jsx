import { Fragment, useEffect, useState } from "react";
import Topbar from "../components/Topbar.jsx";
import { ambulanceAdminApi } from "../api.js";

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
        subtitle="Driver-wise trips, GPS/odo km, missing photos"
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
          {totals ? (
            <span className="text-sm text-slate-500 ml-auto">
              {totals.drivers} drivers · {totals.trips} trips · GPS {totals.gpsKm} km · photos
              missing {totals.photosMissing} · KM mismatch {totals.kmMismatch}
            </span>
          ) : null}
        </div>
        {error ? <p className="text-rose-600 text-sm">{error}</p> : null}
        {loading ? (
          <p className="text-slate-400 text-sm">Loading…</p>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Driver</th>
                  <th className="px-4 py-2 font-medium">Trips</th>
                  <th className="px-4 py-2 font-medium">GPS km</th>
                  <th className="px-4 py-2 font-medium">Odo km</th>
                  <th className="px-4 py-2 font-medium">KM mismatch</th>
                  <th className="px-4 py-2 font-medium">Photos missing</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const key = String(r.driverId || r.driverName);
                  const expanded = !!open[key];
                  return (
                    <Fragment key={key}>
                      <tr
                        className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                        onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold">{r.driverName}</div>
                          <div className="text-[11px] text-slate-400">
                            {(r.vehicles || []).join(", ") || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {r.tripCount}
                          <span className="text-slate-400"> · {r.completedCount} done</span>
                        </td>
                        <td className="px-4 py-3">{Number(r.gpsKm || 0).toFixed(1)}</td>
                        <td className="px-4 py-3">{Number(r.odoKm || 0).toFixed(1)}</td>
                        <td className="px-4 py-3">
                          {r.kmMismatchCount ? (
                            <span className="text-amber-700 font-medium">{r.kmMismatchCount}</span>
                          ) : (
                            "0"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {r.photosMissingCount ? (
                            <span className="text-rose-600 font-medium">{r.photosMissingCount}</span>
                          ) : (
                            "0"
                          )}
                        </td>
                      </tr>
                      {expanded
                        ? (r.trips || []).map((t) => (
                            <tr key={t.id} className="bg-slate-50/80 border-t border-slate-100">
                              <td className="px-4 py-2 pl-8 text-xs" colSpan={2}>
                                <span className="font-medium text-brand-600">{t.tripId}</span>{" "}
                                {t.patientName} · {t.tripStatus}
                              </td>
                              <td className="px-4 py-2 text-xs">{Number(t.gpsKm || 0).toFixed(1)}</td>
                              <td className="px-4 py-2 text-xs">
                                {t.odoKm != null ? t.odoKm : "—"}
                              </td>
                              <td className="px-4 py-2 text-xs">
                                {t.kmMismatch ? `${t.kmMismatchPct}%` : "—"}
                              </td>
                              <td className="px-4 py-2 text-xs text-rose-600">
                                {(t.photosMissing || []).map(photoLabel).join(", ") || "—"}
                              </td>
                            </tr>
                          ))
                        : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 ? (
              <p className="px-4 py-8 text-sm text-slate-400 text-center">Is date pe koi trip nahi</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
