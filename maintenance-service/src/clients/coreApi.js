import env from '../config/env.js';

/**
 * The only outbound call this service makes.
 *
 * The access token carries `sub`, `role` and `email` — enough to authorise, but
 * not enough to *display* a filer (name, roll number, room). We cannot take
 * those from the browser: a student could then file under someone else's name.
 * So we ask the core API, passing the caller's own token — this service holds no
 * service account and can never read more than the user could themselves.
 *
 * Returns null rather than throwing when the core API is unreachable. A
 * request is worth more than its display snapshot: the core API being down
 * degrades how a request renders, it does not stop one being filed. The
 * request path for reading requests never calls this at all.
 */
export const fetchUserSnapshot = async (accessToken) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.coreApiTimeoutMs);

  try {
    const response = await fetch(`${env.coreApiUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[core-api] /auth/me returned ${response.status} — filing without a snapshot`);
      return null;
    }

    const payload = await response.json();
    const user = payload?.data?.user;
    if (!user) return null;

    return {
      name: user.name ?? null,
      rollNumber: user.rollNumber ?? null,
      roomNo: user.roomNo ?? null,
      // A worker needs a number to call when they are at the door.
      phone: user.phone ?? null,
    };
  } catch (err) {
    const reason = err.name === 'AbortError' ? 'timed out' : err.message;
    console.warn(`[core-api] snapshot lookup failed (${reason}) — filing without a snapshot`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

/** Readiness probe used by GET /api/maintenance/health. */
export const pingCoreApi = async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.coreApiTimeoutMs);
  try {
    const response = await fetch(`${env.coreApiUrl}/api/health`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
};
