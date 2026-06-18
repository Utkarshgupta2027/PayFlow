import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { WebSocketProvider } from '../context/WebSocketContext.jsx'
import Toast from './Toast.jsx'
import UserAvatar from './UserAvatar.jsx'
import { apiFetch } from '../api.js'

const NAV_ITEMS = [
  { to: '/', icon: 'home', labelKey: 'nav.dashboard', end: true },
  { to: '/transactions', icon: 'list', labelKey: 'nav.transactions' },
  { to: '/bills', icon: 'receipt', labelKey: 'nav.bills' },
  { to: '/analytics', icon: 'chart', labelKey: 'nav.analytics' },
  { to: '/rewards', icon: 'star', labelKey: 'nav.rewards' },
  { to: '/referral', icon: 'link', labelKey: 'nav.referral' },
  { to: '/send', icon: 'send', labelKey: 'nav.send' },
  { to: '/request', icon: 'request', labelKey: 'nav.request' },
  { to: '/check-balance', icon: 'wallet', labelKey: 'nav.balance' },
  { to: '/qr', icon: 'qr', labelKey: 'nav.qr' },
  { to: '/split', icon: 'split', labelKey: 'nav.split' },
  { to: '/scheduled', icon: 'calendar', labelKey: 'nav.scheduled' },
  { to: '/feedback', icon: 'chat', labelKey: 'nav.feedback' },
]

function NavIcon({ name }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }
  const paths = {
    home: <><path {...common} d="M3 10.5 12 3l9 7.5" /><path {...common} d="M5 10v10h5v-6h4v6h5V10" /></>,
    chart: <><path {...common} d="M4 19V5" /><path {...common} d="M4 19h16" /><path {...common} d="M8 15l3-4 3 2 4-7" /></>,
    star: <path {...common} d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 16.9l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />,
    link: <><path {...common} d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" /><path {...common} d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" /></>,
    send: <><path {...common} d="m21 3-6.5 18-3.7-7.8L3 9.5 21 3Z" /><path {...common} d="m11 13 4-4" /></>,
    request: <><path {...common} d="M12 3v18" /><path {...common} d="M8 7h6.5a3.5 3.5 0 0 1 0 7H8" /><path {...common} d="M16 14H8l7 7" /></>,
    wallet: <><path {...common} d="M4 7h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h13" /><path {...common} d="M16 13h5" /></>,
    qr: <><path {...common} d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" /><path {...common} d="M14 14h2v2h-2zM18 14h2v6h-4v-2" /></>,
    split: <><path {...common} d="M6 3v4a5 5 0 0 0 5 5h7" /><path {...common} d="m15 9 3 3-3 3" /><path {...common} d="M6 21v-4a5 5 0 0 1 5-5" /></>,
    calendar: <><path {...common} d="M7 3v4M17 3v4M4 9h16" /><rect {...common} x="4" y="5" width="16" height="16" rx="2" /></>,
    chat: <><path {...common} d="M4 5h16v11H8l-4 4V5Z" /><path {...common} d="M8 9h8M8 13h5" /></>,
    list: <><path {...common} d="M8 6h13M8 12h13M8 18h13" /><path {...common} d="M3 6h.01M3 12h.01M3 18h.01" /></>,
    receipt: <><path {...common} d="M6 3h12v18l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2L6 21V3Z" /><path {...common} d="M9 8h6M9 12h6M9 16h4" /></>,
    bell: <><path {...common} d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path {...common} d="M10 21h4" /></>,
    settings: <><path {...common} d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" /><path {...common} d="M19.4 15a8 8 0 0 0 .1-2l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.7-1L15 5.5h-4l-.4 2.6a8 8 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.5a8 8 0 0 0 .1 2l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 1.7 1l.4 2.6h4l.4-2.6a8 8 0 0 0 1.7-1l2.4 1 2-3.4-2.2-1.5Z" /></>,
    logout: <><path {...common} d="M10 17l5-5-5-5" /><path {...common} d="M15 12H3" /><path {...common} d="M21 4v16" /></>,
    admin: <><path {...common} d="M12 3 4 6v6c0 5 3.4 8.5 8 9 4.6-.5 8-4 8-9V6l-8-3Z" /><path {...common} d="m9 12 2 2 4-5" /></>,
  }

  return (
    <svg className="nav-svg" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name] || paths.list}
    </svg>
  )
}

export default function Layout() {
  const { user, logout, updateUser, isAdmin } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

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
    const interval = setInterval(fetchUnreadCount, 30_000)
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  const handleNotification = useCallback((notification) => {
    setUnreadCount(c => c + 1)
    setToast({ message: `${notification.title}: ${notification.message}`, type: notification.type?.toLowerCase() || 'info' })
  }, [])

  const handleBalanceUpdate = useCallback((newBalance) => {
    if (user) updateUser({ ...user, balance: newBalance })
  }, [user, updateUser])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <WebSocketProvider
      userEmail={user?.email}
      onNotification={handleNotification}
      onBalanceUpdate={handleBalanceUpdate}
    >
      <div className="app-layout">
        <header className="mobile-header">
          <button className="btn-icon" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle menu">☰</button>
          <span className="sidebar-logo-text">PayFlow</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              className="btn-icon notif-bell"
              onClick={() => navigate('/notifications')}
              aria-label={t('nav.notifications')}
              style={{ position: 'relative' }}
            >
              <NavIcon name="bell" />
              {unreadCount > 0 && (
                <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>
            <UserAvatar user={user} size="2rem" fontSize="0.75rem" />
          </div>
        </header>

        {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="md-overlay" />}

        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-logo">
            <div className="sidebar-logo-text">PayFlow</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.25rem' }}>
              {t('app.tagline')}
            </div>
          </div>

          <nav className="nav-section">
            <div className="nav-label">{t('nav.mainMenu')}</div>
            {NAV_ITEMS.map(({ to, icon, labelKey, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon"><NavIcon name={icon} /></span>
                <span>{t(labelKey)}</span>
              </NavLink>
            ))}

            <NavLink
              to="/notifications"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              style={{ position: 'relative' }}
            >
              <span className="nav-icon"><NavIcon name="bell" /></span>
              <span>{t('nav.notifications')}</span>
              {unreadCount > 0 && (
                <span className="notif-badge" style={{ position: 'static', marginLeft: 'auto' }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </NavLink>

            <div className="nav-label" style={{ marginTop: '1.5rem' }}>{t('nav.account')}</div>

            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                style={{ color: '#f59e0b' }}
              >
                <span className="nav-icon"><NavIcon name="admin" /></span>
                <span>Admin Panel</span>
              </NavLink>
            )}

            <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="nav-icon"><NavIcon name="settings" /></span>
              <span>{t('nav.settings')}</span>
            </NavLink>
            <button className="nav-item" onClick={handleLogout} style={{ color: '#f87171' }}>
              <span className="nav-icon"><NavIcon name="logout" /></span>
              <span>{t('nav.logout')}</span>
            </button>
          </nav>

          <div className="sidebar-user">
            <div style={{ position: 'relative' }}>
              <UserAvatar user={user} />
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

        <main className="main-content animate-fade-in">
          <Outlet context={{ setToast }} />
        </main>

        {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
      </div>
    </WebSocketProvider>
  )
}
