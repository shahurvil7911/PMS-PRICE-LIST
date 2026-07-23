import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import InlinePrice from "@/components/InlinePrice";
import { toast } from "sonner";
import { Search as SearchIcon, X, Plus } from "lucide-react";

const useDebounced = (val, ms = 250) => {
  const [d, setD] = useState(val);
  useEffect(() => {
    const t = setTimeout(() => setD(val), ms);
    return () => clearTimeout(t);
  }, [val, ms]);
  return d;
};

export default function Search() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [q, setQ] = useState("");
  const dq = useDebounced(q, 220);
  const [brand, setBrand] = useState("");
  const [size, setSize] = useState("");
  const [category, setCategory] = useState("");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [facets, setFacets] = useState({ brands: [], sizes: [], categories: [], total: 0 });
  const [showAdd, setShowAdd] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const loadFacets = useCallback(async () => {
    try {
      const { data } = await api.get("/products/facets");
      setFacets(data);
    } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => { loadFacets(); }, [loadFacets]);

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 60 };
      if (dq.trim()) params.q = dq.trim();
      if (brand) params.brand = brand;
      if (size) params.size = size;
      if (category) params.category = category;
      const { data } = await api.get("/products", { params });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, [dq, brand, size, category]);

  useEffect(() => { search(); }, [search]);

  const savePrice = async (id, field, value) => {
    try {
      const { data } = await api.patch(`/products/${id}`, { [field]: value });
      setItems((prev) => prev.map((p) => p.id === id ? data : p));
      toast.success("Price updated");
    } catch (e) {
      toast.error(formatApiError(e));
      throw e;
    }
  };

  const clearFilters = () => { setBrand(""); setSize(""); setCategory(""); };
  const hasFilters = brand || size || category;

  const addProduct = async (payload) => {
    try {
      const { data } = await api.post("/products", payload);
      setItems((p) => [data, ...p]);
      setTotal((t) => t + 1);
      loadFacets();
      toast.success("Product added");
      setShowAdd(false);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-10 pt-10 md:pt-16 pb-24">
      <div className="mb-8 md:mb-10">
        <div className="pms-label text-muted-foreground mb-3">
          {facets.total} products in catalog
        </div>
        <h1 className="font-heading font-black text-3xl md:text-5xl leading-[0.95] tracking-tight">
          Find a price.
        </h1>
      </div>

      <div className="relative border-b-4 border-primary">
        <SearchIcon className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 md:w-8 md:h-8 text-muted-foreground" />
        <input
          ref={inputRef}
          data-testid="search-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search product, brand, size…"
          className="w-full bg-transparent pl-10 md:pl-14 pr-12 py-6 md:py-8 text-2xl md:text-5xl font-heading font-black tracking-tight focus:outline-none placeholder:text-muted-foreground/50"
          autoComplete="off"
        />
        {q && (
          <button
            data-testid="search-clear"
            aria-label="clear"
            onClick={() => { setQ(""); inputRef.current?.focus(); }}
            className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground transition-colors duration-150"
          >
            <X className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div className="mt-6 flex flex-wrap gap-3 items-center" data-testid="filters">
        <FilterSelect label="Brand" value={brand} onChange={setBrand} options={facets.brands} testId="filter-brand" />
        <FilterSelect label="Size" value={size} onChange={setSize} options={facets.sizes} testId="filter-size" />
        <FilterSelect label="Category" value={category} onChange={setCategory} options={facets.categories} testId="filter-category" />
        {hasFilters && (
          <button
            data-testid="filter-clear"
            onClick={clearFilters}
            className="pms-label px-4 py-2 border border-border hover:border-destructive hover:text-destructive transition-colors duration-150"
          >
            Clear
          </button>
        )}
        <div className="pms-label text-muted-foreground ml-auto">
          {loading ? "Searching…" : `${total} result${total === 1 ? "" : "s"}`}
        </div>
        {isAdmin && (
          <button
            data-testid="add-product-btn"
            onClick={() => setShowAdd(true)}
            className="pms-label bg-primary text-primary-foreground hover:bg-foreground hover:text-background px-4 py-2 flex items-center gap-2 transition-colors duration-150"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        )}
      </div>

      {/* Results */}
      <div className="mt-8" data-testid="results">
        {loading && items.length === 0 && (
          <div className="space-y-4">
            {[0,1,2].map((i) => (
              <div key={i} className="h-24 bg-muted/40 animate-pulse" />
            ))}
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="border border-dashed border-border py-16 text-center">
            <div className="pms-label text-muted-foreground">
              {facets.total === 0 ? (isAdmin ? "No products yet. Add one or upload a CSV in the Admin panel." : "Catalog is empty. Ask the admin to upload products.") : "No matches. Try a different search."}
            </div>
          </div>
        )}

        <div className="divide-y divide-border">
          {items.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              admin={isAdmin}
              onSaveWholesale={(v) => savePrice(p.id, "wholesale_price", v)}
              onSaveRetail={(v) => savePrice(p.id, "retail_price", v)}
            />
          ))}
        </div>
      </div>

      {showAdd && (
        <AddProductInline onClose={() => setShowAdd(false)} onSubmit={addProduct} />
      )}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, testId }) {
  return (
    <div className="relative">
      <select
        data-testid={testId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`pms-label appearance-none pl-4 pr-8 py-2 border transition-colors duration-150 cursor-pointer ${value ? "border-primary text-primary bg-primary/5" : "border-border hover:border-foreground"}`}
      >
        <option value="">{label}: All</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">▾</span>
    </div>
  );
}

function ProductRow({ product, admin, onSaveWholesale, onSaveRetail }) {
  return (
    <div
      className="flex flex-col md:flex-row justify-between md:items-center gap-6 py-8 hover:bg-muted/40 transition-colors duration-150 px-2 -mx-2 animate-fade-in"
      data-testid={`product-row-${product.id}`}
    >
      <div className="min-w-0 flex-1">
        <div className="font-heading font-black text-xl md:text-2xl leading-tight" data-testid="product-name">
          {product.name}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 items-center">
          {product.brand && <Tag>{product.brand}</Tag>}
          {product.size && <Tag>{product.size}</Tag>}
          {product.category && <Tag muted>{product.category}</Tag>}
        </div>
      </div>
      <div className="flex items-start gap-8 md:gap-12 shrink-0">
        <InlinePrice
          testId={`wholesale-${product.id}`}
          label="Wholesale"
          value={product.wholesale_price}
          admin={admin}
          onSave={onSaveWholesale}
        />
        <div className="w-px self-stretch bg-border" />
        <InlinePrice
          testId={`retail-${product.id}`}
          label="Retail"
          value={product.retail_price}
          admin={admin}
          onSave={onSaveRetail}
        />
      </div>
    </div>
  );
}

function Tag({ children, muted }) {
  return (
    <span className={`pms-label px-2.5 py-1 border ${muted ? "border-border text-muted-foreground" : "border-foreground/30 text-foreground"}`}>
      {children}
    </span>
  );
}

function AddProductInline({ onClose, onSubmit }) {
  const [form, setForm] = useState({ name: "", brand: "", size: "", category: "", wholesale_price: "", retail_price: "" });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSubmit({
      ...form,
      wholesale_price: parseFloat(form.wholesale_price || 0),
      retail_price: parseFloat(form.retail_price || 0),
    });
  };
  return (
    <div className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm flex items-start justify-center p-5 md:p-10 overflow-auto" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        data-testid="add-product-form"
        className="bg-background border border-foreground w-full max-w-2xl mt-8 md:mt-24 animate-fade-in"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="font-heading font-black text-lg tracking-tight">ADD PRODUCT</div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Product name *" value={form.name} onChange={set("name")} testId="add-name" autoFocus />
          <Field label="Brand" value={form.brand} onChange={set("brand")} testId="add-brand" />
          <Field label="Size / variant" value={form.size} onChange={set("size")} testId="add-size" />
          <Field label="Category" value={form.category} onChange={set("category")} testId="add-category" />
          <Field label="Wholesale ₹" type="number" value={form.wholesale_price} onChange={set("wholesale_price")} testId="add-wholesale" />
          <Field label="Retail ₹" type="number" value={form.retail_price} onChange={set("retail_price")} testId="add-retail" />
        </div>
        <div className="px-6 pb-6 flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="pms-label px-5 py-3 border border-border hover:border-foreground transition-colors duration-150">Cancel</button>
          <button data-testid="add-product-submit" type="submit" className="pms-label px-6 py-3 bg-primary text-primary-foreground hover:bg-foreground hover:text-background transition-colors duration-150">
            Save product
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, testId, type = "text", autoFocus }) {
  return (
    <label className="block">
      <span className="pms-label text-muted-foreground block mb-2">{label}</span>
      <input
        data-testid={testId}
        type={type}
        step={type === "number" ? "0.01" : undefined}
        min={type === "number" ? "0" : undefined}
        autoFocus={autoFocus}
        value={value}
        onChange={onChange}
        className="w-full bg-transparent border-b-2 border-border focus:border-primary focus:outline-none py-2 text-lg font-heading font-bold transition-colors duration-150"
      />
    </label>
  );
}
