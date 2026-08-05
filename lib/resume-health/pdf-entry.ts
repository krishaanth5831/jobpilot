// Re-export shim for the pdfjs layer.
//
// analyze.ts imports this dynamically so that pdfjs — which is ESM-only and
// pulls in a large amount of code — is never loaded on a request that does not
// actually parse a PDF, and never at module-eval time in the test build.

export { loadPdfGeometry, detectPhoto, PHOTO_MIN_AREA_FRACTION, PHOTO_MAX_ASPECT_RATIO } from "./parse/pdf";
export type { PdfGeometry, PlacedImage } from "./parse/pdf";
