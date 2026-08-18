import { useEffect, useState } from "react";
import Topbar from "../components/Topbar.jsx";
import { ambulanceAdminApi } from "../api.js";

export default function Kms() {
  const [date, setDate] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await ambulanceAdminApi.kms(date ? { date } : {});
      setRows(res.rows || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [date]);

  const gpsTotal = rows.reduce((sum, r) => sum + (Number(r.gpsKm) || 0), 0);

  return (
    <div>
      <Topbar title="KMs history" subtitle="GPS km from location pings, plus odometer when filled" />
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
          {date ? (
            <button className="text-sm text-brand-600" onClick={() => setDate("")}>
              All recent
            </button>
          ) : null}
          <span className="text-sm text-slate-500 ml-auto">GPS total {gpsTotal.toFixed(1)} km</span>
        </div>
        {error ? <p className="text-rose-600 text-sm">{error}</p> : null}
        {loading ? (
          <p className="text-slate-400 text-sm">Loading…</p>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Driver</th>
                  <th className="px-4 py-2 font-medium">Vehicle</th>
                  <th className="px-4 py-2 font-medium">GPS km</th>
                  <th className="px-4 py-2 font-medium">Odometer km</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">{r.dateKey}</td>
                    <td className="px-4 py-3 font-semibold">{r.driverName}</td>
                    <td className="px-4 py-3">{r.vehicleNumber || "—"}</td>
                    <td className="px-4 py-3">{Number(r.gpsKm || 0).toFixed(1)}</td>
                    <td className="px-4 py-3">{r.odometerKm != null ? r.odometerKm : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 ? (
              <p className="px-4 py-8 text-sm text-slate-400 text-center">No km rows yet</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
