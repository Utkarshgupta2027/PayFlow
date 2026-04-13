import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { WebSocketProvider } from '../context/WebSocketContext.jsx'
import Toast from './Toast.jsx'
import { apiFetch } from '../api.js'

const NAV_ITEMS = [
  { to: '/',          icon: '🏠', label: 'Dashboard',   end: true },
  { to: '/analytics', icon: '📊', label: 'Analytics' },
  { to: '/rewards',   icon: '⭐', label: 'Rewards' },
  { to: '/referral',  icon: '🔗', label: 'Refer & Earn' },
  { to: '/send',      icon: '💸', label: 'Send Money' },
  { to: '/qr',        icon: '📷', label: 'QR Scanner' },
  { to: '/split',     icon: '🔀', label: 'Split Payment' },
]

export default function Layout() {
  const { user, logout, updateUser, isAdmin } = useAuth()
  const { theme } = useTheme()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)
  const [wsConnected, setWsConnected] = useState(false)

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  // Fetch unread notifications count
  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id) return
    try {
      const res = await apiFetch(`/notifications/${user.id}/unread-count`)
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.count || 0)
      }
    } catch { /* ignore */ }
  }, [user?.id])

  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30_000) // poll every 30s as fallback
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  // WebSocket handlers
  const handleNotification = useCallback((notification) => {
    setUnreadCount(c => c + 1)
    setToast({ message: `${notification.title}: ${notification.message}`, type: notification.type?.toLowerCase() || 'info' })
  }, [])

  const handleBalanceUpdate = useCallback((newBalance) => {
    if (user) {
      updateUser({ ...user, balance: newBalance })
    }
  }, [user, updateUser])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <WebSocketProvider
      userEmail={user?.email}
      onNotification={handleNotification}
      onBalanceUpdate={handleBalanceUpdate}
    >
      <div className="app-layout">
        {/* Mobile header */}
        <header className="mobile-header">
          <button className="btn-icon" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle menu">☰</button>
          <span className="sidebar-logo-text">PayFlow</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              className="btn-icon notif-bell"
              onClick={() => navigate('/notifications')}
              aria-label="Notifications"
              style={{ position: 'relative' }}
            >
              🔔
              {unreadCount > 0 && (
                <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>
            <div className="avatar" style={{ width: '2rem', height: '2rem', fontSize: '0.75rem' }}>{initials}</div>
          </div>
        </header>

        {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="md-overlay" />}

        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-logo">
            <div className="sidebar-logo-text">⚡ PayFlow</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.25rem' }}>
              Smart Payments
            </div>
          </div>

          <nav className="nav-section">
            <div className="nav-label">Main Menu</div>
            {NAV_ITEMS.map(({ to, icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon">{icon}</span>
                <span>{label}</span>
              </NavLink>
            ))}

            {/* Notifications link */}
            <NavLink
              to="/notifications"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              style={{ position: 'relative' }}
            >
              <span className="nav-icon">🔔</span>
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="notif-badge" style={{ position: 'static', marginLeft: 'auto' }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </NavLink>

            <div className="nav-label" style={{ marginTop: '1.5rem' }}>Account</div>

            {/* Admin Panel — only for admins */}
            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                style={{ color: '#f59e0b' }}
              >
                <span className="nav-icon">🛡️</span>
                <span>Admin Panel</span>
              </NavLink>
            )}

            <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="nav-icon">⚙️</span>
              <span>Settings</span>
            </NavLink>
            <button className="nav-item" onClick={handleLogout} style={{ color: '#f87171' }}>
              <span className="nav-icon">🚪</span>
              <span>Logout</span>
            </button>
          </nav>

          <div className="sidebar-user">
            <div style={{ position: 'relative' }}>
              <div className="avatar">{initials}</div>
              {/* Online indicator */}
              <span style={{
                position: 'absolute', bottom: 0, right: 0,
                width: '10px', height: '10px',
                borderRadius: '50%', background: '#22c55e',
                border: '2px solid var(--bg-card)'
              }} title="Online" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {user?.name || 'User'}
                {isAdmin && <span style={{ fontSize: '0.65rem', background: '#f59e0b', color: '#000', borderRadius: '4px', padding: '1px 5px', marginLeft: '6px' }}>ADMIN</span>}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email || ''}
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="main-content animate-fade-in">
          <Outlet context={{ setToast }} />
        </main>

        {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
      </div>
    </WebSocketProvider>
  )
}
