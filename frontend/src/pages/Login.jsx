import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ArrowRight } from "lucide-react";

export default function Login() {
  const { login, user, error } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  if (user && user !== false && user !== null) {
    // already logged in
    setTimeout(() => nav("/"), 0);
  }

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const ok = await login(username, password);
    setBusy(false);
    if (ok) nav("/");
  };

  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      <div className="max-w-7xl w-full mx-auto px-5 md:px-10 pt-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary bg-primary/10 flex items-center justify-center">
            <span className="font-heading font-black text-primary text-sm">P</span>
          </div>
          <div className="pms-label text-muted-foreground">Internal</div>
        </div>
      </div>

      <div className="flex-1 flex items-center px-5 md:px-10">
        <div className="w-full max-w-2xl">
          <h1 className="font-heading font-black text-4xl sm:text-5xl lg:text-6xl leading-[0.9] tracking-tight">
            PANKAJ<br/>MILL<br/><span className="text-primary">STORES.</span>
          </h1>
          <p className="pms-label text-muted-foreground mt-6">Sign in to look up prices.</p>

          <form onSubmit={submit} className="mt-10 space-y-8 max-w-md" data-testid="login-form">
            <div>
              <label className="pms-label text-muted-foreground block mb-2">Username</label>
              <input
                data-testid="login-username"
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-transparent border-b-2 border-border focus:border-primary focus:outline-none py-3 text-2xl font-heading font-black tracking-tight transition-colors duration-150"
                placeholder="admin"
                required
              />
            </div>
            <div>
              <label className="pms-label text-muted-foreground block mb-2">Password</label>
              <input
                data-testid="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border-b-2 border-border focus:border-primary focus:outline-none py-3 text-2xl font-heading font-black tracking-tight transition-colors duration-150"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div data-testid="login-error" className="pms-label text-destructive border border-destructive/40 bg-destructive/5 px-3 py-2">
                {error}
              </div>
            )}

            <button
              data-testid="login-submit"
              type="submit"
              disabled={busy}
              className="pms-sharp inline-flex items-center gap-3 bg-foreground text-background hover:bg-primary hover:text-primary-foreground disabled:opacity-60 px-8 py-4 pms-label transition-colors duration-150"
            >
              {busy ? "Signing in…" : "Sign in"} <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-14 pms-label text-muted-foreground">
            Ask the shop admin for your account.
          </div>
        </div>
      </div>
    </div>
  );
}
