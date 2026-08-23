import { fetchUserSnapshot } from '../clients/coreApi.js';

/**
 * Attaches `req.user.displayName` for the handful of routes that write a name
 * into the record — accepting, resolving, reassigning, commenting.
 *
 * Deliberately NOT global. The access token carries no name, so this costs a
 * call to the core API; putting it on every request would make reading
 * requests depend on another service being up, which is exactly what this
 * architecture is meant to avoid. Reads stay entirely local.
 *
 * Degrades rather than fails: with the core API down the actor is recorded by
 * role ("Maintenance worker accepted this") instead of by name. Losing a label
 * is not a reason to refuse the work.
 */
export const withDisplayName = async (req, _res, next) => {
  try {
    const snapshot = await fetchUserSnapshot(req.accessToken);
    req.user.displayName = snapshot?.name ?? null;
  } catch {
    req.user.displayName = null;
  }
  return next();
};

export default withDisplayName;
