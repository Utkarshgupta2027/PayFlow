import { useEffect } from 'react'

export default function Toast({ toast, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, toast.duration || 3500)
    return () => clearTimeout(timer)
  }, [toast])

  const typeClass = {
    success: 'toast-success',
    error: 'toast-error',
    info: 'toast-info',
    gold: 'toast-gold',
  }[toast.type] || 'toast-info'

  return (
    <div className={`toast ${typeClass}`}>
      {toast.icon && <span style={{ marginRight: '0.5rem' }}>{toast.icon}</span>}
      {toast.message}
    </div>
  )
}
