import { markServerAwake } from './utils/keepAlive.js'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// ── Global 403 handler ──────────────────────────────────────────────────────
// When the Render server cold-starts, the JWT secret is fresh — old tokens
// stored in localStorage are now invalid and the backend returns 403.
// We clear stale credentials and redirect to /login automatically.
let _logoutCallback = null
export function setLogoutCallback(fn) { _logoutCallback = fn }

function handleStaleSession() {
  localStorage.removeItem('payflow_token')
  localStorage.removeItem('payflow_refresh_token')
  localStorage.removeItem('payflow_user')
  if (_logoutCallback) _logoutCallback()
  // Hard redirect so React state is fully reset
  window.location.replace('/login')
}

/**
 * Wrapper around fetch that automatically adds the JWT Authorization header
 * and handles JSON parsing + error responses.
 */
export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('payflow_token')
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (res.ok) markServerAwake()

  // Handle 401 — attempt token refresh
  if (res.status === 401) {
    const refreshed = await tryRefreshToken()
    if (refreshed) {
      // Retry with new token
      const newToken = localStorage.getItem('payflow_token')
      const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` }
      const retryRes = await fetch(`${API_BASE}${path}`, { ...options, headers: retryHeaders })
      if (retryRes.ok) markServerAwake()
      return retryRes
    }
    // Refresh also failed — session is fully stale
    handleStaleSession()
  }

  // Handle 403 — token exists but backend rejects it (cold-start / key rotation)
  if (res.status === 403) {
    handleStaleSession()
  }

  return res
}

async function tryRefreshToken() {
  const refreshToken = localStorage.getItem('payflow_refresh_token')
  if (!refreshToken) return false
  try {
    const res = await fetch(`${API_BASE}/user/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (res.ok) {
      const data = await res.json()
      localStorage.setItem('payflow_token', data.token)
      return true
    }
  } catch {
    // ignore
  }
  return false
}

export default API_BASE
