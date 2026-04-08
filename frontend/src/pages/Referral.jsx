import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useOutletContext } from 'react-router-dom'
import { apiUrl } from '../api.js'

function copyToClipboard(text) {
  return navigator.clipboard.writeText(text).catch(() => {
    const el = document.createElement('textarea')
    el.value = text
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  })
}

export default function Referral() {
  const { user } = useAuth()
  const { setToast } = useOutletContext()

  const [referralCode, setReferralCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [claimCode, setClaimCode] = useState('')
  const [claiming, setClaiming] = useState(false)
  const [alreadyClaimed, setAlreadyClaimed] = useState(false)
  const [claimSuccess, setClaimSuccess] = useState(null)
  const [claimError, setClaimError] = useState('')
  const [sharing, setSharing] = useState(false)

  const shareLink = `https://payflow.app/join?ref=${referralCode}`

  useEffect(() => {
    if (!user?.id) return
    fetch(apiUrl(`/referral/code/${user.id}`))
      .then(r => r.json())
      .then(d => {
        setReferralCode(d.referralCode || '')
        // Backend response tells us if they already used a referral code
        if (d.referredBy) setAlreadyClaimed(true)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user?.id])

  const copyCode = async () => {
    await copyToClipboard(referralCode)
    setToast({ type: 'success', icon: '📋', message: 'Referral code copied!', duration: 2000 })
  }

  const copyLink = async () => {
    await copyToClipboard(shareLink)
    setToast({ type: 'success', icon: '🔗', message: 'Invite link copied!', duration: 2000 })
  }

  const shareReferral = async () => {
    setSharing(true)
    const text = `Join me on PayFlow! Use my referral code ${referralCode} and earn ₹50 bonus points. Sign up here: ${shareLink}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Join PayFlow', text })
        setToast({ type: 'success', icon: '📤', message: 'Invite shared!' })
      } else {
        await copyToClipboard(text)
        setToast({ type: 'info', icon: '📋', message: 'Invite message copied to clipboard!' })
      }
    } catch (err) {
      if (err.name !== 'AbortError') setToast({ type: 'error', message: 'Could not share' })
    } finally {
      setSharing(false)
    }
  }

  const handleClaim = async (e) => {
    e.preventDefault()
    if (!claimCode.trim()) return
    setClaiming(true)
    setClaimError('')
    setClaimSuccess(null)
    try {
      const res = await fetch(
        apiUrl(`/referral/claim?userId=${user.id}&code=${claimCode.trim().toUpperCase()}`),
        { method: 'POST' }
      )
      const d = await res.json()
      if (!res.ok) {
        setClaimError(typeof d === 'string' ? d : 'Invalid referral code.')
        return
      }
      if (d.success === false) {
        setClaimError(d.message)
        setAlreadyClaimed(true)
        return
      }
      setClaimSuccess(d)
      setAlreadyClaimed(true)
      setClaimCode('')
      setToast({ type: 'gold', icon: '🎁', message: `+${d.pointsEarned} points earned from referral!`, duration: 4000 })
    } catch {
      setClaimError('Something went wrong. Try again.')
    } finally {
      setClaiming(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <span className="animate-spin" style={{ fontSize: '2.5rem' }}>⟳</span>
    </div>
  )

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>🔗 Refer & Earn</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          Share your code and earn reward points for every friend who joins
        </p>
      </div>

      {/* ── How it Works Banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(14,165,233,0.1))',
        border: '1px solid rgba(16,185,129,0.25)',
        borderRadius: '1.125rem', padding: '1.5rem', marginBottom: '1.5rem',
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', textAlign: 'center'
      }}>
        {[
          { icon: '📤', step: '1', label: 'Share your code', desc: 'Send your unique referral code to friends' },
          { icon: '📱', step: '2', label: 'Friend signs up', desc: 'They join PayFlow & enter your code' },
          { icon: '🎁', step: '3', label: 'Both earn!', desc: 'You get +100 pts, they get +50 pts' },
        ].map(({ icon, step, label, desc }) => (
          <div key={step}>
            <div style={{
              width: '3rem', height: '3rem', margin: '0 auto 0.75rem',
              borderRadius: '50%', background: 'var(--accent-glow)',
              border: '1px solid var(--accent)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem'
            }}>{icon}</div>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '0.25rem' }}>{label}</div>
            <div style={{ color: 'var(--text-faint)', fontSize: '0.75rem' }}>{desc}</div>
          </div>
        ))}
      </div>

      {/* ── Your Referral Code ── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 1.25rem' }}>
          🪪 Your Referral Code
        </h2>

        {/* Code display */}
        <div style={{
          background: 'var(--bg-input)', borderRadius: '1rem',
          padding: '1.5rem', textAlign: 'center', marginBottom: '1.25rem',
          border: '2px dashed var(--accent)', position: 'relative', overflow: 'hidden'
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Your Unique Code
          </div>
          <div style={{
            fontSize: '2.25rem', fontWeight: 900, letterSpacing: '0.2em',
            color: 'var(--accent-light)', fontFamily: 'monospace',
            textShadow: '0 0 20px var(--accent-glow)'
          }}>
            {referralCode || '——————'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.5rem' }}>
            Share with friends to earn 100 points per referral
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
          <button id="copy-code-btn" className="btn-secondary" onClick={copyCode} style={{ fontSize: '0.8125rem' }}>
            📋 Copy Code
          </button>
          <button id="copy-link-btn" className="btn-secondary" onClick={copyLink} style={{ fontSize: '0.8125rem' }}>
            🔗 Copy Link
          </button>
          <button id="share-referral-btn" className="btn-primary" onClick={shareReferral}
            disabled={sharing} style={{ fontSize: '0.8125rem' }}>
            {sharing ? <><span className="animate-spin">⟳</span> Sharing...</> : '📤 Share'}
          </button>
        </div>
      </div>

      {/* ── Reward Summary ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🎁</div>
          <div className="stat-number" style={{ color: '#fbbf24' }}>+100</div>
          <div className="stat-label">Points you earn per referral</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>👥</div>
          <div className="stat-number" style={{ color: '#34d399' }}>+50</div>
          <div className="stat-label">Points your friend earns</div>
        </div>
      </div>

      {/* ── Claim a Referral ── */}
      <div className="card">
        <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
          🔑 Have a Referral Code?
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: '0 0 1.25rem' }}>
          Enter a friend's referral code to earn +50 bonus points. Can only be used once.
        </p>

        {claimSuccess && (
          <div className="alert-success animate-slide-up" style={{ marginBottom: '1.25rem' }}>
            🎊 Referral claimed from <strong>{claimSuccess.refereeName}</strong>!
            <br />
            <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>
              You earned <strong>+{claimSuccess.pointsEarned} points</strong> · They earned +{claimSuccess.referrerBonus} points
            </span>
          </div>
        )}

        {alreadyClaimed && !claimSuccess ? (
          <div style={{
            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
            borderRadius: '0.75rem', padding: '1rem',
            display: 'flex', gap: '0.75rem', alignItems: 'center'
          }}>
            <span style={{ fontSize: '1.5rem' }}>✅</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Referral bonus already claimed</div>
              <div style={{ color: 'var(--text-faint)', fontSize: '0.8rem' }}>You can only use one referral code per account.</div>
            </div>
          </div>
        ) : !alreadyClaimed && (
          <form onSubmit={handleClaim} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {claimError && (
              <div className="alert-error animate-slide-up">{claimError}</div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <input
                id="claim-code-input"
                className="input-field"
                style={{ fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', flex: 1 }}
                placeholder="e.g. ABCD1234"
                value={claimCode}
                onChange={e => { setClaimCode(e.target.value.toUpperCase()); setClaimError('') }}
                maxLength={8}
                required
              />
              <button
                id="claim-referral-btn"
                className="btn-primary"
                type="submit"
                disabled={claiming || claimCode.length < 6}
                style={{ width: 'auto', padding: '0 1.5rem', whiteSpace: 'nowrap' }}
              >
                {claiming ? <span className="animate-spin">⟳</span> : '🎁 Claim'}
              </button>
            </div>
            <p style={{ color: 'var(--text-faint)', fontSize: '0.75rem', margin: 0 }}>
              💡 You'll receive 50 points instantly. The person who referred you gets 100 points too!
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
