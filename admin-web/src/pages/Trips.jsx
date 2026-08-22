import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import Badge from "../components/Badge.jsx";
import Modal from "../components/Modal.jsx";
import TripReplayMap from "../components/TripReplayMap.jsx";
import DateRangeBar from "../components/DateRangeBar.jsx";
import { useDateRange } from "../hooks/useDateRange.js";
import { ambulanceAdminApi, mediaUrl } from "../api.js";
import { SHOW_PATIENT } from "../showPatient.js";

const empty = {
  patientName: "",
  mobileNumber: "",
  pickupAddress: "",
  dropAddress: "",
  LabName: "",
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
      <Topbar title="Trips" subtitle="View driver trips — create and assign only from the driver app" />
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
                  {SHOW_PATIENT ? (
                    <th className="text-left px-4 py-3 font-medium">Patient</th>
                  ) : null}
                  <th className="text-left px-4 py-3 font-medium">Assigned driver</th>
                  <th className="text-left px-4 py-3 font-medium">Vehicle</th>
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
                    <td colSpan={SHOW_PATIENT ? 9 : 8} className="px-4 py-8 text-center text-slate-400">
                      Loading trips…
                    </td>
                  </tr>
                ) : trips.length === 0 ? (
                  <tr>
                    <td colSpan={SHOW_PATIENT ? 9 : 8} className="px-4 py-8 text-center text-slate-400">
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
                      {SHOW_PATIENT ? (
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{t.patientName || "—"}</div>
                          <div className="text-[11px] text-slate-400">{t.mobileNumber || ""}</div>
                        </td>
                      ) : null}
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{t.assignedDriverName || "Unassigned"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-800">{t.vehicleNumber || "—"}</div>
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
                              notes: t.notes || "",
                            });
                            setFormError("");
                          }}
                        >
                          Edit
                        </button>
                        {!["Completed", "Cancelled"].includes(t.tripStatus) ? (
                            <button
                              className="text-xs font-medium text-rose-600"
                              onClick={() => cancelTrip(t)}
                            >
                              Cancel
                            </button>
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

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit ${editing?.tripId || "trip"}`} width="max-w-lg">
        <form onSubmit={submitEdit} className="space-y-3">
          {formError ? <p className="text-rose-600 text-sm">{formError}</p> : null}
          {SHOW_PATIENT ? (
            <>
              <div>
                <label className="label">Patient name</label>
                <input
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
            </>
          ) : null}
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

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.tripId || "Trip"} width="max-w-4xl">
        {viewing ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              <Badge>{viewing.tripStatus}</Badge>
            </div>

            <TripReplayMap trip={viewing} />

            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase mb-1">Details</div>
              {SHOW_PATIENT ? (
                <>
                  <Row k="Name" v={viewing.patientName} />
                  <Row k="Mobile" v={viewing.mobileNumber} />
                </>
              ) : null}
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
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
