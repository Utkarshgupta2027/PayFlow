import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useOutletContext } from 'react-router-dom'
import { apiUrl } from '../api.js'

const TIERS = {
  BRONZE:   { label: 'Bronze',   min: 0,    max: 499,  icon: '🥉', class: 'tier-bronze', next: 'Silver', nextAt: 500 },
  SILVER:   { label: 'Silver',   min: 500,  max: 1999, icon: '🥈', class: 'tier-silver', next: 'Gold',   nextAt: 2000 },
  GOLD:     { label: 'Gold',     min: 2000, max: 4999, icon: '🥇', class: 'tier-gold',   next: 'Platinum', nextAt: 5000 },
  PLATINUM: { label: 'Platinum', min: 5000, max: Infinity, icon: '💎', class: 'tier-platinum', next: null },
}

function fmtDate(s) {
  if (!s) return ''
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Rewards() {
  const { user } = useAuth()
  const { setToast } = useOutletContext()
  const [rewards, setRewards] = useState(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [alreadyClaimed, setAlreadyClaimed] = useState(false)

  const fetchRewards = () => {
    if (!user?.id) return
    fetch(apiUrl(`/rewards/${user.id}`))
      .then(r => r.json())
      .then(d => {
        setRewards(d)
        // Check if daily bonus already claimed today by looking at history
        const todayStr = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
        const claimedToday = d.history?.some(
          r => r.source === 'DAILY_BONUS' && r.date === todayStr
        )
        setAlreadyClaimed(!!claimedToday)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchRewards() }, [user?.id])

  const claimBonus = async () => {
    setClaiming(true)
    try {
      const res = await fetch(apiUrl(`/rewards/daily-bonus/${user.id}`), { method: 'POST' })
      const d = await res.json()
      if (d.alreadyClaimed || d.pointsAwarded === 0) {
        setAlreadyClaimed(true)
        setToast({ type: 'info', icon: '⏳', message: 'Daily bonus already claimed today! Come back tomorrow.' })
      } else {
        setAlreadyClaimed(true)
        setToast({ type: 'gold', icon: '🎁', message: `+${d.pointsAwarded} bonus points earned! Total: ${d.totalPoints} pts`, duration: 4000 })
        fetchRewards()
      }
    } catch {
      setToast({ type: 'error', message: 'Failed to claim bonus. Try again.' })
    } finally {
      setClaiming(false)
    }
  }

  const tier = rewards ? TIERS[rewards.tier] || TIERS.BRONZE : TIERS.BRONZE
  const totalPoints = rewards?.totalPoints || 0
  const progress = tier.next
    ? Math.min(100, ((totalPoints - tier.min) / (tier.nextAt - tier.min)) * 100)
    : 100

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <span className="animate-spin" style={{ fontSize: '2.5rem' }}>⟳</span>
    </div>
  )

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>⭐ Rewards</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Earn points on every transaction</p>
      </div>

      {/* Hero Card */}
      <div className="rewards-hero" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{ color: 'rgba(255,200,120,0.8)', fontSize: '0.8125rem', marginBottom: '0.375rem' }}>
              Total Points Balance
            </div>
            <div style={{ fontSize: '3rem', fontWeight: 900, color: '#fbbf24', letterSpacing: '-0.02em' }}>
              {totalPoints.toLocaleString()}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              pts
            </div>
          </div>
          <div className={`tier-badge ${tier.class}`} style={{ fontSize: '0.875rem', padding: '0.5rem 1.125rem' }}>
            {tier.icon} {tier.label}
          </div>
        </div>

        {/* Tier Progress */}
        {tier.next && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)', marginBottom: '0.5rem' }}>
              <span>{tier.icon} {tier.label}</span>
              <span>{tier.nextAt - totalPoints} pts to {tier.next}</span>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #fbbf24, #f59e0b)',
                borderRadius: '99px',
                transition: 'width 1s ease',
              }} />
            </div>
          </div>
        )}
        {!tier.next && (
          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '99px', height: '8px', overflow: 'hidden', marginTop: '0.5rem' }}>
            <div style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg, #06b6d4, #a78bfa)', borderRadius: '99px' }} />
          </div>
        )}
      </div>

      {/* Tier Progress Overview */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 1rem' }}>🏆 Tier Levels</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
          {Object.values(TIERS).map(t => (
            <div key={t.label} style={{
              padding: '0.75rem',
              borderRadius: '0.75rem',
              border: `1px solid ${rewards?.tier === t.label.toUpperCase() ? 'var(--accent)' : 'var(--border-color)'}`,
              background: rewards?.tier === t.label.toUpperCase() ? 'var(--accent-glow)' : 'var(--bg-input)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{t.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '0.75rem' }}>{t.label}</div>
              <div style={{ color: 'var(--text-faint)', fontSize: '0.625rem', marginTop: '0.2rem' }}>
                {t.min === 0 ? '0' : t.min.toLocaleString()}
                {t.max !== Infinity ? `–${t.max.toLocaleString()}` : '+'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Bonus */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 0.875rem' }}>🎁 Daily Bonus</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', background: 'var(--bg-input)', borderRadius: '0.75rem', padding: '1rem' }}>
          <div style={{ fontSize: '2.5rem' }}>🎯</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>+50 Points Daily</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              Log in every day to earn your daily bonus. Streak rewards coming soon!
            </div>
          </div>
        </div>
        <button
          id="claim-bonus-btn"
          className="daily-bonus-btn"
          onClick={claimBonus}
          disabled={alreadyClaimed || claiming}
        >
          {claiming ? <span className="animate-spin">⟳</span> : '🎁'}
          {alreadyClaimed ? '✅ Bonus Claimed Today' : claiming ? 'Claiming...' : 'Claim Daily Bonus (+50 pts)'}
        </button>
        {alreadyClaimed && (
          <p style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: '0.8125rem', marginTop: '0.625rem' }}>
            Come back tomorrow for your next bonus!
          </p>
        )}
      </div>

      {/* Reward Rules */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 0.875rem' }}>💡 How to Earn</h2>
        {[
          { icon: '💸', title: 'Send Money', desc: 'Earn 1 point per ₹10 spent', points: '1 pt / ₹10' },
          { icon: '🎁', title: 'Daily Login', desc: 'Log in every day to earn points', points: '+50 pts' },
          { icon: '🎯', title: 'Milestones', desc: 'Unlock bonus points at tier upgrades', points: 'Coming soon' },
        ].map(({ icon, title, desc, points }) => (
          <div key={title} className="reward-item">
            <div className="reward-icon">{icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{title}</div>
              <div style={{ color: 'var(--text-faint)', fontSize: '0.8125rem' }}>{desc}</div>
            </div>
            <div style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', padding: '0.25rem 0.625rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 700, border: '1px solid rgba(245,158,11,0.3)' }}>
              {points}
            </div>
          </div>
        ))}
      </div>

      {/* History */}
      <div className="card">
        <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 0.875rem' }}>📜 Points History</h2>
        {!rewards?.history?.length ? (
          <div style={{ textAlign: 'center', color: 'var(--text-faint)', padding: '1.5rem' }}>
            No reward history yet. Start earning!
          </div>
        ) : (
          rewards.history.map((r, i) => (
            <div key={r.id || i} className="reward-item">
              <div className="reward-icon">
                {r.source === 'DAILY_BONUS' ? '🎁' : '💸'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  {r.source === 'DAILY_BONUS' ? 'Daily Login Bonus' : 'Transaction Reward'}
                </div>
                <div style={{ color: 'var(--text-faint)', fontSize: '0.75rem' }}>
                  {fmtDate(r.date)}
                </div>
              </div>
              <div style={{ fontWeight: 700, color: '#fbbf24', fontSize: '1rem' }}>
                +{r.points}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
