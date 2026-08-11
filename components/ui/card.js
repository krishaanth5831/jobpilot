// The one container treatment for the whole app: hairline border, raised off
// the page by --surface, 16px radius. Depth comes from the border and the
// surface shift, never a shadow.
//
// This existed as copy-pasted markup in 25 places before it was a component,
// and the copies had drifted: some carried no background, so cards read flat
// against the page on one screen and raised on the next.

export function Card({ as: Tag = "div", className, children, ...props }) {
  return (
    <Tag
      className={`rounded-2xl border border-line bg-surface ${className ?? ""}`}
      {...props}
    >
      {children}
    </Tag>
  );
}

// For the places that need the class string rather than the element —
// motion wrappers, <Tilt>, MorphingDialogTrigger.
export const cardClass = "rounded-2xl border border-line bg-surface";
