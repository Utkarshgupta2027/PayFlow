import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

const WsContext = createContext(null)

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export function WebSocketProvider({ children, userEmail, onNotification, onBalanceUpdate }) {
  const clientRef = useRef(null)
  const [connected, setConnected] = useState(false)

  const connect = useCallback(() => {
    if (!userEmail || clientRef.current?.active) return

    const client = new Client({
      webSocketFactory: () => new SockJS(`${API_BASE}/ws`),
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true)

        // Subscribe to user-specific notifications
        client.subscribe(`/user/${userEmail}/topic/notifications`, (msg) => {
          try {
            const notification = JSON.parse(msg.body)
            onNotification?.(notification)
          } catch {/* ignore */}
        })

        // Subscribe to user-specific balance updates
        client.subscribe(`/user/${userEmail}/topic/balance`, (msg) => {
          try {
            const data = JSON.parse(msg.body)
            onBalanceUpdate?.(data.balance)
          } catch {/* ignore */}
        })
      },
      onDisconnect: () => setConnected(false),
      onStompError: () => setConnected(false),
    })

    client.activate()
    clientRef.current = client
  }, [userEmail, onNotification, onBalanceUpdate])

  useEffect(() => {
    connect()
    return () => {
      clientRef.current?.deactivate()
      clientRef.current = null
    }
  }, [connect])

  return (
    <WsContext.Provider value={{ connected }}>
      {children}
    </WsContext.Provider>
  )
}

export const useWebSocket = () => useContext(WsContext)
