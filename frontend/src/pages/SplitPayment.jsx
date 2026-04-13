import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { apiFetch } from '../api.js'

export default function SplitPayment() {
  const { user } = useAuth()
  const [splits, setSplits] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [paying, setPaying] = useState(null)

  // Create form state
  const [form, setForm] = useState({ title: '', totalAmount: '', participantIds: '' })
  const [formError, setFormError] = useState(null)
  const [formSuccess, setFormSuccess] = useState(null)

  const loadSplits = useCallback(async () => {
    if (!user?.id) return
    try {
      const res = await apiFetch(`/split/user/${user.id}`)
      if (res.ok) setSplits(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }, [user?.id])

  useEffect(() => { loadSplits() }, [loadSplits])

  const handleCreate = async (e) => {
    e.preventDefault()
    setFormError(null)
    setFormSuccess(null)

    const amount = parseFloat(form.totalAmount)
    if (!form.title.trim()) return setFormError('Please enter a split title')
    if (isNaN(amount) || amount <= 0) return setFormError('Enter a valid amount')

    const rawIds = form.participantIds.split(',').map(s => s.trim()).filter(Boolean)
    const participantIds = rawIds.map(Number).filter(n => !isNaN(n) && n > 0)
    if (participantIds.length === 0) return setFormError('Enter at least one participant ID')

    setCreating(true)
    try {
      const res = await apiFetch('/split/create', {
        method: 'POST',
        body: JSON.stringify({
          creatorId: user.id,
          title: form.title.trim(),
          totalAmount: amount,
          participantIds,
        }),
      })
      if (res.ok) {
        setFormSuccess('Split created! Participants have been notified.')
        setForm({ title: '', totalAmount: '', participantIds: '' })
        loadSplits()
      } else {
        const data = await res.json()
        setFormError(data.error || 'Failed to create split')
      }
    } catch {
      setFormError('Network error. Please try again.')
    }
    setCreating(false)
  }

  const handlePay = async (splitId) => {
    setPaying(splitId)
    try {
      const res = await apiFetch(`/split/${splitId}/pay?userId=${user.id}`, { method: 'POST' })
      if (res.ok) {
        loadSplits()
      } else {
        const data = await res.json()
        alert(data.error || 'Payment failed')
      }
    } catch {
      alert('Network error')
    }
    setPaying(null)
  }

  const myParticipation = (split) =>
    split.participants?.find(p => p.userId === user?.id)

  const paidCount = (split) =>
    split.participants?.filter(p => p.paid).length || 0

  const progressPct = (split) => {
    const total = split.participants?.length || 1
    return Math.round((paidCount(split) / total) * 100)
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>🔀 Split Payment</h1>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)' }}>
          Divide bills fairly among friends and track who's paid
        </p>
      </div>

      {/* Create New Split */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem', fontWeight: 700 }}>➕ Create New Split</h2>
        <form onSubmit={handleCreate}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <label className="label">Split Title</label>
              <input
                className="input-field"
                placeholder="e.g. Dinner at Barbeque Nation"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Total Amount (₹)</label>
              <input
                className="input-field"
                type="number"
                placeholder="e.g. 2400"
                value={form.totalAmount}
                onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Participant User IDs (comma separated)</label>
              <input
                className="input-field"
                placeholder="e.g. 2, 3, 5 (your ID is auto-included)"
                value={form.participantIds}
                onChange={e => setForm(f => ({ ...f, participantIds: e.target.value }))}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.375rem' }}>
                Your ID: <strong style={{ color: 'var(--accent)' }}>#{user?.id}</strong> — you are automatically included
              </div>
            </div>

            {formError && <div className="alert-error">{formError}</div>}
            {formSuccess && <div className="alert-success">{formSuccess}</div>}

            <button className="btn-primary" type="submit" disabled={creating}>
              {creating ? 'Creating...' : '🔀 Create Split'}
            </button>
          </div>
        </form>
      </div>

      {/* My Splits */}
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>My Splits</h2>

      {loading && <div style={{ textAlign: 'center', color: 'var(--text-faint)', padding: '2rem' }}>Loading...</div>}

      {!loading && splits.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔀</div>
          <div style={{ color: 'var(--text-muted)' }}>No splits yet</div>
          <div style={{ color: 'var(--text-faint)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Create your first split above
          </div>
        </div>
      )}

      {splits.map(split => {
        const myPart = myParticipation(split)
        const pct = progressPct(split)
        const isCreator = split.creatorId === user?.id
        const settled = split.status === 'SETTLED'

        return (
          <div key={split.id} className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  {split.title}
                </div>
                <div style={{ color: 'var(--text-faint)', fontSize: '0.8rem' }}>
                  {isCreator ? '👑 You created this' : '👤 You are a participant'}
                  {' · '}
                  {new Date(split.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-light)' }}>
                  ₹{Number(split.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <span className={`status-badge ${settled ? 'status-approved' : 'status-pending'}`}>
                  {settled ? '✅ Settled' : '⏳ Open'}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-faint)', marginBottom: '0.375rem' }}>
                <span>{paidCount(split)}/{split.participants?.length || 0} paid</span>
                <span>{pct}%</span>
              </div>
              <div className="split-progress-bar">
                <div className="split-progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>

            {/* Participants */}
            <div style={{ marginBottom: '1rem' }}>
              {split.participants?.map(p => (
                <div key={p.id} className="participant-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <div className="avatar" style={{ width: '1.75rem', height: '1.75rem', fontSize: '0.7rem' }}>
                      {(p.userName || 'U').charAt(0).toUpperCase()}
                    </div>
                    <span style={{ color: p.userId === user?.id ? 'var(--accent-light)' : 'var(--text-muted)' }}>
                      {p.userName || `User #${p.userId}`}
                      {p.userId === user?.id && ' (you)'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      ₹{Number(p.amountOwed).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className={`status-badge ${p.paid ? 'status-approved' : 'status-pending'}`}>
                      {p.paid ? '✅ Paid' : '⏳ Pending'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pay my share button */}
            {myPart && !myPart.paid && !settled && (
              <button
                className="btn-primary"
                onClick={() => handlePay(split.id)}
                disabled={paying === split.id}
                style={{ width: 'auto', padding: '0.625rem 1.5rem' }}
              >
                {paying === split.id ? 'Processing...' : `💸 Pay My Share (₹${Number(myPart.amountOwed).toFixed(2)})`}
              </button>
            )}
            {myPart?.paid && (
              <div style={{ color: '#34d399', fontSize: '0.875rem', fontWeight: 600 }}>
                ✅ You've paid your share
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
