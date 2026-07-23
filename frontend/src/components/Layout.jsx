import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LogOut, Search as SearchIcon, ShieldCheck } from "lucide-react";

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const isAdminSection = loc.pathname.startsWith("/admin");

  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      <header
        data-testid="app-header"
        className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md"
      >
        <div className="max-w-7xl mx-auto px-5 md:px-10 h-16 flex items-center justify-between gap-4">
          <Link
            to="/"
            data-testid="brand-link"
            className="flex items-center gap-3 group"
          >
            <div className="w-8 h-8 border-2 border-primary bg-primary/10 flex items-center justify-center">
              <span className="font-heading font-black text-primary text-sm">P</span>
            </div>
            <div className="leading-none">
              <div className="font-heading font-black text-base tracking-tight">PANKAJ MILL STORES</div>
            </div>
          </Link>

          <nav className="flex items-center gap-2">
            {user && user.role === "admin" && (
              <Link
                to={isAdminSection ? "/" : "/admin"}
                data-testid={isAdminSection ? "nav-search" : "nav-admin"}
                className="pms-label px-3 md:px-4 py-2 border border-border hover:border-primary hover:text-primary transition-colors duration-150 flex items-center gap-2"
              >
                {isAdminSection ? <><SearchIcon className="w-3.5 h-3.5" /> Search</> : <><ShieldCheck className="w-3.5 h-3.5" /> Admin</>}
              </Link>
            )}
            <div className="hidden md:flex items-center gap-2 pms-label text-muted-foreground pr-3 border-r border-border h-8">
              <span data-testid="user-username">{user?.username}</span>
              <span className="text-primary">·</span>
              <span data-testid="user-role">{user?.role}</span>
            </div>
            <button
              data-testid="logout-btn"
              onClick={() => { logout(); nav("/login"); }}
              className="pms-label px-3 md:px-4 py-2 border border-border hover:border-destructive hover:text-destructive transition-colors duration-150 flex items-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1 relative z-10">
        <Outlet />
      </main>
      <footer className="border-t border-border py-6 relative z-10">
        <div className="max-w-7xl mx-auto px-5 md:px-10 flex items-center justify-between pms-label text-muted-foreground">
          <span>Pankaj Mill Stores · Internal Use</span>
          <span>₹ INR</span>
        </div>
      </footer>
    </div>
  );
}
