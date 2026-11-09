import { api } from '../api/client';

/**
 * Centralized error handling for the admin panel (Phase 5.1).
 *
 * Every admin request goes through here, so each failure arrives as an
 * AdminApiError with a `kind` the UI can react to consistently:
 *   auth       not signed in                 → send to /login
 *   forbidden  role lacks this capability    → "not authorized" screen
 *   notfound   record is gone                → inline message
 *   invalid    validation error (400/409)    → show `message` next to the form
 *   server     5xx / unexpected              → retry banner
 *   network    request never reached us      → retry banner
 */
export class AdminApiError extends Error {
  constructor(kind, message, { status, data } = {}) {
    super(message);
    this.name = 'AdminApiError';
    this.kind = kind;
    this.status = status;
    this.data = data;
  }
}

function classify(err) {
  if (err instanceof AdminApiError) return err;
  const status = err?.status;
  if (!status) return new AdminApiError('network', 'Could not reach the server. Check your connection and try again.');
  if (status === 401) return new AdminApiError('auth', 'Please sign in again.', { status });
  if (status === 403) {
    return new AdminApiError('forbidden', err.message || "Your admin role doesn't include access to this area.", { status, data: err.data });
  }
  if (status === 404) return new AdminApiError('notfound', 'That record no longer exists.', { status });
  if (status === 400 || status === 409) return new AdminApiError('invalid', err.message, { status, data: err.data });
  return new AdminApiError('server', 'Something went wrong on our side. Please try again.', { status, data: err.data });
}

async function call(fn) {
  try {
    return await fn();
  } catch (err) {
    throw classify(err);
  }
}

export const adminApi = {
  get: (path, params) => call(() => api.get(`/admin${path}`, params)),
  post: (path, body) => call(() => api.post(`/admin${path}`, body)),
  patch: (path, body) => call(() => api.patch(`/admin${path}`, body)),
  delete: (path) => call(() => api.delete(`/admin${path}`)),
};
