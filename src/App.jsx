import React, { useState } from 'react'
import HlavniKalkulackaPage from './kalkulacka/HlavniKalkulackaPage'
import PrijmovyPotencialPage from './prijmovy-potencial/PrijmovyPotencialPage'

const App = () => {
  const [aktivniStranka, setAktivniStranka] = useState('kalkulacka')

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="mb-6 flex flex-wrap gap-3">
          <button
            onClick={() => setAktivniStranka('kalkulacka')}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              aktivniStranka === 'kalkulacka'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-700 border border-slate-300'
            }`}
          >
            Hlavní kalkulačka
          </button>

          <button
            onClick={() => setAktivniStranka('potencial')}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              aktivniStranka === 'potencial'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-700 border border-slate-300'
            }`}
          >
            Příjmový potenciál
          </button>
        </div>

        {aktivniStranka === 'kalkulacka' ? (
          <HlavniKalkulackaPage />
        ) : (
          <PrijmovyPotencialPage />
        )}
      </div>
    </div>
  )
}

export default App