import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { apiFetch } from '../api.js'
import { useNavigate } from 'react-router-dom'

const TABS = ['Overview', 'Users', 'Refunds', 'Transactions']

export default function AdminPanel() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('Overview')
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [refunds, setRefunds] = useState([])
  const [loading, setLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState(null)

  // Redirect non-admins
  useEffect(() => {
    if (user && !isAdmin) navigate('/')
  }, [user, isAdmin, navigate])

  const showMsg = (msg, type = 'success') => {
    setActionMsg({ msg, type })
    setTimeout(() => setActionMsg(null), 3000)
  }

  const loadStats = useCallback(async () => {
    const res = await apiFetch('/admin/stats')
    if (res.ok) setStats(await res.json())
  }, [])

  const loadUsers = useCallback(async () => {
    const res = await apiFetch('/admin/users')
    if (res.ok) setUsers(await res.json())
  }, [])

  const loadRefunds = useCallback(async () => {
    const res = await apiFetch('/admin/refunds')
    if (res.ok) setRefunds(await res.json())
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    loadStats()
    loadUsers()
    loadRefunds()
  }, [isAdmin, loadStats, loadUsers, loadRefunds])

  const blockUser = async (id) => {
    setLoading(true)
    const res = await apiFetch(`/admin/users/${id}/block`, { method: 'POST' })
    if (res.ok) { showMsg('User blocked'); loadUsers() }
    else showMsg('Failed to block', 'error')
    setLoading(false)
  }

  const unblockUser = async (id) => {
    setLoading(true)
    const res = await apiFetch(`/admin/users/${id}/unblock`, { method: 'POST' })
    if (res.ok) { showMsg('User unblocked'); loadUsers() }
    else showMsg('Failed to unblock', 'error')
    setLoading(false)
  }

  const handleRefund = async (txId, action) => {
    setLoading(true)
    const res = await apiFetch(`/admin/refunds/${txId}/${action}`, { method: 'POST' })
    if (res.ok) { showMsg(`Refund ${action}d`); loadRefunds(); loadStats() }
    else showMsg('Action failed', 'error')
    setLoading(false)
  }

  if (!isAdmin) return null

  const STAT_ITEMS = stats ? [
    { label: 'Total Users', value: stats.totalUsers, icon: '👥', color: '#0ea5e9' },
    { label: 'Frozen Accounts', value: stats.frozenUsers, icon: '🔒', color: '#ef4444' },
    { label: 'Total Transactions', value: stats.totalTransactions, icon: '💳', color: '#10b981' },
    { label: 'Total Volume', value: `₹${Number(stats.totalVolume || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, icon: '💰', color: '#f59e0b' },
    { label: 'Flagged Txns', value: stats.flaggedTransactions, icon: '⚠️', color: '#f97316' },
    { label: 'Pending Refunds', value: stats.pendingRefunds, icon: '🔄', color: '#a78bfa' },
  ] : []

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🛡️</span>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800 }}>Admin Panel</h1>
          <span style={{ background: '#f59e0b', color: '#000', borderRadius: '6px', padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700 }}>ADMIN</span>
        </div>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>Monitor, manage and protect the platform</p>
      </div>

      {/* Action message */}
      {actionMsg && (
        <div className={`alert-${actionMsg.type === 'error' ? 'error' : 'success'}`} style={{ marginBottom: '1rem' }}>
          {actionMsg.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="admin-tabs">
        {TABS.map(tab => (
          <button key={tab} className={`admin-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'Overview' && (
        <div>
          <div className="admin-stat-grid">
            {STAT_ITEMS.map(({ label, value, icon, color }) => (
              <div key={label} className="admin-stat-card">
                <div style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{icon}</div>
                <div className="admin-stat-number" style={{ color }}>{value}</div>
                <div className="admin-stat-label">{label}</div>
              </div>
            ))}
          </div>
          {stats?.pendingRefunds > 0 && (
            <div className="risk-medium risk-indicator" style={{ marginBottom: '1rem' }}>
              ⚠️ {stats.pendingRefunds} refund(s) are pending your approval. Go to the Refunds tab.
            </div>
          )}
          {stats?.flaggedTransactions > 0 && (
            <div className="risk-high risk-indicator">
              🚨 {stats.flaggedTransactions} flagged transaction(s) detected by the fraud engine.
            </div>
          )}
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'Users' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>
            All Users ({users.length})
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Balance</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{u.name}</td>
                    <td>{u.email}</td>
                    <td style={{ color: 'var(--accent-light)', fontWeight: 600 }}>
                      ₹{Number(u.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span className={`status-badge ${u.role === 'ADMIN' ? 'status-pending' : 'status-active'}`}>
                        {u.role || 'USER'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${u.frozen ? 'status-frozen' : 'status-active'}`}>
                        {u.frozen ? '🔒 Frozen' : '✅ Active'}
                      </span>
                    </td>
                    <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '—'}</td>
                    <td>
                      {u.id !== user?.id && (
                        u.frozen
                          ? <button className="btn-success" onClick={() => unblockUser(u.id)} disabled={loading}>Unblock</button>
                          : <button className="btn-danger" onClick={() => blockUser(u.id)} disabled={loading}>Block</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Refunds Tab */}
      {activeTab === 'Refunds' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>
            Pending Refunds ({refunds.length})
          </div>
          {refunds.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-faint)' }}>
              ✅ No pending refund requests
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Tx ID</th>
                    <th>From User</th>
                    <th>To User</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Risk</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.map(tx => (
                    <tr key={tx.id}>
                      <td>#{tx.id}</td>
                      <td>User #{tx.senderId}</td>
                      <td>User #{tx.receiverId}</td>
                      <td style={{ color: '#fbbf24', fontWeight: 600 }}>
                        ₹{Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td>{tx.time ? new Date(tx.time).toLocaleDateString() : '—'}</td>
                      <td>
                        <span className={`status-badge status-${tx.riskLevel === 'HIGH' ? 'frozen' : tx.riskLevel === 'MEDIUM' ? 'pending' : 'active'}`}>
                          {tx.riskLevel || 'LOW'}
                        </span>
                      </td>
                      <td style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn-success" onClick={() => handleRefund(tx.id, 'approve')} disabled={loading}>
                          ✅ Approve
                        </button>
                        <button className="btn-danger" onClick={() => handleRefund(tx.id, 'reject')} disabled={loading}>
                          ❌ Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'Transactions' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
            📊 Transaction analytics are available in the Analytics page.
            <br />Flagged transactions: <strong style={{ color: '#fbbf24' }}>{stats?.flaggedTransactions || 0}</strong>
          </p>
        </div>
      )}
    </div>
  )
}
