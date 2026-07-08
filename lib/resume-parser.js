// Extracts raw text from an uploaded resume PDF.
// Alternative for scanned/image-heavy resumes: send the PDF to Claude directly
// as a base64 document content block instead of pre-extracting text.

/**
 * @param {Buffer} buffer - the uploaded PDF file bytes
 * @returns {Promise<string>} plain text of the resume
 */
export async function extractResumeText(buffer) {
  const { pdf } = await import("pdf-parse");
  const result = await pdf(buffer);
  return result.text;
}
