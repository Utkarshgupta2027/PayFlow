import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('payflow_user')) }
    catch { return null }
  })
  const [token, setToken] = useState(() => localStorage.getItem('payflow_token') || null)

  const login = (userData, tokenValue) => {
    setUser(userData)
    setToken(tokenValue)
    localStorage.setItem('payflow_user', JSON.stringify(userData))
    localStorage.setItem('payflow_token', tokenValue)
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('payflow_user')
    localStorage.removeItem('payflow_token')
    localStorage.removeItem('payflow_daily_bonus_date')
  }

  const updateUser = (updated) => {
    setUser(updated)
    localStorage.setItem('payflow_user', JSON.stringify(updated))
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
