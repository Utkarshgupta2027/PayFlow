import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useOutletContext } from 'react-router-dom'
import { apiFetch } from '../api.js'
import PinModal from '../components/PinModal.jsx'

function fmtCurrency(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

export default function RequestMoney() {
  const { user, updateUser } = useAuth()
  const { setToast } = useOutletContext()

  const [activeTab, setActiveTab] = useState('NEW') // NEW, INCOMING, OUTGOING

  // Form state
  const [form, setForm] = useState({ targetUserId: '', amount: '', description: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Requests state
  const [incomingRequests, setIncomingRequests] = useState([])
  const [outgoingRequests, setOutgoingRequests] = useState([])
  const [loadingRequests, setLoadingRequests] = useState(false)

  // PIN modal state (for accepting)
  const [pinRequired, setPinRequired] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinError, setPinError] = useState('')
  const [pendingRequestId, setPendingRequestId] = useState(null)
  const [pendingAmount, setPendingAmount] = useState(0)

  useEffect(() => {
    if (!user?.id) return
    apiFetch('/user/pin-status')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPinRequired(!!d.pinSet) })
      .catch(() => {})
  }, [user?.id])

  useEffect(() => {
    if (activeTab === 'INCOMING') fetchIncoming()
    if (activeTab === 'OUTGOING') fetchOutgoing()
  }, [activeTab])

  const fetchIncoming = async () => {
    setLoadingRequests(true)
    try {
      const res = await apiFetch('/request-money/incoming')
      if (res.ok) setIncomingRequests(await res.json())
    } catch { /* ignore */ }
    setLoadingRequests(false)
  }

  const fetchOutgoing = async () => {
    setLoadingRequests(true)
    try {
      const res = await apiFetch('/request-money/outgoing')
      if (res.ok) setOutgoingRequests(await res.json())
    } catch { /* ignore */ }
    setLoadingRequests(false)
  }

  const handleSendRequest = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!form.targetUserId || !form.amount) return
    if (Number(form.amount) <= 0) { setError('Amount must be greater than 0'); return }
    if (String(form.targetUserId) === String(user?.id)) { setError('Cannot request from yourself'); return }

    setLoading(true)
    const params = new URLSearchParams({
      targetUserId: form.targetUserId,
      amount: form.amount,
      ...(form.description ? { description: form.description } : {})
    })

    try {
      const res = await apiFetch(`/request-money/create?${params}`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to send request')
      }
      setSuccess(`Request for ${fmtCurrency(form.amount)} sent successfully!`)
      setForm({ targetUserId: '', amount: '', description: '' })
      setToast({ type: 'success', message: 'Money request sent!' })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptClick = (req) => {
    if (Number(req.amount) > Number(user?.balance || 0)) {
      setToast({ type: 'error', message: 'Insufficient balance to accept this request' })
      return
    }
    
    if (pinRequired) {
      setPendingRequestId(req.id)
      setPendingAmount(req.amount)
      setPinError('')
      setShowPinModal(true)
    } else {
      submitAccept(req.id)
    }
  }

  const handlePinConfirm = async (pin) => {
    setPinError('')
    await submitAccept(pendingRequestId, pin)
  }

  const submitAccept = async (reqId, pin = null) => {
    setLoading(true)
    try {
      let url = `/request-money/${reqId}/accept`
      if (pin) url += `?transactionPin=${encodeURIComponent(pin)}`
      
      const res = await apiFetch(url, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 403 && showPinModal) {
          setPinError('Incorrect PIN. Please try again.')
          return
        }
        throw new Error(data.error || 'Failed to accept request')
      }
      
      setToast({ type: 'success', message: 'Request accepted. Payment sent!' })
      setShowPinModal(false)
      setPendingRequestId(null)
      fetchIncoming()
      
      // Refresh balance
      apiFetch(`/user/${user.id}`).then(r => r.json()).then(u => updateUser(u)).catch(() => {})
    } catch (err) {
      setToast({ type: 'error', message: err.message })
    } finally {
      setLoading(false)
    }
  }

  const handleDecline = async (reqId) => {
    try {
      const res = await apiFetch(`/request-money/${reqId}/decline`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to decline')
      setToast({ type: 'info', message: 'Request declined' })
      fetchIncoming()
    } catch (err) {
      setToast({ type: 'error', message: err.message })
    }
  }

  const handleCancel = async (reqId) => {
    try {
      const res = await apiFetch(`/request-money/${reqId}/cancel`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to cancel')
      setToast({ type: 'info', message: 'Request cancelled' })
      fetchOutgoing()
    } catch (err) {
      setToast({ type: 'error', message: err.message })
    }
  }

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>🤲 Request Money</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Ask your friends for money, split bills, or manage dues.</p>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('NEW')}
          style={{ background: 'none', border: 'none', fontSize: '1rem', fontWeight: 600, color: activeTab === 'NEW' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', borderBottom: activeTab === 'NEW' ? '2px solid var(--accent)' : 'none', paddingBottom: '0.5rem' }}
        >
          New Request
        </button>
        <button
          onClick={() => setActiveTab('INCOMING')}
          style={{ background: 'none', border: 'none', fontSize: '1rem', fontWeight: 600, color: activeTab === 'INCOMING' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', borderBottom: activeTab === 'INCOMING' ? '2px solid var(--accent)' : 'none', paddingBottom: '0.5rem' }}
        >
          Incoming
        </button>
        <button
          onClick={() => setActiveTab('OUTGOING')}
          style={{ background: 'none', border: 'none', fontSize: '1rem', fontWeight: 600, color: activeTab === 'OUTGOING' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', borderBottom: activeTab === 'OUTGOING' ? '2px solid var(--accent)' : 'none', paddingBottom: '0.5rem' }}
        >
          Sent Requests
        </button>
      </div>

      {activeTab === 'NEW' && (
        <div className="card">
          {success && <div className="alert-success" style={{ marginBottom: '1.25rem' }}>{success}</div>}
          {error && <div className="alert-error" style={{ marginBottom: '1.25rem' }}>{error}</div>}
          
          <form onSubmit={handleSendRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label className="label">Request From (User ID)</label>
              <input
                className="input-field"
                type="number"
                placeholder="Enter friend's User ID"
                value={form.targetUserId}
                onChange={e => setForm(f => ({ ...f, targetUserId: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Amount</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent-light)', fontWeight: 700, fontSize: '1.125rem' }}>₹</span>
                <input
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
            </div>
            <div>
              <label className="label">Note (optional)</label>
              <input
                className="input-field"
                type="text"
                placeholder="What is this for?"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                maxLength={100}
              />
            </div>
            <button className="btn-primary" type="submit" disabled={loading || !form.targetUserId || !form.amount}>
              {loading ? <span className="animate-spin">⟳</span> : '📨'} Send Request
            </button>
          </form>
        </div>
      )}

      {activeTab === 'INCOMING' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {loadingRequests ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading requests...</div>
          ) : incomingRequests.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              No incoming money requests.
            </div>
          ) : (
            incomingRequests.map(req => (
              <div key={req.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{req.otherUserName} <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>(#{req.otherUserId})</span></div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{req.description || 'No note provided'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.2rem' }}>{new Date(req.createdAt).toLocaleString()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-light)' }}>{fmtCurrency(req.amount)}</div>
                  {req.status === 'PENDING' ? (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: '#f87171', borderColor: '#f87171' }} onClick={() => handleDecline(req.id)}>Decline</button>
                      <button className="btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => handleAcceptClick(req)}>Pay</button>
                    </div>
                  ) : (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: req.status === 'ACCEPTED' ? '#34d399' : '#f87171' }}>
                      {req.status}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'OUTGOING' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {loadingRequests ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading requests...</div>
          ) : outgoingRequests.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              You haven't sent any requests.
            </div>
          ) : (
            outgoingRequests.map(req => (
              <div key={req.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Requested from: {req.otherUserName} <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>(#{req.otherUserId})</span></div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{req.description || 'No note provided'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.2rem' }}>{new Date(req.createdAt).toLocaleString()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{fmtCurrency(req.amount)}</div>
                  {req.status === 'PENDING' ? (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                      <button className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => handleCancel(req.id)}>Cancel</button>
                    </div>
                  ) : (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: req.status === 'ACCEPTED' ? '#34d399' : '#f87171' }}>
                      {req.status}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <PinModal
        isOpen={showPinModal}
        onConfirm={handlePinConfirm}
        onCancel={() => { setShowPinModal(false); setPendingRequestId(null) }}
        error={pinError}
        loading={loading}
        title="🔐 Transaction PIN"
        subtitle={`Confirm payment of ${fmtCurrency(pendingAmount)}`}
      />
    </div>
  )
}
