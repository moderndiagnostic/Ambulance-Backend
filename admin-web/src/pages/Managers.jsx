import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import Badge from "../components/Badge.jsx";
import Modal from "../components/Modal.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { ambulanceAdminApi } from "../api.js";

const empty = { name: "", email: "", password: "" };

export default function Managers() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [resetFor, setResetFor] = useState(null);
  const [newPassword, setNewPassword] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await ambulanceAdminApi.managers();
      setRows(res.managers || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.role === "admin") load();
  }, [user?.role]);

  if (user?.role !== "admin") return <Navigate to="/" replace />;

  async function submitAdd(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await ambulanceAdminApi.createManager(form);
      setShowAdd(false);
      setForm(empty);
      await load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(m) {
    try {
      await ambulanceAdminApi.setManagerStatus(m._id, !m.isActive);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function submitReset(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await ambulanceAdminApi.resetManagerPassword(resetFor._id, newPassword);
      setResetFor(null);
      setNewPassword("");
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Topbar
        title="Ambulance managers"
        subtitle="City team like a logistics manager — same city as you, login at this admin"
      />
      <div className="p-4 md:p-8">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-slate-500">{rows.length} managers</p>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>
            Add manager
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
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">City</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m._id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold">{m.name}</td>
                    <td className="px-4 py-3">{m.email}</td>
                    <td className="px-4 py-3">{m.city || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge>{m.isActive === false ? "inactive" : "active"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right space-x-3">
                      <button
                        className="text-brand-600 text-xs font-medium"
                        onClick={() => {
                          setResetFor(m);
                          setNewPassword("");
                          setFormError("");
                        }}
                      >
                        Reset password
                      </button>
                      <button
                        className="text-slate-500 text-xs font-medium"
                        onClick={() => toggleStatus(m)}
                      >
                        {m.isActive === false ? "Enable" : "Disable"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add manager">
        <form onSubmit={submitAdd} className="space-y-3">
          {formError ? <p className="text-rose-600 text-sm">{formError}</p> : null}
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              required
              minLength={6}
              className="input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <p className="text-[11px] text-slate-400">They log in here with this email. City is locked to yours.</p>
          <button className="btn-primary w-full" disabled={saving}>
            {saving ? "Saving…" : "Create"}
          </button>
        </form>
      </Modal>

      <Modal open={!!resetFor} onClose={() => setResetFor(null)} title="Reset password">
        <form onSubmit={submitReset} className="space-y-3">
          {formError ? <p className="text-rose-600 text-sm">{formError}</p> : null}
          <p className="text-sm text-slate-500">{resetFor?.email}</p>
          <div>
            <label className="label">New password</label>
            <input
              type="password"
              required
              minLength={6}
              className="input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <button className="btn-primary w-full" disabled={saving}>
            {saving ? "Saving…" : "Update password"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
