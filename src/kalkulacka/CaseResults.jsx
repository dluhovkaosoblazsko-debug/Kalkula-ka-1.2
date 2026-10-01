import React from 'react';
import { caseStatus, formatKc, MODEL_NOTE, EXECUTION_NOTE, sectionReviewed, number } from './caseState.js';
import CalculationBreakdown from './CalculationBreakdown';

export function percentageText(data,mode,results,params) {
  if (data.dluhNeznamy || !number(data.dluhyNezajistene)) return 'Neurčeno – bez známé kladné výše nezajištěných dluhů';
  if (!sectionReviewed(data,mode,'debts',params)) return 'Neurčeno – nejprve potvrďte oddíl Dluhy a majetek';
  return (mode === 'manzele' ? results.uspokojeniM : results.uspokojeniJ).toLocaleString('cs-CZ',{maximumFractionDigits:1})+' %';
}
export function InputSummary({data,mode,step}) {
  const persons = mode === 'manzele' ? [1,2] : [1];
  if (step.startsWith('income')) {
    const p = step === 'incomeB' ? 2 : 1;
    return <>{data[`bezPostizitelnehoPrijmu${p}`] ? 'Výslovně bez postižitelného příjmu' : data[`prijmy${p}`].map(s=>presentIncome(s.castka)).join(' + ')}</>;
  }
  if (step === 'family') return <>{mode === 'manzele' ? `Společné děti: ${data.spolecneDeti}. ` : ''}{persons.map(p=>`Osoba ${p}: vyživované ${data[`vyzivovaneOsoby${p}`]}, vymáhání ${data[`osobySVykonemProVyzivne${p}`]}`).join('; ')}</>;
  if (step === 'other') return <>{persons.map(p=>`Osoba ${p}: výživné ${formatKc(data[`bezneMesicniVyzivne${p}`])}, chráněné příjmy ${formatKc(data[`chranenePrijmy${p}`])}`).join('; ')}</>;
  if (step === 'execution') return <>{data.pocetExekuci} exekucí; {data.typPohledavky}; chráněné příjmy {formatKc(data.chranenePrijmy1)}</>;
  if (step === 'debts') return <>Nezajištěné dluhy: {data.dluhNeznamy ? 'výše neznámá' : presentIncome(data.dluhyNezajistene)}; zajištěné {formatKc(data.dluhyZajistene)}; neosvoboditelné {formatKc(data.dluhyNeosvoboditelne)}; výtěžek {formatKc(data.vytezekZpenezeni)}.</>;
  const suffix = mode === 'manzele' ? 'M' : '1';
  return <>Zadaný příslib: {formatKc(data['zavaznyPrislib'+suffix])}; třetí osoba: {formatKc(data['pravidelnePlneniTretiOsoby'+suffix])}.</>;
}
function presentIncome(value) { return value === '' || value === undefined || value === null ? 'nezadáno' : formatKc(value); }
function Card({label,value}) { return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm font-bold text-slate-600">{label}</p><p className="mt-2 text-2xl font-black text-slate-900">{value}</p></div>; }
export default function CaseResults({ data, mode, results, params }) {
  const status = caseStatus(data,mode,results,params);
  // An unknown debt can still have a monthly preview; invalid financial/family
  // inputs must not produce a report-shaped set of apparently valid numbers.
  const blocking = status.errors.filter(e=>e.section !== 'debts');
  const spouses = mode === 'manzele', execution = mode === 'nezabavitelna';
  const c = spouses ? results.coverageM : results.coverageJ;
  const deduction = spouses ? results.srazkaCelkemM : execution ? results.ex.srazka : results.insJ.srazka;
  const retained = spouses ? results.kVyplateCelkemM : execution ? results.ex.kVyplate : results.insJ.kVyplate;
  return <div className="space-y-4" data-testid="case-results">
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
      <h2 className="text-lg font-black text-slate-900">{status.canExport ? 'Výsledek podle potvrzeného zadání' : 'Průběžný výsledek – zadání není dokončené'}</h2>
      {!status.canExport && <p className="mt-2 text-sm text-slate-700">Potvrďte tematické oddíly a opravte případné chyby. Tisk a sdílení hotového výpočtu jsou dostupné až potom.</p>}
    </div>
    {status.warnings.map((warning,i)=><p key={i} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{warning}</p>)}
    {blocking.length ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{blocking.map((error,i)=><p key={i} className="mb-2">{error.message}</p>)}</div> : <>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card label={execution ? 'Maximální orientační srážka' : spouses ? 'Celková zákonná měsíční srážka' : 'Zákonná měsíční srážka'} value={formatKc(deduction)} />
        <Card label="Po zákonné srážce zůstává" value={formatKc(retained)} />
      </div>
      {execution ? <>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700"><p>Náhrada plátci: {formatKc(results.ex.nahradaPlatci)}</p><p>Na dluh po náhradě: {formatKc(results.ex.srazkaCista)}</p></div>
        <p className="text-xs leading-relaxed text-slate-600">{EXECUTION_NOTE}</p>
      </> : <>
        <div className={`rounded-xl border p-4 text-sm ${c.finalDeficit > 0 ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'}`}>
          <p className="font-black">{c.finalDeficit > 0 ? `Modelové měsíční minimum není pokryto – chybí ${formatKc(c.finalDeficit)}.` : 'Modelové měsíční minimum je podle aktuálních údajů pokryto.'}</p>
          <p className="mt-2">Potřebné minimum: {formatKc(c.requiredMinimum)}. Odměna a výdaje správce: {formatKc(spouses ? params.odmenaSpravceManzele : params.odmenaSpravceJednotlivec)}.</p>
          <p>Příslib použitý pro minimum: {formatKc(c.debtorPromise)}. Po srážce a tomto příslibu zůstává {formatKc(Math.max(0,retained-c.debtorPromise))}.</p>
          <p>Zadaný aktivní příspěvek třetí osoby: {formatKc(c.thirdPartyContribution)}; k doplnění minima z něj potřeba {formatKc(Math.min(c.thirdPartyContribution,c.deficitAfterDebtorPromise))}.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2"><Card label="Na nezajištěné dluhy měsíčně – bez doplňkových zdrojů" value={formatKc(spouses ? results.proVeriteleM : results.proVeriteleJ)} />
          <Card label="Modelové splacení – bez příslibu a třetí osoby" value={percentageText(data,mode,results,params)} /></div>
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">{MODEL_NOTE}</p>
      </>}
      <details className="rounded-xl border border-slate-200 bg-white p-4 text-slate-800"><summary className="cursor-pointer text-sm font-bold">Jak jsme k výsledku došli?</summary>
        <div className="mt-4 space-y-4">{spouses ? <>{['A','B'].map(letter=><section key={letter}><h3 className="mb-2 font-bold">Manžel {letter}</h3><CalculationBreakdown result={results[`insM_${letter}`]} /></section>)}<p>Celková srážka: {formatKc(results.insM_A.srazka)} + {formatKc(results.insM_B.srazka)} = {formatKc(results.srazkaCelkemM)}.</p></> : <CalculationBreakdown result={execution ? results.ex : results.insJ} />}</div>
      </details>
      <p className="text-xs leading-relaxed text-slate-600">Výpočet je orientační. Neověřuje právní povahu konkrétních příjmů a pohledávek, budoucí změny ani všechny náklady řízení.</p>
    </>}
  </div>;
}
