import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import Toast from './Toast.jsx'

const NAV_ITEMS = [
  { to: '/',          icon: '🏠', label: 'Dashboard',  end: true },
  { to: '/analytics', icon: '📊', label: 'Analytics' },
  { to: '/rewards',   icon: '⭐', label: 'Rewards' },
  { to: '/referral',  icon: '🔗', label: 'Refer & Earn' },
  { to: '/send',      icon: '💸', label: 'Send Money' },
  { to: '/qr',        icon: '📷', label: 'QR Scanner' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const { theme } = useTheme()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const location = useLocation()

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <div className="app-layout">
      {/* Mobile header */}
      <header className="mobile-header">
        <button
          className="btn-icon"
          onClick={() => setSidebarOpen(o => !o)}
          aria-label="Toggle menu"
        >
          ☰
        </button>
        <span className="sidebar-logo-text">PayFlow</span>
        <div className="avatar" style={{ width: '2rem', height: '2rem', fontSize: '0.75rem' }}>
          {initials}
        </div>
      </header>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 99, display: 'none'
          }}
          className="md-overlay"
        />
      )}

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

          <div className="nav-label" style={{ marginTop: '1.5rem' }}>Account</div>
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">⚙️</span>
            <span>Settings</span>
          </NavLink>
          <button className="nav-item" onClick={handleLogout} style={{ color: '#f87171' }}>
            <span className="nav-icon">🚪</span>
            <span>Logout</span>
          </button>
        </nav>

        <div className="sidebar-user">
          <div className="avatar">{initials}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', truncate: true }}>
              {user?.name || 'User'}
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
  )
}
