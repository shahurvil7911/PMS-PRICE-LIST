import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Login from "@/pages/Login";
import Search from "@/pages/Search";
import Admin from "@/pages/Admin";
import Layout from "@/components/Layout";
import { Toaster } from "@/components/ui/sonner";

const RequireAuth = ({ role }) => {
  const { user } = useAuth();
  if (user === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="pms-label text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (user === false) return <Navigate to="/login" replace />;
  if (role === "admin" && user.role !== "admin") return <Navigate to="/" replace />;
  return <Outlet />;
};

function AppShell() {
  return (
    <div className="App">
      <div className="pms-noise" aria-hidden="true" />
      <div className="pms-watermark" aria-hidden="true">PANKAJ MILL STORES</div>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Search />} />
            <Route element={<RequireAuth role="admin" />}>
              <Route path="/admin/*" element={<Admin />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="bottom-right" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  );
}
