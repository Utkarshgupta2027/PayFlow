import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useOutletContext } from 'react-router-dom'
import API_BASE from '../api.js'

export default function Feedback() {
  const { user } = useAuth()
  const { setToast } = useOutletContext()
  
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState(5)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!subject.trim() || !message.trim()) {
      setToast({ message: 'Please fill in all fields', type: 'error' })
      return
    }

    setLoading(true)
    try {
      const payload = {
        name: user?.name || 'Anonymous',
        email: user?.email || 'anonymous@payflow.com',
        subject: subject.trim(),
        message: message.trim(),
        rating: parseInt(rating, 10)
      }

      const res = await fetch(`${API_BASE}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || 'Failed to submit feedback')
      }

      setToast({ message: 'Thank you! Your feedback has been submitted successfully.', type: 'success' })
      setSubject('')
      setMessage('')
      setRating(5)
    } catch (err) {
      setToast({ message: err.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.75rem', textAlign: 'center' }}>
        <div style={{
          width: '4rem', height: '4rem', borderRadius: '1rem',
          background: 'linear-gradient(135deg, var(--gradient-from), var(--gradient-to))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2rem', margin: '0 auto 1rem', boxShadow: '0 8px 24px var(--accent-glow)',
        }}>💬</div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Send Feedback</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>We'd love to hear your thoughts to improve PayFlow.</p>
      </div>

      <div className="settings-section" style={{ border: '1px solid var(--border-color)', borderRadius: '1rem', background: 'var(--bg-card)', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
        <div className="settings-section-header" style={{ borderBottom: '1px solid var(--border-color)', padding: '1.25rem 1.5rem', background: 'var(--bg-input)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>📝 Feedback Details</h2>
        </div>
        
        <div style={{ padding: '1.5rem' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div>
              <label className="label" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Subject</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.1rem', pointerEvents: 'none' }}>📌</span>
                <input
                  type="text"
                  className="input-field"
                  placeholder="What is this regarding?"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={{ paddingLeft: '2.75rem' }}
                  required
                />
              </div>
            </div>

            <div>
              <label className="label" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>How would you rate your experience?</label>
              <div style={{ 
                display: 'flex', 
                gap: '0.75rem', 
                alignItems: 'center',
                background: 'var(--bg-input)',
                padding: '0.75rem 1rem',
                borderRadius: '0.75rem',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '2rem',
                        cursor: 'pointer',
                        color: star <= rating ? '#f59e0b' : 'var(--border-color)',
                        transition: 'all 0.2s',
                        padding: 0,
                        transform: star <= rating ? 'scale(1.1)' : 'scale(1)'
                      }}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <div style={{ 
                  marginLeft: 'auto', 
                  color: rating >= 4 ? '#10b981' : rating === 3 ? '#f59e0b' : '#ef4444',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  background: 'rgba(0,0,0,0.1)',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '99px'
                }}>
                  {rating === 5 ? 'Excellent 🤩' : rating === 4 ? 'Good 😊' : rating === 3 ? 'Average 😐' : rating === 2 ? 'Poor 😞' : 'Terrible 😫'}
                </div>
              </div>
            </div>

            <div>
              <label className="label" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Message</label>
              <textarea
                className="input-field"
                placeholder="Tell us what you think in detail..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                style={{ resize: 'vertical', padding: '1rem' }}
                required
              />
            </div>

            <button 
              type="submit" 
              className="btn-primary" 
              disabled={loading}
              style={{ 
                marginTop: '0.5rem', 
                padding: '0.875rem', 
                fontSize: '1rem', 
                fontWeight: 600,
                boxShadow: '0 4px 14px var(--accent-glow)'
              }}
            >
              {loading ? <span className="animate-spin">⟳</span> : '✉️'}
              {loading ? ' Sending...' : ' Submit Feedback'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
