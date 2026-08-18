import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import { SidebarProvider } from "./context/SidebarContext.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Trips from "./pages/Trips.jsx";
import Fleet from "./pages/Fleet.jsx";
import Drivers from "./pages/Drivers.jsx";
import Managers from "./pages/Managers.jsx";
import Shifts from "./pages/Shifts.jsx";
import Kms from "./pages/Kms.jsx";
import DailySheet from "./pages/DailySheet.jsx";
import LiveMap from "./pages/LiveMap.jsx";

function ProtectedLayout({ children }) {
  const { isAuthed, user } = useAuth();
  if (!isAuthed) return <Navigate to="/login" replace />;
  if (!["admin", "ops", "manager"].includes(user?.role)) {
    return <Navigate to="/login" replace />;
  }
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedLayout>
            <Dashboard />
          </ProtectedLayout>
        }
      />
      <Route
        path="/trips"
        element={
          <ProtectedLayout>
            <Trips />
          </ProtectedLayout>
        }
      />
      <Route
        path="/fleet"
        element={
          <ProtectedLayout>
            <Fleet />
          </ProtectedLayout>
        }
      />
      <Route
        path="/drivers"
        element={
          <ProtectedLayout>
            <Drivers />
          </ProtectedLayout>
        }
      />
      <Route
        path="/team"
        element={
          <ProtectedLayout>
            <Managers />
          </ProtectedLayout>
        }
      />
      <Route
        path="/check-ins"
        element={
          <ProtectedLayout>
            <Shifts />
          </ProtectedLayout>
        }
      />
      <Route
        path="/kms"
        element={
          <ProtectedLayout>
            <Kms />
          </ProtectedLayout>
        }
      />
      <Route
        path="/daily-sheet"
        element={
          <ProtectedLayout>
            <DailySheet />
          </ProtectedLayout>
        }
      />
      <Route
        path="/live-map"
        element={
          <ProtectedLayout>
            <LiveMap />
          </ProtectedLayout>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
