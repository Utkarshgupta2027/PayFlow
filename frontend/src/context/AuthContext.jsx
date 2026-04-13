import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('payflow_user')) }
    catch { return null }
  })
  const [token, setToken] = useState(() => localStorage.getItem('payflow_token') || null)

  const login = (userData, tokenValue, refreshToken) => {
    setUser(userData)
    setToken(tokenValue)
    localStorage.setItem('payflow_user', JSON.stringify(userData))
    localStorage.setItem('payflow_token', tokenValue)
    if (refreshToken) {
      localStorage.setItem('payflow_refresh_token', refreshToken)
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('payflow_user')
    localStorage.removeItem('payflow_token')
    localStorage.removeItem('payflow_refresh_token')
    localStorage.removeItem('payflow_daily_bonus_date')
  }

  const updateUser = (updated) => {
    setUser(updated)
    localStorage.setItem('payflow_user', JSON.stringify(updated))
  }

  // Re-fetch user from backend to pick up role/profile changes (e.g. after admin promotion)
  const refreshUser = async () => {
    if (!user?.id) return
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'
      const storedToken = localStorage.getItem('payflow_token')
      const res = await fetch(`${API_BASE}/user/${user.id}`, {
        headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {}
      })
      if (res.ok) {
        const freshUser = await res.json()
        setUser(freshUser)
        localStorage.setItem('payflow_user', JSON.stringify(freshUser))
        return freshUser
      }
    } catch { /* ignore */ }
    return null
  }

  // Convenience computed values
  const isAdmin = user?.role === 'ADMIN'
  const isLoggedIn = !!user

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, refreshUser, isAdmin, isLoggedIn }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
