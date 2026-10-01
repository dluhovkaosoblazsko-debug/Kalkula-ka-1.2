import React from 'react'
import HlavniKalkulackaPage from './kalkulacka/HlavniKalkulackaPage'

const App = () => (
  <div className="dashboard-shell">
    <header className="dashboard-topbar">
      <div className="dashboard-brand">
        <span className="dashboard-brand-mark">K</span>
        <div>
          <strong>Kalkulačka srážek a oddlužení</strong>
          <span>Orientační výpočet · právní stav 2026</span>
        </div>
      </div>
      <div className="dashboard-topbar-actions">
        <span className="dashboard-status">
          <span className="dashboard-status-dot" />
          Údaje se průběžně ukládají pouze v tomto zařízení
        </span>
      </div>
    </header>

    <main className="dashboard-content">
      <HlavniKalkulackaPage />
    </main>
  </div>
)

export default App
