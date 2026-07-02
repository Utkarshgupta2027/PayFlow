/**
 * Keep-Alive Utility
 * -------------------------------------------------
 * Render free tier servers auto-shutdown after ~15 min
 * of inactivity. This module:
 *
 *  1. Pings /healthz every 9 min to PREVENT sleep.
 *  2. On first load, fires an immediate ping so the
 *     server wakes up fast (cold start detection).
 *  3. Uses Page Visibility API — when user returns to
 *     the tab after 8+ min away, fires an immediate ping
 *     so the server never gets a full 15-min silence window.
 *  4. Exposes `onStatusChange` so UI components can
 *     show a "Server waking up…" banner to the user.
 *
 * Start this once when the app mounts.
 */

const PING_INTERVAL_MS    = 9 * 60 * 1000  // 9 minutes — under Render's 15-min timeout
const REPING_THRESHOLD_MS = 8 * 60 * 1000  // Re-ping on tab focus if away for 8+ min
const BASE_URL            = import.meta.env.VITE_API_URL || 'http://localhost:8080'
const HEALTH_ENDPOINT     = `${BASE_URL}/healthz`

let intervalId      = null
let lastPingTime    = 0          // Timestamp of the last successful/attempted ping
let statusListeners = []         // Functions to call when server status changes
let currentStatus   = 'unknown'  // 'unknown' | 'awake' | 'waking'

// ── Status broadcasting ──────────────────────────────────────────────────────

function setStatus(status) {
  if (currentStatus === status) return
  currentStatus = status
  statusListeners.forEach(fn => fn(status))
}

/**
 * Subscribe to server status changes.
 * @param {(status: 'awake'|'waking'|'unknown') => void} fn
 * @returns {() => void} Unsubscribe function
 */
export function onStatusChange(fn) {
  statusListeners.push(fn)
  // Immediately call with current status so new subscribers are in sync
  fn(currentStatus)
  return () => {
    statusListeners = statusListeners.filter(l => l !== fn)
  }
}

/** Get the current server status without subscribing */
export function getServerStatus() {
  return currentStatus
}

// ── Core ping logic ──────────────────────────────────────────────────────────

/**
 * Sends a single ping to the health endpoint.
 * If the response takes >1s, marks the server as 'waking'
 * so the UI can show a loading indicator.
 */
async function pingServer() {
  lastPingTime = Date.now()

  // If no response within 1s → server is likely cold-starting
  const wakeTimer = setTimeout(() => setStatus('waking'), 1000)

  try {
    const res = await fetch(HEALTH_ENDPOINT, {
      method: 'GET',
      cache: 'no-store', // Always make a real network request, skip cache
    })

    clearTimeout(wakeTimer)

    if (res.ok || res.status === 200) {
      setStatus('awake')
      if (import.meta.env.DEV) {
        console.log(`[KeepAlive] ✅ Server awake — ${res.status} @ ${new Date().toLocaleTimeString()}`)
      }
    }
  } catch {
    clearTimeout(wakeTimer)
    // Don't flip status on error — server might just be mid-restart
    if (import.meta.env.DEV) {
      console.warn('[KeepAlive] ⚠️ Ping failed — server may be restarting')
    }
  }
}

// ── Page Visibility handler ──────────────────────────────────────────────────

/**
 * Fires when the user switches back to this tab.
 * If last ping was 8+ minutes ago, ping immediately so the server
 * never accumulates a full 15-minute silence window, even if the
 * user left the tab open but idle.
 */
function handleVisibilityChange() {
  if (document.visibilityState !== 'visible') return

  const timeSinceLastPing = Date.now() - lastPingTime
  if (timeSinceLastPing >= REPING_THRESHOLD_MS) {
    if (import.meta.env.DEV) {
      console.log(`[KeepAlive] 👁️ Tab visible again after ${Math.round(timeSinceLastPing / 60000)}min — pinging immediately`)
    }
    // Reset the interval so next scheduled ping is 9 min from NOW
    clearInterval(intervalId)
    intervalId = setInterval(pingServer, PING_INTERVAL_MS)
    pingServer()
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Starts the keep-alive system.
 * - Fires an immediate ping to detect cold start.
 * - Pings every 9 minutes to prevent Render sleep.
 * - Watches tab visibility to catch long idle periods.
 * Safe to call multiple times — only one interval runs at a time.
 */
export function startKeepAlive() {
  if (intervalId !== null) return // Already running

  // 🔥 Immediate ping — detect/resolve cold start right away
  pingServer()

  // 🔄 Recurring ping every 9 minutes
  intervalId = setInterval(pingServer, PING_INTERVAL_MS)

  // 👁️ Re-ping when user returns to the tab after long absence
  document.addEventListener('visibilitychange', handleVisibilityChange)

  if (import.meta.env.DEV) {
    console.log(`[KeepAlive] 🟢 Started — pinging every ${PING_INTERVAL_MS / 60000}min → ${HEALTH_ENDPOINT}`)
  }
}

/**
 * Stops the keep-alive interval and removes all event listeners.
 * Call this on app unmount.
 */
export function stopKeepAlive() {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    if (import.meta.env.DEV) {
      console.log('[KeepAlive] 🔴 Stopped')
    }
  }
}
