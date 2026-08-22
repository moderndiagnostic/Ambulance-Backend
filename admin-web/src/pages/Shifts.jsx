import { useEffect, useState } from "react";
import Topbar from "../components/Topbar.jsx";
import { ambulanceAdminApi, mediaUrl } from "../api.js";

function fmtTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

function condSummary(c = {}) {
  const bits = [];
  if (c.fuelLevel) bits.push(`fuel ${c.fuelLevel}`);
  const flags = [
    ["tires", c.tiresOk],
    ["lights", c.lightsOk],
    ["siren", c.sirenOk],
    ["AC", c.acOk],
    ["stretcher", c.stretcherOk],
    ["O2", c.oxygenOk],
  ];
  const bad = flags.filter(([, ok]) => ok === false).map(([n]) => n);
  if (bad.length) bits.push(`issue: ${bad.join(", ")}`);
  else bits.push("checklist ok");
  if (c.notes) bits.push(c.notes);
  return bits.join(" · ");
}

export default function Shifts() {
  const [date, setDate] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await ambulanceAdminApi.shifts(date ? { date } : {});
      setRows(res.shifts || []);
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
      <Topbar title="Check-ins" subtitle="Start-of-day vehicle check + point-to-point legs" />
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
        </div>
        {error ? <p className="text-rose-600 text-sm">{error}</p> : null}
        {loading ? (
          <p className="text-slate-400 text-sm">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-slate-400 text-sm">No check-ins yet</p>
        ) : (
          <div className="space-y-3">
            {rows.map((s) => {
              const open = openId === String(s.id);
              return (
                <div key={s.id} className="card p-4">
                  <div className="flex flex-wrap gap-2 items-start justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {s.driverName || "Driver"} · {s.vehicleNumber || "—"}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {s.dateKey} · in {fmtTime(s.checkInAt)} · out {fmtTime(s.checkOutAt)}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{condSummary(s.condition)}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        GPS {s.gpsKm || 0} km
                        {s.odometerStart != null ? ` · odo start ${s.odometerStart}` : ""}
                        {s.odometerEnd != null ? ` · end ${s.odometerEnd}` : ""}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <ShiftPhoto url={s.checkInOdometerPhotoUrl} label="Check-in odo" />
                        {(s.checkInVehiclePhotoUrls || [s.checkInVehiclePhotoUrl].filter(Boolean)).map((url, i) => (
                          <ShiftPhoto key={`in-v-${i}`} url={url} label={`Check-in vehicle ${i + 1}`} />
                        ))}
                        <ShiftPhoto url={s.checkOutOdometerPhotoUrl} label="Check-out odo" />
                        {(s.checkOutVehiclePhotoUrls || [s.checkOutVehiclePhotoUrl].filter(Boolean)).map((url, i) => (
                          <ShiftPhoto key={`out-v-${i}`} url={url} label={`Check-out vehicle ${i + 1}`} />
                        ))}
                      </div>
                    </div>
                    <button
                      className="text-xs font-medium text-brand-600"
                      onClick={() => setOpenId(open ? null : String(s.id))}
                    >
                      {open ? "Hide legs" : `Legs (${(s.legs || []).length})`}
                    </button>
                  </div>
                  {open ? (
                    <ol className="mt-3 border-t border-slate-100 pt-3 space-y-2 text-sm">
                      {(s.legs || []).map((leg, i) => (
                        <li key={i} className="flex gap-2 text-slate-600">
                          <span className="text-slate-400 w-5">{i + 1}.</span>
                          <div>
                            <div>{leg.label || leg.type}</div>
                            <div className="text-xs text-slate-400">
                              {fmtTime(leg.at)}
                              {leg.lat != null && leg.lng != null
                                ? ` · ${Number(leg.lat).toFixed(4)}, ${Number(leg.lng).toFixed(4)}`
                                : ""}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ShiftPhoto({ url, label }) {
  const href = mediaUrl(url);
  if (!href) {
    return (
      <span className="text-[11px] text-slate-400 border border-dashed border-slate-200 rounded px-2 py-1">
        {label}: —
      </span>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className="block">
      <img src={href} alt={label} className="h-20 w-28 object-cover rounded border border-slate-100" />
      <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
    </a>
  );
}
