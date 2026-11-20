/**
 * D38: Safe relative callback URL validator.
 * Accepts only relative same-origin paths starting with `/pod` (e.g. `/pod`, `/pod/abc`, `/pod?step=1`).
 * Rejects protocol-relative URLs (`//`), absolute URLs, backslashes (`\`, `/\`),
 * javascript: pseudo-protocols, encoded exploits (`%2F%2F`, `%5C`), and path traversals (`..`, `%2e%2e`).
 */
export function safeCallbackPath(input: unknown): string | null {
  if (typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  // Reject immediately if it has an absolute scheme (e.g. https://, http://, javascript:, data:)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return null;
  }

  // Reject backslashes or protocol-relative slashes
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\') || trimmed.includes('\\')) {
    return null;
  }

  // Check URL decoding to catch %2f%2f, %5c, %2e%2e, etc.
  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    // Malformed URI encoding
    return null;
  }

  if (
    decoded.startsWith('//') ||
    decoded.startsWith('/\\') ||
    decoded.includes('\\') ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(decoded)
  ) {
    return null;
  }

  // Reject path traversals
  if (/(^|\/)\.\.(\/|$)/.test(decoded) || decoded.includes('..')) {
    return null;
  }

  // Must strictly start with /pod (either exactly /pod, /pod/, or /pod?...)
  if (!/^\/pod(\/|\?|$)/.test(decoded)) {
    return null;
  }

  return trimmed;
}
