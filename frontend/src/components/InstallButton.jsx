/**
 * InstallButton.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable React component that handles PWA installation for PayFlow.
 *
 * Behaviour:
 *  1. Listens for the browser's `beforeinstallprompt` event.
 *  2. Stores the deferred prompt reference in state.
 *  3. Renders the button ONLY when installation is available
 *     (prompt captured) AND the app is not already installed.
 *  4. On click: triggers the native browser install dialog.
 *  5. Awaits the user's choice (accepted / dismissed).
 *  6. Shows a success state when the app is installed.
 *  7. Includes ripple animation on click for fintech-grade UX polish.
 *  8. Cleans up ALL event listeners on unmount to prevent memory leaks.
 *
 * Hooks used: useState, useEffect, useCallback
 *
 * Security: This component never touches auth tokens, wallet data, or
 * payment information — it only interacts with the browser install API.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import './InstallButton.css'

// ─── SVG Icons (inline, no external dependency) ───────────────────────────────

/** Download / Install arrow-into-tray icon */
function DownloadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Down arrow */}
      <path d="M12 3v12" />
      <path d="M7 11l5 5 5-5" />
      {/* Tray base */}
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  )
}

/** Checkmark icon for installed state */
function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

/** Spinning loader icon */
function SpinnerIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {/* Partial arc to give spinner appearance when rotated via CSS */}
      <path d="M12 2a10 10 0 0 1 10 10" opacity="1" />
      <path d="M22 12a10 10 0 0 1-10 10" opacity="0.6" />
      <path d="M12 22A10 10 0 0 1 2 12" opacity="0.3" />
      <path d="M2 12A10 10 0 0 1 12 2" opacity="0.1" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function InstallButton() {
  /**
   * deferredPrompt — stores the BeforeInstallPromptEvent captured from
   * the browser. This is needed to programmatically trigger the install
   * dialog when the user clicks the button.
   */
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  /**
   * isInstalled — true when the PWA has been installed (either via this
   * button or the browser's own install mechanism).
   */
  const [isInstalled, setIsInstalled] = useState(false)

  /**
   * isLoading — true while awaiting the user's response to the native
   * install prompt dialog.
   */
  const [isLoading, setIsLoading] = useState(false)

  /**
   * ripples — array of active ripple objects { id, x, y, size }
   * used to render the click-ripple animation effect.
   */
  const [ripples, setRipples] = useState([])

  /**
   * buttonRef — used to calculate ripple origin position relative to the button.
   */
  const buttonRef = useRef(null)

  // ── Detect if already installed (standalone display mode) ─────────────────
  useEffect(() => {
    // `display-mode: standalone` is true when the app runs as a PWA.
    const standaloneMedia = window.matchMedia('(display-mode: standalone)')

    if (standaloneMedia.matches) {
      // Already running as installed PWA — hide the button.
      setIsInstalled(true)
    }

    // Listen for the user installing the app through the browser directly.
    const handleChange = (e) => {
      if (e.matches) setIsInstalled(true)
    }

    standaloneMedia.addEventListener('change', handleChange)
    return () => standaloneMedia.removeEventListener('change', handleChange)
  }, [])

  // ── Capture the beforeinstallprompt event ─────────────────────────────────
  useEffect(() => {
    /**
     * The browser fires `beforeinstallprompt` when the PWA install criteria
     * are met (HTTPS, manifest, SW registered, user engagement heuristics).
     * We call `preventDefault()` to suppress the default mini-infobar and
     * store the event so we can trigger it on our own button click.
     */
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault() // Prevent default mini-infobar on Chrome mobile
      console.log('[InstallButton] beforeinstallprompt captured')
      setDeferredPrompt(e)
    }

    /**
     * The browser fires `appinstalled` when installation completes
     * (via any means — our button or browser UI).
     */
    const handleAppInstalled = () => {
      console.log('[InstallButton] App installed successfully')
      setIsInstalled(true)
      setDeferredPrompt(null) // Release the stored prompt reference
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    // ── Cleanup: remove listeners when the component unmounts ──────────────
    // This is critical to prevent memory leaks in a SPA environment.
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  // ── Ripple cleanup — remove expired ripples after animation ends ──────────
  useEffect(() => {
    if (ripples.length === 0) return

    const timer = setTimeout(() => {
      // Remove all ripples after the animation duration (550ms in CSS)
      setRipples([])
    }, 600)

    return () => clearTimeout(timer)
  }, [ripples])

  // ── Handle click: trigger native install prompt ───────────────────────────
  const handleInstallClick = useCallback(
    async (e) => {
      // 1. Create ripple animation at the click position
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect()
        const size = Math.max(rect.width, rect.height)
        const x = e.clientX - rect.left - size / 2
        const y = e.clientY - rect.top - size / 2

        setRipples((prev) => [
          ...prev,
          { id: Date.now(), x, y, size },
        ])
      }

      // 2. Guard: no deferred prompt available
      if (!deferredPrompt) {
        console.warn('[InstallButton] No deferred prompt available.')
        return
      }

      // 3. Show loading state while the native dialog is open
      setIsLoading(true)

      try {
        // 4. Trigger the browser's native install dialog
        await deferredPrompt.prompt()

        // 5. Await the user's choice (accepted or dismissed)
        const { outcome } = await deferredPrompt.userChoice

        if (outcome === 'accepted') {
          console.log('[InstallButton] User accepted the install prompt')
          // setIsInstalled(true) will be called via the 'appinstalled' event
        } else {
          console.log('[InstallButton] User dismissed the install prompt')
          // Keep the button visible in case they change their mind
        }
      } catch (err) {
        console.error('[InstallButton] Install prompt error:', err)
      } finally {
        // 6. Release the deferred prompt (it can only be used once)
        setDeferredPrompt(null)
        setIsLoading(false)
      }
    },
    [deferredPrompt]
  )

  // ── Render logic ──────────────────────────────────────────────────────────

  /**
   * Hide the button entirely if:
   *  - The app is already installed (isInstalled && !showing success briefly)
   *  - No install prompt is available (e.g., not on Chrome/Edge, or already installed)
   *
   * Exception: keep visible to show the installed success state.
   */
  if (!deferredPrompt && !isInstalled) {
    // Browser hasn't fired beforeinstallprompt yet (or it's not supported).
    return null
  }

  // Determine current visual state
  const buttonClass = [
    'install-btn',
    isInstalled ? 'installed' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="install-btn-wrapper" role="complementary" aria-label="Install PayFlow app">
      <button
        ref={buttonRef}
        id="pwa-install-button"
        className={buttonClass}
        onClick={handleInstallClick}
        disabled={isLoading || isInstalled}
        aria-label={isInstalled ? 'PayFlow Installed' : 'Install PayFlow as an app'}
        aria-live="polite"
        title={
          isInstalled
            ? 'PayFlow is already installed on your device'
            : 'Install PayFlow for a faster, native-like experience'
        }
      >
        {/* Ripple layers (rendered behind content via z-index in CSS) */}
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="install-btn-ripple"
            style={{
              width: ripple.size,
              height: ripple.size,
              left: ripple.x,
              top: ripple.y,
            }}
          />
        ))}

        {/* Icon: spinner while loading, check when installed, download by default */}
        <span
          className={
            isLoading
              ? 'install-btn-icon install-btn-spinner'
              : isInstalled
              ? 'install-btn-icon install-btn-check'
              : 'install-btn-icon'
          }
        >
          {isLoading ? <SpinnerIcon /> : isInstalled ? <CheckIcon /> : <DownloadIcon />}
        </span>

        {/* Label text */}
        <span className="install-btn-label">
          {isLoading
            ? 'Installing…'
            : isInstalled
            ? '✓ PayFlow Installed'
            : 'Install PayFlow'}
        </span>
      </button>
    </div>
  )
}
