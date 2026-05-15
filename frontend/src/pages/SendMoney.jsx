import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../api.js'
import API_BASE from '../api.js'
import PinModal from '../components/PinModal.jsx'
import UserAvatar from '../components/UserAvatar.jsx'

function fmtCurrency(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

function RiskIndicator({ risk }) {
  if (!risk) return null
  const levelClass = { LOW: 'risk-low', MEDIUM: 'risk-medium', HIGH: 'risk-high' }[risk.level] || 'risk-low'
  const icon = { LOW: '🟢', MEDIUM: '🟡', HIGH: '🔴' }[risk.level] || '🟢'
  const pct = Math.min(100, risk.score)
  const barColor = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444' }[risk.level] || '#10b981'

  return (
    <div className={`risk-indicator ${levelClass}`} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.375rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
        <span>{icon} Risk Score: <strong>{risk.score.toFixed(0)}/100</strong> — <strong>{risk.level}</strong></span>
      </div>
      <div className="risk-score-bar" style={{ width: '100%' }}>
        <div className="risk-score-fill" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      {risk.reason && risk.reason !== 'No suspicious activity' && (
        <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>⚠️ {risk.reason}</div>
      )}
    </div>
  )
}

export default function SendMoney() {
  const { user, updateUser } = useAuth()
  const { setToast } = useOutletContext()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [form, setForm] = useState({ receiverId: '', amount: '', description: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState('')
  const [qrPrefilled, setQrPrefilled] = useState(false)
  const [receiverInfo, setReceiverInfo] = useState(null)
  const [risk, setRisk] = useState(null)
  const [contacts, setContacts] = useState([])
  const riskTimer = useRef(null)

  // PIN modal state
  const [pinRequired, setPinRequired] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinError, setPinError] = useState('')
  const [pendingParams, setPendingParams] = useState(null)

  // Pre-fill receiverId from QR scan URL param
  useEffect(() => {
    const rid = searchParams.get('receiverId')
    if (rid) {
      setForm(f => ({ ...f, receiverId: rid }))
      setQrPrefilled(true)
      fetch(`${API_BASE}/user/${rid}`)
        .then(r => r.ok ? r.json() : null)
        .then(u => { if (u) setReceiverInfo(u) })
        .catch(() => {})
    }
  }, [])

  // Check whether this user has a Transaction PIN set
  useEffect(() => {
    if (!user?.id) return
    apiFetch('/user/pin-status')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPinRequired(!!d.pinSet) })
      .catch(() => {})
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    apiFetch('/contacts')
      .then(r => r.ok ? r.json() : [])
      .then(d => setContacts(Array.isArray(d) ? d : []))
      .catch(() => setContacts([]))
  }, [user?.id])

  const pickContact = (contact) => {
    setForm(f => ({ ...f, receiverId: String(contact.contactUserId) }))
    setReceiverInfo({
      id: contact.contactUserId,
      name: contact.name || contact.nickname || `User #${contact.contactUserId}`,
      profilePictureUrl: contact.profilePictureUrl,
    })
    setQrPrefilled(false)
  }

  // Live risk preview — debounced 600ms after amount changes
  useEffect(() => {
    const amount = parseFloat(form.amount)
    if (!form.amount || isNaN(amount) || amount <= 0 || !user?.id) {
      setRisk(null)
      return
    }
    clearTimeout(riskTimer.current)
    riskTimer.current = setTimeout(async () => {
      try {
        const res = await apiFetch(`/transaction/risk-preview?senderId=${user.id}&amount=${amount}`)
        if (res.ok) setRisk(await res.json())
      } catch { /* ignore */ }
    }, 600)
    return () => clearTimeout(riskTimer.current)
  }, [form.amount, user?.id])

  const handleSend = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess(null)
    if (!form.receiverId || !form.amount) return
    if (Number(form.amount) <= 0) { setError('Amount must be greater than 0'); return }
    if (Number(form.amount) > Number(user?.balance || 0)) { setError('Insufficient balance'); return }
    if (String(form.receiverId) === String(user?.id)) { setError('Cannot send to yourself'); return }
    if (risk?.level === 'HIGH') { setError('Transaction blocked due to high fraud risk. Please contact support.'); return }

    const params = new URLSearchParams({
      senderId: user.id,
      receiverId: form.receiverId,
      amount: form.amount,
      ...(form.description ? { description: form.description } : {})
    })

    if (pinRequired) {
      // Store params and open PIN modal — actual submission happens in handlePinConfirm
      setPendingParams(params)
      setPinError('')
      setShowPinModal(true)
      return
    }

    // No PIN set — submit directly
    await submitPayment(params)
  }

  const handlePinConfirm = async (pin) => {
    setPinError('')
    const params = pendingParams
    params.set('transactionPin', pin)
    await submitPayment(params, () => setShowPinModal(false))
  }

  const submitPayment = async (params, onSuccess) => {
    setLoading(true)
    try {
      const res = await apiFetch(`/transaction/send?${params}`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg = data.error || await res.text() || 'Transaction failed'
        if (res.status === 403 && showPinModal) {
          setPinError('Incorrect PIN. Please try again.')
          return
        }
        throw new Error(msg)
      }
      const sentAmount = parseFloat(params.get('amount') || 0)
      const data = await res.json()
      // Inject the sent amount so the success banner always has it,
      // even though the backend response doesn't include it.
      data.amount = sentAmount
      onSuccess?.()
      setShowPinModal(false)
      setPendingParams(null)
      setSuccess(data)
      setForm({ receiverId: '', amount: '', description: '' })
      setRisk(null)

      // Refresh balance
      apiFetch(`/user/${user.id}`).then(r => r.json()).then(u => updateUser(u)).catch(() => {})

      setToast({
        type: data.riskLevel === 'MEDIUM' ? 'warning' : 'gold',
        icon: data.riskLevel === 'MEDIUM' ? '⚠️' : '⭐',
        message: `Payment sent! +${data.pointsAwarded} reward points earned!${data.riskLevel === 'MEDIUM' ? ' (Flagged for review)' : ''}`,
        duration: 4500
      })
    } catch (err) {
      setError(err.message)
      setToast({ type: 'error', message: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>💸 Send Money</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Transfer funds instantly with fraud protection</p>
      </div>

      {/* Frozen warning */}
      {user?.frozen && (
        <div className="alert-error" style={{ marginBottom: '1.5rem' }}>
          🔒 Your account is frozen. Please contact support to restore access.
        </div>
      )}

      {/* Balance */}
      <div className="card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, var(--gradient-from)22, var(--gradient-to)11)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Available Balance</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-light)' }}>
              {fmtCurrency(user?.balance || 0)}
            </div>
          </div>
          <div style={{ fontSize: '2.5rem', opacity: 0.6 }}>💰</div>
        </div>
      </div>

      {/* Form */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        {success && (
          <div className="alert-success animate-slide-up" style={{ marginBottom: '1.25rem' }}>
            ✅ Payment successful! <strong>{fmtCurrency(success.amount || form.amount)}</strong> sent.
            <br />
            <span style={{ fontSize: '0.8125rem', opacity: 0.85 }}>
              ⭐ +{success.pointsAwarded} reward points · Risk: {success.riskLevel}
            </span>
          </div>
        )}
        {error && <div className="alert-error" style={{ marginBottom: '1.25rem' }}>{error}</div>}

        <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Recipient */}
          <div>
            <label className="label">Recipient</label>

            {qrPrefilled && receiverInfo && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.875rem',
                background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: '0.875rem', padding: '0.875rem 1rem', marginBottom: '0.75rem',
                animation: 'slideUp 0.3s ease-out'
              }}>
                <UserAvatar user={receiverInfo} size="2.5rem" fontSize="1rem" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                    {receiverInfo.name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    📷 Filled from QR scan · ID #{receiverInfo.id}
                  </div>
                </div>
                <div style={{ color: '#34d399', fontSize: '1.25rem' }}>✓</div>
              </div>
            )}

            <input
              id="send-receiver-id"
              className="input-field"
              type="text"
              placeholder="Enter recipient's User ID, Email, or Phone"
              value={form.receiverId}
              onChange={e => { setForm(f => ({ ...f, receiverId: e.target.value })); setQrPrefilled(false); setReceiverInfo(null) }}
              required
              />
            {contacts.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                {contacts.slice(0, 6).map(contact => (
                  <button
                    key={contact.id}
                    type="button"
                    className="btn-secondary"
                    onClick={() => pickContact(contact)}
                    style={{ width: 'auto', padding: '0.375rem 0.625rem', fontSize: '0.78rem' }}
                  >
                    <UserAvatar name={contact.name} src={contact.profilePictureUrl} size="1.5rem" fontSize="0.65rem" />
                    {contact.nickname || contact.name || `#${contact.contactUserId}`}
                  </button>
                ))}
              </div>
            )}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.375rem' }}>
              💡 Or <button type="button" onClick={() => navigate('/qr')} style={{ background: 'none', border: 'none', color: 'var(--accent-light)', cursor: 'pointer', fontSize: '0.75rem', padding: 0, fontWeight: 600 }}>scan a QR code</button> to auto-fill
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="label">Amount</label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
                color: 'var(--accent-light)', fontWeight: 700, fontSize: '1.125rem'
              }}>₹</span>
              <input
                id="send-amount"
                className="input-field"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                style={{ paddingLeft: '2rem', fontSize: '1.125rem', fontWeight: 600 }}
                required
              />
            </div>
            {form.amount && Number(form.amount) > 0 && (
              <div style={{ marginTop: '0.375rem', fontSize: '0.8125rem', color: 'var(--accent-light)' }}>
                ⭐ You'll earn ~{Math.max(1, Math.floor(Number(form.amount) / 10))} reward points
              </div>
            )}
          </div>

          {/* Risk Indicator */}
          {risk && <RiskIndicator risk={risk} />}

          {/* Description */}
          <div>
            <label className="label">Note (optional)</label>
            <input
              className="input-field"
              type="text"
              placeholder="e.g. Dinner split, rent, etc."
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              maxLength={100}
            />
          </div>

          {/* Quick amounts */}
          <div>
            <label className="label">Quick Amount</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {[50, 100, 200, 500, 1000].map(amt => (
                <button
                  key={amt}
                  type="button"
                  className="btn-secondary"
                  onClick={() => setForm(f => ({ ...f, amount: String(amt) }))}
                  style={{ padding: '0.375rem 0.875rem', fontSize: '0.8125rem', width: 'auto' }}
                >
                  ₹{amt}
                </button>
              ))}
            </div>
          </div>

          <button
            id="send-submit"
            className="btn-primary"
            type="submit"
            disabled={loading || !form.receiverId || !form.amount || user?.frozen || risk?.level === 'HIGH'}
          >
            {loading ? <span className="animate-spin">⟳</span> : '💸'}
            {loading ? 'Sending...' : `Send ${form.amount ? fmtCurrency(Number(form.amount)) : 'Money'}`}
          </button>

          {risk?.level === 'HIGH' && (
            <div className="alert-error" style={{ textAlign: 'center', fontSize: '0.8125rem' }}>
              ⛔ Transaction blocked. Risk score too high.
            </div>
          )}
        </form>
      </div>

      {/* QR Scan shortcut */}
      <div className="card card-hover" onClick={() => navigate('/qr')} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{
          width: '3rem', height: '3rem', borderRadius: '0.875rem',
          background: 'var(--accent-glow)', border: '1px solid var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.5rem', flexShrink: 0
        }}>📷</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Pay via QR Code</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Scan recipient's QR to auto-fill their ID</div>
        </div>
        <div style={{ marginLeft: 'auto', color: 'var(--text-faint)' }}>→</div>
      </div>

      {/* Transaction PIN Modal */}
      <PinModal
        isOpen={showPinModal}
        onConfirm={handlePinConfirm}
        onCancel={() => { setShowPinModal(false); setPendingParams(null); setLoading(false) }}
        error={pinError}
        loading={loading}
        title="🔐 Transaction PIN"
        subtitle={`Confirm payment of ₹${Number(pendingParams?.get('amount') || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
      />
    </div>
  )
}
