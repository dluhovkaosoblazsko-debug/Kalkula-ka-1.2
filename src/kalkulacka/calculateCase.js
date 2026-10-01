import { DEFAULT_2026_PARAMS, calculateCreditorSatisfaction, calculateDebtorPromiseLimit, calculateMinimumPaymentCoverage, calculateWageDeduction, getMinimumInsolvencyPayment } from '../lib/calculations2026.js';
import { present, validNumber, number, sumIncomeSources, hasQualifyingPension, feeEligible } from './caseState.js';

// Multiple income types can belong to one payer. Each payer gets one allowance
// and at most one fee. Legacy rows without an explicit payer remain separate.
export function groupPayers(sources = []) {
  const groups = new Map();
  for (const source of sources) {
    const key = source.platceId || source.id;
    if (!groups.has(key)) groups.set(key, { id: key, sources: [], source });
    groups.get(key).sources.push(source);
  }
  return [...groups.values()];
}
// Keep a payer's allowance and fee visible when its first income is moved or
// removed. Income rows do not carry multiple independent fees for the same payer.
function preservePayerMetadata(rows, previous) {
  const previousGroups = new Map(groupPayers(previous).map(g => [g.id,g.source]));
  const primaryIds = new Map(groupPayers(rows).map(g => [g.id,g.source.id]));
  return rows.map(source => {
    const groupId = source.platceId || source.id;
    const old = previousGroups.get(groupId);
    const primary = source.id === primaryIds.get(groupId);
    return { ...source,
      pridelenaNezabavitelna: primary ? (old?.pridelenaNezabavitelna ?? '') : '',
      uplatnitPausal: primary && old?.uplatnitPausal === true,
    };
  });
}
export const moveIncomeToPayer = (sources, id, payerId) => preservePayerMetadata(
  sources.map(s => s.id === id ? {...s,platceId:payerId} : s), sources);
export const removeIncomeSource = (sources,id) => preservePayerMetadata(sources.filter(s => s.id !== id),sources);

export function calculatePerson({ sources = [], multiplePayers = false, chranenyPrijem = 0, ...input }, params = DEFAULT_2026_PARAMS) {
  const rows = Array.isArray(sources) ? sources : [];
  const safeSources = rows.filter(s => number(s.castka) > 0);
  const groups = groupPayers(rows);
  const totalPrijem = sumIncomeSources(safeSources);
  const duchodPovinny = hasQualifyingPension(safeSources);
  const common = { ...input, duchodPovinny, chranenyPrijem: number(chranenyPrijem) };
  const combined = calculateWageDeduction({ ...common, prijem: totalPrijem, uplatnitPausal: (!multiplePayers || groups.length <= 1) ? (rows[0]?.uplatnitPausal ?? input.uplatnitPausal) : false, payerFeeEligible: safeSources.some(feeEligible) }, params);
  const base = { ...combined, payerBreakdown: [], multiPayerExact: false, multiPayerNeedsAllocation: false, totalPrijem, duchodPovinny };
  if (!multiplePayers || groups.length <= 1) return base;
  // Blank is not zero. Compare in cents, not with the former one-crown tolerance.
  const complete = groups.every(g => present(g.source.pridelenaNezabavitelna) && validNumber(g.source.pridelenaNezabavitelna));
  const assignedTotal = groups.reduce((s,g) => s + number(g.source.pridelenaNezabavitelna),0);
  const match = complete && Math.abs(assignedTotal - combined.legalniMinimum) < 0.0000001;
  if (!match) {
    // No fictitious payroll fee is assigned to an unknown allocation.
    const withoutFee = calculateWageDeduction({ ...common, prijem: totalPrijem, uplatnitPausal: false }, params);
    return { ...base, ...withoutFee, multiPayerNeedsAllocation: true, assignedNezabavitelnaTotal: assignedTotal,
      feeUnresolved: Boolean(input.uplatnitPausal || groups.some(g => g.source.uplatnitPausal)) };
  }
  const payerBreakdown = groups.map(group => ({
    source: group.source, sources: group.sources,
    result: calculateWageDeduction({ ...common, chranenyPrijem: 0,
      prijem: sumIncomeSources(group.sources), nezabavitelnaOverride: number(group.source.pridelenaNezabavitelna),
      uplatnitPausal: group.source.uplatnitPausal === true,
      payerFeeEligible: group.sources.some(s => number(s.castka) > 0 && feeEligible(s)),
    }, params),
  }));
  const sum = key => payerBreakdown.reduce((s,item) => s + number(item.result[key]),0);
  return { ...base, srazka: sum('srazka'), srazkaCista: sum('srazkaCista'), nahradaPlatci: sum('nahradaPlatci'),
    kVyplateZeSrazek: sum('kVyplateZeSrazek'), kVyplate: sum('kVyplateZeSrazek') + number(chranenyPrijem),
    payerBreakdown, multiPayerExact: true, assignedNezabavitelnaTotal: assignedTotal,
    allocationUnused: payerBreakdown.some(item => item.result.prijemPredSrazkou < item.result.legalniMinimum),
    feeUnresolved: Boolean(input.uplatnitPausal && groups.every(g => g.source.uplatnitPausal === undefined)),
  };
}

export function calculateCase(rawData, params = DEFAULT_2026_PARAMS, activeTab = 'jednotlivec') {
  const data = { ...rawData };
  for (const field of ['spolecneDeti','vyzivovaneOsoby1','vyzivovaneOsoby2','osobySVykonemProVyzivne1','osobySVykonemProVyzivne2','chranenePrijmy1','chranenePrijmy2','bezneMesicniVyzivne1','bezneMesicniVyzivne2','dluhyNezajistene','dluhyZajistene','dluhyNeosvoboditelne','vytezekZpenezeni','delkaOddluzeni']) data[field] = number(data[field]);
  const calculatePersonResult = input => calculatePerson(input,params);
  // @INTEGRATE_ORIGINAL_CASE_BODY
}
