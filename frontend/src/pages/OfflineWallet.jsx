import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import PinModal from '../components/PinModal.jsx'
import useOnlineStatus from '../offline/useOnlineStatus.js'
import * as db from '../offline/db.js'
import {
  enableOfflineWallet,
  topUpOfflineWallet,
  releaseOfflineWallet,
  revokeOfflineWallet,
  refreshOfflineStatus,
  syncPendingTokens,
} from '../offline/offlineService.js'

function fmtCurrency(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function OfflineWallet() {
  const { user } = useAuth()
  const { setToast } = useOutletContext()
  const navigate = useNavigate()
  const { isOnline, isSyncing, triggerSync } = useOnlineStatus()

  // State
  const [loading, setLoading] = useState(true)
  const [statusData, setStatusData] = useState(null)
  const [localCert, setLocalCert] = useState(null)
  const [pendingTokens, setPendingTokens] = useState([])
  const [sentTokens, setSentTokens] = useState([])
  const [activeTab, setActiveTab] = useState('received') // 'received' | 'sent'

  // Action modals & inputs
  const [actionType, setActionType] = useState(null) // 'enable' | 'topup' | 'release' | 'revoke'
  const [amountInput, setAmountInput] = useState('')
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinLoading, setPinLoading] = useState(false)
  const [pinError, setPinError] = useState('')

  // Load status and local DB data
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Load from IndexedDB first (works offline)
      const cert = await db.getCertificate()
      setLocalCert(cert)

      const received = await db.getPendingTokens()
      setPendingTokens(received ? received.reverse() : [])

      const sent = await db.getSentTokens()
      setSentTokens(sent || [])

      // 2. If online, fetch live server status
      if (navigator.onLine) {
        const serverStatus = await refreshOfflineStatus()
        setStatusData(serverStatus)
        if (serverStatus?.certificate) {
          setLocalCert(serverStatus.certificate)
        }
      }
    } catch (err) {
      console.warn('[OfflineWallet] Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()

    const handleSyncEvent = () => loadData()
    window.addEventListener('offline-sync-completed', handleSyncEvent)
    return () => window.removeEventListener('offline-sync-completed', handleSyncEvent)
  }, [loadData])

  // Derive active status
  const isActive = Boolean(
    (statusData?.active || localCert) &&
    localCert?.expiry &&
    new Date(localCert.expiry).getTime() > Date.now()
  )

  const isExpired = Boolean(
    localCert?.expiry && new Date(localCert.expiry).getTime() <= Date.now()
  )

  // Escrow calculations
  const escrowTotal = statusData?.wallet?.escrowAmount || localCert?.escrowLimit || 0
  const spentAmount = statusData?.wallet?.spentAmount || 0
  const remainingAmount = isActive
    ? (statusData?.remainingEscrow ?? Math.max(0, escrowTotal - spentAmount))
    : 0

  // ── Action Handlers ──

  const handleOpenEnable = () => {
    const amt = parseFloat(amountInput)
    if (!amountInput || isNaN(amt) || amt <= 0) {
      setToast({ type: 'error', icon: '⚠️', message: 'Enter a valid amount to allocate to escrow.' })
      return
    }
    if (amt > (statusData?.config?.maxEscrow || 2000)) {
      setToast({ type: 'error', icon: '⚠️', message: `Maximum allowed escrow is ₹${statusData?.config?.maxEscrow || 2000}.` })
      return
    }
    if (user?.balance < amt) {
      setToast({ type: 'error', icon: '⚠️', message: 'Insufficient main balance.' })
      return
    }
    setActionType('enable')
    setPinError('')
    setShowPinModal(true)
  }

  const handleOpenTopUp = () => {
    const amt = parseFloat(amountInput)
    if (!amountInput || isNaN(amt) || amt <= 0) {
      setToast({ type: 'error', icon: '⚠️', message: 'Enter a valid top-up amount.' })
      return
    }
    const maxEscrow = statusData?.config?.maxEscrow || 2000
    if (remainingAmount + amt > maxEscrow) {
      setToast({ type: 'error', icon: '⚠️', message: `Total escrow cannot exceed ₹${maxEscrow}.` })
      return
    }
    if (user?.balance < amt) {
      setToast({ type: 'error', icon: '⚠️', message: 'Insufficient main balance.' })
      return
    }
    setActionType('topup')
    setPinError('')
    setShowPinModal(true)
  }

  const handleOpenRelease = () => {
    if (remainingAmount <= 0) {
      setToast({ type: 'info', icon: 'ℹ️', message: 'No unspent escrow balance to release.' })
      return
    }
    setActionType('release')
    setPinError('')
    setShowPinModal(true)
  }

  const handleOpenRevoke = () => {
    if (!window.confirm('Revoke this offline wallet? Any remaining escrow will be returned to your main balance, and offline payments will be deactivated.')) {
      return
    }
    executeRevoke()
  }

  const executeRevoke = async () => {
    try {
      setLoading(true)
      const res = await revokeOfflineWallet(user?.id)
      setToast({ type: 'success', icon: '🔒', message: res.message || 'Offline wallet revoked.' })
      setAmountInput('')
      await loadData()
    } catch (err) {
      setToast({ type: 'error', icon: '❌', message: err.message })
    } finally {
      setLoading(false)
    }
  }

  const handlePinConfirm = async (pin) => {
    setPinLoading(true)
    setPinError('')

    try {
      if (actionType === 'enable') {
        const res = await enableOfflineWallet(parseFloat(amountInput), pin)
        setToast({ type: 'success', icon: '✅', message: 'Offline payments activated!' })
        setShowPinModal(false)
        setAmountInput('')
        await loadData()
      } else if (actionType === 'topup') {
        const res = await topUpOfflineWallet(parseFloat(amountInput), pin)
        setToast({ type: 'success', icon: '⬆️', message: 'Escrow topped up successfully!' })
        setShowPinModal(false)
        setAmountInput('')
        await loadData()
      } else if (actionType === 'release') {
        const res = await releaseOfflineWallet(pin)
        setToast({ type: 'success', icon: '🔓', message: `Released ${fmtCurrency(res.releasedAmount)} to main balance!` })
        setShowPinModal(false)
        await loadData()
      }
    } catch (err) {
      setPinError(err.message || 'Action failed. Please check your PIN.')
    } finally {
      setPinLoading(false)
    }
  }

  const handleManualSync = async () => {
    try {
      setToast({ type: 'info', icon: '🔄', message: 'Syncing offline payments with server…' })
      const res = await triggerSync()
      if (res) {
        setToast({
          type: res.settledCount > 0 ? 'success' : 'info',
          icon: '✅',
          message: `Sync complete: ${res.settledCount} settled, ${res.rejectedCount} rejected, ${res.duplicateCount} duplicate.`
        })
      }
      await loadData()
    } catch (err) {
      setToast({ type: 'error', icon: '❌', message: err.message || 'Sync failed.' })
    }
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            🔒 Offline Payments
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.375rem 0 0', fontSize: '0.9375rem' }}>
            Send and receive money seamlessly even without internet access.
          </p>
        </div>

        {/* Sync Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={handleManualSync}
            disabled={!isOnline || isSyncing}
            className="btn-primary"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.625rem 1rem', fontSize: '0.875rem',
              background: !isOnline ? 'var(--bg-input)' : undefined,
              color: !isOnline ? 'var(--text-faint)' : undefined,
              border: !isOnline ? '1px solid var(--border-color)' : undefined
            }}
          >
            {isSyncing ? '⟳ Syncing…' : '🔄 Sync Offline Tokens'}
          </button>
        </div>
      </div>

      {/* Status Hero Card */}
      <div className="card" style={{
        background: isActive
          ? 'linear-gradient(135deg, rgba(14,165,233,0.12), rgba(16,185,129,0.08))'
          : 'var(--bg-card)',
        border: isActive ? '1px solid rgba(14,165,233,0.3)' : '1px solid var(--border-color)',
        padding: '1.5rem',
        borderRadius: '1rem',
        marginBottom: '1.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <span style={{ fontSize: '1.5rem' }}>
                {isActive ? '🟢' : isExpired ? '⏰' : '⚪'}
              </span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Offline Wallet Status
              </h2>
              <span className={`badge ${isActive ? 'badge-success' : isExpired ? 'badge-danger' : 'badge-info'}`}>
                {isActive ? 'ACTIVE' : isExpired ? 'EXPIRED' : (statusData?.wallet?.status || 'NOT ENABLED')}
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.5rem 0 0' }}>
              {isActive
                ? `Certificate ID: ${localCert?.certId?.substring(0, 16)}… • Valid until ${new Date(localCert?.expiry).toLocaleDateString()}`
                : isExpired
                ? 'Your certificate has expired. Unused escrow has been refunded. Please re-enable to use offline mode.'
                : 'Enable offline mode online by allocating escrow funds. Your device signs transactions cryptographically without internet.'
              }
            </p>
          </div>

          {/* Quick Pay / Receive Buttons */}
          <div style={{ display: 'flex', gap: '0.625rem' }}>
            <button
              onClick={() => navigate('/pay-offline')}
              disabled={!isActive || remainingAmount <= 0}
              className="btn-primary"
              style={{ padding: '0.625rem 1.25rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
            >
              <span>⚡</span> Pay Offline
            </button>
            <button
              onClick={() => navigate('/receive-offline')}
              style={{
                padding: '0.625rem 1.25rem', fontSize: '0.875rem', fontWeight: 600,
                background: 'var(--bg-input)', color: 'var(--text-primary)',
                border: '1px solid var(--border-color)', borderRadius: '0.75rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem'
              }}
            >
              <span>📥</span> Receive Offline
            </button>
          </div>
        </div>

        {/* Escrow Balance Metrics */}
        {isActive && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem', marginTop: '1.5rem', paddingTop: '1.25rem',
            borderTop: '1px solid var(--border-color)'
          }}>
            <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', textTransform: 'uppercase', fontWeight: 600 }}>
                Remaining Escrow
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>
                {fmtCurrency(remainingAmount)}
              </div>
            </div>

            <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', textTransform: 'uppercase', fontWeight: 600 }}>
                Total Allocated Escrow
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                {fmtCurrency(escrowTotal)}
              </div>
            </div>

            <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', textTransform: 'uppercase', fontWeight: 600 }}>
                Spent Amount
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {fmtCurrency(spentAmount)}
              </div>
            </div>

            <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', textTransform: 'uppercase', fontWeight: 600 }}>
                Certificate Expiry
              </div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.375rem' }}>
                {localCert?.expiry ? new Date(localCert.expiry).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Interactive Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Left Column: Escrow Management */}
        <div className="card" style={{ padding: '1.5rem', borderRadius: '1rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 1rem', color: 'var(--text-primary)' }}>
            ⚙️ Escrow Management
          </h3>

          {!isActive ? (
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                Allocate funds from your main wallet into offline escrow. When you go offline, you can spend up to this amount without network connectivity.
              </p>

              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                Allocation Amount (₹) • Max ₹{statusData?.config?.maxEscrow || 2000}
              </label>
              <div style={{ position: 'relative', marginBottom: '1rem' }}>
                <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>₹</span>
                <input
                  type="number"
                  placeholder="e.g. 500"
                  value={amountInput}
                  onChange={e => setAmountInput(e.target.value)}
                  style={{
                    width: '100%', padding: '0.75rem 0.875rem 0.75rem 2rem',
                    background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                    borderRadius: '0.75rem', color: 'var(--text-primary)', fontSize: '1rem'
                  }}
                />
              </div>

              <button
                type="button"
                onClick={handleOpenEnable}
                disabled={!isOnline || loading}
                className="btn-primary"
                style={{ width: '100%', padding: '0.75rem' }}
              >
                {!isOnline ? 'Connect Online to Enable' : 'Enable Offline Wallet'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Top Up Section */}
              <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.375rem' }}>
                  Top Up Escrow (₹)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="number"
                    placeholder="Amount (e.g. 200)"
                    value={amountInput}
                    onChange={e => setAmountInput(e.target.value)}
                    style={{
                      flex: 1, padding: '0.625rem 0.75rem',
                      background: 'var(--bg-base)', border: '1px solid var(--border-color)',
                      borderRadius: '0.5rem', color: 'var(--text-primary)', fontSize: '0.9375rem'
                    }}
                  />
                  <button
                    onClick={handleOpenTopUp}
                    disabled={!isOnline}
                    className="btn-primary"
                    style={{ padding: '0.625rem 1rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}
                  >
                    Top Up
                  </button>
                </div>
              </div>

              {/* Release Escrow Section */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem', background: 'var(--bg-input)', borderRadius: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Release Unspent Escrow
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                    Return {fmtCurrency(remainingAmount)} back to main wallet
                  </div>
                </div>
                <button
                  onClick={handleOpenRelease}
                  disabled={!isOnline || remainingAmount <= 0}
                  style={{
                    padding: '0.5rem 0.875rem', fontSize: '0.8125rem', fontWeight: 600,
                    background: 'transparent', color: '#10b981',
                    border: '1px solid #10b981', borderRadius: '0.5rem', cursor: 'pointer'
                  }}
                >
                  Release Funds
                </button>
              </div>

              {/* Revoke / Lost Device */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem', background: 'var(--bg-input)', borderRadius: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Lost Device / Revoke
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                    Invalidate offline keys and refund escrow
                  </div>
                </div>
                <button
                  onClick={handleOpenRevoke}
                  disabled={!isOnline}
                  style={{
                    padding: '0.5rem 0.875rem', fontSize: '0.8125rem', fontWeight: 600,
                    background: 'transparent', color: '#ef4444',
                    border: '1px solid #ef4444', borderRadius: '0.5rem', cursor: 'pointer'
                  }}
                >
                  Revoke
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Security & How It Works */}
        <div className="card" style={{ padding: '1.5rem', borderRadius: '1rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 1rem', color: 'var(--text-primary)' }}>
            🛡️ How Offline Payments Work
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem' }}>1️⃣</span>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Device Key Security</strong>:
                An ECDSA P-256 private key is generated directly on this device. It is non-extractable and never leaves your browser storage.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem' }}>2️⃣</span>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Server Escrow Certificate</strong>:
                The server locks your chosen limit into escrow and signs a cryptographic certificate guaranteeing your funds.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem' }}>3️⃣</span>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Offline QR Exchange</strong>:
                Your PIN unlocks offline token signing. The receiver's camera scans the QR and verifies all cryptographic signatures locally without internet.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem' }}>4️⃣</span>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>Automatic Settlement</strong>:
                When either device connects online, received payment tokens sync automatically with the server.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Received Tokens vs Sent Tokens */}
      <div className="card" style={{ padding: '1.5rem', borderRadius: '1rem' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.25rem', gap: '1rem' }}>
          <button
            onClick={() => setActiveTab('received')}
            style={{
              background: 'none', border: 'none', padding: '0.5rem 0.25rem 0.75rem',
              fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer',
              color: activeTab === 'received' ? 'var(--accent)' : 'var(--text-faint)',
              borderBottom: activeTab === 'received' ? '2px solid var(--accent)' : '2px solid transparent'
            }}
          >
            📥 Received Offline Payments ({pendingTokens.length})
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            style={{
              background: 'none', border: 'none', padding: '0.5rem 0.25rem 0.75rem',
              fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer',
              color: activeTab === 'sent' ? 'var(--accent)' : 'var(--text-faint)',
              borderBottom: activeTab === 'sent' ? '2px solid var(--accent)' : '2px solid transparent'
            }}
          >
            📤 Outbound Sent Payments ({sentTokens.length})
          </button>
        </div>

        {/* Tab 1: Received */}
        {activeTab === 'received' && (
          <div>
            {pendingTokens.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-faint)' }}>
                <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>📭</span>
                No offline payments received yet. Tap "Receive Offline" to scan a QR code from another device.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {pendingTokens.map(tok => {
                  const statusClass = {
                    SETTLED: 'badge-success',
                    REJECTED: 'badge-danger',
                    PENDING_SETTLEMENT: 'badge-info',
                  }[tok.status] || 'badge-info'

                  return (
                    <div
                      key={tok.tokenId}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
                        padding: '1rem', background: 'var(--bg-input)', borderRadius: '0.75rem', gap: '0.75rem'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.0625rem' }}>
                            {fmtCurrency(tok.amount)}
                          </span>
                          <span className={`badge ${statusClass}`} style={{ fontSize: '0.7rem' }}>
                            {tok.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.25rem' }}>
                          From: User #{tok.senderId} • Counter: #{tok.counter} • Token ID: {tok.tokenId?.substring(0, 16)}…
                        </div>
                        {tok.rejectReason && (
                          <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.25rem' }}>
                            ⚠️ Reason: {tok.rejectReason}
                          </div>
                        )}
                      </div>

                      <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                        {tok.receivedAt ? new Date(tok.receivedAt).toLocaleString() : ''}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Sent */}
        {activeTab === 'sent' && (
          <div>
            {sentTokens.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-faint)' }}>
                <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>📤</span>
                No offline payments sent from this device yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {sentTokens.map(tok => (
                  <div
                    key={tok.tokenId}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
                      padding: '1rem', background: 'var(--bg-input)', borderRadius: '0.75rem', gap: '0.75rem'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.0625rem' }}>
                          {fmtCurrency(tok.amount)}
                        </span>
                        <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                          SENT OFFLINE
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.25rem' }}>
                        To: User #{tok.receiverId} • Counter: #{tok.counter} • Token: {tok.tokenId?.substring(0, 16)}…
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                      {tok.createdAt ? new Date(tok.createdAt).toLocaleString() : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transaction PIN Modal */}
      <PinModal
        isOpen={showPinModal}
        onConfirm={handlePinConfirm}
        onCancel={() => { setShowPinModal(false); setPinError('') }}
        title={
          actionType === 'enable' ? '🔐 Confirm Offline Allocation'
          : actionType === 'topup' ? '🔐 Confirm Escrow Top-Up'
          : '🔐 Confirm Escrow Release'
        }
        subtitle={
          actionType === 'enable' ? `Authorize allocation of ${fmtCurrency(amountInput)} to offline escrow`
          : actionType === 'topup' ? `Authorize top-up of ${fmtCurrency(amountInput)}`
          : `Authorize refund of ${fmtCurrency(remainingAmount)} to your main wallet`
        }
        error={pinError}
        loading={pinLoading}
        length={4}
      />
    </div>
  )
}

