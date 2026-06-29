import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
// ── PWA: Register the Service Worker for offline support & installation
import { registerServiceWorker } from './utils/registerSW.js'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Register SW after React renders so it doesn't compete with initial page resources
registerServiceWorker()
