import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { apiFetch } from '../api.js'
import { exportTransactionsCsv, exportTransactionsPdf } from '../utils/exportStatement.js'

function fmtCurrency(n) {
  return 'INR ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(s) {
  if (!s) return ''
  return new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Transactions() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ query: '', from: '', to: '', min: '', max: '' })

  useEffect(() => {
    if (!user?.id) return
    setLoading(true)
    apiFetch(`/transaction/history/${user.id}`)
      .then(r => r.json())
      .then(data => setTransactions(Array.isArray(data) ? data : []))
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false))
  }, [user?.id])

  const filtered = useMemo(() => {
    const query = filters.query.trim().toLowerCase()
    const from = filters.from ? new Date(`${filters.from}T00:00:00`) : null
    const to = filters.to ? new Date(`${filters.to}T23:59:59`) : null
    const min = filters.min ? Number(filters.min) : null
    const max = filters.max ? Number(filters.max) : null

    return transactions.filter(tx => {
      const txDate = tx.time ? new Date(tx.time) : null
      if (from && (!txDate || txDate < from)) return false
      if (to && (!txDate || txDate > to)) return false
      if (min !== null && Number(tx.amount) < min) return false
      if (max !== null && Number(tx.amount) > max) return false
      if (!query) return true
      return [tx.senderId, tx.receiverId, tx.category, tx.description, tx.status]
        .some(value => String(value || '').toLowerCase().includes(query))
    })
  }, [transactions, filters])

  const summary = filtered.reduce((acc, tx) => {
    if (tx.senderId === user?.id) acc.debit += Number(tx.amount || 0)
    if (tx.receiverId === user?.id) acc.credit += Number(tx.amount || 0)
    return acc
  }, { debit: 0, credit: 0 })

  const updateFilter = (key, value) => setFilters(current => ({ ...current, [key]: value }))

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>Transactions</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Search, filter, and export your mini statement.</p>
      </div>

      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card"><div className="stat-number">{filtered.length}</div><div className="stat-label">Results</div></div>
        <div className="stat-card"><div className="stat-number" style={{ color: '#f87171' }}>{fmtCurrency(summary.debit)}</div><div className="stat-label">Debits</div></div>
        <div className="stat-card"><div className="stat-number" style={{ color: '#34d399' }}>{fmtCurrency(summary.credit)}</div><div className="stat-label">Credits</div></div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
          <div>
            <label className="label">User, status, category, or note</label>
            <input className="input-field" value={filters.query} onChange={e => updateFilter('query', e.target.value)} placeholder="Search transactions" />
          </div>
          <div>
            <label className="label">From</label>
            <input className="input-field" type="date" value={filters.from} onChange={e => updateFilter('from', e.target.value)} />
          </div>
          <div>
            <label className="label">To</label>
            <input className="input-field" type="date" value={filters.to} onChange={e => updateFilter('to', e.target.value)} />
          </div>
          <div>
            <label className="label">Min amount</label>
            <input className="input-field" type="number" min="0" value={filters.min} onChange={e => updateFilter('min', e.target.value)} />
          </div>
          <div>
            <label className="label">Max amount</label>
            <input className="input-field" type="number" min="0" value={filters.max} onChange={e => updateFilter('max', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <button className="btn-primary" style={{ width: 'auto' }} onClick={() => exportTransactionsPdf(filtered, user)} disabled={!filtered.length}>Export PDF</button>
          <button className="btn-secondary" style={{ width: 'auto' }} onClick={() => exportTransactionsCsv(filtered, user)} disabled={!filtered.length}>Export CSV</button>
          <button className="btn-secondary" style={{ width: 'auto' }} onClick={() => setFilters({ query: '', from: '', to: '', min: '', max: '' })}>Clear</button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading transactions...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-faint)' }}>No matching transactions found.</div>
        ) : (
          filtered.map(tx => {
            const isDebit = tx.senderId === user?.id
            const label = tx.category?.startsWith('BILL_')
              ? tx.category.replace('BILL_', 'Bill ')
              : tx.category === 'WITHDRAWAL'
                ? 'Bank withdrawal'
                : isDebit ? `Sent to #${tx.receiverId}` : `Received from #${tx.senderId}`
            return (
              <div key={tx.id} className="tx-item">
                <div className={`tx-icon ${isDebit ? 'tx-sent' : 'tx-received'}`}>{isDebit ? '-' : '+'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{label}</div>
                  <div style={{ color: 'var(--text-faint)', fontSize: '0.78rem' }}>{tx.description || fmtDate(tx.time)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, color: isDebit ? '#f87171' : '#34d399' }}>{isDebit ? '-' : '+'}{fmtCurrency(tx.amount)}</div>
                  <div style={{ color: 'var(--text-faint)', fontSize: '0.75rem' }}>{fmtDate(tx.time)}</div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
