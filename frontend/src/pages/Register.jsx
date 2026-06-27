import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import API_BASE from '../api.js'

async function extractErrorMessage(res, fallback = 'An error occurred. Please try again.') {
  try {
    const text = await res.text()
    if (!text) return fallback
    if (text.trimStart().startsWith('{')) {
      try {
        const json = JSON.parse(text)
        return json.message || json.error || json.details || text || fallback
      } catch { /* not JSON */ }
    }
    return text || fallback
  } catch {
    return fallback
  }
}

export default function Register() {
  const [name, setName]               = useState('')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [confirmPwd, setConfirmPwd]   = useState('')
  const [showPwd, setShowPwd]         = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError]             = useState('')
  const [success, setSuccess]         = useState('')
  const [loading, setLoading]         = useState(false)
  const [otp, setOtp]                 = useState('')
  const [otpSent, setOtpSent]         = useState(false)
  const [sendingOtp, setSendingOtp]   = useState(false)

  const { login } = useAuth()
  const navigate  = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!name.trim())  return setError('Please enter your full name.')
    if (!email.trim()) return setError('Please enter your email address.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return setError('Please enter a valid email address.')
    if (password.trim().length < 6) return setError('Password must be at least 6 characters.')
    if (password !== confirmPwd)    return setError('Passwords do not match.')
    if (!otp.trim()) {
      if (!otpSent) return setError('Please click "Send OTP" to verify your email first.')
      return setError('Please enter the OTP sent to your email.')
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/user/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name.trim(), email: email.trim(), password, otp: otp.trim() }),
      })

      if (!res.ok) {
        const msg = await extractErrorMessage(res, 'Registration failed. Please try again.')
        throw new Error(msg)
      }

      const data = await res.json()
      if (!data.token || !data.user) throw new Error('Invalid response from server. Please try again.')

      login(data.user, data.token, data.refreshToken)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSendOtp = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setError('Please enter a valid email address first.')
    }
    setSendingOtp(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch(`${API_BASE}/api/email-otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      })
      if (!res.ok) {
        const msg = await extractErrorMessage(res, 'Failed to send OTP.')
        throw new Error(msg)
      }
      setOtpSent(true)
      setSuccess(`OTP sent successfully to ${email.trim()}.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSendingOtp(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card animate-slide-up">

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '3.5rem', height: '3.5rem', borderRadius: '1rem',
            background: 'linear-gradient(135deg, var(--gradient-from), var(--gradient-to))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', margin: '0 auto 1rem', boxShadow: '0 8px 24px var(--accent-glow)',
          }}>✨</div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Create account
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Join PayFlow — it's free
          </p>
        </div>

        {error && <div className="alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
        {success && <div className="alert-success" style={{ marginBottom: '1rem' }}>{success}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Full Name */}
          <div>
            <label className="label">Full Name</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.1rem', pointerEvents: 'none' }}>👤</span>
              <input
                id="reg-name"
                className="input-field"
                type="text"
                placeholder="Your full name"
                value={name}
                onChange={e => setName(e.target.value)}
                style={{ paddingLeft: '2.5rem' }}
                required
                autoFocus
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.1rem', pointerEvents: 'none' }}>✉️</span>
              <input
                id="reg-email"
                className="input-field"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setOtpSent(false); setSuccess('') }}
                style={{ paddingLeft: '2.5rem' }}
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Email OTP</label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <input
                id="reg-otp"
                className="input-field"
                type="text"
                inputMode="numeric"
                placeholder="6-digit OTP"
                value={otp}
                maxLength={6}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{ flex: 1 }}
                required
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={handleSendOtp}
                disabled={sendingOtp || !email.trim()}
                style={{ width: 'auto', whiteSpace: 'nowrap', paddingInline: '1rem' }}
              >
                {sendingOtp ? 'Sending...' : otpSent ? 'Resend OTP' : 'Send OTP'}
              </button>
            </div>
            {otpSent && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                OTP sent to {email}. It is valid for 5 minutes.
              </div>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="label">Password</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.1rem', pointerEvents: 'none' }}>🔒</span>
              <input
                id="reg-password"
                className="input-field"
                type={showPwd ? 'text' : 'password'}
                placeholder="Min. 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ paddingLeft: '2.5rem', paddingRight: '3rem' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-muted)', padding: '0.25rem' }}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
              >
                {showPwd ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="label">Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.1rem', pointerEvents: 'none' }}>🔒</span>
              <input
                id="reg-confirm-password"
                className="input-field"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Re-enter password"
                value={confirmPwd}
                onChange={e => setConfirmPwd(e.target.value)}
                style={{ paddingLeft: '2.5rem', paddingRight: '3rem' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-muted)', padding: '0.25rem' }}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button id="reg-submit" className="btn-primary" type="submit" disabled={loading}>
            {loading ? <span className="animate-spin">⟳</span> : '🚀'}
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '1.5rem' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent-light)', fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
