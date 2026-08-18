const STYLES = {
  Unassigned: "bg-slate-100 text-slate-600",
  Assigned: "bg-amber-50 text-amber-700",
  Accepted: "bg-blue-50 text-blue-700",
  Rejected: "bg-rose-50 text-rose-700",
  EnRoutePickup: "bg-indigo-50 text-indigo-700",
  ArrivedPickup: "bg-violet-50 text-violet-700",
  Onboard: "bg-cyan-50 text-cyan-700",
  EnRouteDrop: "bg-indigo-50 text-indigo-700",
  ArrivedDrop: "bg-violet-50 text-violet-700",
  Completed: "bg-emerald-50 text-emerald-700",
  Cancelled: "bg-rose-100 text-rose-800",
  available: "bg-emerald-50 text-emerald-700",
  on_trip: "bg-indigo-50 text-indigo-700",
  maintenance: "bg-amber-50 text-amber-700",
  on_duty: "bg-emerald-50 text-emerald-700",
  off_duty: "bg-slate-100 text-slate-600",
  active: "bg-emerald-50 text-emerald-700",
  inactive: "bg-slate-100 text-slate-600",
  suspended: "bg-rose-50 text-rose-700",
};

export default function Badge({ children }) {
  const cls = STYLES[children] || "bg-slate-100 text-slate-600";
  const label = typeof children === "string" ? children.replace(/_/g, " ") : children;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
