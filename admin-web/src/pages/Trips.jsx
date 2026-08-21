import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import Badge from "../components/Badge.jsx";
import Modal from "../components/Modal.jsx";
import TripReplayMap from "../components/TripReplayMap.jsx";
import DateRangeBar from "../components/DateRangeBar.jsx";
import { useDateRange } from "../hooks/useDateRange.js";
import { ambulanceAdminApi, mediaUrl } from "../api.js";

const empty = {
  patientName: "",
  mobileNumber: "",
  pickupAddress: "",
  dropAddress: "",
  LabName: "",
  requestedType: "BLS",
  notes: "",
  driverId: "",
  ambulanceId: "",
};

function fmt(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
}

function ProofFlag({ ok, label }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
        ok ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
      }`}
    >
      {label}: {ok ? "uploaded" : "not uploaded"}
    </span>
  );
}

function PhotoCell({ url, caption }) {
  const href = mediaUrl(url);
  if (!href) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
        {caption}
        <div className="mt-1 font-medium text-slate-500">Not uploaded</div>
      </div>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className="block">
      <img src={href} alt={caption} className="h-36 w-full object-cover rounded-lg border border-slate-100" />
      <div className="text-[11px] text-slate-500 mt-1">{caption} · click to open</div>
    </a>
  );
}

function Row({ k, v }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-sm py-1.5 border-b border-slate-50">
      <div className="text-slate-400">{k}</div>
      <div className="col-span-2 text-slate-800 whitespace-pre-wrap">{v || "—"}</div>
    </div>
  );
}

export default function Trips() {
  const [searchParams] = useSearchParams();
  const [trips, setTrips] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [ambulances, setAmbulances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [viewing, setViewing] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(empty);
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [assignForm, setAssignForm] = useState({ driverId: "", ambulanceId: "" });
  const { preset, range, applyPreset, setCustom } = useDateRange("30d");

  async function loadLookups() {
    try {
      const [d, a] = await Promise.all([ambulanceAdminApi.drivers(), ambulanceAdminApi.ambulances()]);
      setDrivers(d.drivers || []);
      setAmbulances(a.ambulances || []);
    } catch (e) {
      setError(e.message);
    }
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (range.from) params.from = range.from;
      if (range.to) params.to = range.to;
      const t = await ambulanceAdminApi.trips(params);
      setTrips(t.trips || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setStatusFilter(searchParams.get("status") || "");
  }, [searchParams]);

  useEffect(() => {
    loadLookups();
  }, []);

  useEffect(() => {
    load();
  }, [statusFilter, range]);

  async function submitAdd(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      if ((form.driverId && !form.ambulanceId) || (!form.driverId && form.ambulanceId)) {
        setFormError("Assign both driver and vehicle, or leave both empty");
        setSaving(false);
        return;
      }
      await ambulanceAdminApi.createTrip({
        ...form,
        driverId: form.driverId || undefined,
        ambulanceId: form.ambulanceId || undefined,
      });
      setShowAdd(false);
      setForm(empty);
      await load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitAssign(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await ambulanceAdminApi.assignTrip(assigning.id, assignForm);
      setAssigning(null);
      await load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitEdit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await ambulanceAdminApi.updateTrip(editing.id, editForm);
      setEditing(null);
      await load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function openView(t) {
    setViewing(t);
    try {
      const res = await ambulanceAdminApi.trip(t.id);
      if (res.trip) setViewing(res.trip);
    } catch (e) {
      setError(e.message);
    }
  }

  async function cancelTrip(trip) {
    const reason = window.prompt("Cancel reason?", "Cancelled by ops");
    if (reason == null) return;
    try {
      await ambulanceAdminApi.cancelTrip(trip.id, reason);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  const freeAmbulances = ambulances.filter(
    (a) => a.isActive !== false && (a.status === "available" || a.id === assigning?.assignedAmbulance)
  );
  const newTripVehicles = ambulances.filter((a) => a.isActive !== false && a.status === "available");

  return (
    <div>
      <Topbar title="Trips" subtitle="Create request → assign driver + vehicle" />
      <div className="p-4 md:p-8 space-y-4">
        <DateRangeBar
          preset={preset}
          range={range}
          onPreset={applyPreset}
          onCustom={setCustom}
          trailing={
            <>
              <select
                className="input w-44"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                <option>Unassigned</option>
                <option>Assigned</option>
                <option>Accepted</option>
                <option>EnRoutePickup</option>
                <option>ArrivedPickup</option>
                <option>Onboard</option>
                <option>EnRouteDrop</option>
                <option>ArrivedDrop</option>
                <option>Completed</option>
                <option>Cancelled</option>
              </select>
              <button className="btn-primary" onClick={() => { setForm(empty); setFormError(""); setShowAdd(true); }}>
                New trip
              </button>
            </>
          }
        />
        <p className="text-sm text-slate-500">{trips.length} trips in this range</p>
        {error ? <p className="text-rose-600 text-sm mb-3">{error}</p> : null}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Trip</th>
                  <th className="text-left px-4 py-3 font-medium">Assigned driver</th>
                  <th className="text-left px-4 py-3 font-medium">Vehicle</th>
                  <th className="text-left px-4 py-3 font-medium">Patient</th>
                  <th className="text-left px-4 py-3 font-medium">Pickup</th>
                  <th className="text-left px-4 py-3 font-medium">Drop</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Flags</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                      Loading trips…
                    </td>
                  </tr>
                ) : trips.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                      No ambulance trips yet.
                    </td>
                  </tr>
                ) : (
                  trips.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-brand-600">{t.tripId || "—"}</div>
                        <div className="text-[11px] text-slate-400">{fmt(t.createdAt)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{t.assignedDriverName || "Unassigned"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-800">{t.vehicleNumber || "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{t.patientName}</div>
                        <div className="text-xs text-slate-400">{t.mobileNumber || "—"}</div>
                      </td>
                      <td className="px-4 py-3 max-w-[180px]">
                        <div className="text-slate-700 truncate" title={t.pickupAddress}>
                          {t.pickupAddress}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[180px]">
                        <div className="text-slate-700 truncate" title={t.dropAddress}>
                          {t.hospitalName ? `${t.hospitalName} · ` : ""}
                          {t.dropAddress}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge>{t.tripStatus}</Badge>
                        <div className="text-[11px] text-slate-400 mt-1">{t.requestedType}</div>
                      </td>
                      <td className="px-4 py-3">
                        {t.kmMismatch ? (
                          <div className="text-[11px] font-medium text-amber-700">KM {t.kmMismatchPct}%</div>
                        ) : null}
                        {(t.photosMissing || []).length ? (
                          <div className="text-[11px] font-medium text-rose-600">
                            Photos {(t.photosMissing || []).length}
                          </div>
                        ) : null}
                        {!t.kmMismatch && !(t.photosMissing || []).length ? (
                          <span className="text-[11px] text-slate-300">—</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          className="text-xs font-medium text-slate-700 mr-3"
                          onClick={() => openView(t)}
                        >
                          View
                        </button>
                        <button
                          className="text-xs font-medium text-brand-600 mr-3"
                          onClick={() => {
                            setEditing(t);
                            setEditForm({
                              patientName: t.patientName || "",
                              mobileNumber: t.mobileNumber || "",
                              pickupAddress: t.pickupAddress || "",
                              dropAddress: t.dropAddress || "",
                              hospitalName: t.hospitalName || "",
                              requestedType: t.requestedType || "BLS",
                              notes: t.notes || "",
                            });
                            setFormError("");
                          }}
                        >
                          Edit
                        </button>
                        {!["Completed", "Cancelled"].includes(t.tripStatus) ? (
                          <>
                            <button
                              className="text-xs font-medium text-brand-600 mr-3"
                              onClick={() => {
                                setAssigning(t);
                                setAssignForm({
                                  driverId: t.assignedDriver || "",
                                  ambulanceId: t.assignedAmbulance || "",
                                });
                                setFormError("");
                              }}
                            >
                              Assign
                            </button>
                            <button
                              className="text-xs font-medium text-rose-600"
                              onClick={() => cancelTrip(t)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New trip" width="max-w-lg">
        <form onSubmit={submitAdd} className="space-y-3">
          {formError ? <p className="text-rose-600 text-sm">{formError}</p> : null}
          <div>
            <label className="label">Patient name</label>
            <input
              required
              className="input"
              value={form.patientName}
              onChange={(e) => setForm({ ...form, patientName: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Mobile</label>
            <input
              className="input"
              value={form.mobileNumber}
              onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Pickup address</label>
            <input
              required
              className="input"
              value={form.pickupAddress}
              onChange={(e) => setForm({ ...form, pickupAddress: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Lab/ drop</label>
            <input
              className="input"
              placeholder="Lab name"
              value={form.LabName}
              onChange={(e) => setForm({ ...form, LabName: e.target.value })}
            />
            <input
              required
              className="input mt-2"
              placeholder="Drop address"
              value={form.dropAddress}
              onChange={(e) => setForm({ ...form, dropAddress: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Type</label>
            <select
              className="input"
              value={form.requestedType}
              onChange={(e) => setForm({ ...form, requestedType: e.target.value })}
            >
              <option>BLS</option>
              <option>ALS</option>
              <option>ICU</option>
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <input
              className="input"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Assigned driver</label>
            <select
              className="input"
              value={form.driverId}
              onChange={(e) => setForm({ ...form, driverId: e.target.value })}
            >
              <option value="">Assign later</option>
              {drivers
                .filter((d) => d.status === "active")
                .map((d) => (
                  <option key={d._id || d.id} value={d._id || d.id}>
                    {d.name} · {d.employeeId} · {d.dutyStatus}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="label">Vehicle</label>
            <select
              className="input"
              value={form.ambulanceId}
              onChange={(e) => setForm({ ...form, ambulanceId: e.target.value })}
            >
              <option value="">Assign later</option>
              {newTripVehicles.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.vehicleNumber} · {a.type} · {a.status}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-primary w-full" disabled={saving}>
            {saving ? "Saving…" : form.driverId && form.ambulanceId ? "Create & assign" : "Create trip"}
          </button>
        </form>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit ${editing?.tripId || "trip"}`} width="max-w-lg">
        <form onSubmit={submitEdit} className="space-y-3">
          {formError ? <p className="text-rose-600 text-sm">{formError}</p> : null}
          <div>
            <label className="label">Patient name</label>
            <input
              required
              className="input"
              value={editForm.patientName}
              onChange={(e) => setEditForm({ ...editForm, patientName: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Mobile</label>
            <input
              className="input"
              value={editForm.mobileNumber}
              onChange={(e) => setEditForm({ ...editForm, mobileNumber: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Pickup address</label>
            <input
              required
              className="input"
              value={editForm.pickupAddress}
              onChange={(e) => setEditForm({ ...editForm, pickupAddress: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Hospital name</label>
            <input
              className="input"
              value={editForm.hospitalName}
              onChange={(e) => setEditForm({ ...editForm, hospitalName: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Drop address</label>
            <input
              required
              className="input"
              value={editForm.dropAddress}
              onChange={(e) => setEditForm({ ...editForm, dropAddress: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Type</label>
            <select
              className="input"
              value={editForm.requestedType}
              onChange={(e) => setEditForm({ ...editForm, requestedType: e.target.value })}
            >
              <option>BLS</option>
              <option>ALS</option>
              <option>ICU</option>
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <input
              className="input"
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
            />
          </div>
          <button className="btn-primary w-full" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </Modal>

      <Modal open={!!assigning} onClose={() => setAssigning(null)} title="Assign driver & vehicle">
        <form onSubmit={submitAssign} className="space-y-3">
          {formError ? <p className="text-rose-600 text-sm">{formError}</p> : null}
          <div>
            <label className="label">Driver</label>
            <select
              required
              className="input"
              value={assignForm.driverId}
              onChange={(e) => setAssignForm({ ...assignForm, driverId: e.target.value })}
            >
              <option value="">Select driver</option>
              {drivers
                .filter((d) => d.status === "active")
                .map((d) => (
                  <option key={d._id || d.id} value={d._id || d.id}>
                    {d.name} · {d.employeeId} · {d.dutyStatus}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="label">Ambulance</label>
            <select
              required
              className="input"
              value={assignForm.ambulanceId}
              onChange={(e) => setAssignForm({ ...assignForm, ambulanceId: e.target.value })}
            >
              <option value="">Select vehicle</option>
              {freeAmbulances.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.vehicleNumber} · {a.type} · {a.status}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-primary w-full" disabled={saving}>
            {saving ? "Assigning…" : "Assign"}
          </button>
        </form>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.tripId || "Trip"} width="max-w-4xl">
        {viewing ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              <Badge>{viewing.tripStatus}</Badge>
              <ProofFlag ok={!!viewing.startOdometerPhotoUrl} label="Start odometer" />
              <ProofFlag ok={!!viewing.startVehiclePhotoUrl} label="Start vehicle" />
              <ProofFlag ok={!!viewing.endOdometerPhotoUrl} label="End odometer" />
            </div>

            {viewing.kmMismatch ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                KM mismatch: GPS {viewing.gpsKm} km vs odometer {viewing.odoKm} km (
                {viewing.kmMismatchPct}% farak, 20%+ alert)
              </div>
            ) : null}

            <TripReplayMap trip={viewing} />

            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Patient</div>
              <Row k="Name" v={viewing.patientName} />
              <Row k="Mobile" v={viewing.mobileNumber} />
              <Row k="Type" v={viewing.requestedType} />
              <Row k="City" v={viewing.city} />
              <Row k="Notes" v={viewing.notes} />
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Route</div>
              <Row k="Pickup" v={viewing.pickupAddress} />
              <Row
                k="Pickup GPS"
                v={
                  viewing.pickupLat != null
                    ? `${viewing.pickupLat}, ${viewing.pickupLng}`
                    : ""
                }
              />
              <Row k="Hospital" v={viewing.hospitalName} />
              <Row k="Drop" v={viewing.dropAddress} />
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Assignment</div>
              <Row k="Driver" v={viewing.assignedDriverName} />
              <Row k="Vehicle" v={viewing.vehicleNumber} />
              <Row k="Assigned by" v={viewing.assignedByName} />
              <Row k="Assigned at" v={fmt(viewing.assignedAt)} />
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Timeline</div>
              <Row k="Created" v={fmt(viewing.createdAt)} />
              <Row k="Accepted" v={fmt(viewing.acceptedAt)} />
              <Row k="En route pickup" v={fmt(viewing.enRoutePickupAt)} />
              <Row k="Arrived pickup" v={fmt(viewing.arrivedPickupAt)} />
              <Row k="Onboard" v={fmt(viewing.onboardAt)} />
              <Row k="En route hospital" v={fmt(viewing.enRouteDropAt)} />
              <Row k="Arrived hospital" v={fmt(viewing.arrivedDropAt)} />
              <Row k="Completed" v={fmt(viewing.completedAt)} />
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Start proof</div>
              <Row k="Start odometer km" v={viewing.startOdometerKm != null ? String(viewing.startOdometerKm) : ""} />
              <Row k="Start photos at" v={fmt(viewing.startProofAt)} />
              <div className="grid grid-cols-2 gap-3 mt-2">
                <PhotoCell url={viewing.startOdometerPhotoUrl} caption="Odometer (start)" />
                <PhotoCell url={viewing.startVehiclePhotoUrl} caption="Vehicle (start)" />
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase mb-2">End proof</div>
              <Row k="End odometer km" v={viewing.endOdometerKm != null ? String(viewing.endOdometerKm) : ""} />
              <Row k="GPS km" v={viewing.gpsKm != null ? String(viewing.gpsKm) : ""} />
              <Row
                k="Trip km (odo)"
                v={viewing.odoKm != null ? String(viewing.odoKm) : ""}
              />
              <div className="grid grid-cols-2 gap-3 mt-2">
                <PhotoCell url={viewing.endOdometerPhotoUrl} caption="Odometer (end)" />
                <PhotoCell url={viewing.endVehiclePhotoUrl} caption="Vehicle (end)" />
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
