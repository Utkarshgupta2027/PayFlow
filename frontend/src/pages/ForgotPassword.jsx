import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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

export default function ForgotPassword() {
  const [email, setEmail]             = useState('')
  const [otp, setOtp]                 = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [step, setStep]               = useState(1) // 1: Email, 2: OTP & New Password
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const navigate = useNavigate()

  const handleSendOtp = async (e) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setError('Please enter a valid email address.')
    }
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/user/forgot-password/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      })
      if (!res.ok) {
        const msg = await extractErrorMessage(res, 'Failed to send OTP.')
        throw new Error(msg)
      }
      setStep(2)
      alert('OTP sent successfully to ' + email)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setError('')
    if (!otp.trim()) return setError('Please enter the OTP.')
    if (newPassword.length < 6) return setError('Password must be at least 6 characters.')

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/user/forgot-password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim(), newPassword })
      })
      if (!res.ok) {
        const msg = await extractErrorMessage(res, 'Failed to reset password.')
        throw new Error(msg)
      }
      alert('Password reset successfully! Please login with your new password.')
      navigate('/login')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card animate-slide-up">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Reset Password
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            {step === 1 ? 'Enter your email to receive an OTP' : 'Enter the OTP and your new password'}
          </p>
        </div>

        {error && <div className="alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        {step === 1 ? (
          <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.1rem', pointerEvents: 'none' }}>✉️</span>
                <input
                  className="input-field"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{ paddingLeft: '2.5rem' }}
                  required
                  autoFocus
                />
              </div>
            </div>
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? <span className="animate-spin">⟳</span> : '✉️'}
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="label">Verification OTP</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.1rem', pointerEvents: 'none' }}>🔑</span>
                <input
                  className="input-field"
                  type="text"
                  placeholder="6-digit OTP"
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  style={{ paddingLeft: '2.5rem' }}
                  maxLength={6}
                  required
                  autoFocus
                />
              </div>
            </div>
            <div>
              <label className="label">New Password</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.1rem', pointerEvents: 'none' }}>🔒</span>
                <input
                  className="input-field"
                  type="password"
                  placeholder="Min. 6 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  style={{ paddingLeft: '2.5rem' }}
                  required
                />
              </div>
            </div>
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? <span className="animate-spin">⟳</span> : '✓'}
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setStep(1)} disabled={loading}>
              Back
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '1.5rem' }}>
          Remembered your password?{' '}
          <Link to="/login" style={{ color: 'var(--accent-light)', fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
