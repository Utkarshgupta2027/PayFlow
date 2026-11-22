import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { verifyAndStoreIncomingToken } from '../offline/offlineService.js'

function fmtCurrency(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ReceiveOffline() {
  const { user } = useAuth()
  const { setToast } = useOutletContext()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('scanner') // 'scanner' | 'paste'
  const [pasteInput, setPasteInput] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifiedToken, setVerifiedToken] = useState(null)
  const [verifyError, setVerifyError] = useState('')

  // Scanner state
  const [scannerActive, setScannerActive] = useState(false)
  const [scannerError, setScannerError] = useState('')
  const html5QrRef = useRef(null)

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      stopScanner()
    }
  }, [])

  const stopScanner = useCallback(async () => {
    if (html5QrRef.current) {
      try {
        await html5QrRef.current.stop()
        html5QrRef.current.clear()
      } catch {}
      html5QrRef.current = null
    }
    setScannerActive(false)
  }, [])

  const processPayload = async (rawPayload) => {
    setVerifying(true)
    setVerifyError('')
    try {
      const stored = await verifyAndStoreIncomingToken(rawPayload, user?.id)
      setVerifiedToken(stored)
      setToast({ type: 'success', icon: '✅', message: 'Payment verified and stored locally!' })
    } catch (err) {
      setVerifyError(err.message || 'Payment verification failed.')
      setToast({ type: 'error', icon: '❌', message: err.message || 'Verification failed.' })
    } finally {
      setVerifying(false)
    }
  }

  const startScanner = useCallback(async () => {
    setScannerError('')
    setVerifyError('')
    setScannerActive(true)

    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      await new Promise(res => setTimeout(res, 120))
      const qr = new Html5Qrcode('offline-qr-reader')
      html5QrRef.current = qr

      await qr.start(
        { facingMode: 'environment' },
        { fps: 15, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        async (decodedText) => {
          await stopScanner()
          await processPayload(decodedText)
        },
        () => {}
      )
    } catch (err) {
      setScannerActive(false)
      const errStr = err?.toString() || ''
      if (errStr.includes('Permission') || errStr.includes('NotAllowedError')) {
        setScannerError('Camera permission denied. Please allow camera access or use the Paste Code option.')
      } else {
        setScannerError('Could not start camera scanner. Try switching to Paste Code.')
      }
    }
  }, [stopScanner, user?.id])

  const handlePasteSubmit = async (e) => {
    e.preventDefault()
    if (!pasteInput.trim()) {
      setToast({ type: 'error', icon: '⚠️', message: 'Paste a valid payment token code.' })
      return
    }
    await processPayload(pasteInput)
  }

  const resetScanner = () => {
    setVerifiedToken(null)
    setVerifyError('')
    setPasteInput('')
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
        <div style={{
          width: '3.5rem', height: '3.5rem', borderRadius: '50%',
          background: 'linear-gradient(135deg, #10b981, #059669)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.75rem', margin: '0 auto 0.75rem',
          boxShadow: '0 8px 24px rgba(16,185,129,0.35)'
        }}>
          📥
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
          Receive Offline
        </h1>
        <p style={{ color: 'var(--text-muted)', margin: '0.375rem 0 0', fontSize: '0.875rem' }}>
          Scan a payment QR code from the sender. All cryptographic signatures are verified on this device.
        </p>
      </div>

      {/* Recipient User ID Badge */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
        padding: '0.625rem 1rem', background: 'var(--bg-input)', borderRadius: '0.75rem',
        marginBottom: '1.5rem', border: '1px solid var(--border-color)', fontSize: '0.875rem'
      }}>
        <span style={{ color: 'var(--text-muted)' }}>Your Recipient User ID:</span>
        <strong style={{ color: 'var(--accent)', fontSize: '1rem' }}>#{user?.id}</strong>
      </div>

      {/* Success Receipt Screen */}
      {verifiedToken ? (
        <div className="card animate-fade-in" style={{ padding: '2rem', borderRadius: '1rem', textAlign: 'center' }}>
          <div style={{
            width: '4rem', height: '4rem', borderRadius: '50%',
            background: 'rgba(16,185,129,0.15)', color: '#10b981',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2rem', margin: '0 auto 1rem'
          }}>
            ✓
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Payment Received!
          </h2>
          <div style={{ marginTop: '0.5rem' }}>
            <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
              PENDING SETTLEMENT
            </span>
          </div>

          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#10b981', margin: '1rem 0' }}>
            {fmtCurrency(verifiedToken.amount)}
          </div>

          <div style={{
            background: 'var(--bg-input)', padding: '1.25rem', borderRadius: '0.75rem',
            textAlign: 'left', fontSize: '0.8125rem', margin: '1.25rem 0 1.5rem',
            display: 'flex', flexDirection: 'column', gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-faint)' }}>Sender User ID:</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>User #{verifiedToken.senderId}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-faint)' }}>Token ID:</span>
              <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                {verifiedToken.tokenId?.substring(0, 18)}…
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-faint)' }}>Counter:</span>
              <span style={{ color: 'var(--text-primary)' }}>#{verifiedToken.counter}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-faint)' }}>Certificate ID:</span>
              <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                {verifiedToken.certId?.substring(0, 16)}…
              </span>
            </div>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: '0 auto 1.5rem', maxWidth: '420px' }}>
            🔒 <strong>Cryptographic verification passed.</strong> This payment is saved in local IndexedDB. It will automatically settle to your wallet balance once either device is online.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={resetScanner}
              style={{
                flex: 1, padding: '0.75rem', fontSize: '0.875rem', fontWeight: 600,
                background: 'var(--bg-input)', color: 'var(--text-primary)',
                border: '1px solid var(--border-color)', borderRadius: '0.75rem', cursor: 'pointer'
              }}
            >
              Scan Another
            </button>
            <button
              onClick={() => navigate('/offline-wallet')}
              className="btn-primary"
              style={{ flex: 1, padding: '0.75rem', fontSize: '0.875rem' }}
            >
              View in Offline Wallet
            </button>
          </div>
        </div>
      ) : (
        /* Scanner / Paste Card */
        <div className="card" style={{ padding: '1.5rem', borderRadius: '1rem' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', gap: '1rem' }}>
            <button
              onClick={() => { setActiveTab('scanner'); stopScanner() }}
              style={{
                background: 'none', border: 'none', padding: '0.5rem 0.25rem 0.75rem',
                fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer',
                color: activeTab === 'scanner' ? 'var(--accent)' : 'var(--text-faint)',
                borderBottom: activeTab === 'scanner' ? '2px solid var(--accent)' : '2px solid transparent'
              }}
            >
              📷 Camera Scanner
            </button>
            <button
              onClick={() => { setActiveTab('paste'); stopScanner() }}
              style={{
                background: 'none', border: 'none', padding: '0.5rem 0.25rem 0.75rem',
                fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer',
                color: activeTab === 'paste' ? 'var(--accent)' : 'var(--text-faint)',
                borderBottom: activeTab === 'paste' ? '2px solid var(--accent)' : '2px solid transparent'
              }}
            >
              📋 Paste Payment Code
            </button>
          </div>

          {/* Verification Error Notice */}
          {verifyError && (
            <div style={{
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '0.75rem', padding: '1rem', color: '#ef4444',
              fontSize: '0.875rem', marginBottom: '1.25rem', display: 'flex', gap: '0.5rem'
            }}>
              <span>❌</span>
              <div>
                <strong>Verification Failed:</strong> {verifyError}
              </div>
            </div>
          )}

          {/* Tab 1: Scanner */}
          {activeTab === 'scanner' && (
            <div>
              {scannerError && (
                <div style={{
                  background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '0.75rem', padding: '0.875rem', color: '#ef4444',
                  fontSize: '0.8125rem', marginBottom: '1rem'
                }}>
                  ⚠️ {scannerError}
                </div>
              )}

              {/* Viewport for html5-qrcode */}
              <div
                id="offline-qr-reader"
                style={{
                  width: '100%', maxWidth: '360px', margin: '0 auto',
                  borderRadius: '0.75rem', overflow: 'hidden', minHeight: scannerActive ? '260px' : '0'
                }}
              />

              {!scannerActive ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                  <button
                    onClick={startScanner}
                    className="btn-primary"
                    style={{ padding: '0.75rem 1.5rem', fontSize: '0.9375rem' }}
                  >
                    📷 Start QR Camera Scanner
                  </button>
                  <p style={{ color: 'var(--text-faint)', fontSize: '0.75rem', marginTop: '0.75rem' }}>
                    Point camera at sender's offline payment QR code.
                  </p>
                </div>
              ) : (
                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                  <button
                    onClick={stopScanner}
                    style={{
                      padding: '0.5rem 1.25rem', fontSize: '0.8125rem', fontWeight: 600,
                      background: 'var(--bg-input)', color: 'var(--text-muted)',
                      border: '1px solid var(--border-color)', borderRadius: '0.5rem', cursor: 'pointer'
                    }}
                  >
                    ⏹ Stop Scanner
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Paste Code */}
          {activeTab === 'paste' && (
            <form onSubmit={handlePasteSubmit}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                Paste Raw Payment JSON
              </label>
              <textarea
                rows={6}
                placeholder='{"token":{"tokenId":"...","amount":100},"certificate":{...}}'
                value={pasteInput}
                onChange={e => setPasteInput(e.target.value)}
                style={{
                  width: '100%', padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.8125rem',
                  background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                  borderRadius: '0.75rem', color: 'var(--text-primary)', marginBottom: '1.25rem'
                }}
              />
              <button
                type="submit"
                disabled={verifying}
                className="btn-primary"
                style={{ width: '100%', padding: '0.75rem', fontSize: '0.9375rem' }}
              >
                {verifying ? 'Verifying Signatures…' : '✓ Verify & Accept Offline Payment'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

