export const TOKEN_KEY = 'crm_jwt_token';

export async function api(path, opts = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    headers,
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new Event('auth:logout'));
  }

  if (!res.ok) {
    let message = '';
    let rawText = '';
    let parsed = null;
    try { rawText = await res.text(); } catch {}
    if (rawText) {
      try {
        parsed = JSON.parse(rawText);
        message = parsed.error || parsed.message || '';
      } catch {
        message = rawText.slice(0, 300);
      }
    }
    if (!message) message = res.statusText || `HTTP ${res.status}`;
    const error = new Error(`${message} (status ${res.status})`);
    error.status = res.status;
    error.data = parsed;
    throw error;
  }

  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
