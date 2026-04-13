const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

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

  // Handle 401 — attempt token refresh
  if (res.status === 401) {
    const refreshed = await tryRefreshToken()
    if (refreshed) {
      // Retry with new token
      const newToken = localStorage.getItem('payflow_token')
      const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` }
      return fetch(`${API_BASE}${path}`, { ...options, headers: retryHeaders })
    }
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