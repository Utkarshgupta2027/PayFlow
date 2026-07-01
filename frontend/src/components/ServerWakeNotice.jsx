import { useEffect, useState } from 'react'
import { onStatusChange } from '../utils/keepAlive'

/**
 * ServerWakeNotice
 * ─────────────────────────────────────────────────────────
 * Shows a non-blocking banner at the top of the screen when
 * the Render backend is cold-starting (took > 1s to respond).
 * Automatically dismisses once the server is awake.
 *
 * Place this once inside <App /> (outside the Router so it
 * always renders regardless of the current route).
 */
export default function ServerWakeNotice() {
  const [status, setStatus] = useState('unknown')
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const unsub = onStatusChange(s => {
      setStatus(s)
      // Auto-reset dismissed flag when server goes back to waking
      if (s === 'waking') setDismissed(false)
    })
    return unsub
  }, [])

  // Only show banner when server is waking up and user hasn't manually dismissed it
  if (status !== 'waking' || dismissed) return null

  return (
    <div style={styles.banner} role="status" aria-live="polite">
      <div style={styles.inner}>
        {/* Animated spinner */}
        <span style={styles.spinner} aria-hidden="true" />

        <div style={styles.text}>
          <strong style={styles.title}>Server is waking up…</strong>
          <span style={styles.sub}>
            Free tier servers sleep after inactivity. This takes ~30 seconds — please wait.
          </span>
        </div>

        <button
          style={styles.close}
          onClick={() => setDismissed(true)}
          aria-label="Dismiss server wake notice"
          title="Dismiss"
        >
          ✕
        </button>
      </div>

      {/* Animated progress bar */}
      <div style={styles.progressTrack}>
        <div style={styles.progressBar} />
      </div>

      <style>{`
        @keyframes ka-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes ka-progress {
          0%   { width: 0%; }
          80%  { width: 90%; }
          100% { width: 95%; }
        }
        @keyframes ka-slide-in {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}

const styles = {
  banner: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    background: 'linear-gradient(135deg, #1a1035 0%, #2d1b69 100%)',
    borderBottom: '1px solid rgba(139, 92, 246, 0.4)',
    boxShadow: '0 4px 24px rgba(139, 92, 246, 0.25)',
    animation: 'ka-slide-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  inner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.875rem',
    padding: '0.75rem 1.25rem',
    maxWidth: '900px',
    margin: '0 auto',
  },
  spinner: {
    display: 'inline-block',
    width: '1.2rem',
    height: '1.2rem',
    border: '2.5px solid rgba(167, 139, 250, 0.3)',
    borderTopColor: '#a78bfa',
    borderRadius: '50%',
    flexShrink: 0,
    animation: 'ka-spin 0.8s linear infinite',
  },
  text: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.1rem',
  },
  title: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#e9d5ff',
    letterSpacing: '0.01em',
  },
  sub: {
    fontSize: '0.75rem',
    color: 'rgba(196, 181, 253, 0.75)',
    lineHeight: 1.4,
  },
  close: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '6px',
    color: 'rgba(196,181,253,0.8)',
    cursor: 'pointer',
    fontSize: '0.7rem',
    padding: '0.3rem 0.5rem',
    flexShrink: 0,
    transition: 'background 0.2s',
  },
  progressTrack: {
    height: '2.5px',
    background: 'rgba(139, 92, 246, 0.15)',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #7c3aed, #a78bfa, #7c3aed)',
    backgroundSize: '200% 100%',
    animation: 'ka-progress 30s ease-out forwards',
  },
}
