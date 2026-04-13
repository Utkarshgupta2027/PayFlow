import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { apiFetch } from '../api.js'

const TYPE_ICONS = {
  INFO: { icon: 'ℹ️', cls: 'notif-icon-info' },
  SUCCESS: { icon: '✅', cls: 'notif-icon-success' },
  ALERT: { icon: '🚨', cls: 'notif-icon-alert' },
  WARNING: { icon: '⚠️', cls: 'notif-icon-warning' },
}

function timeAgo(dateStr) {
  const d = new Date(dateStr)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function Notifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user?.id) return
    try {
      const res = await apiFetch(`/notifications/${user.id}`)
      if (res.ok) setNotifications(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }, [user?.id])

  useEffect(() => { load() }, [load])

  const markRead = async (id) => {
    await apiFetch(`/notifications/${id}/read`, { method: 'POST' })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const markAllRead = async () => {
    await apiFetch(`/notifications/read-all/${user.id}`, { method: 'POST' })
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>🔔 Notifications</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)' }}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button className="btn-secondary" onClick={markAllRead} style={{ width: 'auto' }}>
            Mark all read
          </button>
        )}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-faint)' }}>
          Loading notifications...
        </div>
      )}

      {!loading && notifications.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔔</div>
          <div style={{ color: 'var(--text-muted)', fontWeight: 500 }}>No notifications yet</div>
          <div style={{ color: 'var(--text-faint)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Notifications about your transactions will appear here
          </div>
        </div>
      )}

      {!loading && notifications.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {notifications.map(n => {
            const meta = TYPE_ICONS[n.type] || TYPE_ICONS.INFO
            return (
              <div
                key={n.id}
                className={`notif-item ${!n.read ? 'unread' : ''}`}
                onClick={() => !n.read && markRead(n.id)}
                style={{ cursor: n.read ? 'default' : 'pointer' }}
              >
                <div className={`notif-icon ${meta.cls}`}>{meta.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: n.read ? 500 : 700,
                    color: n.read ? 'var(--text-muted)' : 'var(--text-primary)',
                    marginBottom: '0.25rem',
                    fontSize: '0.875rem'
                  }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-faint)', lineHeight: 1.4 }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.375rem' }}>
                    {n.createdAt ? timeAgo(n.createdAt) : ''}
                  </div>
                </div>
                {!n.read && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
