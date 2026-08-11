// Form controls. The focus ring is the accent — it's the same signal as a
// primary button, which is what makes one accent colour readable everywhere.

export const inputClass =
  "w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-accent disabled:opacity-50";

/** Label + control + optional hint. Pass an id so the label binds. */
export function Field({ label, hint, htmlFor, className, children }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="font-mono text-[11px] uppercase tracking-widest text-muted"
        >
          {label}
        </label>
      )}
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Input({ className, ...props }) {
  return <input className={`${inputClass} ${className ?? ""}`} {...props} />;
}
