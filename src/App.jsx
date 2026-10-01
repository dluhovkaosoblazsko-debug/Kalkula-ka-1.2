import React from 'react'
import HlavniKalkulackaPage from './kalkulacka/HlavniKalkulackaPage'
import './print.css'

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
          Výpočet probíhá v tomto prohlížeči
        </span>
      </div>
    </header>

    <main className="dashboard-content">
      <HlavniKalkulackaPage />
    </main>
  </div>
)

export default App
