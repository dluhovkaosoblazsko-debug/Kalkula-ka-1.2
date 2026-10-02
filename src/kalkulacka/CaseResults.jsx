import React from 'react';
import { caseStatus, formatKc, MODEL_NOTE, EXECUTION_NOTE, sectionReviewed, number, present } from './caseState.js';
import { nextStepMessage, SHORT_MODEL_NOTE } from './uiCopy.js';
import ApprovedHelp from './ApprovedHelp';
import CalculationBreakdown from './CalculationBreakdown';

export function percentageText(data, mode, results, params) {
  if (data.dluhNeznamy || !number(data.dluhyNezajistene)) return 'Odhad zatím nelze určit';
  if (!sectionReviewed(data, mode, 'debts', params)) return 'Nejprve zkontrolujte dluhy';
  return (mode === 'manzele' ? results.uspokojeniM : results.uspokojeniJ).toLocaleString('cs-CZ', { maximumFractionDigits: 1 }) + ' %';
}

export function InputSummary({ data, mode, step }) {
  const persons = mode === 'manzele' ? [1, 2] : [1];
  const personLabel = p => mode === 'manzele' ? `Manžel ${p === 1 ? 'A' : 'B'}: ` : '';
  if (step.startsWith('income')) {
    const p = step === 'incomeB' ? 2 : 1;
    return <>{data[`bezPostizitelnehoPrijmu${p}`] ? 'Bez příjmu pro výpočet srážky' : data[`prijmy${p}`].map(s => presentIncome(s.castka)).join(' + ')}</>;
  }
  if (step === 'family') {
    const lines = [];
    if (mode === 'manzele' && number(data.spolecneDeti) > 0) lines.push(`Společné děti: ${data.spolecneDeti}`);
    for (const p of persons) {
      if (number(data[`vyzivovaneOsoby${p}`]) > 0) lines.push(`${personLabel(p)}${mode === 'manzele' ? 'další vyživované osoby' : 'Vyživované osoby'}: ${data[`vyzivovaneOsoby${p}`]}`);
      if (number(data[`osobySVykonemProVyzivne${p}`]) > 0) lines.push(`${personLabel(p)}osoby s vymáhaným výživným: ${data[`osobySVykonemProVyzivne${p}`]}`);
    }
    if (mode !== 'manzele' && data.partnerProNezabavitelnou1) lines.push('Manžel nebo partner uveden k započtení');
    return <>{lines.length ? lines.join('. ') : 'Žádné další osoby nejsou zadané.'}</>;
  }
  if (step === 'other') {
    const lines = persons.flatMap(p => [
      number(data[`bezneMesicniVyzivne${p}`]) > 0 ? `${personLabel(p)}placené výživné ${formatKc(data[`bezneMesicniVyzivne${p}`])}` : '',
      number(data[`chranenePrijmy${p}`]) > 0 ? `${personLabel(p)}příjmy bez srážek ${formatKc(data[`chranenePrijmy${p}`])}` : '',
    ]).filter(Boolean);
    return <>{lines.length ? lines.join('. ') : 'Bez dalších zadaných příjmů a plateb.'}</>;
  }
  if (step === 'execution') {
    const type = { neprednostni: 'nepřednostní dluh', prednostni: 'přednostní dluh', vyzivne: 'výživné' }[data.typPohledavky] || 'druh dluhu není vybraný';
    return <>{data.pocetExekuci === '4+' ? '4 a více' : '1 až 3'} exekuce; {type}{number(data.chranenePrijmy1) > 0 ? `; příjmy bez srážek ${formatKc(data.chranenePrijmy1)}` : ''}.</>;
  }
  if (step === 'debts') {
    const lines = [`Běžné dluhy: ${data.dluhNeznamy ? 'výši zatím neznáte' : presentIncome(data.dluhyNezajistene)}`];
    for (const [field, label] of [['dluhyZajistene', 'Dluhy zajištěné majetkem'], ['dluhyNeosvoboditelne', 'Dluhy, které se neodpouštějí'], ['vytezekZpenezeni', 'Peníze z prodeje majetku']]) {
      if (number(data[field]) > 0) lines.push(`${label}: ${formatKc(data[field])}`);
    }
    return <>{lines.join('. ')}.</>;
  }
  const suffix = mode === 'manzele' ? 'M' : '1';
  const lines = [];
  for (const [field, flag, label] of [['zavaznyPrislib', 'povolitPrislibDluznika', 'Další platba z vlastních peněz'], ['pravidelnePlneniTretiOsoby', 'povolitPlneniTretiOsoby', 'Pomoc jiné osoby']]) {
    if (data[flag + suffix] || number(data[field + suffix]) > 0) lines.push(`${label}: ${presentIncome(data[field + suffix])}${data[flag + suffix] ? '' : ' (nepoužívá se)'}`);
  }
  return <>{lines.length ? lines.join('. ') : 'Další pomoc se splácením není zadaná.'}</>;
}

function presentIncome(value) { return !present(value) ? 'zatím nezadáno' : formatKc(value); }
function Card({ label, value, hint, testId, helpKey }) {
  return <div data-testid={testId} className="rounded-xl border border-slate-200 bg-white p-4">
    <p className="text-sm font-bold text-slate-600">{label}</p>
    <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
    {hint && <p className="mt-2 text-xs leading-relaxed text-slate-600">{hint}</p>}
    {helpKey && <ApprovedHelp name={helpKey} />}
  </div>;
}

export default function CaseResults({ data, mode, results, params }) {
  const status = caseStatus(data, mode, results, params);
  // Stejná blokace jako před úpravou textů: neplatné rodinné a finanční vstupy
  // nesmějí vytvořit zdánlivě hotový výsledek. Neznámý dluh připouští měsíční náhled.
  const blocking = status.errors.filter(e => e.section !== 'debts');
  const spouses = mode === 'manzele', execution = mode === 'nezabavitelna';
  const c = spouses ? results.coverageM : results.coverageJ;
  const deduction = spouses ? results.srazkaCelkemM : execution ? results.ex.srazka : results.insJ.srazka;
  const retained = spouses ? results.kVyplateCelkemM : execution ? results.ex.kVyplate : results.insJ.kVyplate;
  const debtHint = data.dluhNeznamy || !present(data.dluhyNezajistene)
    ? 'Výši dluhů zatím neznáme, proto nemůžeme ukázat odhad jejich splacení.'
    : !number(data.dluhyNezajistene)
      ? 'U běžných dluhů je zadáno 0 Kč. Procento splacení proto neuvádíme.'
      : !sectionReviewed(data, mode, 'debts', params)
        ? 'Zkontrolujte část Dluhy a majetek. Potom se zde zobrazí odhad splacení.'
        : `Odhad za ${data.delkaOddluzeni} měsíců při zadaných příjmech a majetku. Nejde o zaručený výsledek.`;
  return <div className="space-y-4" data-testid="case-results" data-state={status.canExport ? 'complete' : 'draft'}>
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
      <h2 className="text-lg font-black text-slate-900">{status.canExport ? 'Váš orientační výsledek' : status.incomeReady ? 'Průběžný výsledek' : 'Nejdřív vaše příjmy'}</h2>
      <p className="mt-2 text-sm text-slate-700">{nextStepMessage(status, data, mode, params)}</p>
    </div>
    {status.warnings.map((warning, i) => <p key={i} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{warning}</p>)}
    {blocking.length ? <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800">
      <summary className="cursor-pointer font-bold">Co je potřeba doplnit nebo opravit?</summary>
      <div className="mt-3 space-y-2">{blocking.map((error, i) => <p key={i}>{error.message}</p>)}</div>
    </details> : <>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card helpKey={execution ? "deductionExecution" : spouses ? "deductionSpouses" : "deductionIndividual"} testId="monthly-deduction" label={execution ? 'Měsíčně se vám může srazit až' : spouses ? 'Měsíčně se vám oběma srazí' : 'Měsíčně se vám srazí'} value={formatKc(deduction)} />
        <Card helpKey={execution ? "retainedExecution" : spouses ? "retainedSpouses" : "retainedIndividual"} testId="retained-after-deduction" label={spouses ? 'Po srážkách vám oběma zůstane' : 'Po srážce vám zůstane'} value={formatKc(retained)} />
      </div>
      {execution ? <>
        {results.ex.nahradaPlatci > 0 && <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <p>Náhrada plátci: {formatKc(results.ex.nahradaPlatci)}. Je již součástí srážky, neplatíte ji navíc.</p>
          <ApprovedHelp name="feeResult" />
          <p>Na dluh po náhradě: {formatKc(results.ex.srazkaCista)}.</p>
          <ApprovedHelp name="debtAfterFee" />
        </div>}
        <p className="text-xs leading-relaxed text-slate-600">{EXECUTION_NOTE}</p>
      </> : <>
        <section data-testid="minimum-summary" className={`rounded-xl border p-4 text-sm ${c.finalDeficit > 0 ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'}`}>
          <h3 className="font-bold">Stačí to na potřebné měsíční minimum?</h3>
          <ApprovedHelp name="minimumRule" />
          <p className="mt-2 text-base font-black">{c.finalDeficit > 0 ? `Do potřebného minima chybí ${formatKc(c.finalDeficit)} měsíčně.` : 'Podle zadaných údajů je měsíční minimum pokryté.'}</p>
          <p className="mt-2 text-xs leading-relaxed">Samotné pokrytí minima neznamená schválení oddlužení.</p>
          <details className="mt-3"><summary className="cursor-pointer font-bold">Kolik je potřeba a co se započítává?</summary>
            <div className="mt-2 space-y-1">
              <p>Potřebné minimum: {formatKc(c.requiredMinimum)} měsíčně.</p>
              <p>Zákonná srážka: {formatKc(deduction)}.</p>
              <p>Odměna a výdaje insolvenčního správce: {formatKc(spouses ? params.odmenaSpravceManzele : params.odmenaSpravceJednotlivec)}.</p>
              <ApprovedHelp name={spouses ? "feeSpouses" : "feeIndividual"} />
              {c.debtorPromise > 0 && <p>Z vašich dalších peněz se započítává: {formatKc(c.debtorPromise)}.</p>}
              {c.thirdPartyContribution > 0 && <p>Od jiné osoby je k doplnění minima potřeba: {formatKc(Math.min(c.thirdPartyContribution, c.deficitAfterDebtorPromise))}.</p>}
            </div>
          </details>
        </section>
        {c.debtorPromise > 0 && <div data-testid="own-payment-summary" className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p>Navíc ze svých peněz přidáváte <strong>{formatKc(c.debtorPromise)} měsíčně</strong>. Tato částka není součástí zákonné srážky.</p>
          <p className="mt-2 font-bold">Po srážce a této další platbě {spouses ? 'vám oběma' : 'vám'} zůstane {formatKc(Math.max(0, retained - c.debtorPromise))}.</p>
        </div>}
        {c.thirdPartyContribution > 0 && <div data-testid="third-party-summary" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <p>Někdo další vám bude přispívat <strong>{formatKc(c.thirdPartyContribution)} měsíčně</strong>.</p>
          <p className="mt-1">K pokrytí minima z této částky potřebujete {formatKc(Math.min(c.thirdPartyContribution, c.deficitAfterDebtorPromise))}.</p>
        </div>}
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" data-testid="repayment-estimate">
          <h3 className="text-base font-black text-slate-900">Kolik by se mohlo splatit z běžných dluhů?</h3>
          <ApprovedHelp name="modelLimit" />
          <div className="grid gap-3 lg:grid-cols-2">
            <Card helpKey={spouses ? "creditorsSpouses" : "creditorsIndividual"} label="Na běžné dluhy ze zákonné srážky měsíčně" value={formatKc(spouses ? results.proVeriteleM : results.proVeriteleJ)} />
            <Card helpKey={!data.dluhNeznamy && number(data.dluhyNezajistene) > 0 && sectionReviewed(data, mode, "debts", params) ? "satisfaction" : undefined} label="Odhad splacení běžných dluhů" value={percentageText(data, mode, results, params)} hint={debtHint} />
          </div>
          <details className="text-xs leading-relaxed text-slate-600"><summary className="cursor-pointer font-bold">Podrobnosti a omezení odhadu</summary><p className="mt-2">{MODEL_NOTE}</p></details>
        </section>
      </>}
      <details className="rounded-xl border border-slate-200 bg-white p-4 text-slate-800"><summary className="cursor-pointer text-sm font-bold">Jak jsme k výsledku došli?</summary>
        <div className="mt-4 space-y-4"><ApprovedHelp name="protectedAmount" />{spouses && <ApprovedHelp name="separateSpouseDeduction" />}{spouses ? <>{['A', 'B'].map(letter => <section key={letter}><h3 className="mb-2 font-bold">Manžel {letter}</h3><CalculationBreakdown result={results[`insM_${letter}`]} /></section>)}<p>Celková srážka: {formatKc(results.insM_A.srazka)} + {formatKc(results.insM_B.srazka)} = {formatKc(results.srazkaCelkemM)}.</p></> : <CalculationBreakdown result={execution ? results.ex : results.insJ} />}</div>
      </details>
      <p className="text-xs leading-relaxed text-slate-600">Výpočet je orientační. Neověřuje právní povahu konkrétních příjmů a pohledávek, budoucí změny ani všechny náklady řízení.</p>
    </>}
  </div>;
}
