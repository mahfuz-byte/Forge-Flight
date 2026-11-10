export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const TOKEN_KEY = 'forge-flight-auth-token';

// Uploaded files come back as "/media/..." or absolute URLs; make them absolute.
const API_ORIGIN = new URL(BASE_URL, window.location.href).origin;
export function mediaUrl(path) {
  if (!path) return null;
  return /^https?:\/\//.test(path) ? path : `${API_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}

export function getAuthToken() {
  return window.sessionStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
  if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
  else window.sessionStorage.removeItem(TOKEN_KEY);
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function ensureCsrfCookie() {
  if (!getCookie('csrftoken')) {
    await fetch(`${BASE_URL}/csrf/`, { credentials: 'include' });
  }
}

async function request(path, { method = 'GET', body, params } = {}) {
  let url = `${BASE_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
    const qsString = qs.toString();
    if (qsString) url += `?${qsString}`;
  }

  const headers = {};
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const token = path === '/auth/login/' || path === '/auth/register/' ? null : getAuthToken();
  if (token) {
    headers.Authorization = `Token ${token}`;
  } else if (method !== 'GET' && method !== 'HEAD') {
    await ensureCsrfCookie();
    headers['X-CSRFToken'] = getCookie('csrftoken') || '';
  }

  const res = await fetch(url, {
    method,
    credentials: token ? 'omit' : 'include',
    headers,
    body: body instanceof FormData ? body : (body !== undefined ? JSON.stringify(body) : undefined),
  });

  if (res.status === 204) return null;

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    const error = new Error(errorMessage(data, res.status));
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

// The server's own explanation: `detail`, else the first field error.
function errorMessage(data, status) {
  const first = (v) => (Array.isArray(v) ? v[0] : v);
  if (data?.detail) return String(first(data.detail));
  if (data && typeof data === 'object') {
    const [field, value] = Object.entries(data)[0] || [];
    if (value) return field === 'non_field_errors' ? String(first(value)) : `${field}: ${first(value)}`;
  }
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  return `Request failed (${status}). Please try again.`;
}

export const api = {
  get: (path, params) => request(path, { method: 'GET', params }),
  post: (path, body) => request(path, { method: 'POST', body: body ?? {} }),
  patch: (path, body) => request(path, { method: 'PATCH', body: body ?? {} }),
  put: (path, body) => request(path, { method: 'PUT', body: body ?? {} }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
