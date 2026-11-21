// api.js — central fetch wrapper
// Every API call in the app goes through apiFetch().
// It adds the auth token, parses JSON, and throws errors with the server's message.

const BASE_URL = import.meta.env.VITE_API_URL;

/**
 * apiFetch(path, options)
 *
 * path    — e.g. '/items' or '/batches/5/complete'
 * options — same as fetch options (method, body, etc.)
 *
 * Returns the parsed JSON body on success.
 * Throws an Error whose .message is the server's "error" string on failure.
 * On 401, clears the stored token and redirects to /login (session expired).
 */
export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('ff_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    // body must be a JSON string; callers pass plain objects
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // Session expired — kick the user back to login
  if (res.status === 401) {
    localStorage.removeItem('ff_token');
    localStorage.removeItem('ff_user');
    window.location.href = '/login';
    // Return so the calling code doesn't try to read the body
    return;
  }

  // Parse the body (the server always returns JSON)
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Server returned an unexpected response');
  }

  if (!res.ok) {
    // Validation errors (400) have a details array; build a human-readable message.
    if (data.details && Array.isArray(data.details)) {
      const msgs = data.details.map((d) => `${d.field}: ${d.message}`).join(', ');
      throw new Error(msgs);
    }
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }

  return data;
}

// Shorthand helpers so callers don't have to remember the method names
export const api = {
  get:    (path)         => apiFetch(path),
  post:   (path, body)   => apiFetch(path, { method: 'POST',  body }),
  put:    (path, body)   => apiFetch(path, { method: 'PUT',   body }),
  delete: (path)         => apiFetch(path, { method: 'DELETE' }),
};
