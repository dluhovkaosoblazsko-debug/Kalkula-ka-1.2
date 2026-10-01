import React from 'react'

import { DEFAULT_2026_PARAMS } from '../lib/calculations2026.js'
import { caseStatus, formatKc, MODEL_NOTE, EXECUTION_NOTE, present } from './caseState.js'
import { percentageText } from './CaseResults'
import CalculationSteps from './CalculationBreakdown'
import { groupPayers } from './calculateCase.js'

const INCOME_LABELS = {
  mzda: 'Mzda / plat',
  starobni: 'Starobní důchod',
  invalidni1: 'Invalidní důchod I. stupně',
  invalidni2: 'Invalidní důchod II. stupně',
  invalidni3: 'Invalidní důchod III. stupně',
  sirotci: 'Sirotčí důchod',
  dpp_dpc: 'DPP / DPČ',
  nemocenske: 'Nemocenské / PPM',
  podpora: 'Podpora v nezaměstnanosti',
  jiny: 'Jiný postižitelný příjem',
}

const modeTitle = (mode) => {
  if (mode === 'manzele') return 'Společné oddlužení manželů'
  if (mode === 'nezabavitelna') return 'Exekuční srážka'
  return 'Oddlužení jednotlivce'
}

const Row = ({ label, value, strong = false }) => (
  <div className={`report-row${strong ? ' report-row-strong' : ''}`}>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
)

const IncomeRows = ({ title, sources = [], multiplePayers = false }) => {
  const rows = Array.isArray(sources) ? sources : [];
  const groups = multiplePayers ? groupPayers(rows) : [{id: 'all', source: rows[0], sources: rows}];
  return <div className="report-subsection">
    <h4>{title}</h4>
    {groups.map((group,index) => <div key={group.id} className="report-payer-input">
      {multiplePayers && <p><strong>Plátce {index+1}</strong> — přidělená nezabavitelná částka: {present(group.source.pridelenaNezabavitelna) ? formatKc(group.source.pridelenaNezabavitelna) : 'Nezadáno'}</p>}
      {group.sources.map((source,i) => <div className="report-income-row" key={source.id || i}>
        <span>{INCOME_LABELS[source.typ] || 'Příjem'}</span><strong>{formatKc(source.castka)}</strong>
      </div>)}
    </div>)}
  </div>;
}

export const buildCalculationShareText = ({ mode, data, results, params = DEFAULT_2026_PARAMS }) => {
  const status = caseStatus(data,mode,results,params)
  if (!status.canExport) throw new Error("Výpočet není platný a potvrzený.")
  if (mode === 'nezabavitelna') {
    return [
      'Orientační výpočet exekuční srážky 2026',
      `Postižitelný příjem: ${formatKc(results.totalPrijem1)}`,
      `Počet exekucí: ${data.pocetExekuci === '4+' ? '4 a více' : '1 až 3'}`,
      `Druh dluhu: ${data.typPohledavky === 'prednostni' ? 'přednostní' : data.typPohledavky === 'vyzivne' ? 'výživné' : 'nepřednostní'}`,
      `Nezabavitelná částka: ${formatKc(results.ex.legalniMinimum)}`,
      `Maximální orientační srážka: ${formatKc(results.ex.srazka)}`,
      `Po srážce může zůstat: ${formatKc(results.ex.kVyplate)}`,
      '',
      EXECUTION_NOTE,
      ...status.warnings,
      'Výpočet je orientační.',
    ].join('\n')
  }

  const spouses = mode === 'manzele'
  const coverage = spouses ? results.coverageM : results.coverageJ
  const deduction = spouses ? results.srazkaCelkemM : results.insJ.srazka
  const retained = spouses ? results.kVyplateCelkemM : results.insJ.kVyplate
  const creditors = spouses ? results.proVeriteleM : results.proVeriteleJ
  const satisfaction = spouses ? results.uspokojeniM : results.uspokojeniJ
  const income = spouses
    ? results.totalPrijem1 + results.totalPrijem2
    : results.totalPrijem1

  const lines = [
    `Orientační výpočet – ${modeTitle(mode)} 2026`,
    `Postižitelný příjem celkem: ${formatKc(income)}`,
    `Nezajištěné dluhy: ${data.dluhNeznamy ? "výše neznámá" : formatKc(data.dluhyNezajistene)}`,
    `Délka oddlužení: ${data.delkaOddluzeni} měsíců`,
    `Zákonná měsíční srážka: ${formatKc(deduction)}`,
  ]

  if (coverage.debtorPromise > 0) {
    lines.push(`Závazný příslib: ${formatKc(coverage.debtorPromise)}`)
    lines.push(`Po srážce a příslibu zůstává: ${formatKc(Math.max(0, retained - coverage.debtorPromise))}`)
  } else {
    lines.push(`Po zákonné srážce zůstává: ${formatKc(retained)}`)
  }

  if (coverage.thirdPartyContribution > 0) {
    lines.push(`Zadaný aktivní příspěvek třetí osoby: ${formatKc(coverage.thirdPartyContribution)}; pro minimum potřeba ${formatKc(Math.min(coverage.thirdPartyContribution,coverage.deficitAfterDebtorPromise))}`)
  }

  lines.push(`Pro běžné nezajištěné dluhy měsíčně: ${formatKc(creditors)}`)
  lines.push(`Odhad splacení bez příslibu a třetí osoby: ${percentageText(data,mode,results,params)}`)
  lines.push(`Minimální měsíční plnění: ${coverage.finalDeficit === 0 ? 'pokryto' : 'nepokryto – chybí ' + formatKc(coverage.finalDeficit)}`)
  lines.push('')
  lines.push(MODEL_NOTE)
  lines.push(...status.warnings)
  lines.push('Výpočet je orientační.')

  return lines.join('\n')
}

const PrintableCalculationReport = ({ mode, data, results, params }) => {
  if (!['jednotlivec', 'manzele', 'nezabavitelna'].includes(mode)) return null

  const status = caseStatus(data,mode,results,params)
  if (!status.canExport) return <article className="calculation-print-report"><h1>Výpočet nelze vydat</h1><p>Zadání není dokončené nebo obsahuje chyby. Nejde o výsledek výpočtu.</p>{status.errors.map((e,i)=><p key={i}>{e.message}</p>)}<p>V aplikaci opravte údaje a potvrďte všechny tematické oddíly.</p></article>

  const printedAt = new Date().toLocaleString('cs-CZ')
  const spouses = mode === 'manzele'
  const exekuce = mode === 'nezabavitelna'
  const coverage = spouses ? results.coverageM : results.coverageJ

  return (
    <article className="calculation-print-report">
      <header className="report-header">
        <div>
          <p className="report-kicker">ORIENTAČNÍ VÝPOČET · PRÁVNÍ STAV 2026</p>
          <h1>Kalkulačka srážek a oddlužení</h1>
          <h2>{modeTitle(mode)}</h2>
        </div>
        <div className="report-meta">Vytvořeno: {printedAt}</div>
      </header>

      {status.warnings.map((warning,i)=><p key={i} className="report-warning"><strong>Upozornění:</strong> {warning}</p>)}
      <section className="report-section">
        <h3>1. Zadané údaje</h3>

        <IncomeRows
          title={spouses ? 'Příjmy manžela A' : 'Příjmy dlužníka'}
          sources={data.prijmy1}
          multiplePayers={Boolean(data.vicePlatcu1)}
        />

        {spouses && (
          <IncomeRows
            title="Příjmy manžela B"
            sources={data.prijmy2}
            multiplePayers={Boolean(data.vicePlatcu2)}
          />
        )}

        <div className="report-grid">
          {spouses ? (
            <>
              <Row label="Společné děti" value={data.spolecneDeti} />
              <Row label="Další vyživované osoby – manžel A" value={data.vyzivovaneOsoby1} />
              <Row label="Další vyživované osoby – manžel B" value={data.vyzivovaneOsoby2} />
              <Row label="Osoby s vymáhaným výživným – manžel A" value={data.osobySVykonemProVyzivne1} />
              <Row label="Osoby s vymáhaným výživným – manžel B" value={data.osobySVykonemProVyzivne2} />
              <Row label="Běžné výživné – manžel A" value={formatKc(data.bezneMesicniVyzivne1)} />
              <Row label="Běžné výživné – manžel B" value={formatKc(data.bezneMesicniVyzivne2)} />
              <Row label="Chráněné příjmy – manžel A" value={formatKc(data.chranenePrijmy1)} />
              <Row label="Chráněné příjmy – manžel B" value={formatKc(data.chranenePrijmy2)} />
            </>
          ) : (
            <>
              <Row label="Vyživované osoby" value={data.vyzivovaneOsoby1} />
              <Row label="Osoby s vymáhaným výživným" value={data.osobySVykonemProVyzivne1} />
              <Row label="Manžel/partner relevantní pro nezabavitelnou částku" value={data.partnerProNezabavitelnou1 ? 'Ano' : 'Ne'} />
              {!exekuce && <Row label="Běžné výživné" value={formatKc(data.bezneMesicniVyzivne1)} />}
              <Row label="Jiné příjmy chráněné před srážkami" value={formatKc(data.chranenePrijmy1)} />
            </>
          )}

          {exekuce ? (
            <>
              <Row label="Počet souběžných exekucí" value={data.pocetExekuci === '4+' ? '4 a více' : '1 až 3'} />
              <Row
                label="Druh pohledávky"
                value={data.typPohledavky === 'prednostni' ? 'Přednostní' : data.typPohledavky === 'vyzivne' ? 'Výživné' : 'Nepřednostní'}
              />
              <Row label="Paušální náhrada plátce" value={results.ex.nahradaPlatci > 0 ? 'Uplatněna u způsobilých plátců' : 'Neuplatněna'} />
            </>
          ) : (
            <>
              <Row label="Délka oddlužení" value={`${data.delkaOddluzeni} měsíců`} />
              <Row label="Nezajištěné dluhy" value={data.dluhNeznamy ? 'Výše neznámá' : formatKc(data.dluhyNezajistene)} />
              <Row label="Zajištěné dluhy" value={formatKc(data.dluhyZajistene)} />
              <Row label="Dluhy, které se oddlužením neodpouštějí" value={formatKc(data.dluhyNeosvoboditelne)} />
              <Row label="Odhad výtěžku ze zpeněžení majetku" value={formatKc(data.vytezekZpenezeni)} />
            </>
          )}
        </div>
      </section>

      <section className="report-section">
        <h3>2. Výpočet</h3>

        {exekuce && <CalculationSteps result={results.ex} />}

        {!exekuce && !spouses && (
          <>
            <CalculationSteps result={results.insJ} insolvency />
            <div className="report-formula">
              <Row label="Měsíční odměna a hotové výdaje správce" value={formatKc(params.odmenaSpravceJednotlivec)} />
              <Row label="Běžné zákonné výživné" value={formatKc(data.bezneMesicniVyzivne1)} />
              <Row label="Pro nezajištěné věřitele měsíčně bez doplňkových zdrojů" value={formatKc(results.proVeriteleJ)} strong />
            </div>
          </>
        )}

        {spouses && (
          <div className="report-two-columns">
            <div>
              <h4>Manžel A</h4>
              <CalculationSteps result={results.insM_A} insolvency />
            </div>
            <div>
              <h4>Manžel B</h4>
              <CalculationSteps result={results.insM_B} insolvency />
            </div>
          </div>
        )}
      </section>

      <section className="report-section">
        <h3>3. Výsledek</h3>

        {exekuce ? (
          <div className="report-grid">
            <Row label="Postižitelný příjem" value={formatKc(results.totalPrijem1)} />
            <Row label="Nezabavitelná částka" value={formatKc(results.ex.legalniMinimum)} />
            <Row label="Maximální orientační srážka" value={formatKc(results.ex.srazka)} strong />
            <Row label="Paušální náhrada plátce" value={formatKc(results.ex.nahradaPlatci)} />
            <Row label="Na dluh po náhradě plátci" value={formatKc(results.ex.srazkaCista)} />
            <Row label="Po srážce zůstává" value={formatKc(results.ex.kVyplate)} strong />
          </div>
        ) : (
          <div className="report-grid">
            <Row
              label={spouses ? 'Celková zákonná měsíční srážka manželů' : 'Zákonná měsíční srážka'}
              value={formatKc(spouses ? results.srazkaCelkemM : results.insJ.srazka)}
              strong
            />
            {spouses && <Row label="Srážka manžel A / B" value={`${formatKc(results.insM_A.srazka)} / ${formatKc(results.insM_B.srazka)}`} />}
            <Row
              label="Po zákonné srážce zůstává"
              value={formatKc(spouses ? results.kVyplateCelkemM : results.insJ.kVyplate)}
            />
            <Row label="Požadované minimum" value={formatKc(coverage.requiredMinimum)} />
            <Row label="Závazný příslib" value={formatKc(coverage.debtorPromise)} />
            {coverage.basicNeedsDeclared && <Row label="Zadané základní potřeby domácnosti" value={formatKc(coverage.basicNeeds)} />}
            <Row label="Zadaný aktivní příspěvek třetí osoby" value={formatKc(coverage.thirdPartyContribution)} />
            <Row label="Z příspěvku k doplnění minima potřeba" value={formatKc(Math.min(coverage.thirdPartyContribution,coverage.deficitAfterDebtorPromise))} />
            <Row
              label="Stav minimálního plnění"
              value={coverage.finalDeficit === 0 ? 'Pokryto' : `Chybí ${formatKc(coverage.finalDeficit)}`}
              strong
            />
            <Row
              label="Po příslibu zůstává"
              value={formatKc(Math.max(0, (spouses ? results.kVyplateCelkemM : results.insJ.kVyplate) - coverage.debtorPromise))}
            />
            <Row
              label="Pro nezajištěné věřitele měsíčně bez doplňkových zdrojů"
              value={formatKc(spouses ? results.proVeriteleM : results.proVeriteleJ)}
            />
            <Row
              label="Modelové splacení bez příslibu a třetí osoby"
              value={percentageText(data,mode,results,params)}
              strong
            />
          </div>
        )}
      </section>

      <footer className="report-footer">
        <p><strong>Rozsah modelu:</strong> {exekuce ? EXECUTION_NOTE : MODEL_NOTE}</p>
        <p><strong>Upozornění:</strong> Výpočet je orientační. Nejde o rozhodnutí soudu, exekutora ani insolvenčního správce. Skutečný výsledek může ovlivnit právní povaha příjmů a pohledávek, změna příjmů, další náklady řízení a další skutečnosti.</p>
      </footer>
    </article>
  )
}

export default PrintableCalculationReport
