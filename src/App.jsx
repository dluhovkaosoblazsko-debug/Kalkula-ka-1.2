import React, { useState } from 'react'
import HlavniKalkulackaPage from './kalkulacka/HlavniKalkulackaPage'
import PrijmovyPotencialPage from './prijmovy-potencial/PrijmovyPotencialPage'

const App = () => {
  const [aktivniStranka, setAktivniStranka] = useState('kalkulacka')

  return (
    <div className="dashboard-shell">
      <header className="dashboard-topbar">
        <div className="dashboard-brand">
          <span className="dashboard-brand-mark">K</span>
          <div>
            <strong>Kontrola oddlužení</strong>
            <span>Pracovní panel · 2026</span>
          </div>
        </div>
        <div className="dashboard-topbar-actions">
          <span className="dashboard-status"><span className="dashboard-status-dot" /> Lokální režim</span>
          <span className="dashboard-avatar">P</span>
        </div>
      </header>

      <div className="dashboard-layout">
        <aside className="dashboard-sidebar">
          <div className="dashboard-sidebar-label">MODULY</div>
          <button
            onClick={() => setAktivniStranka('kalkulacka')}
            aria-pressed={aktivniStranka === 'kalkulacka'}
            className={`dashboard-sidebar-button ${aktivniStranka === 'kalkulacka' ? 'is-active' : ''}`}
          >
            <span className="dashboard-sidebar-icon">∑</span>
            <span><strong>Hlavní kalkulačka</strong><small>Srážky a oddlužení</small></span>
          </button>
          <button
            onClick={() => setAktivniStranka('potencial')}
            aria-pressed={aktivniStranka === 'potencial'}
            className={`dashboard-sidebar-button ${aktivniStranka === 'potencial' ? 'is-active' : ''}`}
          >
            <span className="dashboard-sidebar-icon">↗</span>
            <span><strong>Příjmový potenciál</strong><small>Statistické srovnání</small></span>
          </button>
          <div className="dashboard-sidebar-divider" />
          <div className="dashboard-sidebar-note">
            <span className="dashboard-sidebar-note-icon">i</span>
            <p>Všechny údaje zůstávají v tomto prohlížeči.</p>
          </div>
        </aside>

        <main className="dashboard-content">
          {aktivniStranka === 'kalkulacka' ? (
            <HlavniKalkulackaPage />
          ) : (
            <PrijmovyPotencialPage />
          )}
        </main>
      </div>
    </div>
  )
}

export default App
