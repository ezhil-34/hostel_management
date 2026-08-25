/**
 * CORS policy for the core API, shared in shape (not in code) with the
 * maintenance service.
 *
 * Two things about this are easy to get wrong, and both were:
 *
 * 1. **Chrome attaches an `Origin` header to every non-GET request, even a
 *    same-origin one.** Requests reach us through the gateway, so they *are*
 *    same-origin — but a POST still arrives carrying `Origin:
 *    http://127.0.0.1:5173`. If the allow-list happens to spell that host
 *    `localhost` instead, the request is refused. The symptom is maddening:
 *    every page loads and every list renders (GETs carry no Origin), and then
 *    every button fails. So we compare the origin against the request's own
 *    host and let a genuinely same-origin request through however it is spelled.
 *
 * 2. **A refused origin must not throw.** Throwing inside the origin callback
 *    surfaces as a 500 with a stack trace, which reads like a server crash.
 *    Withholding the `Access-Control-Allow-Origin` header is the correct
 *    behaviour: the browser blocks the preflight, so a cross-origin POST never
 *    executes, and nobody sees a fake internal error.
 */

/** Loopback, or an address in one of the private LAN ranges. */
const isLocalHostname = (hostname) =>
  hostname === 'localhost' ||
  hostname === '::1' ||
  hostname === '[::1]' ||
  /^127\./.test(hostname) ||
  /^10\./.test(hostname) ||
  /^192\.168\./.test(hostname) ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);

const buildCorsDelegate = (env, serviceName) => {
  const warned = new Set();

  return (req, callback) => {
    const allow = (ok) => callback(null, { origin: ok, credentials: true });
    const origin = req.headers.origin;

    // No Origin at all: a same-origin GET, curl, a health probe, another
    // service. There is no cross-origin request to police.
    if (!origin) return allow(true);

    if (env.corsOrigins.includes(origin)) return allow(true);

    let url;
    try {
      url = new URL(origin);
    } catch {
      return allow(false);
    }

    // Same-origin, arriving through the gateway. See note 1 above.
    if (req.headers.host && url.host === req.headers.host) return allow(true);

    // In development, anything on this machine or the local network is fine —
    // otherwise testing from a phone on the same Wi-Fi means editing .env for
    // every address the router hands out.
    if (!env.isProd && isLocalHostname(url.hostname)) return allow(true);

    // Refused. Say so once per origin, in the logs, where it can be acted on —
    // the browser's own console message does not mention CORS_ORIGINS.
    if (!warned.has(origin)) {
      warned.add(origin);
      console.warn(
        `[${serviceName}] refused cross-origin request from ${origin}. ` +
          `Add it to CORS_ORIGINS in .env and restart if this is expected.`,
      );
    }
    return allow(false);
  };
};

export default buildCorsDelegate;
