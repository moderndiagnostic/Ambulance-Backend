import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useSidebar } from "../context/SidebarContext.jsx";

const allItems = [
  { to: "/", label: "Dashboard", icon: "▦", end: true },
  { to: "/trips", label: "Trips", icon: "🚑" },
  { to: "/fleet", label: "Fleet", icon: "🚐" },
  { to: "/drivers", label: "Drivers", icon: "🪪" },
  { to: "/team", label: "Managers", icon: "👥", adminOnly: true },
  { to: "/check-ins", label: "Check-ins", icon: "☑️" },
  { to: "/kms", label: "KMs", icon: "📏" },
  { to: "/daily-sheet", label: "Daily sheet", icon: "📋" },
  { to: "/live-map", label: "Live Map", icon: "📍" },
];

export default function Sidebar() {
  const { user } = useAuth();
  const { mobileOpen, setMobileOpen, collapsed, toggleCollapsed } = useSidebar();
  const items = allItems.filter((it) => !it.adminOnly || user?.role === "admin");
  const roleLabel =
    user?.role === "ops" ? "Ops" : user?.role === "manager" ? "Manager" : "City Admin";

  return (
    <>
      {mobileOpen ? (
        <div
          className="fixed inset-0 bg-slate-900/50 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <div
        className={`hidden md:block shrink-0 transition-all duration-200 ${collapsed ? "w-[76px]" : "w-60"}`}
        aria-hidden
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col h-dvh overflow-hidden bg-slate-900
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0
          ${collapsed ? "md:w-[76px]" : "md:w-60"} w-64`}
      >
        <div className={`px-4 py-4 flex items-center gap-2.5 ${collapsed ? "md:flex-col md:gap-2 md:px-2" : ""}`}>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden md:flex h-8 w-8 rounded-lg items-center justify-center text-white text-xs font-bold shrink-0 bg-brand-500 hover:bg-brand-600"
            aria-label={collapsed ? "Expand menu" : "Collapse menu"}
            title={collapsed ? "Open menu" : "Close menu"}
          >
            M
          </button>
          <div className="md:hidden h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 bg-brand-500">
            M
          </div>
          <div className={collapsed ? "md:hidden min-w-0 flex-1" : "min-w-0 flex-1"}>
            <div className="font-semibold leading-none truncate text-white">MDRC</div>
            <div className="text-[11px] mt-0.5 truncate text-slate-500">
              Ambulance · {roleLabel} · {user?.city || "—"}
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto md:hidden h-8 w-8 rounded-lg text-slate-400 hover:bg-white/5"
          >
            ✕
          </button>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-1.5 overflow-y-auto">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                  collapsed ? "md:justify-center md:px-0" : ""
                } ${
                  isActive
                    ? "bg-brand-500/10 text-white ring-1 ring-inset ring-brand-500/30"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <span className="text-base shrink-0">{it.icon}</span>
              <span className={collapsed ? "md:hidden" : ""}>{it.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className={`px-5 py-4 text-[11px] border-t border-white/5 text-slate-600 ${collapsed ? "md:hidden" : ""}`}>
          MDRC · Ambulance Ops
        </div>
      </aside>
    </>
  );
}
