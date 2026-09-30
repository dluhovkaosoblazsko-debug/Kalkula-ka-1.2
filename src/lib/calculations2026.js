export const DEFAULT_2026_PARAMS = {
  zivotniMinimum: 4860,
  normativniNajemne: 9430,
  energetickyPausal: 2300,
  odmenaSpravceJednotlivec: 1089,
  odmenaSpravceManzele: 1633.5,
  pausalniNahradaPlatce: 50,
  koeficientZahladu: 85,
  koeficientZabavitelnosti: 1.9,
  limit4PlusPension: 1089,
  minSplatkaJednotlivec: 2178,
  minSplatkaManzele: 3267,
}

/**
 * Výpočet srážky ze mzdy / důchodu pro rok 2026.
 *
 * Funkce je společným zdrojem pravdy pro hlavní kalkulačku i modul
 * příjmového potenciálu. Parametry lze v hlavní kalkulačce uživatelsky
 * měnit; ostatní části aplikace používají DEFAULT_2026_PARAMS.
 */
export function calculateWageDeduction(
  {
    prijem,
    chranenyPrijem = 0,
    pocetVyz = 0,
    maPartnera = false,
    duchodPovinny = false,
    duchodPartner = false,
    vykonProVyzivne = 0,
    typ = 'neprednostni',
    pocetExekuci = '1-3',
    uplatnitPausal = false,
    mode = 'exekuce',
  },
  params = DEFAULT_2026_PARAMS,
) {
  const safePrijem = Math.max(0, Number(prijem) || 0)
  const safeChranenyPrijem = Math.max(0, Number(chranenyPrijem) || 0)
  const safePocetVyz = Math.max(0, Number(pocetVyz) || 0)
  const safeVykonProVyzivne = Math.max(0, Number(vykonProVyzivne) || 0)

  const soucetZakladu =
    Number(params.zivotniMinimum || 0) +
    Number(params.normativniNajemne || 0) +
    Number(params.energetickyPausal || 0)

  const zakladNaPovinneho = soucetZakladu * (Number(params.koeficientZahladu || 0) / 100)
  const jednaCtvrtina = zakladNaPovinneho / 4
  const hranicePlneZabavitelna = Math.floor(
    soucetZakladu * Number(params.koeficientZabavitelnosti || 0),
  )

  const zapocitatPartnera = Boolean(maPartnera && (duchodPovinny || duchodPartner))
  const pocetVsechOsob = safePocetVyz + (zapocitatPartnera ? 1 : 0)
  const pocetCtvrtin = Math.max(0, pocetVsechOsob - safeVykonProVyzivne)

  const celkovaNezabavitelnaRaw = zakladNaPovinneho + pocetCtvrtin * jednaCtvrtina
  const legalniNezabavitelnaCastka = Math.ceil(celkovaNezabavitelnaRaw)
  const zbytekMzdy = safePrijem - legalniNezabavitelnaCastka

  if (zbytekMzdy <= 0) {
    return {
      srazka: 0,
      srazkaCista: 0,
      nahradaPlatci: 0,
      kVyplate: safePrijem + safeChranenyPrijem,
      kVyplateZeSrazek: safePrijem,
      legalniMinimum: legalniNezabavitelnaCastka,
      tretina: 0,
      plneZabavitelna: 0,
      zbytekKDeleni: 0,
      castDoLimitu: 0,
      castDoTretin: 0,
      zaokrouhlovaciZbytek: 0,
      forceTwoThirds: false,
      exception4PlusApplied: false,
      maxPrednostniFond: 0,
      hranicePlneZabavitelna,
      zbytekMzdyRaw: zbytekMzdy,
      prijemPredSrazkou: safePrijem,
      partnerZapocitan: zapocitatPartnera,
      zakladNaPovinneho,
      jednaCtvrtina,
      pocetVsechOsob,
      vykonProVyzivne: safeVykonProVyzivne,
      pocetCtvrtin,
      celkovaNezabavitelnaRaw,
    }
  }

  const plneZabavitelnaCast = Math.max(0, zbytekMzdy - hranicePlneZabavitelna)
  const castDoLimitu = Math.min(zbytekMzdy, hranicePlneZabavitelna)
  const castDoTretin = Math.floor(castDoLimitu / 3) * 3
  const tretina = castDoTretin / 3
  const zaokrouhlovaciZbytek = castDoLimitu - castDoTretin

  const has4Plus = pocetExekuci === '4+'
  const exception4Plus = Boolean(duchodPovinny && tretina < Number(params.limit4PlusPension || 0))
  const apply4PlusRule = has4Plus && !exception4Plus

  const isPriority = typ === 'prednostni' || typ === 'vyzivne' || mode === 'insolvence'
  const forceTwoThirds = isPriority || apply4PlusRule
  const srazka = forceTwoThirds
    ? 2 * tretina + plneZabavitelnaCast
    : tretina + plneZabavitelnaCast

  let nahradaPlatci = 0
  if (mode === 'exekuce' && uplatnitPausal && srazka > 0) {
    nahradaPlatci = Math.min(Number(params.pausalniNahradaPlatce || 0), Math.ceil(srazka / 3))
  }

  const maxPrednostniFond = typ === 'vyzivne' ? tretina + plneZabavitelnaCast : 0

  return {
    srazka,
    srazkaCista: srazka - nahradaPlatci,
    nahradaPlatci,
    kVyplateZeSrazek: safePrijem - srazka,
    kVyplate: safePrijem - srazka + safeChranenyPrijem,
    chranenyPrijem: safeChranenyPrijem,
    legalniMinimum: legalniNezabavitelnaCastka,
    tretina,
    plneZabavitelna: plneZabavitelnaCast,
    // zbytekKDeleni je záměrně částka již snížená na násobek tří,
    // aby zobrazený mezivýpočet „÷ 3“ vždy přesně seděl.
    zbytekKDeleni: castDoTretin,
    castDoLimitu,
    castDoTretin,
    zaokrouhlovaciZbytek,
    forceTwoThirds,
    exception4PlusApplied: has4Plus && exception4Plus,
    maxPrednostniFond,
    partnerZapocitan: zapocitatPartnera,
    hranicePlneZabavitelna,
    zbytekMzdyRaw: zbytekMzdy,
    prijemPredSrazkou: safePrijem,
    zakladNaPovinneho,
    jednaCtvrtina,
    pocetVsechOsob,
    vykonProVyzivne: safeVykonProVyzivne,
    pocetCtvrtin,
    celkovaNezabavitelnaRaw,
  }
}

export function getMinimumInsolvencyPayment({
  administratorFee,
  ordinaryAlimony = 0,
  configuredMinimum = 0,
}) {
  const fee = Math.max(0, Number(administratorFee) || 0)
  const alimony = Math.max(0, Number(ordinaryAlimony) || 0)
  // „1 + 1“: správce + alespoň stejná částka ostatním věřitelům,
  // k tomu běžné zákonné výživné. Uživatelský parametr může základní
  // minimum zvýšit, nikoli snížit pod 2× odměnu správce.
  const baseMinimum = Math.max(Number(configuredMinimum) || 0, 2 * fee)
  return baseMinimum + alimony
}

/**
 * Posoudí, zda zákonná srážka a případné pravidelné doplňkové zdroje
 * pokryjí orientační minimum pro povolení oddlužení.
 *
 * Doplňkové zdroje jsou záměrně oddělené od výpočtu zákonné srážky.
 * Do dlouhodobého modelu uspokojení věřitelů se započítají až tehdy,
 * pokud je aplikace bude umět evidovat jako skutečně pravidelné plnění.
 */
export function calculateMinimumPaymentCoverage({
  statutoryDeduction = 0,
  requiredMinimum = 0,
  debtorPromise = 0,
  thirdPartyContribution = 0,
}) {
  const statutory = Math.max(0, Number(statutoryDeduction) || 0)
  const required = Math.max(0, Number(requiredMinimum) || 0)
  const promise = Math.max(0, Number(debtorPromise) || 0)
  const thirdParty = Math.max(0, Number(thirdPartyContribution) || 0)
  const totalAvailable = statutory + promise + thirdParty

  return {
    statutoryDeduction: statutory,
    requiredMinimum: required,
    debtorPromise: promise,
    thirdPartyContribution: thirdParty,
    totalAvailable,
    deficitAfterStatutoryDeduction: Math.max(0, required - statutory),
    deficitAfterDebtorPromise: Math.max(0, required - statutory - promise),
    finalDeficit: Math.max(0, required - totalAvailable),
    coveredByStatutoryDeduction: statutory >= required,
    coveredByDebtorPromise: statutory + promise >= required,
    coveredWithAdditionalSources: totalAvailable >= required,
  }
}

export function calculateCreditorSatisfaction({
  availableForCreditors,
  unsecuredDebt,
}) {
  const available = Math.max(0, Number(availableForCreditors) || 0)
  const debt = Math.max(0, Number(unsecuredDebt) || 0)

  if (debt <= 0) {
    return {
      percentage: 0,
      actualPayment: 0,
      availableForCreditors: available,
      unsecuredDebt: debt,
      excessPotential: 0,
      isFullySatisfied: false,
    }
  }

  const actualPayment = Math.min(available, debt)
  const percentage = Math.min(100, (actualPayment / debt) * 100)

  return {
    percentage,
    actualPayment,
    availableForCreditors: available,
    unsecuredDebt: debt,
    excessPotential: Math.max(0, available - debt),
    isFullySatisfied: actualPayment >= debt,
  }
}
