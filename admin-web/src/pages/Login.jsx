import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { login, logout, isAuthed, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const allowed = user?.role === "admin" || user?.role === "ops" || user?.role === "manager";
  if (isAuthed && allowed) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(email, password, keepLoggedIn);
      const role = data.userdata?.role;
      if (role !== "admin" && role !== "ops" && role !== "manager") {
        logout();
        setError("Use a City Admin, Manager, or Ops account.");
        return;
      }
      navigate("/");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-brand-900 to-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="h-12 w-12 rounded-xl bg-brand-500 flex items-center justify-center text-white text-xl font-bold shadow-card">
            A
          </div>
          <h1 className="mt-3 text-white text-xl font-semibold">Ambulance Ops</h1>
          <p className="text-slate-400 text-sm">Dashboard, trips, fleet and live map</p>
        </div>

        <form onSubmit={onSubmit} className="card p-6 space-y-4">
          {error ? (
            <div className="rounded-lg bg-rose-50 text-rose-700 text-sm px-3 py-2">{error}</div>
          ) : null}
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
              className="input"
              placeholder="ops@phlebo.local"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              required
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={keepLoggedIn}
              onChange={(e) => setKeepLoggedIn(e.target.checked)}
              className="rounded border-slate-300 text-brand-500 focus:ring-brand-400"
            />
            Keep me logged in
          </label>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
