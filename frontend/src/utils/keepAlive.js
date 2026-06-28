/**
 * Keep-Alive Utility
 * -------------------------------------------------
 * Render free tier servers auto-shutdown after ~15 min
 * of inactivity. This module pings the /healthz endpoint
 * every 9 minutes to keep the server awake.
 *
 * Start this once when the app mounts — it handles
 * everything automatically, including cleanup on unmount.
 */

const PING_INTERVAL_MS = 9 * 60 * 1000 // 9 minutes
const HEALTH_ENDPOINT = `${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/healthz`

let intervalId = null

/**
 * Sends a single ping to the backend health endpoint.
 * Logs success/failure for debugging — silent in production.
 */
async function pingServer() {
  try {
    const res = await fetch(HEALTH_ENDPOINT, {
      method: 'GET',
      cache: 'no-store', // always make a real network request
    })
    if (import.meta.env.DEV) {
      console.log(`[KeepAlive] Ping successful — status: ${res.status} at ${new Date().toLocaleTimeString()}`)
    }
  } catch (err) {
    // Network error or server truly down — log silently
    if (import.meta.env.DEV) {
      console.warn('[KeepAlive] Ping failed:', err.message)
    }
  }
}

/**
 * Starts the keep-alive interval.
 * Safe to call multiple times — only one interval runs at a time.
 */
export function startKeepAlive() {
  if (intervalId !== null) return // Already running

  // Ping immediately on start, then every PING_INTERVAL_MS
  pingServer()
  intervalId = setInterval(pingServer, PING_INTERVAL_MS)

  if (import.meta.env.DEV) {
    console.log(`[KeepAlive] Started — pinging every ${PING_INTERVAL_MS / 60000} minutes`)
  }
}

/**
 * Stops the keep-alive interval (call on app unmount).
 */
export function stopKeepAlive() {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
    if (import.meta.env.DEV) {
      console.log('[KeepAlive] Stopped')
    }
  }
}
