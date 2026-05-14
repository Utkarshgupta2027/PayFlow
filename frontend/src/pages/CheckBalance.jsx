import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { apiFetch } from '../api.js'

function fmtCurrency(n) {
  return 'Rs. ' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function CheckBalance() {
  const navigate = useNavigate()
  const { setToast } = useOutletContext()
  const [pin, setPin] = useState('')
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setBalance(null)

    if (!/^\d{4,6}$/.test(pin)) {
      setError('Enter your 4-6 digit Transaction PIN.')
      return
    }

    setLoading(true)
    try {
      const res = await apiFetch('/user/check-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionPin: pin })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Unable to check balance.')
      }
      setBalance(Number(data.balance || 0))
      setPin('')
    } catch (err) {
      setError(err.message || 'Unable to check balance.')
      setToast?.({ type: 'error', message: err.message || 'Unable to check balance.', duration: 3000 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>
          Check Balance
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          Enter your Transaction PIN to view your wallet balance.
        </p>
      </div>

      <div className="card animate-slide-up" style={{ maxWidth: '520px' }}>
        <form onSubmit={handleSubmit}>
          <label className="label" htmlFor="check-balance-pin">Transaction PIN</label>
          <input
            id="check-balance-pin"
            className="input-field"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Enter 4-6 digit PIN"
            value={pin}
            maxLength={6}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            style={{ fontSize: '1.125rem', fontWeight: 700, letterSpacing: '0.2em' }}
          />

          {error && (
            <div className="alert-error animate-slide-up" style={{ marginTop: '1rem' }}>
              {error}
            </div>
          )}

          {balance !== null && (
            <div className="balance-card" style={{ margin: '1.25rem 0 0' }}>
              <div style={{ fontSize: '0.875rem', opacity: 0.85, marginBottom: '0.5rem' }}>Wallet Balance</div>
              <div className="amount" style={{ fontWeight: 900, marginBottom: 0 }}>
                {fmtCurrency(balance)}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <button
              className="btn-primary"
              type="submit"
              disabled={loading || pin.length < 4}
              style={{ flex: 1, minWidth: '180px' }}
            >
              {loading ? <><span className="animate-spin">...</span> Checking...</> : 'Check Balance'}
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => navigate('/settings')}
              style={{ flex: 1, minWidth: '180px' }}
            >
              Manage PIN
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
