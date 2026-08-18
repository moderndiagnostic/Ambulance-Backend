import { useAuth } from "../context/AuthContext.jsx";
import { useSidebar } from "../context/SidebarContext.jsx";
import { useNavigate } from "react-router-dom";

export default function Topbar({ title, subtitle }) {
  const { user, logout } = useAuth();
  const { mobileOpen, setMobileOpen } = useSidebar();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200 px-4 md:px-8 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden h-9 w-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 shrink-0"
        >
          {mobileOpen ? "✕" : "☰"}
        </button>
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          {subtitle ? <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p> : null}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <div className="text-sm font-medium text-slate-800">{user?.name || "Ops"}</div>
          <div className="text-xs text-slate-500">
            {user?.email}
            {user?.city ? ` · ${user.city}` : ""}
          </div>
        </div>
        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="btn-secondary"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
