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
  constructor(message, { status, details } = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
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
    const retryable =
      err instanceof ApiRequestError &&
      err.status === 401 &&
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
  updateProfile: (payload) => api.patch('/auth/me', payload),
  changePassword: (payload) => api.post('/auth/change-password', payload),
};

export default api;
