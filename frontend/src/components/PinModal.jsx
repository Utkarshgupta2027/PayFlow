import { useState, useRef, useEffect } from 'react'

/**
 * PinModal — Full-screen PIN entry overlay
 *
 * Props:
 *  - isOpen      {boolean}   show/hide
 *  - onConfirm   {(pin:string) => void}  called with the entered PIN string
 *  - onCancel    {() => void}
 *  - title       {string}    optional heading
 *  - subtitle    {string}    optional sub-text
 *  - error       {string}    external error message (triggers shake + clears digits)
 *  - loading     {boolean}   disables confirm button
 *  - length      {4|6}       number of PIN digits (default 4)
 */
export default function PinModal({
  isOpen,
  onConfirm,
  onCancel,
  title = '🔐 Enter Transaction PIN',
  subtitle = 'Confirm your identity to complete this payment',
  error = '',
  loading = false,
  length = 4,
}) {
  const [digits, setDigits] = useState(Array(length).fill(''))
  const [shake, setShake] = useState(false)
  const [visible, setVisible] = useState(false)
  const inputRefs = useRef([])

  // Focus first input when opened
  useEffect(() => {
    if (isOpen) {
      setDigits(Array(length).fill(''))
      setShake(false)
      setTimeout(() => inputRefs.current[0]?.focus(), 80)
    }
  }, [isOpen, length])

  // Shake + clear on external error
  useEffect(() => {
    if (error) {
      setShake(true)
      setDigits(Array(length).fill(''))
      setTimeout(() => {
        setShake(false)
        inputRefs.current[0]?.focus()
      }, 600)
    }
  }, [error, length])

  if (!isOpen) return null

  const handleKey = (e, idx) => {
    const { key } = e
    if (key === 'Backspace') {
      e.preventDefault()
      if (digits[idx]) {
        const next = [...digits]; next[idx] = ''; setDigits(next)
      } else if (idx > 0) {
        const next = [...digits]; next[idx - 1] = ''; setDigits(next)
        inputRefs.current[idx - 1]?.focus()
      }
      return
    }
    if (key === 'Enter') { handleConfirm(); return }
    if (key === 'Escape') { onCancel(); return }
    if (!/^\d$/.test(key)) { e.preventDefault(); return }

    e.preventDefault()
    const next = [...digits]; next[idx] = key; setDigits(next)
    if (idx < length - 1) inputRefs.current[idx + 1]?.focus()
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    const next = Array(length).fill('')
    pasted.split('').forEach((d, i) => { if (i < length) next[i] = d })
    setDigits(next)
    const focusIdx = Math.min(pasted.length, length - 1)
    inputRefs.current[focusIdx]?.focus()
  }

  const handleConfirm = () => {
    const pin = digits.join('')
    if (pin.length < length) { inputRefs.current[digits.findIndex(d => !d)]?.focus(); return }
    onConfirm(pin)
  }

  const filled = digits.filter(Boolean).length

  return (
    <div className="pin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className={`pin-modal${shake ? ' pin-modal-shake' : ''}`}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            width: '3.5rem', height: '3.5rem', borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--gradient-from), var(--gradient-to))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', margin: '0 auto 1rem',
            boxShadow: '0 8px 24px rgba(99,102,241,0.35)'
          }}>
            🔐
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            {title}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.375rem' }}>
            {subtitle}
          </p>
        </div>

        {/* Digit inputs */}
        <div className="pin-input-group" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              id={`pin-digit-${i}`}
              ref={el => (inputRefs.current[i] = el)}
              className={`pin-digit${d ? ' pin-digit-filled' : ''}`}
              type={visible ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={1}
              value={d}
              readOnly
              onKeyDown={e => handleKey(e, i)}
              onClick={() => inputRefs.current[i]?.focus()}
              autoComplete="off"
            />
          ))}
        </div>

        {/* Progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.375rem', marginTop: '0.875rem' }}>
          {Array(length).fill(0).map((_, i) => (
            <div
              key={i}
              style={{
                width: '0.4rem', height: '0.4rem', borderRadius: '50%',
                background: i < filled ? 'var(--accent)' : 'var(--border-color)',
                transition: 'background 0.2s ease'
              }}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="pin-error animate-slide-up">
            ⚠️ {error}
          </div>
        )}

        {/* Show/hide toggle */}
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-faint)', fontSize: '0.75rem',
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            margin: '0.75rem auto 0', padding: '0.25rem 0.5rem',
            borderRadius: '0.375rem',
            transition: 'color 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-muted)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}
        >
          {visible ? '🙈 Hide digits' : '👁 Show digits'}
        </button>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: '0 0 auto', padding: '0.75rem 1.25rem',
              background: 'var(--bg-input)', color: 'var(--text-muted)',
              border: '1px solid var(--border-color)', borderRadius: '0.75rem',
              fontWeight: 600, fontSize: '0.9375rem', cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Cancel
          </button>
          <button
            id="pin-confirm-btn"
            type="button"
            onClick={handleConfirm}
            disabled={loading || filled < length}
            className="btn-primary"
            style={{ flex: 1 }}
          >
            {loading
              ? <><span className="animate-spin">⟳</span> Verifying…</>
              : filled < length
                ? `Enter ${length - filled} more digit${length - filled > 1 ? 's' : ''}`
                : '✓ Confirm Payment'
            }
          </button>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: '0.75rem', marginTop: '1rem' }}>
          🔒 PIN never stored in plain text
        </p>
      </div>
    </div>
  )
}
