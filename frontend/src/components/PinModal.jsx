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
  const [pinValue, setPinValue] = useState('')
  const [shake, setShake] = useState(false)
  const [visible, setVisible] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const hiddenInputRef = useRef(null)

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setPinValue('')
      setShake(false)
      setTimeout(() => hiddenInputRef.current?.focus(), 80)
    }
  }, [isOpen, length])

  // Shake + clear on external error
  useEffect(() => {
    if (error) {
      setShake(true)
      setPinValue('')
      setTimeout(() => {
        setShake(false)
        hiddenInputRef.current?.focus()
      }, 600)
    }
  }, [error])

  if (!isOpen) return null

  const handleInputChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, length)
    setPinValue(val)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (pinValue.length === length && !loading) {
        onConfirm(pinValue)
      }
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  const handleConfirm = () => {
    if (pinValue.length === length && !loading) {
      onConfirm(pinValue)
    }
  }

  const focusInput = () => {
    hiddenInputRef.current?.focus()
  }

  const digits = Array(length).fill('').map((_, i) => pinValue[i] || '')
  const filled = pinValue.length

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

        {/* Hidden input field for mobile/accessibility keyboard support */}
        <input
          ref={hiddenInputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={length}
          value={pinValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            position: 'absolute',
            opacity: 0,
            pointerEvents: 'none',
            width: '1px',
            height: '1px',
            border: 'none',
            outline: 'none',
            background: 'transparent',
          }}
          autoComplete="one-time-code"
        />

        {/* Visual Digit boxes */}
        <div className="pin-input-group" onClick={focusInput} style={{ cursor: 'pointer' }}>
          {digits.map((d, i) => {
            const isDigitFocused = isFocused && (
              i === filled || (filled === length && i === length - 1)
            )
            const displayChar = d ? (visible ? d : '●') : ''
            return (
              <div
                key={i}
                id={`pin-digit-${i}`}
                className={`pin-digit${d ? ' pin-digit-filled' : ''}${isDigitFocused ? ' pin-digit-focused' : ''}`}
              >
                {displayChar}
              </div>
            )
          })}
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
