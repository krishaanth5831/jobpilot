// A rule-under-a-heading, optionally with controls pushed to the right.
// /settings alone had this exact markup pasted seven times, in two variants
// that had drifted apart on padding.

export function SectionHeader({ title, description, children, className }) {
  return (
    <div className={`border-b border-line pb-3 ${className ?? ""}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        {children}
      </div>
      {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
    </div>
  );
}
