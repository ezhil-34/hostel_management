/**
 * Helpers for reading a payment code. Kept out of the scanner component so that
 * file exports a component and nothing else — a module mixing the two breaks
 * fast refresh during development.
 */

/**
 * Whether the browser exposes the native decoder. Chromium ships `BarcodeDetector`
 * only on Android, ChromeOS and macOS — never on Linux or Windows desktop, and
 * Firefox not at all. It is a fast path when present, never a requirement.
 */
export const hasNativeDetector = () =>
  typeof window !== 'undefined' && 'BarcodeDetector' in window;

/**
 * Whether this browser can scan at all. A decoder is now bundled, so the only
 * hard requirement is camera access — which is why this no longer asks for
 * `BarcodeDetector`. Gating on that API disabled the button outright on every
 * Linux and Windows desktop, with no way for the user to tell scanning apart
 * from a browser that simply refused to try.
 */
export const canScan = () =>
  typeof window !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

/**
 * A camera needs a secure context. `localhost` counts; `http://192.168.1.20`
 * does not — and that is exactly the address you reach the app on from a phone,
 * so it is worth saying out loud rather than letting the camera fail silently.
 */
export const isSecureForCamera = () =>
  typeof window !== 'undefined' &&
  (window.isSecureContext || window.location.hostname === 'localhost');

/**
 * A scanned QR holds a full URL like `https://host/points/pay/<token>`, while a
 * typed code is bare. Reduce both to the part the API resolves.
 */
export const extractCode = (raw) => {
  const value = String(raw ?? '').trim();
  if (!value) return '';

  // Only parse it as a URL if it really is one — a bare token must not be
  // mangled by a parser that accepts almost anything.
  if (/^https?:\/\//i.test(value)) {
    try {
      return new URL(value).pathname.split('/').filter(Boolean).at(-1) ?? '';
    } catch {
      return value;
    }
  }

  // Someone may paste the tail of a link rather than the whole thing.
  if (value.includes('/')) return value.split('/').filter(Boolean).at(-1) ?? '';

  return value;
};
