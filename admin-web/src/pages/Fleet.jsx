import { useEffect, useState } from "react";
import Topbar from "../components/Topbar.jsx";
import Badge from "../components/Badge.jsx";
import Modal from "../components/Modal.jsx";
import { ambulanceAdminApi } from "../api.js";

const empty = { vehicleNumber: "", type: "BLS", notes: "" };

export default function Fleet() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState("");
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await ambulanceAdminApi.ambulances();
      setRows(res.ambulances || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submitAdd(e) {
    e.preventDefault();
    setSaving(true);
    setAddError("");
    try {
      await ambulanceAdminApi.createAmbulance(form);
      setShowAdd(false);
      setForm(empty);
      await load();
    } catch (e) {
      setAddError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await ambulanceAdminApi.updateAmbulance(editing.id || editing._id, editForm);
      setEditing(null);
      await load();
    } catch (e) {
      setAddError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Topbar title="Fleet" subtitle="Ambulance vehicles" />
      <div className="p-4 md:p-8">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-slate-500">{rows.length} vehicles</p>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>
            Add ambulance
          </button>
        </div>
        {error ? <p className="text-rose-600 text-sm mb-3">{error}</p> : null}
        {loading ? (
          <p className="text-slate-400 text-sm">Loading…</p>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Vehicle</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">City</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold">{a.vehicleNumber}</td>
                    <td className="px-4 py-3">{a.type}</td>
                    <td className="px-4 py-3">{a.city || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge>{a.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="text-brand-600 text-xs font-medium"
                        onClick={() => {
                          setEditing(a);
                          setEditForm({
                            vehicleNumber: a.vehicleNumber,
                            type: a.type,
                            status: a.status,
                            notes: a.notes || "",
                            isActive: a.isActive !== false,
                          });
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add ambulance">
        <form onSubmit={submitAdd} className="space-y-3">
          {addError ? <p className="text-rose-600 text-sm">{addError}</p> : null}
          <div>
            <label className="label">Vehicle number</label>
            <input
              required
              className="input"
              value={form.vehicleNumber}
              onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Type</label>
            <select
              className="input"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
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
          <button className="btn-primary w-full" disabled={saving}>
            {saving ? "Saving…" : "Create"}
          </button>
        </form>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit ambulance">
        {editForm ? (
          <form onSubmit={saveEdit} className="space-y-3">
            <div>
              <label className="label">Vehicle number</label>
              <input
                className="input"
                value={editForm.vehicleNumber}
                onChange={(e) => setEditForm({ ...editForm, vehicleNumber: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Type</label>
              <select
                className="input"
                value={editForm.type}
                onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
              >
                <option>BLS</option>
                <option>ALS</option>
                <option>ICU</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              >
                <option value="available">available</option>
                <option value="on_trip">on_trip</option>
                <option value="maintenance">maintenance</option>
              </select>
            </div>
            <button className="btn-primary w-full" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
