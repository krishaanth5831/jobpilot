// Every tab opens the same way: display-face title, one line of muted prose
// saying what the screen is for. The app used to set headings in the text face
// at font-bold while the landing page used Bricolage at font-semibold, so the
// product and its own homepage were typographically unrelated.

export function PageHeader({ title, description, children }) {
  return (
    <header>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold">{title}</h1>
        {children}
      </div>
      {description && (
        <p className="mt-2 max-w-[62ch] leading-relaxed text-muted">{description}</p>
      )}
    </header>
  );
}
