import { useState, useEffect } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { apiUrl } from '../api.js'

function fmtCurrency(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(s) {
  if (!s) return ''
  return new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Dashboard() {
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()
  const { setToast } = useOutletContext()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshBalance, setRefreshBalance] = useState(0)

  // Add Money modal state
  const [showAddMoney, setShowAddMoney] = useState(false)
  const [addAmount, setAddAmount] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addSuccess, setAddSuccess] = useState(false)

  const PRESETS = [500, 1000, 2000, 5000]

  // Fetch user balance
  useEffect(() => {
    if (!user?.id) return
    fetch(apiUrl(`/user/${user.id}`))
      .then(r => r.json())
      .then(u => updateUser(u))
      .catch(() => {})
  }, [refreshBalance])

  // Fetch transactions
  useEffect(() => {
    if (!user?.id) return
    fetch(apiUrl(`/transaction/history/${user.id}`))
      .then(r => r.json())
      .then(data => setTransactions(Array.isArray(data) ? data.slice(0, 8) : []))
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false))
  }, [refreshBalance])

  // Daily bonus auto-check
  useEffect(() => {
    if (!user?.id) return
    const today = new Date().toDateString()
    const lastBonus = localStorage.getItem('payflow_daily_bonus_date')
    if (lastBonus === today) return
    fetch(apiUrl(`/rewards/daily-bonus/${user.id}`), { method: 'POST' })
      .then(r => r.json())
      .then(d => {
        if (!d.alreadyClaimed && d.pointsAwarded > 0) {
          localStorage.setItem('payflow_daily_bonus_date', today)
          setToast({ type: 'gold', icon: '🎁', message: `Daily bonus! +${d.pointsAwarded} points earned!`, duration: 4000 })
        }
      })
      .catch(() => {})
  }, [])

  const handleAddMoney = async () => {
    const amt = parseFloat(addAmount)
    if (!amt || amt <= 0) return
    setAddLoading(true)
    try {
      const res = await fetch(apiUrl('/wallet/addMoney'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, amount: amt })
      })
      if (!res.ok) throw new Error('Failed')
      const updated = await res.json()
      updateUser(updated)
      setAddSuccess(true)
      setTimeout(() => {
        setAddSuccess(false)
        setShowAddMoney(false)
        setAddAmount('')
        setRefreshBalance(r => r + 1)
        setToast({ type: 'success', icon: '💰', message: `${fmtCurrency(amt)} added to your wallet!`, duration: 3500 })
      }, 1600)
    } catch {
      setToast({ type: 'error', icon: '❌', message: 'Failed to add money. Try again.', duration: 3000 })
    } finally {
      setAddLoading(false)
    }
  }

  const closeModal = () => {
    if (addLoading || addSuccess) return
    setShowAddMoney(false)
    setAddAmount('')
  }

  const sent = transactions.filter(t => t.senderId === user?.id)
  const received = transactions.filter(t => t.receiverId === user?.id)
  const totalSent = sent.reduce((s, t) => s + t.amount, 0)
  const totalReceived = received.reduce((s, t) => s + t.amount, 0)

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>
          Hi, {user?.name?.split(' ')[0] || 'there'} 👋
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Balance Card */}
      <div className="balance-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.875rem', opacity: 0.85, marginBottom: '0.5rem' }}>Total Balance</div>
        <div style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.02em', marginBottom: '1rem' }}>
          {fmtCurrency(user?.balance || 0)}
        </div>
        <div style={{ fontSize: '0.8rem', opacity: 0.75, marginBottom: '1rem' }}>
          Account: {user?.email}
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.75rem', opacity: 0.75 }}>Total Sent</div>
            <div style={{ fontWeight: 700, fontSize: '1.0625rem' }}>{fmtCurrency(totalSent)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', opacity: 0.75 }}>Total Received</div>
            <div style={{ fontWeight: 700, fontSize: '1.0625rem' }}>{fmtCurrency(totalReceived)}</div>
          </div>
          <button
            onClick={() => setShowAddMoney(true)}
            style={{
              marginLeft: 'auto',
              background: 'rgba(255,255,255,0.18)',
              border: '1.5px solid rgba(255,255,255,0.35)',
              borderRadius: '0.75rem',
              color: 'white',
              fontWeight: 700,
              fontSize: '0.875rem',
              padding: '0.5rem 1.25rem',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              transition: 'all 0.2s',
              backdropFilter: 'blur(8px)'
            }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.28)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
          >
            ＋ Add Money
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.75rem', flexWrap: 'wrap' }}>
        {[
          { icon: '➕', label: 'Add Money', action: () => setShowAddMoney(true) },
          { icon: '💸', label: 'Send', path: '/send' },
          { icon: '📷', label: 'Scan QR', path: '/qr' },
          { icon: '📊', label: 'Analytics', path: '/analytics' },
          { icon: '⭐', label: 'Rewards', path: '/rewards' },
        ].map(({ icon, label, path, action }) => (
          <button key={label} className="quick-action" onClick={action || (() => navigate(path))}>
            <div className="quick-action-icon">{icon}</div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>{label}</span>
          </button>
        ))}
      </div>

      {/* Recent Transactions */}
      <div className="card animate-slide-up">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Recent Transactions</h2>
          <button
            className="btn-secondary"
            onClick={() => navigate('/analytics')}
            style={{ padding: '0.375rem 0.875rem', fontSize: '0.8125rem', width: 'auto' }}
          >
            View all →
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div className="skeleton" style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <div className="skeleton" style={{ height: '0.875rem', width: '60%' }} />
                  <div className="skeleton" style={{ height: '0.75rem', width: '40%' }} />
                </div>
                <div className="skeleton" style={{ height: '1rem', width: '5rem' }} />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-faint)' }}>
            No transactions yet.<br />
            <button className="btn-primary" onClick={() => navigate('/send')} style={{ marginTop: '1rem', width: 'auto', padding: '0.6rem 1.25rem' }}>
              Send money
            </button>
          </div>
        ) : (
          transactions.map(t => {
            const isSent = t.senderId === user?.id
            return (
              <div key={t.id} className="tx-item">
                <div className={`tx-icon ${isSent ? 'tx-sent' : 'tx-received'}`}>
                  {isSent ? '↑' : '↓'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {isSent ? `Sent to #${t.receiverId}` : `Received from #${t.senderId}`}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                    {fmtDate(t.time)}
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: isSent ? '#f87171' : '#34d399' }}>
                  {isSent ? '-' : '+'}{fmtCurrency(t.amount)}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── Add Money Modal ── */}
      {showAddMoney && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.72)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: '1.5rem',
              padding: '2rem',
              width: '100%', maxWidth: '420px',
              boxShadow: '0 32px 72px rgba(0,0,0,0.55)',
              animation: 'slideUp 0.25s ease-out',
              position: 'relative'
            }}
          >
            {/* Close */}
            <button
              onClick={closeModal}
              style={{
                position: 'absolute', top: '1rem', right: '1rem',
                background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                borderRadius: '50%', width: '2rem', height: '2rem',
                cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s'
              }}
            >×</button>

            {addSuccess ? (
              /* Success state */
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <div style={{
                  width: '5rem', height: '5rem', borderRadius: '50%',
                  background: 'rgba(16,185,129,0.15)',
                  border: '2.5px solid #10b981',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2.25rem', margin: '0 auto 1.25rem',
                  animation: 'pulse-glow 1s ease-in-out'
                }}>✓</div>
                <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#34d399', margin: '0 0 0.5rem' }}>
                  Money Added!
                </h2>
                <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
                  {fmtCurrency(parseFloat(addAmount))} credited to your wallet
                </p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
                  <div style={{
                    width: '3.75rem', height: '3.75rem', borderRadius: '1.125rem',
                    background: 'linear-gradient(135deg, var(--gradient-from), var(--gradient-to))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.875rem', margin: '0 auto 1rem',
                    boxShadow: '0 8px 28px var(--accent-glow)'
                  }}>💰</div>
                  <h2 style={{ fontSize: '1.375rem', fontWeight: 800, margin: '0 0 0.25rem' }}>Add Money</h2>
                  <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem' }}>
                    Top up your PayFlow wallet instantly
                  </p>
                </div>

                {/* Current balance pill */}
                <div style={{
                  background: 'var(--accent-glow)',
                  border: '1px solid rgba(14,165,233,0.2)',
                  borderRadius: '0.875rem',
                  padding: '0.75rem 1rem',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: '1.5rem'
                }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Current Balance</span>
                  <span style={{ fontWeight: 800, fontSize: '1.125rem', color: 'var(--accent-light)' }}>
                    {fmtCurrency(user?.balance || 0)}
                  </span>
                </div>

                {/* Preset amounts */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="label">Quick Select</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.625rem' }}>
                    {PRESETS.map(p => {
                      const selected = addAmount === String(p)
                      return (
                        <button
                          key={p}
                          onClick={() => setAddAmount(String(p))}
                          style={{
                            padding: '0.625rem 0.25rem',
                            borderRadius: '0.75rem',
                            border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--border-input)'}`,
                            background: selected ? 'var(--accent-glow)' : 'var(--bg-input)',
                            color: selected ? 'var(--accent-light)' : 'var(--text-primary)',
                            fontWeight: 700, fontSize: '0.875rem',
                            cursor: 'pointer', transition: 'all 0.15s ease'
                          }}
                        >
                          ₹{p >= 1000 ? `${p / 1000}K` : p}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Custom amount */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label className="label">Or enter custom amount</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: '1rem', top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)', fontWeight: 700, fontSize: '1.125rem',
                      pointerEvents: 'none'
                    }}>₹</span>
                    <input
                      className="input-field"
                      type="number"
                      min="1"
                      max="100000"
                      placeholder="0"
                      value={addAmount}
                      onChange={e => setAddAmount(e.target.value)}
                      autoFocus
                      style={{
                        paddingLeft: '2.25rem',
                        fontSize: '1.25rem',
                        fontWeight: 800,
                        letterSpacing: '-0.01em'
                      }}
                    />
                  </div>
                  {addAmount && parseFloat(addAmount) > 0 && (
                    <div style={{
                      fontSize: '0.8rem', color: 'var(--text-muted)',
                      marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem'
                    }}>
                      New balance:
                      <span style={{ color: '#34d399', fontWeight: 700 }}>
                        {fmtCurrency((user?.balance || 0) + parseFloat(addAmount))}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    className="btn-secondary"
                    onClick={closeModal}
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleAddMoney}
                    disabled={addLoading || !addAmount || parseFloat(addAmount) <= 0}
                    style={{ flex: 2, fontSize: '1rem', padding: '0.875rem' }}
                  >
                    {addLoading
                      ? <><span className="animate-spin">⟳</span> Processing...</>
                      : <>💰 Add {addAmount && parseFloat(addAmount) > 0 ? fmtCurrency(parseFloat(addAmount)) : 'Money'}</>
                    }
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
