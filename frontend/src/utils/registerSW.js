/**
 * PayFlow Service Worker Registration
 * ───────────────────────────────────────────────────────────────────────────
 * Registers the Service Worker (sw.js) and sets up an update-check mechanism.
 *
 * This module is imported once in main.jsx so it runs on every app boot.
 * It performs the registration only in production-like environments where
 * the SW can legally run (HTTPS or localhost).
 *
 * Security note: SW registration is skipped entirely in HTTP contexts
 * to prevent potential man-in-the-middle interception of the SW script.
 */

/**
 * registerServiceWorker
 * Registers /sw.js and attaches lifecycle event listeners for updates.
 */
export function registerServiceWorker() {
  // Service Workers require HTTPS (or localhost for dev testing).
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator)
  ) {
    console.info('[SW Registration] Service Workers are not supported in this browser.');
    return;
  }

  // Only register on secure contexts (HTTPS or localhost).
  const isSecure =
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  if (!isSecure) {
    console.warn('[SW Registration] Skipped — HTTPS is required for Service Workers in production.');
    return;
  }

  // Defer registration until after the page has fully loaded
  // to avoid competing with critical page resources.
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', {
        // The scope '/' means the SW controls all pages under the domain root.
        scope: '/',
      })
      .then((registration) => {
        console.log('[SW Registration] Registered successfully. Scope:', registration.scope);

        // ── Check for updates every time the page is focused ──────────────
        registration.update();

        // ── Listen for new SW waiting to activate ─────────────────────────
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // A new version is available; optionally notify the user.
              console.log('[SW Registration] New version available. Reload to update.');
              // You could dispatch a custom event here to show a banner:
              // window.dispatchEvent(new CustomEvent('sw-update-available'));
            }
          });
        });
      })
      .catch((error) => {
        // Non-fatal: the app continues to work normally without SW.
        console.error('[SW Registration] Registration failed:', error);
      });

    // ── Handle controller change (SW activated after update) ──────────────
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[SW Registration] Controller changed — new SW is now active.');
    });
  });
}

/**
 * unregisterServiceWorker
 * Unregisters all active Service Workers.
 * Useful for debugging or if you need to fully disable the PWA behaviour.
 */
export async function unregisterServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((reg) => reg.unregister()));
    console.log('[SW Registration] All Service Workers unregistered.');
  } catch (error) {
    console.error('[SW Registration] Unregister failed:', error);
  }
}
