import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { apiUrl } from '../api.js'

export default function QRPage() {
  const { user } = useAuth()
  const { setToast } = useOutletContext()
  const navigate = useNavigate()

  const [tab, setTab] = useState('scanner')
  const [scanResult, setScanResult] = useState(null)
  const [scanError, setScanError] = useState('')
  const [scannerActive, setScannerActive] = useState(false)
  const [myQrUrl, setMyQrUrl] = useState('')
  const [qrLoaded, setQrLoaded] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadScanning, setUploadScanning] = useState(false)

  const html5QrRef = useRef(null)
  const fileInputRef = useRef(null)

  // Load my QR URL
  useEffect(() => {
    if (user?.id) setMyQrUrl(apiUrl(`/qr/generate/${user.id}?t=${Date.now()}`))
  }, [user?.id])

  // Cleanup scanner on unmount
  useEffect(() => () => { stopScanner() }, [])

  /* ── SCANNER ── */
  const stopScanner = useCallback(async () => {
    if (html5QrRef.current) {
      try { await html5QrRef.current.stop(); html5QrRef.current.clear() } catch {}
      html5QrRef.current = null
    }
    setScannerActive(false)
  }, [])

  const startScanner = useCallback(async () => {
    setScanError(''); setScanResult(null); setScannerActive(true)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      await new Promise(res => setTimeout(res, 100))
      const qr = new Html5Qrcode('qr-reader-element')
      html5QrRef.current = qr
      await qr.start(
        { facingMode: 'environment' },
        { fps: 15, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        (text) => { handleScanSuccess(text); stopScanner() },
        () => {}
      )
    } catch (err) {
      setScannerActive(false)
      setScanError(err.toString().includes('Permission')
        ? 'Camera permission denied. Allow camera access and try again.'
        : 'Could not start camera scanner. Try again.')
    }
  }, [stopScanner])

  const handleScanSuccess = (text) => {
    try {
      const data = JSON.parse(text)
      if (data.paymentId) {
        setScanResult({ type: 'payment', data })
        setToast({ type: 'success', icon: '✅', message: `QR scanned: ${data.name || 'User #' + data.paymentId}` })
        return
      }
    } catch {}
    setScanResult({ type: 'text', data: text })
    setToast({ type: 'info', icon: '📷', message: 'QR scanned!' })
  }

  /* ── UPLOAD QR TO PAY ── */
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(''); setUploadScanning(true); setScanResult(null)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const qr = new Html5Qrcode('qr-upload-hidden')
      const result = await qr.scanFile(file, true)
      qr.clear()
      handleScanSuccess(result)
      setToast({ type: 'success', icon: '🖼️', message: 'QR image scanned successfully!' })
    } catch (err) {
      setUploadError('Could not read QR from this image. Make sure it is a valid QR code.')
      setToast({ type: 'error', icon: '❌', message: 'QR scan from image failed' })
    } finally {
      setUploadScanning(false)
      e.target.value = ''
    }
  }

  /* ── DOWNLOAD QR ── */
  const downloadQr = async () => {
    setDownloading(true)
    try {
      const res = await fetch(myQrUrl)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payflow-qr-${user?.name?.replace(/\s+/g, '-') || user?.id}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setToast({ type: 'success', icon: '⬇️', message: 'QR code downloaded!' })
    } catch {
      setToast({ type: 'error', icon: '❌', message: 'Failed to download QR' })
    } finally {
      setDownloading(false)
    }
  }

  /* ── SHARE QR ── */
  const shareQr = async () => {
    setSharing(true)
    try {
      const res = await fetch(myQrUrl)
      const blob = await res.blob()
      const file = new File([blob], `payflow-qr-${user?.name || user?.id}.png`, { type: 'image/png' })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Pay ${user?.name} on PayFlow`,
          text: `Scan this QR code to send money to ${user?.name} instantly on PayFlow!`,
          files: [file],
        })
        setToast({ type: 'success', icon: '📤', message: 'QR shared successfully!' })
      } else {
        // Fallback: copy QR URL to clipboard
        await navigator.clipboard.writeText(`PayFlow payment QR for ${user?.name} — ID #${user?.id}`)
        setToast({ type: 'info', icon: '📋', message: 'Sharing not supported. Details copied to clipboard!' })
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setToast({ type: 'error', icon: '❌', message: 'Failed to share QR' })
      }
    } finally {
      setSharing(false)
    }
  }

  const goToSend = () => {
    if (scanResult?.data?.paymentId) navigate(`/send?receiverId=${scanResult.data.paymentId}`)
  }

  /* ── RENDER ── */
  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>📷 QR Payments</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          Scan, upload or share QR codes to pay instantly
        </p>
      </div>

      {/* Tabs */}
      <div className="analytics-tabs" style={{ marginBottom: '1.5rem' }}>
        <button
          id="tab-scanner"
          className={`analytics-tab ${tab === 'scanner' ? 'active' : ''}`}
          onClick={() => { setTab('scanner'); stopScanner(); setScanResult(null); setScanError(''); setUploadError('') }}
        >📷 Scan QR</button>
        <button
          id="tab-my-qr"
          className={`analytics-tab ${tab === 'my-qr' ? 'active' : ''}`}
          onClick={() => { setTab('my-qr'); stopScanner() }}
        >🪪 My QR Code</button>
      </div>

      {/* ════════════════ SCANNER TAB ════════════════ */}
      {tab === 'scanner' && (
        <div>
          {/* Scan result banner */}
          {scanResult && (
            <div className="scan-result animate-slide-up" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#34d399', marginBottom: '0.375rem' }}>✅ QR Scanned!</div>
                  {scanResult.type === 'payment' && (
                    <>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}><strong>Name:</strong> {scanResult.data.name}</div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}><strong>User ID:</strong> #{scanResult.data.paymentId}</div>
                      {scanResult.data.email && (
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}><strong>Email:</strong> {scanResult.data.email}</div>
                      )}
                    </>
                  )}
                  {scanResult.type === 'text' && (
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>{scanResult.data}</div>
                  )}
                </div>
                <button className="btn-icon" onClick={() => setScanResult(null)} style={{ flexShrink: 0 }}>✕</button>
              </div>
              {scanResult.type === 'payment' && (
                <button id="pay-scanned-btn" className="btn-primary" onClick={goToSend} style={{ marginTop: '1rem' }}>
                  💸 Pay {scanResult.data.name}
                </button>
              )}
            </div>
          )}

          {/* Scan/upload errors */}
          {(scanError || uploadError) && (
            <div className="alert-error animate-slide-up" style={{ marginBottom: '1.25rem' }}>
              ❌ {scanError || uploadError}
            </div>
          )}

          {/* Camera scanner */}
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            {!scannerActive ? (
              <div style={{ textAlign: 'center', padding: '1.5rem' }}>
                <div style={{
                  width: '8rem', height: '8rem', margin: '0 auto 1.5rem',
                  borderRadius: '1.25rem',
                  background: 'var(--accent-glow)',
                  border: '2px solid var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '3rem',
                  boxShadow: '0 0 32px var(--accent-glow)',
                }}>📷</div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>Scan a QR Code</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                  Use your camera or upload a QR image to make a payment
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    id="start-scanner-btn"
                    className="btn-primary"
                    onClick={startScanner}
                    style={{ maxWidth: '220px' }}
                  >
                    📷 Start Camera
                  </button>
                  <button
                    id="upload-qr-btn"
                    className="btn-secondary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadScanning}
                    style={{ maxWidth: '220px' }}
                  >
                    {uploadScanning
                      ? <><span className="animate-spin">⟳</span> Scanning...</>
                      : '🖼️ Upload QR Image'
                    }
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '0.875rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  🔍 Scanning... Point camera at a QR code
                </div>
                <div id="qr-reader-element" className="qr-scanner-wrapper" />
                <div style={{ textAlign: 'center', marginTop: '1rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                  <button id="stop-scanner-btn" className="btn-secondary" onClick={stopScanner} style={{ width: 'auto', padding: '0.5rem 1.25rem' }}>
                    ⏹ Stop Camera
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => { stopScanner(); fileInputRef.current?.click() }}
                    style={{ width: 'auto', padding: '0.5rem 1.25rem' }}
                  >
                    🖼️ Upload Instead
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Hidden file input for QR upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            id="qr-file-input"
          />
          {/* Hidden element required by html5-qrcode for file scanning */}
          <div id="qr-upload-hidden" style={{ display: 'none' }} />

          {/* How-to cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem' }}>📷 Scan with Camera</h3>
              {[
                'Click "Start Camera"',
                'Allow camera access',
                'Point at their QR code',
                'Tap Pay to confirm',
              ].map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', padding: '0.3rem 0' }}>
                  <span style={{
                    width: '1.25rem', height: '1.25rem', borderRadius: '50%',
                    background: 'var(--accent-glow)', color: 'var(--accent-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.675rem', fontWeight: 700, flexShrink: 0
                  }}>{i + 1}</span>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{t}</span>
                </div>
              ))}
            </div>
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem' }}>🖼️ Upload QR Image</h3>
              {[
                'Click "Upload QR Image"',
                'Choose saved QR photo',
                'System detects the QR',
                'Tap Pay to confirm',
              ].map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', padding: '0.3rem 0' }}>
                  <span style={{
                    width: '1.25rem', height: '1.25rem', borderRadius: '50%',
                    background: 'rgba(16,185,129,0.15)', color: '#34d399',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.675rem', fontWeight: 700, flexShrink: 0
                  }}>{i + 1}</span>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════ MY QR TAB ════════════════ */}
      {tab === 'my-qr' && (
        <div>
          <div className="card" style={{ marginBottom: '1.25rem', textAlign: 'center' }}>
            {/* Header */}
            <div style={{ marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.25rem' }}>My Payment QR Code</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                Share this to receive payments from anyone
              </p>
            </div>

            {/* QR image */}
            <div style={{
              display: 'inline-flex',
              padding: '1.25rem',
              background: 'white',
              borderRadius: '1.25rem',
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              marginBottom: '1.25rem',
              position: 'relative'
            }}>
              {!qrLoaded && (
                <div className="skeleton" style={{ width: '220px', height: '220px', borderRadius: '0.5rem' }} />
              )}
              {myQrUrl && (
                <img
                  src={myQrUrl}
                  alt="My Payment QR Code"
                  width={220}
                  height={220}
                  style={{ borderRadius: '0.5rem', display: qrLoaded ? 'block' : 'none' }}
                  onLoad={() => setQrLoaded(true)}
                  onError={() => setToast({ type: 'error', message: 'Failed to load QR code' })}
                />
              )}
            </div>

            {/* User info */}
            <div style={{
              background: 'var(--bg-input)', borderRadius: '0.75rem',
              padding: '1rem', marginBottom: '1.25rem', textAlign: 'left'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <div style={{
                  width: '2.75rem', height: '2.75rem', borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--gradient-from), var(--gradient-to))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '1.125rem', color: 'white', flexShrink: 0
                }}>
                  {user?.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{user?.name}</div>
                  <div style={{ color: 'var(--text-faint)', fontSize: '0.8125rem' }}>{user?.email}</div>
                  <div style={{ color: 'var(--text-faint)', fontSize: '0.75rem' }}>User ID: #{user?.id}</div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <button
                id="download-qr-btn"
                className="btn-primary"
                onClick={downloadQr}
                disabled={downloading || !qrLoaded}
                style={{ gap: '0.5rem' }}
              >
                {downloading
                  ? <><span className="animate-spin">⟳</span> Saving...</>
                  : '⬇️ Download QR'
                }
              </button>
              <button
                id="share-qr-btn"
                className="btn-secondary"
                onClick={shareQr}
                disabled={sharing || !qrLoaded}
                style={{ gap: '0.5rem' }}
              >
                {sharing
                  ? <><span className="animate-spin">⟳</span> Sharing...</>
                  : '📤 Share QR'
                }
              </button>
            </div>

            <p style={{ color: 'var(--text-faint)', fontSize: '0.75rem', margin: 0 }}>
              Anyone can scan this QR to send you money instantly via PayFlow.
            </p>
          </div>

          {/* Tips */}
          <div className="card">
            <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.875rem' }}>💡 Tips for sharing</h3>
            {[
              { icon: '⬇️', text: 'Download and save to your phone gallery for quick access' },
              { icon: '📤', text: 'Share directly to WhatsApp, email or any messaging app' },
              { icon: '🖨️', text: 'Print and display at your shop counter to accept payments' },
              { icon: '🔒', text: 'Your QR is safe to share — it only allows people to send you money' },
            ].map(({ icon, text }) => (
              <div key={icon} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>{icon}</span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
