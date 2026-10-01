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

    const totalPrijem1 = sumIncomeSources(data.prijmy1);
    const totalPrijem2 = sumIncomeSources(data.prijmy2);
    const duchodPovinny1 = hasQualifyingPension(data.prijmy1);
    const duchodPovinny2 = hasQualifyingPension(data.prijmy2);

    const spolecneDetiD1 = activeTab === 'manzele' ? data.spolecneDeti : 0;
    const pocetVyzD1 = spolecneDetiD1 + data.vyzivovaneOsoby1;
    const pocetVyzD2 = data.spolecneDeti + data.vyzivovaneOsoby2;

    const partnerRelevant1 = Boolean(data.partnerProNezabavitelnou1);
    const partnerQualifying1 = activeTab === 'manzele'
      ? duchodPovinny2
      : partnerRelevant1 && !duchodPovinny1;
    const partnerQualifying2 = duchodPovinny1;

    // --- Exekuce (dlužník 1) ---
    const ex = calculatePersonResult({
      sources: data.prijmy1,
      multiplePayers: data.vicePlatcu1,
      chranenyPrijem: data.chranenePrijmy1,
      pocetVyz: pocetVyzD1,
      maPartnera: activeTab === 'manzele' ? true : partnerRelevant1,
      duchodPartner: partnerQualifying1,
      vykonProVyzivne: data.osobySVykonemProVyzivne1,
      typ: data.typPohledavky,
      pocetExekuci: data.pocetExekuci,
      uplatnitPausal: data.uplatnitPausalPlatce,
      mode: 'exekuce',
    });

    // --- Oddlužení jednotlivce ---
    const insJ = calculatePersonResult({
      sources: data.prijmy1,
      multiplePayers: data.vicePlatcu1,
      chranenyPrijem: data.chranenePrijmy1,
      pocetVyz: pocetVyzD1,
      maPartnera: partnerRelevant1,
      duchodPartner: partnerRelevant1 && !duchodPovinny1,
      vykonProVyzivne: data.osobySVykonemProVyzivne1,
      typ: 'prednostni',
      pocetExekuci: '1-3',
      uplatnitPausal: false,
      mode: 'insolvence',
    });

    const proVeriteleJ = Math.max(0, insJ.srazka - params.odmenaSpravceJednotlivec - data.bezneMesicniVyzivne1);
    const celkemProVeriteleJ = (proVeriteleJ * data.delkaOddluzeni) + data.vytezekZpenezeni;
    const uspokojeniInfoJ = calculateCreditorSatisfaction({
      availableForCreditors: celkemProVeriteleJ,
      unsecuredDebt: data.dluhyNezajistene,
    });
    const minimalniNutnaSrazkaJ = getMinimumInsolvencyPayment({
      administratorFee: params.odmenaSpravceJednotlivec,
      ordinaryAlimony: data.bezneMesicniVyzivne1,
      configuredMinimum: 0,
    });
    const promiseLimitJ = calculateDebtorPromiseLimit({
      retainedAfterStatutoryDeduction: insJ.kVyplate,
      basicNeeds: data.zakladniPotreby1,
      deficitAfterStatutoryDeduction: Math.max(0, minimalniNutnaSrazkaJ - insJ.srazka),
      requestedPromise: data.povolitPrislibDluznika1 ? data.zavaznyPrislib1 : 0,
    });
    const coverageJ = {
      ...calculateMinimumPaymentCoverage({
        statutoryDeduction: insJ.srazka,
        requiredMinimum: minimalniNutnaSrazkaJ,
        debtorPromise: promiseLimitJ.effectiveDebtorPromise,
        thirdPartyContribution: data.povolitPlneniTretiOsoby1 ? data.pravidelnePlneniTretiOsoby1 : 0,
      }),
      ...promiseLimitJ,
    };

    // --- Společné oddlužení manželů ---
    // Každý manžel má vlastní srážku. Společné děti se započítávají každému zvlášť.
    // Manžel/partner se započte, pokud je kvalifikovaný důchod přiznán alespoň jednomu z nich.
    const insM_A = calculatePersonResult({
      sources: data.prijmy1,
      multiplePayers: data.vicePlatcu1,
      chranenyPrijem: data.chranenePrijmy1,
      pocetVyz: pocetVyzD1,
      maPartnera: true,
      duchodPartner: partnerQualifying1,
      vykonProVyzivne: data.osobySVykonemProVyzivne1,
      typ: 'prednostni',
      pocetExekuci: '1-3',
      uplatnitPausal: false,
      mode: 'insolvence',
    });

    const insM_B = calculatePersonResult({
      sources: data.prijmy2,
      multiplePayers: data.vicePlatcu2,
      chranenyPrijem: data.chranenePrijmy2,
      pocetVyz: pocetVyzD2,
      maPartnera: true,
      duchodPartner: partnerQualifying2,
      vykonProVyzivne: data.osobySVykonemProVyzivne2,
      typ: 'prednostni',
      pocetExekuci: '1-3',
      uplatnitPausal: false,
      mode: 'insolvence',
    });

    const srazkaCelkemM = insM_A.srazka + insM_B.srazka;
    const kVyplateCelkemM = insM_A.kVyplate + insM_B.kVyplate;
    const bezneVyzivneM = data.bezneMesicniVyzivne1 + data.bezneMesicniVyzivne2;
    const proVeriteleM = Math.max(0, srazkaCelkemM - params.odmenaSpravceManzele - bezneVyzivneM);
    const celkemProVeriteleM = (proVeriteleM * data.delkaOddluzeni) + data.vytezekZpenezeni;
    const uspokojeniInfoM = calculateCreditorSatisfaction({
      availableForCreditors: celkemProVeriteleM,
      unsecuredDebt: data.dluhyNezajistene,
    });
    const minimalniNutnaSrazkaM = getMinimumInsolvencyPayment({
      administratorFee: params.odmenaSpravceManzele,
      ordinaryAlimony: bezneVyzivneM,
      configuredMinimum: 0,
    });
    const promiseLimitM = calculateDebtorPromiseLimit({
      retainedAfterStatutoryDeduction: kVyplateCelkemM,
      basicNeeds: data.zakladniPotrebyM,
      deficitAfterStatutoryDeduction: Math.max(0, minimalniNutnaSrazkaM - srazkaCelkemM),
      requestedPromise: data.povolitPrislibDluznikaM ? data.zavaznyPrislibM : 0,
    });
    const coverageM = {
      ...calculateMinimumPaymentCoverage({
        statutoryDeduction: srazkaCelkemM,
        requiredMinimum: minimalniNutnaSrazkaM,
        debtorPromise: promiseLimitM.effectiveDebtorPromise,
        thirdPartyContribution: data.povolitPlneniTretiOsobyM ? data.pravidelnePlneniTretiOsobyM : 0,
      }),
      ...promiseLimitM,
    };

    return {
      ex,
      insJ,
      proVeriteleJ,
      uspokojeniJ: uspokojeniInfoJ.percentage,
      uspokojeniInfoJ,
      rizikoNepovoleniJ: coverageJ.finalDeficit > 0,
      minimalniNutnaSrazkaJ,
      minimalneProVeriteleJ: params.odmenaSpravceJednotlivec,
      coverageJ,
      totalPrijem1,
      celkemProVeriteleJ,
      duchodPovinny1,
      insM_A,
      insM_B,
      srazkaCelkemM,
      kVyplateCelkemM,
      proVeriteleM,
      uspokojeniM: uspokojeniInfoM.percentage,
      uspokojeniInfoM,
      rizikoNepovoleniM: coverageM.finalDeficit > 0,
      minimalniNutnaSrazkaM,
      minimalneProVeriteleM: params.odmenaSpravceManzele,
      coverageM,
      totalPrijem2,
      celkemProVeriteleM,
      duchodPovinny2,
    };

}
