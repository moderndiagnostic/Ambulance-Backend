import { useEffect, useState } from "react";
import Topbar from "../components/Topbar.jsx";
import Badge from "../components/Badge.jsx";
import Modal from "../components/Modal.jsx";
import { ambulanceAdminApi } from "../api.js";

const empty = { name: "", phone: "", employeeId: "", password: "", zone: "" };

export default function Drivers() {
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
      const res = await ambulanceAdminApi.drivers();
      setRows(res.drivers || []);
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
      await ambulanceAdminApi.createDriver(form);
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
    setAddError("");
    try {
      const payload = { ...editForm };
      if (!payload.password) delete payload.password;
      await ambulanceAdminApi.updateDriver(editing._id || editing.id, payload);
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
      <Topbar title="Drivers" subtitle="Add phone — driver logs in the field app with OTP" />
      <div className="p-4 md:p-8">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-slate-500">{rows.length} drivers</p>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>
            Add driver
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
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Employee ID</th>
                  <th className="px-4 py-2 font-medium">Phone</th>
                  <th className="px-4 py-2 font-medium">Duty</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d._id || d.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold">{d.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{d.employeeId}</td>
                    <td className="px-4 py-3">{d.phone}</td>
                    <td className="px-4 py-3">
                      <Badge>{d.dutyStatus}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge>{d.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="text-brand-600 text-xs font-medium"
                        onClick={() => {
                          setEditing(d);
                          setEditForm({
                            name: d.name,
                            phone: d.phone,
                            employeeId: d.employeeId,
                            zone: d.zone || "",
                            status: d.status,
                            password: "",
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

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add driver">
        <form onSubmit={submitAdd} className="space-y-3">
          {addError ? <p className="text-rose-600 text-sm">{addError}</p> : null}
          <div>
            <label className="label">Name</label>
            <input
              required
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Phone</label>
            <input
              required
              className="input"
              maxLength={10}
              value={form.phone}
              onChange={(e) =>
                setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })
              }
            />
          </div>
          <div>
            <label className="label">Employee ID (optional)</label>
            <input
              className="input"
              placeholder="auto if blank"
              value={form.employeeId}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
            />
            <p className="text-[11px] text-slate-400 mt-1">App login is this phone + OTP</p>
          </div>
          <div>
            <label className="label">Zone</label>
            <input
              className="input"
              value={form.zone}
              onChange={(e) => setForm({ ...form, zone: e.target.value })}
            />
          </div>
          <button className="btn-primary w-full" disabled={saving}>
            {saving ? "Saving…" : "Create"}
          </button>
        </form>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit driver">
        {editForm ? (
          <form onSubmit={saveEdit} className="space-y-3">
            {addError ? <p className="text-rose-600 text-sm">{addError}</p> : null}
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Employee ID</label>
              <input
                className="input"
                value={editForm.employeeId}
                onChange={(e) => setEditForm({ ...editForm, employeeId: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="suspended">suspended</option>
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
