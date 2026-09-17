/**
 * api.js
 * -----------------------------------------------------------------------
 * Thin wrapper around the Fetch API. Every network call the dashboard
 * makes goes through here, and every call is built on API_BASE_URL from
 * config.js — no page ever hardcodes a URL.
 *
 * All CRUD pages call HMD_API.get/post/put/del with an /api/... path.
 * Errors are normalized into an ApiError with a user-friendly message so
 * the UI never has to show a raw stack trace or Oracle error.
 */

class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status || 0;
    this.details = details || null;
  }
}

const HMD_API = {

  async request(path, options = {}) {
    const url = `${API_BASE_URL}${path}`;
    let response;

    try {
      response = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options,
      });
    } catch (networkErr) {
      // Backend unreachable, CORS failure, offline, etc.
      throw new ApiError(
        'The server could not be reached. Check that the backend is running and reachable.',
        0
      );
    }

    if (response.status === 204) return null;

    let payload = null;
    const text = await response.text();
    if (text) {
      try { payload = JSON.parse(text); } catch (_) { payload = text; }
    }

    if (!response.ok) {
      const friendly = HMD_API._friendlyError(response.status, payload);
      throw new ApiError(friendly, response.status, payload);
    }

    return payload;
  },

  _friendlyError(status, payload) {
    // Try to surface a backend-supplied message without leaking stack traces.
    const backendMessage =
      payload && typeof payload === 'object'
        ? (payload.message || payload.error || null)
        : null;

    if (status === 400) return backendMessage || 'That request was invalid. Please check the highlighted fields.';
    if (status === 404) return 'That record no longer exists.';
    if (status === 409) return backendMessage || 'This conflicts with an existing record (possible duplicate).';
    if (status === 422) return backendMessage || 'Some fields failed validation.';
    if (status >= 500) return 'The server ran into a problem processing that request. Please try again.';
    return backendMessage || 'Something went wrong with that request.';
  },

  get(path) {
    return HMD_API.request(path, { method: 'GET' });
  },
  post(path, body) {
    return HMD_API.request(path, { method: 'POST', body: JSON.stringify(body) });
  },
  put(path, body) {
    return HMD_API.request(path, { method: 'PUT', body: JSON.stringify(body) });
  },
  del(path) {
    return HMD_API.request(path, { method: 'DELETE' });
  },

  /** Lightweight reachability probe used for the sidebar API status pill. */
  async ping() {
    try {
      await HMD_API.request('/api/dashboard/summary', { method: 'GET' });
      return true;
    } catch (_) {
      return false;
    }
  },
};
