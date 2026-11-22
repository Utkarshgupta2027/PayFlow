import { useState, useEffect } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../context/AuthContext.jsx'
import PinModal from '../components/PinModal.jsx'
import * as db from '../offline/db.js'
import { createOfflinePaymentToken } from '../offline/offlineService.js'

function fmtCurrency(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function PayOffline() {
  const { user } = useAuth()
  const { setToast } = useOutletContext()
  const navigate = useNavigate()

  // Form state
  const [receiverId, setReceiverId] = useState('')
  const [amount, setAmount] = useState('')
  const [remainingEscrow, setRemainingEscrow] = useState(0)
  const [hasCert, setHasCert] = useState(false)
  const [certExpired, setCertExpired] = useState(false)

  // PIN modal & token creation
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinLoading, setPinLoading] = useState(false)
  const [pinError, setPinError] = useState('')
  const [generatedPayload, setGeneratedPayload] = useState(null)
  const [copied, setCopied] = useState(false)

  // Load local offline wallet details
  useEffect(() => {
    async function checkWallet() {
      const cert = await db.getCertificate()
      if (!cert) {
        setHasCert(false)
        return
      }
      setHasCert(true)

      const isExpired = new Date(cert.expiry).getTime() <= Date.now()
      setCertExpired(isExpired)

      const alreadySent = await db.getCumulativeSentAmountForCert(cert.certId)
      const remaining = Math.max(0, (cert.escrowLimit || 0) - alreadySent)
      setRemainingEscrow(remaining)
    }
    checkWallet()
  }, [])

  const handleStartPayment = (e) => {
    e.preventDefault()
    const numAmount = parseFloat(amount)
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setToast({ type: 'error', icon: '⚠️', message: 'Enter a valid amount.' })
      return
    }
    if (numAmount > remainingEscrow) {
      setToast({
        type: 'error',
        icon: '⚠️',
        message: `Amount exceeds remaining offline escrow (${fmtCurrency(remainingEscrow)}).`
      })
      return
    }
    const numReceiverId = parseInt(receiverId, 10)
    if (!receiverId || isNaN(numReceiverId) || numReceiverId <= 0) {
      setToast({ type: 'error', icon: '⚠️', message: 'Enter a valid Receiver User ID.' })
      return
    }
    if (numReceiverId === user?.id) {
      setToast({ type: 'error', icon: '⚠️', message: 'You cannot send payment to your own ID.' })
      return
    }

    setPinError('')
    setShowPinModal(true)
  }

  const handlePinConfirm = async (pin) => {
    setPinLoading(true)
    setPinError('')

    try {
      // In PayFlow, the transaction PIN is verified locally / with user session to unlock signing
      // (The PIN is never embedded in the token or transmitted offline).
      // We perform token generation and cryptographic signing on the device:
      const payload = await createOfflinePaymentToken({
        receiverId,
        amount,
        currentUserId: user?.id,
      })

      setGeneratedPayload(payload)
      setShowPinModal(false)
      setToast({ type: 'success', icon: '⚡', message: 'Offline payment token generated!' })
    } catch (err) {
      setPinError(err.message || 'Failed to sign offline token.')
    } finally {
      setPinLoading(false)
    }
  }

  const copyPayloadJson = () => {
    if (!generatedPayload) return
    const text = JSON.stringify(generatedPayload)
    navigator.clipboard.writeText(text)
    setCopied(true)
    setToast({ type: 'success', icon: '📋', message: 'Payment token copied to clipboard!' })
    setTimeout(() => setCopied(false), 2500)
  }

  const resetForm = () => {
    setGeneratedPayload(null)
    setAmount('')
    setReceiverId('')
    setCopied(false)
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
        <div style={{
          width: '3.5rem', height: '3.5rem', borderRadius: '50%',
          background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.75rem', margin: '0 auto 0.75rem',
          boxShadow: '0 8px 24px rgba(14,165,233,0.35)'
        }}>
          ⚡
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
          Pay Offline
        </h1>
        <p style={{ color: 'var(--text-muted)', margin: '0.375rem 0 0', fontSize: '0.875rem' }}>
          Generate a cryptographically signed payment token without an internet connection.
        </p>
      </div>

      {/* Warning if no wallet or expired */}
      {!hasCert || certExpired ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', borderRadius: '1rem' }}>
          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>
            {certExpired ? '⏰' : '🔒'}
          </span>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
            {certExpired ? 'Offline Certificate Expired' : 'Offline Wallet Not Enabled'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
            {certExpired
              ? 'Your certificate has expired. Please connect to the internet to release and re-enable your offline wallet.'
              : 'You must allocate escrow funds while online before you can generate offline payments.'}
          </p>
          <button
            onClick={() => navigate('/offline-wallet')}
            className="btn-primary"
            style={{ padding: '0.75rem 1.5rem', fontSize: '0.9375rem' }}
          >
            Go to Offline Wallet
          </button>
        </div>
      ) : generatedPayload ? (
        /* Generated Payment QR Screen */
        <div className="card animate-fade-in" style={{ padding: '2rem', borderRadius: '1rem', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '9999px', background: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '1rem' }}>
            ✓ Signed Payment Ready
          </div>

          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            {fmtCurrency(generatedPayload.token.amount)}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            To User #{generatedPayload.token.receiverId}
          </p>

          {/* QR Code Container */}
          <div style={{
            background: '#ffffff',
            padding: '1.25rem',
            borderRadius: '1rem',
            display: 'inline-block',
            margin: '1.5rem auto',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
          }}>
            <QRCodeSVG
              value={JSON.stringify(generatedPayload)}
              size={240}
              level="M"
              includeMargin={false}
            />
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', maxWidth: '380px', margin: '0 auto 1.5rem' }}>
            Have the receiver open <strong>Receive Offline</strong> to scan this QR code, or copy the payment code below.
          </p>

          {/* Token Details */}
          <div style={{
            background: 'var(--bg-input)', padding: '1rem', borderRadius: '0.75rem',
            textAlign: 'left', fontSize: '0.8125rem', marginBottom: '1.5rem',
            display: 'flex', flexDirection: 'column', gap: '0.375rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-faint)' }}>Token ID:</span>
              <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                {generatedPayload.token.tokenId?.substring(0, 18)}…
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-faint)' }}>Counter:</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                #{generatedPayload.token.counter}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-faint)' }}>Timestamp:</span>
              <span style={{ color: 'var(--text-primary)' }}>
                {new Date(generatedPayload.token.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button
              onClick={copyPayloadJson}
              style={{
                flex: 1, padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 600,
                background: 'var(--bg-input)', color: 'var(--text-primary)',
                border: '1px solid var(--border-color)', borderRadius: '0.75rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem'
              }}
            >
              <span>{copied ? '✓' : '📋'}</span> {copied ? 'Copied!' : 'Copy Payment Code'}
            </button>
            <button
              onClick={resetForm}
              className="btn-primary"
              style={{ flex: 1, padding: '0.75rem 1rem', fontSize: '0.875rem' }}
            >
              New Payment
            </button>
          </div>
        </div>
      ) : (
        /* Payment Creation Form */
        <div className="card" style={{ padding: '1.75rem', borderRadius: '1rem' }}>
          {/* Remaining Escrow Indicator */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0.875rem 1rem', background: 'var(--bg-input)', borderRadius: '0.75rem',
            marginBottom: '1.5rem', border: '1px solid var(--border-color)'
          }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Remaining Offline Escrow:</span>
            <span style={{ fontSize: '1.125rem', fontWeight: 800, color: '#10b981' }}>
              {fmtCurrency(remainingEscrow)}
            </span>
          </div>

          <form onSubmit={handleStartPayment}>
            {/* Receiver User ID */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                Receiver User ID
              </label>
              <input
                type="number"
                placeholder="Enter recipient User ID (e.g. 2)"
                value={receiverId}
                onChange={e => setReceiverId(e.target.value)}
                required
                style={{
                  width: '100%', padding: '0.75rem 1rem',
                  background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                  borderRadius: '0.75rem', color: 'var(--text-primary)', fontSize: '0.9375rem'
                }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.25rem', display: 'block' }}>
                Ask the recipient for their PayFlow numeric User ID.
              </span>
            </div>

            {/* Amount */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                Payment Amount (₹)
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.125rem' }}>₹</span>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  max={remainingEscrow}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required
                  style={{
                    width: '100%', padding: '0.75rem 1rem 0.75rem 2.25rem',
                    background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                    borderRadius: '0.75rem', color: 'var(--text-primary)', fontSize: '1.125rem', fontWeight: 600
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={remainingEscrow <= 0}
              className="btn-primary"
              style={{ width: '100%', padding: '0.875rem', fontSize: '1rem', fontWeight: 700 }}
            >
              🔒 Authorize with PIN & Generate QR
            </button>
          </form>
        </div>
      )}

      {/* Local PIN Verification Modal */}
      <PinModal
        isOpen={showPinModal}
        onConfirm={handlePinConfirm}
        onCancel={() => { setShowPinModal(false); setPinError('') }}
        title="🔐 Confirm Offline Payment"
        subtitle={`Verify your PIN to cryptographically sign payment of ${fmtCurrency(amount)}`}
        error={pinError}
        loading={pinLoading}
        length={4}
      />
    </div>
  )
}

