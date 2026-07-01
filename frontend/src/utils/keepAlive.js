/**
 * Keep-Alive Utility
 * -------------------------------------------------
 * Render free tier servers auto-shutdown after ~15 min
 * of inactivity. This module:
 *
 *  1. Pings /healthz every 9 min to PREVENT sleep.
 *  2. On first load, fires an immediate ping so the
 *     server wakes up fast (cold start detection).
 *  3. Exposes `onStatusChange` so UI components can
 *     show a "Server waking up…" banner to the user.
 *
 * Start this once when the app mounts.
 */

const PING_INTERVAL_MS = 9 * 60 * 1000 // 9 minutes — under Render's 15-min timeout
const WAKE_TIMEOUT_MS  = 60 * 1000      // Consider server "cold" if ping takes > 1s
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'
const HEALTH_ENDPOINT = `${BASE_URL}/healthz`

let intervalId      = null
let statusListeners = []   // Functions to call when server status changes
let currentStatus   = 'unknown' // 'unknown' | 'awake' | 'waking'

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
 * Sends a single ping. If the response is slow (cold start), marks server
 * as 'waking' so the UI can show a loading indicator.
 */
async function pingServer() {
  // Set a short timer — if no response in 1s, server is likely cold-starting
  const wakeTimer = setTimeout(() => setStatus('waking'), 1000)

  try {
    const res = await fetch(HEALTH_ENDPOINT, {
      method: 'GET',
      cache: 'no-store', // always make a real network request, skip cache
    })

    clearTimeout(wakeTimer)

    if (res.ok || res.status === 200) {
      setStatus('awake')
      if (import.meta.env.DEV) {
        console.log(`[KeepAlive] ✅ Server awake — ${res.status} at ${new Date().toLocaleTimeString()}`)
      }
    }
  } catch {
    clearTimeout(wakeTimer)
    // Don't change status on error — server might just be mid-restart
    if (import.meta.env.DEV) {
      console.warn('[KeepAlive] ⚠️ Ping failed — server may be restarting')
    }
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Starts the keep-alive system.
 * - Fires an immediate ping to detect cold start.
 * - Then pings every 9 minutes to prevent sleep.
 * Safe to call multiple times — only one interval runs at a time.
 */
export function startKeepAlive() {
  if (intervalId !== null) return // Already running

  // 🔥 Immediate ping — wakes server on cold start right away
  pingServer()

  // 🔄 Recurring ping every 9 minutes to prevent sleep
  intervalId = setInterval(pingServer, PING_INTERVAL_MS)

  if (import.meta.env.DEV) {
    console.log(`[KeepAlive] 🟢 Started — pinging every ${PING_INTERVAL_MS / 60000} min → ${HEALTH_ENDPOINT}`)
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
      console.log('[KeepAlive] 🔴 Stopped')
    }
  }
}
