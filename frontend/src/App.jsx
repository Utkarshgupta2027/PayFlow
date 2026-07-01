import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { startKeepAlive, stopKeepAlive } from './utils/keepAlive'
import ServerWakeNotice from './components/ServerWakeNotice.jsx'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { LanguageProvider } from './context/LanguageContext.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Analytics from './pages/Analytics.jsx'
import Rewards from './pages/Rewards.jsx'
import Referral from './pages/Referral.jsx'
import Settings from './pages/Settings.jsx'
import SendMoney from './pages/SendMoney.jsx'
import QRPage from './pages/QRPage.jsx'
import AdminPanel from './pages/AdminPanel.jsx'
import Notifications from './pages/Notifications.jsx'
import SplitPayment from './pages/SplitPayment.jsx'
import RequestMoney from './pages/RequestMoney.jsx'
import ScheduledPayments from './pages/ScheduledPayments.jsx'
import Feedback from './pages/Feedback.jsx'
import CheckBalance from './pages/CheckBalance.jsx'
import Transactions from './pages/Transactions.jsx'
import BillPayments from './pages/BillPayments.jsx'
import Layout from './components/Layout.jsx'

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { user, isAdmin } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}

function PublicRoute({ children }) {
  const { user } = useAuth()
  return user ? <Navigate to="/" replace /> : children
}

export default function App() {
  // Keep Render server alive — ping /healthz every 9 minutes
  useEffect(() => {
    startKeepAlive()
    return () => stopKeepAlive()
  }, [])

  return (
    <ThemeProvider>
      <LanguageProvider>
        {/* Shows a banner when the Render server is cold-starting */}
        <ServerWakeNotice />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
              <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
              <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="transactions" element={<Transactions />} />
                <Route path="bills" element={<BillPayments />} />
                <Route path="rewards" element={<Rewards />} />
                <Route path="referral" element={<Referral />} />
                <Route path="settings" element={<Settings />} />
                <Route path="send" element={<SendMoney />} />
                <Route path="request" element={<RequestMoney />} />
                <Route path="check-balance" element={<CheckBalance />} />
                <Route path="qr" element={<QRPage />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="split" element={<SplitPayment />} />
                <Route path="scheduled" element={<ScheduledPayments />} />
                <Route path="feedback" element={<Feedback />} />
                <Route path="admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  )
}
