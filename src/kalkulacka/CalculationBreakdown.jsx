import React from 'react';
import { formatKc, incomeLabel, number } from './caseState.js';

// The same actual payer results are used in the UI and in print. Never build
// a formula from combined-income terms when the result is a sum of payer deductions.
export default function CalculationBreakdown({ result }) {
  if (result.multiPayerExact && result.payerBreakdown?.length) {
    const sumRetained = result.payerBreakdown.reduce((sum,item) => sum + item.result.kVyplate,0);
    return <div className="space-y-3 report-payers">
      {result.payerBreakdown.map((item,index) => <div key={item.source.id || index} className="report-subsection rounded-lg border border-slate-200 p-3">
        <h4 className="font-bold">Plátce {index+1} – {(item.sources || [item.source]).map(s=>incomeLabel(s.typ)).join(' + ')}</h4>
        <CalculationBreakdown result={item.result} />
      </div>)}
      <p className="font-bold">Součet srážek plátců: {result.payerBreakdown.map(item=>formatKc(item.result.srazka)).join(' + ')} = {formatKc(result.srazka)}.</p>
      <p>Součet ponechaných příjmů: {formatKc(sumRetained)}{result.kVyplate > sumRetained ? ` + chráněné příjmy ${formatKc(result.kVyplate-sumRetained)}` : ''} = {formatKc(result.kVyplate)}.</p>
    </div>;
  }
  const above = Math.max(0,result.zbytekMzdyRaw);
  return <div>
    {result.multiPayerNeedsAllocation && <p className="mb-2 text-sm font-bold">Souhrnný orientační model bez úplného rozdělení mezi plátce; nejde o součet jejich skutečných srážek.</p>}
    <ol className="report-steps list-decimal space-y-2 pl-5 text-sm leading-relaxed">
      <li>{result.nezabavitelnaOverridePouzita ? 'Přidělená' : 'Celková'} nezabavitelná částka: <strong>{formatKc(result.legalniMinimum)}</strong>.</li>
      {above === 0 ? <li>Příjem {formatKc(result.prijemPredSrazkou)} nepřesahuje nezabavitelnou částku. Srážka je <strong>0 Kč</strong>.</li> : <>
        <li>Příjem nad nezabavitelnou částku: {formatKc(result.prijemPredSrazkou)} − {formatKc(result.legalniMinimum)} = <strong>{formatKc(above)}</strong>.</li>
        <li>K dělení na třetiny: {formatKc(result.zbytekKDeleni)} ÷ 3 = <strong>{formatKc(result.tretina)}</strong>. Zaokrouhlovací zbytek {formatKc(result.zaokrouhlovaciZbytek)} zůstává dlužníkovi.</li>
        <li>Srážka: {result.forceTwoThirds ? 2 : 1} × {formatKc(result.tretina)} + {formatKc(result.plneZabavitelna)} plně zabavitelné části = <strong>{formatKc(result.srazka)}</strong>.</li>
      </>}
      {number(result.nahradaPlatci) > 0 && <li>Ze srážky náleží plátci {formatKc(result.nahradaPlatci)}; na dluh po náhradě {formatKc(result.srazkaCista)}.</li>}
      <li>Po srážce zůstává{number(result.chranenyPrijem) > 0 ? ' včetně chráněných příjmů' : ''}: <strong>{formatKc(result.kVyplate)}</strong>.</li>
    </ol>
  </div>;
}
