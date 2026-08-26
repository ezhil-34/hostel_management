const BASE_URL = import.meta.env.VITE_API_URL || '/api';
const ACCESS_TOKEN_KEY = 'hostel_access_token';

export class ApiRequestError extends Error {
  constructor(message, { status, details, code } = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details ?? [];
  }

  get fieldErrors() {
    return Object.fromEntries(
      this.details.map((d) => [d.field, d.message]),
    );
  }
}

export const tokenStore = {
  get: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  set: (token) => localStorage.setItem(ACCESS_TOKEN_KEY, token),
  clear: () => localStorage.removeItem(ACCESS_TOKEN_KEY),
};

let refreshInFlight = null;

const rawRequest = async (
  path,
  {
    method = 'GET',
    body,
    headers = {},
    auth = true,
  } = {},
) => {
  const token = tokenStore.get();

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(body !== undefined && body !== null
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(auth && token
        ? { Authorization: `Bearer ${token}` }
        : {}),
      ...headers,
    },
    ...(body !== undefined && body !== null
      ? { body: JSON.stringify(body) }
      : {}),
  });

  const isJson = response.headers
    .get('content-type')
    ?.includes('application/json');

  const payload = isJson
    ? await response.json().catch(() => null)
    : null;

  if (!response.ok) {
    throw new ApiRequestError(
      payload?.error?.message ||
        `Request failed (${response.status})`,
      {
        status: response.status,
        code: payload?.error?.code,
        details: payload?.error?.details,
      },
    );
  }

  return payload?.data ?? payload;
};

const refreshSession = () => {
  refreshInFlight ??= rawRequest('/auth/refresh', {
    method: 'POST',
    auth: false,
  })
    .then((data) => {
      if (!data?.accessToken) {
        throw new Error('Invalid refresh response');
      }

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
    const expiredToken =
      err instanceof ApiRequestError &&
      err.status === 401 &&
      (err.code === 'TOKEN_INVALID' ||
        err.code === 'TOKEN_MISSING');

    const retryable =
      expiredToken &&
      options.auth !== false &&
      !options._retried &&
      !path.startsWith('/auth/refresh');

    if (!retryable) {
      throw err;
    }

    try {
      await refreshSession();
    } catch {
      tokenStore.clear();
      throw err;
    }

    return rawRequest(path, {
      ...options,
      _retried: true,
    });
  }
};

export const api = {
  get: (path, options) =>
    request(path, {
      ...options,
      method: 'GET',
    }),

  post: (path, body, options) =>
    request(path, {
      ...options,
      method: 'POST',
      body,
    }),

  patch: (path, body, options) =>
    request(path, {
      ...options,
      method: 'PATCH',
      body,
    }),

  delete: (path, options) =>
    request(path, {
      ...options,
      method: 'DELETE',
    }),
};

export const authApi = {
  signup: (payload) =>
    api.post('/auth/signup', payload, {
      auth: false,
    }),

  signin: (payload) =>
    api.post('/auth/signin', payload, {
      auth: false,
    }),

  logout: () =>
    api.post('/auth/logout', undefined, {
      auth: false,
    }),

  me: () => api.get('/auth/me'),

  changePassword: (payload) =>
    api.post('/auth/change-password', payload),
};

export const profileApi = {
  get: () => api.get('/profile'),

  update: (payload) =>
    api.patch('/profile', payload),

  listMyRequests: (status = 'ALL') =>
    api.get(
      `/profile/requests?status=${encodeURIComponent(status)}`,
    ),

  createRequest: (payload) =>
    api.post('/profile/requests', payload),

  cancelRequest: (id) =>
    api.patch(
      `/profile/requests/${encodeURIComponent(id)}/cancel`,
    ),

  listAllRequests: (status = 'ALL') =>
    api.get(
      `/profile/review/requests?status=${encodeURIComponent(status)}`,
    ),

  review: (id, payload) =>
    api.patch(
      `/profile/review/requests/${encodeURIComponent(id)}`,
      payload,
    ),
};

const outpassQuery = ({
  status = 'ALL',
  overdue = false,
} = {}) =>
  `?status=${encodeURIComponent(status)}${
    overdue ? '&overdue=true' : ''
  }`;

export const outpassApi = {
  list: (opts) =>
    api.get(`/outpasses${outpassQuery(opts)}`),

  create: (payload) =>
    api.post('/outpasses', payload),

  get: (id) =>
    api.get(
      `/outpasses/${encodeURIComponent(id)}`,
    ),

  cancel: (id) =>
    api.patch(
      `/outpasses/${encodeURIComponent(id)}/cancel`,
    ),

  listForReview: (opts) =>
    api.get(
      `/outpasses/review${outpassQuery(opts)}`,
    ),

  review: (id, payload) =>
    api.patch(
      `/outpasses/review/${encodeURIComponent(id)}`,
      payload,
    ),

  verify: (token) =>
    api.get(
      `/outpasses/verify/${encodeURIComponent(token)}`,
    ),

  markExit: (token) =>
    api.post(
      `/outpasses/verify/${encodeURIComponent(token)}/exit`,
    ),

  markReturn: (token) =>
    api.post(
      `/outpasses/verify/${encodeURIComponent(token)}/return`,
    ),
};

const pointsTransactionQuery = ({
  walletType = 'ALL',
  type,
  limit = 50,
} = {}) => {
  const params = new URLSearchParams();

  params.set('walletType', walletType);
  params.set('limit', String(limit));

  if (type) {
    params.set('type', type);
  }

  return `?${params.toString()}`;
};

export const pointsApi = {
  wallets: () =>
    api.get('/points/wallets'),

  transactions: (opts = {}) =>
    api.get(
      `/points/transactions${pointsTransactionQuery(opts)}`,
    ),

  counters: () =>
    api.get('/points/counters'),

  counter: (token) =>
    api.get(
      `/points/counters/${encodeURIComponent(token)}`,
    ),

  pinStatus: () =>
    api.get('/points/pin'),

  setPin: (payload) =>
    api.post('/points/pin', payload),

  changePin: (payload) =>
    api.patch('/points/pin', payload),

  spend: (payload) =>
    api.post('/points/spend', payload),

  previewPay: (token) =>
    api.get(
      `/points/pay/${encodeURIComponent(token)}`,
    ),

  pay: (token, payload) =>
    api.post(
      `/points/pay/${encodeURIComponent(token)}`,
      payload,
    ),

  findStudents: (q) =>
    api.get(
      `/points/students?q=${encodeURIComponent(q)}`,
    ),

  credit: (payload) =>
    api.post('/points/credit', payload),

  topUp: (payload) =>
    api.post('/points/admin/topup', payload),

  createQr: (payload) =>
    api.post('/points/admin/qr', payload),

  listQr: (status = 'ALL') =>
    api.get(
      `/points/admin/qr?status=${encodeURIComponent(status)}`,
    ),

  cancelQr: (id) =>
    api.patch(
      `/points/admin/qr/${encodeURIComponent(id)}/cancel`,
    ),
};

const maintenanceQuery = ({
  status = 'ALL',
  category = 'ALL',
} = {}) =>
  `?status=${encodeURIComponent(
    status,
  )}&category=${encodeURIComponent(category)}`;

export const maintenanceApi = {
  list: (opts) =>
    api.get(`/maintenance${maintenanceQuery(opts)}`),

  create: (payload) =>
    api.post('/maintenance', payload),

  get: (id) =>
    api.get(
      `/maintenance/${encodeURIComponent(id)}`,
    ),

  withdraw: (id) =>
    api.patch(
      `/maintenance/${encodeURIComponent(id)}/withdraw`,
    ),

  reopen: (id, payload) =>
    api.post(
      `/maintenance/${encodeURIComponent(id)}/reopen`,
      payload,
    ),

  close: (id) =>
    api.post(
      `/maintenance/${encodeURIComponent(id)}/close`,
    ),

  comment: (id, payload) =>
    api.post(
      `/maintenance/${encodeURIComponent(id)}/comments`,
      payload,
    ),

  queue: (opts) =>
    api.get(
      `/maintenance/queue${maintenanceQuery(opts)}`,
    ),

  accept: (id) =>
    api.post(
      `/maintenance/${encodeURIComponent(id)}/accept`,
    ),

  resolve: (id, payload) =>
    api.post(
      `/maintenance/${encodeURIComponent(id)}/resolve`,
      payload,
    ),

  listAll: (opts) =>
    api.get(
      `/maintenance/admin${maintenanceQuery(opts)}`,
    ),

  reassign: (id, payload) =>
    api.post(
      `/maintenance/${encodeURIComponent(id)}/reassign`,
      payload,
    ),

  health: () =>
    api.get('/maintenance/health', {
      auth: false,
    }),
};

export default api;