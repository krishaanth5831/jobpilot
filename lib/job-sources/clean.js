// Job boards return HTML descriptions of wildly varying length. Strip the
// markup and cap the length — every stored description is sent to Claude
// for matching, so this directly bounds token cost per job.

const MAX_DESCRIPTION_CHARS = 4000;

export function cleanDescription(html) {
  if (!html) return "";
  const text = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x?[0-9a-f]+;/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > MAX_DESCRIPTION_CHARS
    ? `${text.slice(0, MAX_DESCRIPTION_CHARS)}…`
    : text;
}
