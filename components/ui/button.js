// Four button roles, and only four. Before this, the app ran two competing
// primaries at once — black/white on /jobs' search button and terracotta on
// the same screen's "Draft application" — which made the accent unlearnable.
// Accent now means "the action this screen exists for". Nothing else fills.

// Full class strings, not interpolated fragments: Tailwind only ships classes
// it can see written out.
const VARIANTS = {
  primary:
    "bg-accent text-accent-ink transition hover:bg-accent-hover active:translate-y-px disabled:opacity-50",
  secondary:
    "border border-line text-ink transition hover:border-accent hover:text-accent disabled:opacity-50",
  ghost:
    "text-muted transition hover:bg-accent-wash hover:text-accent disabled:opacity-50",
  icon: "rounded-xl p-2 text-muted transition hover:bg-accent-wash hover:text-accent disabled:opacity-50",
};

const SIZES = {
  sm: "rounded-xl px-3 py-2 text-sm font-medium",
  md: "rounded-xl px-5 py-2.5 text-sm font-medium",
  lg: "rounded-xl px-6 py-3.5 font-medium",
};

/** Class string for links and anything that can't be a <Button>. */
export function buttonClass(variant = "primary", size = "md", className) {
  const base = "inline-flex items-center justify-center gap-2";
  const sizing = variant === "icon" ? "" : SIZES[size];
  return `${base} ${sizing} ${VARIANTS[variant]} ${className ?? ""}`.replace(/\s+/g, " ").trim();
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  children,
  ...props
}) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...props}>
      {children}
    </button>
  );
}
