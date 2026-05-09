import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useOutletContext } from 'react-router-dom'
import { apiFetch } from '../api.js'
import PinModal from '../components/PinModal.jsx'

function fmtCurrency(n) {
  return 'Rs ' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

function fmtDate(date) {
  if (!date) return 'Not scheduled'
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

const WEEK_DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
]

export default function ScheduledPayments() {
  const { user } = useAuth()
  const { setToast } = useOutletContext()
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const [schedules, setSchedules] = useState([])
  const [loadingSchedules, setLoadingSchedules] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pinRequired, setPinRequired] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinError, setPinError] = useState('')
  const [pendingPayload, setPendingPayload] = useState(null)
  const [form, setForm] = useState({
    title: 'Rent',
    receiverId: '',
    amount: '',
    description: '',
    frequency: 'MONTHLY',
    dayOfMonth: String(new Date().getDate()),
    dayOfWeek: '1',
    startDate: today
  })

  useEffect(() => {
    fetchSchedules()
    apiFetch('/user/pin-status')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPinRequired(!!d.pinSet) })
      .catch(() => {})
  }, [user?.id])

  const fetchSchedules = async () => {
    setLoadingSchedules(true)
    try {
      const res = await apiFetch('/scheduled-payments')
      if (res.ok) setSchedules(await res.json())
    } catch {
      setToast({ type: 'error', message: 'Could not load scheduled payments' })
    } finally {
      setLoadingSchedules(false)
    }
  }

  const buildPayload = () => ({
    title: form.title.trim() || 'Recurring payment',
    receiverId: Number(form.receiverId),
    amount: Number(form.amount),
    description: form.description.trim(),
    frequency: form.frequency,
    dayOfMonth: form.frequency === 'MONTHLY' ? Number(form.dayOfMonth) : null,
    dayOfWeek: form.frequency === 'WEEKLY' ? Number(form.dayOfWeek) : null,
    startDate: form.startDate || today
  })

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.receiverId || !form.amount) return
    if (Number(form.amount) <= 0) { setError('Amount must be greater than 0'); return }
    if (Number(form.amount) > Number(user?.balance || 0)) { setError('Your balance is lower than this payment amount'); return }
    if (String(form.receiverId) === String(user?.id)) { setError('Cannot schedule a payment to yourself'); return }
    if (form.frequency === 'MONTHLY' && (Number(form.dayOfMonth) < 1 || Number(form.dayOfMonth) > 31)) {
      setError('Monthly date must be between 1 and 31')
      return
    }

    const payload = buildPayload()
    if (pinRequired) {
      setPendingPayload(payload)
      setPinError('')
      setShowPinModal(true)
      return
    }
    await submitCreate(payload)
  }

  const handlePinConfirm = async (pin) => {
    setPinError('')
    await submitCreate({ ...pendingPayload, transactionPin: pin })
  }

  const submitCreate = async (payload) => {
    setLoading(true)
    try {
      const res = await apiFetch('/scheduled-payments', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 403 && showPinModal) {
          setPinError(data.error || 'Incorrect PIN. Please try again.')
          return
        }
        throw new Error(data.error || 'Failed to create scheduled payment')
      }

      setForm(f => ({ ...f, receiverId: '', amount: '', description: '' }))
      setShowPinModal(false)
      setPendingPayload(null)
      setToast({ type: 'success', message: 'Scheduled payment created' })
      fetchSchedules()
    } catch (err) {
      setError(err.message)
      setToast({ type: 'error', message: err.message })
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (schedule, status) => {
    try {
      const res = await apiFetch(`/scheduled-payments/${schedule.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update schedule')
      }
      setToast({ type: 'success', message: `Schedule ${status.toLowerCase()}` })
      fetchSchedules()
    } catch (err) {
      setToast({ type: 'error', message: err.message })
    }
  }

  const deleteSchedule = async (schedule) => {
    try {
      const res = await apiFetch(`/scheduled-payments/${schedule.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete schedule')
      }
      setToast({ type: 'info', message: 'Scheduled payment removed' })
      fetchSchedules()
    } catch (err) {
      setToast({ type: 'error', message: err.message })
    }
  }

  const activeCount = schedules.filter(s => s.status === 'ACTIVE').length
  const monthlyTotal = schedules
    .filter(s => s.status === 'ACTIVE' && s.frequency === 'MONTHLY')
    .reduce((sum, s) => sum + Number(s.amount || 0), 0)

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>Scheduled Payments</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Auto-pay rent, subscriptions, and recurring dues on a fixed date.</p>
      </div>

      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-number">{activeCount}</div>
          <div className="stat-label">Active auto-pays</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{fmtCurrency(monthlyTotal)}</div>
          <div className="stat-label">Monthly committed</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{fmtCurrency(user?.balance || 0)}</div>
          <div className="stat-label">Available balance</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '1.5rem', alignItems: 'start' }}>
        <div className="card">
          <h2 style={{ fontSize: '1.1rem', margin: '0 0 1rem', fontWeight: 700 }}>Create Auto-Pay</h2>
          {error && <div className="alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="label">Payment name</label>
              <input className="input-field" value={form.title} maxLength={80} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Rent, Netflix, tuition" />
            </div>

            <div>
              <label className="label">Recipient User ID</label>
              <input className="input-field" type="number" value={form.receiverId} onChange={e => setForm(f => ({ ...f, receiverId: e.target.value }))} placeholder="Enter recipient ID" required />
            </div>

            <div>
              <label className="label">Amount</label>
              <input className="input-field" type="number" step="0.01" min="1" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" required />
            </div>

            <div>
              <label className="label">Repeats</label>
              <div className="analytics-tabs">
                <button type="button" className={`analytics-tab ${form.frequency === 'MONTHLY' ? 'active' : ''}`} onClick={() => setForm(f => ({ ...f, frequency: 'MONTHLY' }))}>Monthly</button>
                <button type="button" className={`analytics-tab ${form.frequency === 'WEEKLY' ? 'active' : ''}`} onClick={() => setForm(f => ({ ...f, frequency: 'WEEKLY' }))}>Weekly</button>
              </div>
            </div>

            {form.frequency === 'MONTHLY' ? (
              <div>
                <label className="label">Fixed date each month</label>
                <input className="input-field" type="number" min="1" max="31" value={form.dayOfMonth} onChange={e => setForm(f => ({ ...f, dayOfMonth: e.target.value }))} />
              </div>
            ) : (
              <div>
                <label className="label">Fixed day each week</label>
                <select className="input-field" value={form.dayOfWeek} onChange={e => setForm(f => ({ ...f, dayOfWeek: e.target.value }))}>
                  {WEEK_DAYS.map(day => <option key={day.value} value={day.value}>{day.label}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="label">Start from</label>
              <input className="input-field" type="date" min={today} value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>

            <div>
              <label className="label">Note (optional)</label>
              <input className="input-field" value={form.description} maxLength={100} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Apartment rent, premium plan, etc." />
            </div>

            <button className="btn-primary" type="submit" disabled={loading || !form.receiverId || !form.amount || user?.frozen}>
              {loading ? 'Creating...' : 'Create Scheduled Payment'}
            </button>
          </form>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {loadingSchedules ? (
            <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading scheduled payments...</div>
          ) : schedules.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No scheduled payments yet.</div>
          ) : schedules.map(schedule => (
            <div key={schedule.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>{schedule.title}</h3>
                  <span className={`status-badge ${schedule.status === 'ACTIVE' ? 'status-active' : schedule.status === 'PAUSED' ? 'status-pending' : 'status-rejected'}`}>{schedule.status}</span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.45rem' }}>
                  To user #{schedule.receiverId} | {schedule.frequency.toLowerCase()} | next run {fmtDate(schedule.nextRunDate)}
                </div>
                {schedule.description && <div style={{ color: 'var(--text-faint)', fontSize: '0.8rem', marginTop: '0.35rem' }}>{schedule.description}</div>}
                {schedule.lastFailureReason && <div className="alert-error" style={{ marginTop: '0.75rem' }}>{schedule.lastFailureReason}</div>}
              </div>

              <div style={{ textAlign: 'right', minWidth: '150px', marginLeft: 'auto' }}>
                <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--accent-light)' }}>{fmtCurrency(schedule.amount)}</div>
                <div style={{ color: 'var(--text-faint)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{schedule.executions || 0} paid</div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                  {schedule.status === 'ACTIVE' ? (
                    <button className="btn-secondary" style={{ width: 'auto', padding: '0.4rem 0.7rem' }} onClick={() => updateStatus(schedule, 'PAUSED')}>Pause</button>
                  ) : schedule.status === 'PAUSED' ? (
                    <button className="btn-success" onClick={() => updateStatus(schedule, 'ACTIVE')}>Resume</button>
                  ) : null}
                  <button className="btn-danger" onClick={() => schedule.status === 'CANCELLED' ? deleteSchedule(schedule) : updateStatus(schedule, 'CANCELLED')}>
                    {schedule.status === 'CANCELLED' ? 'Delete' : 'Cancel'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <PinModal
        isOpen={showPinModal}
        onConfirm={handlePinConfirm}
        onCancel={() => { setShowPinModal(false); setPendingPayload(null); setLoading(false) }}
        error={pinError}
        loading={loading}
        title="Transaction PIN"
        subtitle={`Authorize auto-pay setup for ${fmtCurrency(pendingPayload?.amount || 0)}`}
      />
    </div>
  )
}
