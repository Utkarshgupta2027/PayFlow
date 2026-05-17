import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { apiFetch } from '../api.js'

const BILL_TYPES = [
  { key: 'ELECTRICITY', label: 'Electricity', providers: ['BSES Rajdhani', 'Tata Power', 'Adani Electricity'] },
  { key: 'RECHARGE', label: 'Mobile Recharge', providers: ['Jio', 'Airtel', 'Vi'] },
  { key: 'DTH', label: 'DTH', providers: ['Tata Play', 'Airtel Digital TV', 'Dish TV'] },
]

function fmtCurrency(n) {
  return 'INR ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function BillPayments() {
  const { user, updateUser } = useAuth()
  const { setToast } = useOutletContext()
  const [billType, setBillType] = useState('ELECTRICITY')
  const selected = BILL_TYPES.find(type => type.key === billType) || BILL_TYPES[0]
  const [form, setForm] = useState({ provider: selected.providers[0], accountNumber: '', amount: '', description: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(null)

  const changeType = (nextType) => {
    const next = BILL_TYPES.find(type => type.key === nextType) || BILL_TYPES[0]
    setBillType(next.key)
    setForm(current => ({ ...current, provider: next.providers[0] }))
  }

  const cashbackPreview = () => {
    const amount = Number(form.amount || 0)
    if (amount >= 500 && (billType === 'ELECTRICITY' || billType === 'DTH')) return Math.min(75, amount * 0.05)
    if (amount >= 199 && billType === 'RECHARGE') return Math.min(30, amount * 0.03)
    return 0
  }

  const submitPayment = async (e) => {
    e.preventDefault()
    setLoading(true)
    setSuccess(null)
    try {
      const res = await apiFetch('/bill-payments/pay', {
        method: 'POST',
        body: JSON.stringify({
          billType,
          provider: form.provider,
          accountNumber: form.accountNumber,
          amount: Number(form.amount),
          description: form.description,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Bill payment failed')
      if (data.user) updateUser(data.user)
      setSuccess(data)
      setForm(current => ({ ...current, accountNumber: '', amount: '', description: '' }))
      setToast({ type: 'success', message: `Bill paid. Cashback: ${fmtCurrency(data.cashback || 0)}`, duration: 3500 })
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Bill payment failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>Bill Payments</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Pay electricity, mobile recharge, and DTH from your PayFlow wallet.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        <div className="card">
          {success && (
            <div className="alert-success" style={{ marginBottom: '1rem' }}>
              Payment successful. +{success.pointsAwarded || 0} points earned
              {success.cashback > 0 ? ` and ${fmtCurrency(success.cashback)} cashback credited.` : '.'}
            </div>
          )}

          <div className="analytics-tabs" style={{ marginBottom: '1.25rem' }}>
            {BILL_TYPES.map(type => (
              <button key={type.key} type="button" className={`analytics-tab ${billType === type.key ? 'active' : ''}`} onClick={() => changeType(type.key)}>
                {type.label}
              </button>
            ))}
          </div>

          <form onSubmit={submitPayment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="label">Provider</label>
              <select className="input-field" value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}>
                {selected.providers.map(provider => <option key={provider} value={provider}>{provider}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{billType === 'RECHARGE' ? 'Mobile number' : 'Consumer number'}</label>
              <input className="input-field" value={form.accountNumber} onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Amount</label>
              <input className="input-field" type="number" min="1" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
              {cashbackPreview() > 0 && (
                <div style={{ color: '#fbbf24', fontSize: '0.8125rem', marginTop: '0.5rem' }}>
                  Cashback preview: {fmtCurrency(cashbackPreview())}
                </div>
              )}
            </div>
            <div>
              <label className="label">Note (optional)</label>
              <input className="input-field" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} maxLength={80} />
            </div>
            <button className="btn-primary" disabled={loading || !form.amount || !form.accountNumber}>
              {loading ? 'Processing...' : `Pay ${form.amount ? fmtCurrency(form.amount) : 'Bill'}`}
            </button>
          </form>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 1rem' }}>Cashback Offers</h2>
          {[
            ['Electricity and DTH', '5% cashback up to INR 75 on payments above INR 500'],
            ['Mobile Recharge', '3% cashback up to INR 30 on recharges above INR 199'],
            ['Reward Points', 'Earn points on every successful bill payment'],
          ].map(([title, desc]) => (
            <div key={title} className="reward-item">
              <div className="reward-icon">%</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{title}</div>
                <div style={{ color: 'var(--text-faint)', fontSize: '0.8rem' }}>{desc}</div>
              </div>
            </div>
          ))}
          <div style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            Wallet balance: {fmtCurrency(user?.balance || 0)}
          </div>
        </div>
      </div>
    </div>
  )
}
