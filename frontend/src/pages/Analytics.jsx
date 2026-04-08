import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { apiUrl } from '../api.js'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart, Legend,
  ComposedChart, Line
} from 'recharts'

function fmt(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtDate(s) {
  if (!s) return ''
  return new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function fmtShortDate(s) {
  if (!s) return ''
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

const PERIOD = {
  day:   { label: 'Today',     icon: '🕐', desc: 'Last 24 hours' },
  week:  { label: 'This Week', icon: '📅', desc: 'Last 7 days' },
  month: { label: 'Month',     icon: '📆', desc: 'Last 30 days' },
}

// Colors (hardcoded hex — CSS vars don't work in SVG)
const C = {
  sent:     '#f87171',
  received: '#34d399',
  accent:   '#0ea5e9',
  grid:     '#1e293b',
  muted:    '#64748b',
  bg:       '#0f172a',
  border:   '#1e293b',
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '0.75rem', padding: '0.75rem 1rem', fontSize: '0.8125rem', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
      <div style={{ color: C.muted, marginBottom: '0.375rem', fontWeight: 600 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem', color: p.color, fontWeight: 700 }}>
          <span>{p.name}</span>
          <span>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function StatCard({ icon, value, label, color, delay = 0, sub }) {
  return (
    <div className="stat-card animate-slide-up" style={{ animationDelay: `${delay}s` }}>
      <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{icon}</div>
      <div className="stat-number" style={color ? { color } : {}}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: C.muted, marginTop: '0.25rem' }}>{sub}</div>}
    </div>
  )
}

export default function Analytics() {
  const { user } = useAuth()
  const [period, setPeriod] = useState('week')
  const [chartData, setChartData] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [txLoading, setTxLoading] = useState(true)
  const [chartType, setChartType] = useState('composed') // 'composed' | 'area'
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'history' | 'insights'

  // Fetch chart data
  useEffect(() => {
    if (!user?.id) return
    setLoading(true)
    setError(null)
    fetch(apiUrl(`/transaction/analytics/${user.id}?period=${period}`))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { setChartData(Array.isArray(d.data) ? d.data : []); setTotal(d.total || 0) })
      .catch(() => { setError('Could not load chart data.'); setChartData([]) })
      .finally(() => setLoading(false))
  }, [period, user?.id])

  // Fetch all transactions
  useEffect(() => {
    if (!user?.id) return
    setTxLoading(true)
    fetch(apiUrl(`/transaction/history/${user.id}`))
      .then(r => r.json())
      .then(d => setTransactions(Array.isArray(d) ? d : []))
      .catch(() => setTransactions([]))
      .finally(() => setTxLoading(false))
  }, [user?.id])

  // Derived stats
  const sent = transactions.filter(t => t.senderId === user?.id)
  const received = transactions.filter(t => t.receiverId === user?.id)
  const totalSent = sent.reduce((s, t) => s + t.amount, 0)
  const totalReceived = received.reduce((s, t) => s + t.amount, 0)
  const avgSent = sent.length ? totalSent / sent.length : 0
  const maxTx = sent.length ? Math.max(...sent.map(t => t.amount)) : 0
  const netFlow = totalReceived - totalSent

  // Build received data overlay on same buckets as chartData
  const receivedByLabel = {}
  received.forEach(t => {
    if (!t.time) return
    const d = new Date(t.time)
    let key = ''
    if (period === 'day') key = d.getHours() + ':00'
    else if (period === 'week') key = ['SUN','MON','TUE','WED','THU','FRI','SAT'][d.getDay()]
    else key = String(d.getDate())
    receivedByLabel[key] = (receivedByLabel[key] || 0) + t.amount
  })

  const combinedData = chartData.map(d => ({
    ...d,
    received: receivedByLabel[d.label] || 0,
  }))

  const hasData = combinedData.some(d => d.amount > 0 || d.received > 0)

  // Top 5 sent
  const topSent = [...sent].sort((a, b) => b.amount - a.amount).slice(0, 5)

  // Recent transactions (last 10)
  const recent = transactions.slice(0, 10)

  // Activity by day of week
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const activityByDay = daysOfWeek.map(d => ({ day: d, count: 0, amount: 0 }))
  sent.forEach(t => {
    if (t.time) {
      const dow = new Date(t.time).getDay()
      activityByDay[dow].count++
      activityByDay[dow].amount += t.amount
    }
  })
  const maxDayAmount = Math.max(...activityByDay.map(d => d.amount), 1)

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>📊 Analytics</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Deep dive into your payment patterns</p>
      </div>

      {/* Nav tabs */}
      <div className="analytics-tabs" style={{ marginBottom: '1.5rem' }}>
        {[
          { key: 'overview',  label: '📈 Overview' },
          { key: 'history',   label: '📋 History' },
          { key: 'insights',  label: '💡 Insights' },
        ].map(({ key, label }) => (
          <button
            key={key}
            id={`nav-${key}`}
            className={`analytics-tab ${activeTab === key ? 'active' : ''}`}
            onClick={() => setActiveTab(key)}
          >{label}</button>
        ))}
      </div>

      {/* ══════════════ OVERVIEW TAB ══════════════ */}
      {activeTab === 'overview' && (
        <>
          {/* Summary stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            <StatCard icon="💸" value={fmt(totalSent)} label="Total Sent" color={C.sent} delay={0} sub={`${sent.length} transactions`} />
            <StatCard icon="💰" value={fmt(totalReceived)} label="Total Received" color={C.received} delay={0.05} sub={`${received.length} transactions`} />
            <StatCard icon="📊" value={fmt(avgSent)} label="Avg per Send" delay={0.1} sub={`Max: ${fmt(maxTx)}`} />
            <StatCard
              icon={netFlow >= 0 ? '📈' : '📉'}
              value={`${netFlow >= 0 ? '+' : ''}${fmt(netFlow)}`}
              label="Net Cash Flow"
              color={netFlow >= 0 ? C.received : C.sent}
              delay={0.15}
              sub={netFlow >= 0 ? 'You received more' : 'You sent more'}
            />
          </div>

          {/* Chart card */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            {/* Chart controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.875rem' }}>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Sent vs Received</h2>
                <p style={{ color: 'var(--text-faint)', fontSize: '0.8125rem', margin: '0.2rem 0 0' }}>
                  {PERIOD[period].desc}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Period tabs */}
                {Object.entries(PERIOD).map(([key, cfg]) => (
                  <button
                    key={key}
                    id={`period-${key}`}
                    onClick={() => setPeriod(key)}
                    style={{
                      padding: '0.375rem 0.875rem', borderRadius: '0.5rem', fontSize: '0.8rem',
                      fontWeight: 600, cursor: 'pointer', border: '1px solid',
                      borderColor: period === key ? 'var(--accent)' : 'var(--border-color)',
                      background: period === key ? 'var(--accent-glow)' : 'transparent',
                      color: period === key ? 'var(--accent-light)' : 'var(--text-muted)',
                      transition: 'all 0.2s'
                    }}
                  >{cfg.icon} {cfg.label}</button>
                ))}
                {/* Chart type toggle */}
                <div style={{ display: 'flex', gap: '0.375rem', marginLeft: '0.25rem' }}>
                  <button className="btn-icon" onClick={() => setChartType('composed')} title="Bar"
                    style={chartType === 'composed' ? { background: 'var(--accent-glow)', borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}>▊</button>
                  <button className="btn-icon" onClick={() => setChartType('area')} title="Area"
                    style={chartType === 'area' ? { background: 'var(--accent-glow)', borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}>〜</button>
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="chart-container">
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '0.75rem', color: 'var(--text-faint)' }}>
                  <span className="animate-spin" style={{ fontSize: '2rem' }}>⟳</span><span>Loading...</span>
                </div>
              ) : error ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-faint)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⚠️</div>
                  <div>{error}</div>
                </div>
              ) : !hasData ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-faint)', gap: '0.75rem' }}>
                  <div style={{ fontSize: '3rem' }}>📭</div>
                  <div style={{ fontWeight: 600 }}>No transactions for this period</div>
                  <div style={{ fontSize: '0.8rem' }}>Send or receive money to see analytics</div>
                </div>
              ) : chartType === 'composed' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={combinedData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000 ? `₹${(v/1000).toFixed(1)}k` : `₹${v}`} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Legend formatter={v => v === 'amount' ? 'Sent' : 'Received'} wrapperStyle={{ fontSize: '0.8rem', paddingTop: '0.5rem' }} />
                    <Bar dataKey="amount" name="amount" fill={C.sent} radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="received" name="received" fill={C.received} radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Line type="monotone" dataKey="amount" stroke={C.sent} strokeWidth={2} dot={false} strokeDasharray="4 2" />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={combinedData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                    <defs>
                      <linearGradient id="gSent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.sent} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={C.sent} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.received} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={C.received} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000 ? `₹${(v/1000).toFixed(1)}k` : `₹${v}`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend formatter={v => v === 'amount' ? 'Sent' : 'Received'} wrapperStyle={{ fontSize: '0.8rem', paddingTop: '0.5rem' }} />
                    <Area type="monotone" dataKey="amount" name="amount" stroke={C.sent} strokeWidth={2.5}
                      fill="url(#gSent)" dot={{ fill: C.sent, r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                    <Area type="monotone" dataKey="received" name="received" stroke={C.received} strokeWidth={2.5}
                      fill="url(#gRec)" dot={{ fill: C.received, r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Sent vs Received breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '1.5rem' }}>🔴</div>
                  <div className="stat-number" style={{ color: C.sent, fontSize: '1.5rem' }}>{fmt(totalSent)}</div>
                  <div className="stat-label">Money Sent</div>
                </div>
                <div style={{ textAlign: 'right', color: 'var(--text-faint)', fontSize: '0.8125rem' }}>
                  <div>{sent.length} transactions</div>
                  <div>Avg {fmt(avgSent)}</div>
                </div>
              </div>
              {/* Mini progress bar */}
              <div style={{ background: 'var(--bg-input)', borderRadius: '99px', height: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${totalSent + totalReceived > 0 ? (totalSent / (totalSent + totalReceived)) * 100 : 0}%`,
                  background: C.sent, borderRadius: '99px', transition: 'width 1s ease'
                }} />
              </div>
            </div>
            <div className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '1.5rem' }}>🟢</div>
                  <div className="stat-number" style={{ color: C.received, fontSize: '1.5rem' }}>{fmt(totalReceived)}</div>
                  <div className="stat-label">Money Received</div>
                </div>
                <div style={{ textAlign: 'right', color: 'var(--text-faint)', fontSize: '0.8125rem' }}>
                  <div>{received.length} transactions</div>
                  <div>Max {fmt(received.length ? Math.max(...received.map(t => t.amount)) : 0)}</div>
                </div>
              </div>
              <div style={{ background: 'var(--bg-input)', borderRadius: '99px', height: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${totalSent + totalReceived > 0 ? (totalReceived / (totalSent + totalReceived)) * 100 : 0}%`,
                  background: C.received, borderRadius: '99px', transition: 'width 1s ease'
                }} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════ HISTORY TAB ══════════════ */}
      {activeTab === 'history' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
              Transaction History
              <span style={{
                marginLeft: '0.625rem', fontSize: '0.75rem', fontWeight: 600,
                background: 'var(--accent-glow)', color: 'var(--accent-light)',
                padding: '0.125rem 0.5rem', borderRadius: '9999px', border: '1px solid var(--accent)'
              }}>{transactions.length}</span>
            </h2>
          </div>
          {txLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-faint)' }}>
              <span className="animate-spin" style={{ fontSize: '2rem' }}>⟳</span>
            </div>
          ) : transactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-faint)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📭</div>
              No transactions yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {transactions.map(t => {
                const isSent = t.senderId === user?.id
                return (
                  <div key={t.id} className="tx-item">
                    <div className={`tx-icon ${isSent ? 'tx-sent' : 'tx-received'}`}>
                      {isSent ? '↑' : '↓'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                        {isSent ? `To User #${t.receiverId}` : `From User #${t.senderId}`}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.125rem' }}>
                        {fmtDate(t.time)}
                        {t.status && (
                          <span style={{ marginLeft: '0.5rem', color: t.status === 'SUCCESS' ? C.received : C.sent, fontWeight: 600 }}>
                            · {t.status}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: isSent ? C.sent : C.received }}>
                      {isSent ? '-' : '+'}{fmt(t.amount)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════ INSIGHTS TAB ══════════════ */}
      {activeTab === 'insights' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Top transactions */}
          <div className="card">
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1.25rem' }}>🏆 Largest Payments Sent</h2>
            {topSent.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-faint)', padding: '1.5rem' }}>No sent transactions yet</div>
            ) : (
              topSent.map((t, i) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.75rem 0', borderBottom: i < topSent.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                  <div style={{
                    width: '2rem', height: '2rem', borderRadius: '50%', flexShrink: 0,
                    background: i === 0 ? 'rgba(251,191,36,0.2)' : i === 1 ? 'rgba(148,163,184,0.15)' : 'rgba(180,83,9,0.15)',
                    color: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : '#b45309',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.875rem'
                  }}>#{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>To User #{t.receiverId}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>{fmtShortDate(t.time)}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: C.sent }}>{fmt(t.amount)}</div>
                  {/* Relative bar */}
                  <div style={{ width: '4rem', background: 'var(--bg-input)', borderRadius: '99px', height: '5px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(t.amount / maxTx) * 100}%`, background: C.sent, borderRadius: '99px' }} />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Activity by day of week */}
          <div className="card">
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1.25rem' }}>📅 Activity by Day</h2>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', height: '6rem' }}>
              {activityByDay.map(({ day, amount }) => {
                const pct = (amount / maxDayAmount) * 100
                return (
                  <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem' }}>
                    <div style={{ fontSize: '0.625rem', color: 'var(--text-faint)', fontWeight: 600 }}>
                      {amount > 0 ? fmt(amount).replace('₹', '') : ''}
                    </div>
                    <div style={{
                      width: '100%', borderRadius: '0.375rem 0.375rem 0 0',
                      background: pct > 0
                        ? `linear-gradient(180deg, ${C.accent}, rgba(14,165,233,0.4))`
                        : 'var(--bg-input)',
                      height: `${Math.max(pct, 4)}%`,
                      transition: 'height 0.8s ease',
                      minHeight: '4px',
                    }} />
                    <div style={{ fontSize: '0.6875rem', color: pct > 50 ? 'var(--accent-light)' : 'var(--text-faint)', fontWeight: 600 }}>
                      {day}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Key metrics */}
          <div className="card">
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1.25rem' }}>📊 Key Metrics</h2>
            {[
              { label: 'Total Transactions', value: transactions.length, icon: '🔄' },
              { label: 'Total Volume', value: fmt(totalSent + totalReceived), icon: '💹' },
              { label: 'Largest Single Payment', value: fmt(maxTx), icon: '🏆' },
              { label: 'Average Payment Size', value: fmt(avgSent), icon: '📏' },
              { label: 'Net Balance Change', value: `${netFlow >= 0 ? '+' : ''}${fmt(netFlow)}`, icon: netFlow >= 0 ? '📈' : '📉', valueColor: netFlow >= 0 ? C.received : C.sent },
              { label: 'Success Rate', value: `${transactions.length ? Math.round((transactions.filter(t => t.status === 'SUCCESS' || !t.status).length / transactions.length) * 100) : 0}%`, icon: '✅' },
            ].map(({ label, value, icon, valueColor }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {icon} {label}
                </span>
                <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: valueColor || 'var(--text-primary)' }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
