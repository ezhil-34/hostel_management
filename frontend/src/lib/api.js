/**
 * Thin fetch wrapper around the SmartHostel API.
 *
 * - Attaches the access token to every request.
 * - On a 401 caused by an expired access token, silently refreshes once and
 *   replays the original request.
 * - Throws an `ApiRequestError` carrying the server's message and field errors.
 */

const BASE_URL = import.meta.env.VITE_API_URL || '/api';
const ACCESS_TOKEN_KEY = 'hostel_access_token';

export class ApiRequestError extends Error {
  constructor(message, { status, details, code } = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    /** Stable identifier from the server, e.g. TOKEN_INVALID. May be absent. */
    this.code = code;
    this.details = details ?? [];
  }

  /** { email: "...", password: "..." } for rendering errors next to inputs. */
  get fieldErrors() {
    return Object.fromEntries(this.details.map((d) => [d.field, d.message]));
  }
}

export const tokenStore = {
  get: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  set: (token) => localStorage.setItem(ACCESS_TOKEN_KEY, token),
  clear: () => localStorage.removeItem(ACCESS_TOKEN_KEY),
};

let refreshInFlight = null;

const rawRequest = async (path, { method = 'GET', body, headers = {}, auth = true } = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(auth && tokenStore.get() ? { Authorization: `Bearer ${tokenStore.get()}` } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    throw new ApiRequestError(payload?.error?.message ?? `Request failed (${response.status})`, {
      status: response.status,
      code: payload?.error?.code,
      details: payload?.error?.details,
    });
  }

  return payload?.data ?? payload;
};

const refreshSession = () => {
  // Collapse concurrent 401s into a single refresh call.
  refreshInFlight ??= rawRequest('/auth/refresh', { method: 'POST', auth: false })
    .then((data) => {
      tokenStore.set(data.accessToken);
      return data;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
};

export const request = async (path, options = {}) => {
  try {
    return await rawRequest(path, options);
  } catch (err) {
    /**
     * Replay only a 401 that really means "the access token has expired".
     *
     * This used to replay *any* 401 on an authenticated request. That is fine
     * for a stale token and wrong for everything else: the points module
     * answered a wrong spending PIN with 401, so one tap on Pay was posted
     * twice and burned two of the five attempts before the wallet locked. The
     * server now returns 403 for a refused action, and this guard means a
     * future endpoint making the same mistake cannot silently double-post a
     * payment either.
     */
    const expiredToken =
      err instanceof ApiRequestError &&
      err.status === 401 &&
      (err.code === 'TOKEN_INVALID' || err.code === 'TOKEN_MISSING');

    const retryable =
      expiredToken &&
      options.auth !== false &&
      !options._retried &&
      !path.startsWith('/auth/refresh');

    if (!retryable) throw err;

    try {
      await refreshSession();
    } catch {
      tokenStore.clear();
      throw err;
    }

    return rawRequest(path, { ...options, _retried: true });
  }
};

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
};

export const authApi = {
  signup: (payload) => api.post('/auth/signup', payload, { auth: false }),
  signin: (payload) => api.post('/auth/signin', payload, { auth: false }),
  logout: () => api.post('/auth/logout', undefined, { auth: false }),
  me: () => api.get('/auth/me'),
  changePassword: (payload) => api.post('/auth/change-password', payload),
};

export const profileApi = {
  /** Profile + the per-role field policy the UI renders from. */
  get: () => api.get('/profile'),
  /** Only fields the policy marks editable; anything else returns 403. */
  update: (payload) => api.patch('/profile', payload),

  listMyRequests: (status = 'ALL') => api.get(`/profile/requests?status=${status}`),
  createRequest: (payload) => api.post('/profile/requests', payload),
  cancelRequest: (id) => api.patch(`/profile/requests/${id}/cancel`),

  // Warden / admin only.
  listAllRequests: (status = 'ALL') => api.get(`/profile/review/requests?status=${status}`),
  review: (id, payload) => api.patch(`/profile/review/requests/${id}`, payload),
};

const outpassQuery = ({ status = 'ALL', overdue = false } = {}) =>
  `?status=${status}${overdue ? '&overdue=true' : ''}`;

export const outpassApi = {
  list: (opts) => api.get(`/outpasses${outpassQuery(opts)}`),
  create: (payload) => api.post('/outpasses', payload),
  get: (id) => api.get(`/outpasses/${id}`),
  cancel: (id) => api.patch(`/outpasses/${id}/cancel`),

  // Warden / admin.
  listForReview: (opts) => api.get(`/outpasses/review${outpassQuery(opts)}`),
  review: (id, payload) => api.patch(`/outpasses/review/${id}`, payload),

  // Gate — security, warden or admin only.
  verify: (token) => api.get(`/outpasses/verify/${token}`),
  markExit: (token) => api.post(`/outpasses/verify/${token}/exit`),
  markReturn: (token) => api.post(`/outpasses/verify/${token}/return`),
};

/**
 * Canteen and laundry points. Served by the core API, because a wallet belongs
 * to a user and the two are joined on every read — the test for whether
 * something can be its own service.
 */
export const pointsApi = {
  wallets: () => api.get('/points/wallets'),
  transactions: ({ type = 'ALL', limit = 50 } = {}) =>
    api.get(`/points/transactions?type=${type}&limit=${limit}`),

  // Counters. `counters` backs the picker that stands in for a camera; `counter`
  // is what a real scan would call with the token out of the QR code.
  counters: () => api.get('/points/counters'),
  counter: (token) => api.get(`/points/counters/${encodeURIComponent(token)}`),

  setPin: (payload) => api.post('/points/pin', payload),
  spend: (payload) => api.post('/points/spend', payload),

  // Warden / admin.
  findStudents: (q) => api.get(`/points/students?q=${encodeURIComponent(q)}`),
  credit: (payload) => api.post('/points/credit', payload),
};

/**
 * Maintenance is served by a separate service, but nothing here knows that.
 * The gateway (Vite in dev, nginx in production) routes `/api/maintenance` to
 * it and everything else under `/api` to the core API — so these calls look
 * exactly like the rest, and moving a module between services would not touch
 * this file.
 */
const maintenanceQuery = ({ status = 'ALL', category = 'ALL' } = {}) =>
  `?status=${status}&category=${category}`;

export const maintenanceApi = {
  list: (opts) => api.get(`/maintenance${maintenanceQuery(opts)}`),
  create: (payload) => api.post('/maintenance', payload),
  get: (id) => api.get(`/maintenance/${id}`),
  withdraw: (id) => api.patch(`/maintenance/${id}/withdraw`),
  reopen: (id, payload) => api.post(`/maintenance/${id}/reopen`, payload),
  close: (id) => api.post(`/maintenance/${id}/close`),
  comment: (id, payload) => api.post(`/maintenance/${id}/comments`, payload),

  // Maintenance worker.
  queue: (opts) => api.get(`/maintenance/queue${maintenanceQuery(opts)}`),
  accept: (id) => api.post(`/maintenance/${id}/accept`),
  resolve: (id, payload) => api.post(`/maintenance/${id}/resolve`, payload),

  // Warden / admin.
  listAll: (opts) => api.get(`/maintenance/admin${maintenanceQuery(opts)}`),
  reassign: (id, payload) => api.post(`/maintenance/${id}/reassign`, payload),

  health: () => api.get('/maintenance/health', { auth: false }),
};

export default api;
