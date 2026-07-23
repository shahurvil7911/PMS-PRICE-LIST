import { useEffect, useRef, useState } from "react";
import { formatINR } from "@/lib/api";
import { Pencil, Check } from "lucide-react";

// Editable price when admin, plain display otherwise.
export default function InlinePrice({ value, label, admin, onSave, testId }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value ?? 0));
  const inputRef = useRef(null);

  useEffect(() => { setVal(String(value ?? 0)); }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = async () => {
    const n = parseFloat(val);
    if (isNaN(n) || n < 0) { setVal(String(value ?? 0)); setEditing(false); return; }
    if (n === Number(value)) { setEditing(false); return; }
    await onSave(n);
    setEditing(false);
  };

  const cancel = () => { setVal(String(value ?? 0)); setEditing(false); };

  return (
    <div className="min-w-[7rem]" data-testid={`${testId}-block`}>
      <div className="pms-label text-muted-foreground mb-1.5">{label}</div>
      {editing ? (
        <div className="flex items-center gap-2">
          <span className="pms-price text-3xl md:text-4xl text-foreground">₹</span>
          <input
            ref={inputRef}
            data-testid={`${testId}-input`}
            type="number"
            step="0.01"
            min="0"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commit(); }
              if (e.key === "Escape") { e.preventDefault(); cancel(); }
            }}
            className="w-28 md:w-36 bg-transparent border-b-2 border-primary text-3xl md:text-4xl pms-price focus:outline-none text-foreground"
          />
          <button
            type="button"
            aria-label="save"
            onMouseDown={(e) => e.preventDefault()}
            onClick={commit}
            className="text-primary hover:text-foreground transition-colors duration-150"
            data-testid={`${testId}-save`}
          >
            <Check className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          data-testid={testId}
          onClick={() => admin && setEditing(true)}
          disabled={!admin}
          className={`group inline-flex items-baseline gap-1.5 ${admin ? "cursor-pointer" : "cursor-default"}`}
          title={admin ? "Click to edit" : undefined}
        >
          <span className="pms-price text-3xl md:text-4xl text-foreground">
            <span className="text-muted-foreground text-2xl md:text-3xl mr-1">₹</span>
            {formatINR(value)}
          </span>
          {admin && (
            <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150 ml-1" />
          )}
        </button>
      )}
    </div>
  );
}
