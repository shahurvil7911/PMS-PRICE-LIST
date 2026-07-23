import { useCallback, useEffect, useRef, useState } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import { api, formatApiError, formatINR, API } from "@/lib/api";
import InlinePrice from "@/components/InlinePrice";
import { toast } from "sonner";
import { Trash2, Upload, Download, UserPlus, FileSpreadsheet } from "lucide-react";

export default function Admin() {
  const linkCls = ({ isActive }) =>
    `pms-label px-4 py-2 border transition-colors duration-150 ${isActive ? "border-primary text-primary bg-primary/5" : "border-border hover:border-foreground"}`;

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-10 pt-10 pb-24">
      <div className="mb-8 flex items-baseline justify-between flex-wrap gap-4">
        <div>
          <div className="pms-label text-muted-foreground mb-2">Admin</div>
          <h1 className="font-heading font-black text-3xl md:text-4xl tracking-tight">Manage catalog & team.</h1>
        </div>
      </div>

      <div className="flex gap-2 mb-8 flex-wrap" data-testid="admin-tabs">
        <NavLink to="" end className={linkCls} data-testid="tab-products">Products</NavLink>
        <NavLink to="upload" className={linkCls} data-testid="tab-upload">CSV Upload / Export</NavLink>
        <NavLink to="team" className={linkCls} data-testid="tab-team">Team</NavLink>
      </div>

      <Routes>
        <Route index element={<ProductsAdmin />} />
        <Route path="upload" element={<UploadAdmin />} />
        <Route path="team" element={<TeamAdmin />} />
      </Routes>
    </div>
  );
}

function ProductsAdmin() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/products", { params: { q: q || undefined, limit: 100 } });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setLoading(false); }
  }, [q]);

  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  const save = async (id, field, val) => {
    try {
      const { data } = await api.patch(`/products/${id}`, { [field]: val });
      setItems((p) => p.map((x) => x.id === id ? data : x));
      toast.success("Saved");
    } catch (e) { toast.error(formatApiError(e)); throw e; }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this product?")) return;
    try {
      await api.delete(`/products/${id}`);
      setItems((p) => p.filter((x) => x.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      toast.success("Deleted");
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <input
          data-testid="admin-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search catalog…"
          className="flex-1 min-w-[16rem] bg-transparent border-b-2 border-border focus:border-primary focus:outline-none py-3 text-xl font-heading font-bold"
        />
        <span className="pms-label text-muted-foreground">{loading ? "Loading…" : `${total} total`}</span>
      </div>

      <div className="border border-border">
        <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 border-b border-border bg-muted/40">
          {["Name","Brand","Size","Category","Wholesale","Retail",""].map((h,i) => (
            <div key={i} className="pms-label text-muted-foreground">{h}</div>
          ))}
        </div>
        {items.length === 0 && !loading && (
          <div className="p-10 text-center pms-label text-muted-foreground">
            No products. Go to <span className="text-primary">CSV Upload</span> to import.
          </div>
        )}
        {items.map((p) => (
          <div key={p.id} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-4 border-b border-border last:border-0 items-center hover:bg-muted/30 transition-colors duration-150" data-testid={`admin-row-${p.id}`}>
            <EditableCell value={p.name} onSave={(v) => save(p.id, "name", v)} className="font-heading font-bold text-base" />
            <EditableCell value={p.brand} onSave={(v) => save(p.id, "brand", v)} />
            <EditableCell value={p.size} onSave={(v) => save(p.id, "size", v)} />
            <EditableCell value={p.category} onSave={(v) => save(p.id, "category", v)} />
            <div>
              <InlinePrice testId={`admin-wholesale-${p.id}`} label="" value={p.wholesale_price} admin onSave={(v) => save(p.id, "wholesale_price", v)} />
            </div>
            <div>
              <InlinePrice testId={`admin-retail-${p.id}`} label="" value={p.retail_price} admin onSave={(v) => save(p.id, "retail_price", v)} />
            </div>
            <button
              data-testid={`admin-delete-${p.id}`}
              onClick={() => del(p.id)}
              className="p-2 text-muted-foreground hover:text-destructive transition-colors duration-150 justify-self-start md:justify-self-end"
              aria-label="delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditableCell({ value, onSave, className = "" }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value || "");
  const ref = useRef(null);
  useEffect(() => { setV(value || ""); }, [value]);
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select(); } }, [editing]);
  const commit = async () => {
    if (v === (value || "")) { setEditing(false); return; }
    try { await onSave(v); } catch (_) { setV(value || ""); }
    setEditing(false);
  };
  if (editing) {
    return (
      <input
        ref={ref}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setV(value || ""); setEditing(false); } }}
        className="w-full bg-transparent border-b-2 border-primary focus:outline-none py-1 text-base font-body"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`text-left w-full py-1 border-b-2 border-transparent hover:border-dashed hover:border-primary transition-colors duration-150 ${className}`}
      title="Click to edit"
    >
      {value || <span className="text-muted-foreground italic">—</span>}
    </button>
  );
}

function UploadAdmin() {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("update");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const submit = async () => {
    if (!file) { toast.error("Choose a CSV or Excel file"); return; }
    setBusy(true); setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", mode);
      const { data } = await api.post("/products/bulk", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setResult(data);
      toast.success(`Imported ${data.inserted + data.updated} rows`);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally { setBusy(false); }
  };

  const download = async () => {
    try {
      const token = localStorage.getItem("pms_token");
      const res = await fetch(`${API}/products/export`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "pankaj_catalog.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { toast.error(String(e.message || e)); }
  };

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div>
        <h2 className="font-heading font-black text-2xl mb-1 tracking-tight">Bulk Upload</h2>
        <p className="pms-label text-muted-foreground mb-6">CSV or Excel. Columns: Product Name, Brand, Size, Category, Wholesale Price, Retail Price.</p>

        <div
          data-testid="csv-drop"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); }}
          className="border-2 border-dashed border-primary bg-primary/5 hover:bg-primary/10 p-10 text-center cursor-pointer transition-colors duration-150"
        >
          <FileSpreadsheet className="w-8 h-8 mx-auto mb-3 text-primary" />
          <div className="font-heading font-black text-lg">{file ? file.name : "Drop file here or click"}</div>
          <div className="pms-label text-muted-foreground mt-2">CSV, XLSX up to 10,000+ rows</div>
          <input
            ref={inputRef}
            data-testid="csv-file"
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ModeButton active={mode === "update"} onClick={() => setMode("update")} testId="mode-update">
            <div className="font-heading font-black text-base">Update + Add</div>
            <div className="pms-label text-muted-foreground mt-1">Merges by name+brand+size</div>
          </ModeButton>
          <ModeButton active={mode === "replace"} onClick={() => setMode("replace")} testId="mode-replace">
            <div className="font-heading font-black text-base">Replace All</div>
            <div className="pms-label text-muted-foreground mt-1">Wipes catalog first</div>
          </ModeButton>
        </div>

        <button
          data-testid="csv-submit"
          onClick={submit}
          disabled={busy || !file}
          className="mt-6 pms-label bg-primary text-primary-foreground hover:bg-foreground hover:text-background disabled:opacity-50 px-6 py-4 flex items-center gap-2 transition-colors duration-150"
        >
          <Upload className="w-4 h-4" /> {busy ? "Uploading…" : "Upload"}
        </button>

        {result && (
          <div className="mt-6 border border-border p-5" data-testid="csv-result">
            <div className="font-heading font-black text-lg">Result</div>
            <div className="pms-label mt-2 text-muted-foreground">
              Inserted <span className="text-primary">{result.inserted}</span> · Updated <span className="text-primary">{result.updated}</span> · Rows read <span className="text-primary">{result.total_rows}</span>
            </div>
            {result.errors && result.errors.length > 0 && (
              <details className="mt-3">
                <summary className="pms-label text-destructive cursor-pointer">{result.errors.length} errors</summary>
                <ul className="mt-2 pms-label text-muted-foreground max-h-40 overflow-auto">
                  {result.errors.map((er, i) => <li key={i}>Row {er.row}: {er.error}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-heading font-black text-2xl mb-1 tracking-tight">Export</h2>
        <p className="pms-label text-muted-foreground mb-6">Download the entire catalog as CSV.</p>
        <button
          data-testid="csv-export"
          onClick={download}
          className="pms-label border border-foreground hover:bg-foreground hover:text-background px-6 py-4 flex items-center gap-2 transition-colors duration-150"
        >
          <Download className="w-4 h-4" /> Download catalog.csv
        </button>

        <div className="mt-10 border border-border p-5 bg-muted/20">
          <div className="font-heading font-black text-lg mb-2">CSV Format</div>
          <pre className="font-mono text-xs whitespace-pre-wrap text-muted-foreground">
Product Name,Brand,Size,Category,Wholesale Price,Retail Price
Steel Wire,Tata,2mm,Wire,45,60
Cement Bag,Ultratech,50kg,Cement,380,420
          </pre>
        </div>
      </div>
    </div>
  );
}

function ModeButton({ children, active, onClick, testId }) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      className={`text-left p-4 border-2 transition-colors duration-150 ${active ? "border-primary bg-primary/5" : "border-border hover:border-foreground"}`}
    >{children}</button>
  );
}

function TeamAdmin() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: "", password: "", role: "viewer" });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { const { data } = await api.get("/users"); setUsers(data); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/users", form);
      setForm({ username: "", password: "", role: "viewer" });
      await load();
      toast.success("Team member added");
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusy(false); }
  };

  const del = async (id, uname) => {
    if (!window.confirm(`Remove ${uname}?`)) return;
    try { await api.delete(`/users/${id}`); await load(); toast.success("Removed"); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div className="grid md:grid-cols-2 gap-10">
      <form onSubmit={create} className="space-y-5" data-testid="team-form">
        <h2 className="font-heading font-black text-2xl tracking-tight">Add team member</h2>
        <div>
          <label className="pms-label text-muted-foreground block mb-2">Username</label>
          <input
            data-testid="team-username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
            className="w-full bg-transparent border-b-2 border-border focus:border-primary focus:outline-none py-2 text-xl font-heading font-bold"
          />
        </div>
        <div>
          <label className="pms-label text-muted-foreground block mb-2">Password</label>
          <input
            data-testid="team-password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            className="w-full bg-transparent border-b-2 border-border focus:border-primary focus:outline-none py-2 text-xl font-heading font-bold"
          />
        </div>
        <div>
          <label className="pms-label text-muted-foreground block mb-2">Role</label>
          <select
            data-testid="team-role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="pms-label appearance-none pl-4 pr-8 py-2 border border-border cursor-pointer"
          >
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button
          data-testid="team-submit"
          type="submit"
          disabled={busy}
          className="pms-label bg-primary text-primary-foreground hover:bg-foreground hover:text-background px-6 py-3 flex items-center gap-2 transition-colors duration-150"
        >
          <UserPlus className="w-4 h-4" /> Add member
        </button>
      </form>

      <div>
        <h2 className="font-heading font-black text-2xl tracking-tight mb-4">Team ({users.length})</h2>
        <div className="border border-border">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors duration-150" data-testid={`team-row-${u.id}`}>
              <div>
                <div className="font-heading font-bold text-base">{u.username}</div>
                <div className="pms-label text-muted-foreground mt-0.5">{u.role}</div>
              </div>
              <button
                data-testid={`team-delete-${u.id}`}
                onClick={() => del(u.id, u.username)}
                className="p-2 text-muted-foreground hover:text-destructive transition-colors duration-150"
                aria-label="delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
