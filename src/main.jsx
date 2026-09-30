import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

if ('serviceWorker' in navigator) {
  let controllerReloaded = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controllerReloaded) return
    controllerReloaded = true
    window.location.reload()
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        registration.update()

        // Při dlouho otevřené kalkulačce kontroluj novou verzi průběžně.
        window.setInterval(() => {
          registration.update()
        }, 60 * 60 * 1000)
      })
      .catch((error) => {
        console.warn('PWA service worker se nepodařilo zaregistrovat.', error)
      })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
