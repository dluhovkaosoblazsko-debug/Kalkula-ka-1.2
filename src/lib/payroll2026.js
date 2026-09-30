export const PAYROLL_2026 = {
  higherTaxThresholdMonthly: 146901,
  monthlyTaxpayerDiscount: 2570,
  monthlyChildBonusIncomeThreshold: 11200,
  socialEmployeeRate: 0.071,
  workingPensionerSocialDiscountRate: 0.065,
  healthEmployeeRate: 0.045,
}

export function getPersonalDisabilityDiscount(postizeni) {
  if (postizeni === 'invalidita1' || postizeni === 'invalidita2') return 210
  if (postizeni === 'invalidita3') return 420
  if (postizeni === 'ztp-p') return 1345
  return 0
}

export function getChildTaxAdvantage(pocetDetiProBonus, pocetDetiZtpP) {
  const count = Math.max(0, Math.floor(Number(pocetDetiProBonus) || 0))
  const ztpCount = Math.min(count, Math.max(0, Math.floor(Number(pocetDetiZtpP) || 0)))
  const baseAmounts = Array.from({ length: count }, (_, index) => {
    if (index === 0) return 1267
    if (index === 1) return 1860
    return 2320
  })

  // Vstup nerozlišuje pořadí konkrétních dětí. ZTP/P se proto přiřadí
  // k nejvyšším pořadovým sazbám, tedy k výhodnějšímu uplatnění.
  const ztpIndexes = new Set(
    Array.from({ length: ztpCount }, (_, index) => count - 1 - index),
  )

  return baseAmounts.reduce(
    (sum, amount, index) => sum + amount * (ztpIndexes.has(index) ? 2 : 1),
    0,
  )
}

/**
 * Orientační měsíční čistá mzda 2026 pro standardní zaměstnání.
 * Neřeší všechny výjimky zdravotního pojištění, roční maxima pojistného,
 * souběh zaměstnavatelů ani roční daňové zúčtování.
 */
export function calculateNetIncome2026({
  hrubyPrijem,
  slevaNaPoplatnika = true,
  pocetDetiProBonus = 0,
  pocetDetiZtpP = 0,
  postizeni = 'bez',
  slevaNaManzela = false,
  slevaPracujiciDuchodce = false,
}) {
  const gross = Math.max(0, Number(hrubyPrijem) || 0)

  const socialRate = slevaPracujiciDuchodce
    ? PAYROLL_2026.socialEmployeeRate - PAYROLL_2026.workingPensionerSocialDiscountRate
    : PAYROLL_2026.socialEmployeeRate
  const socialni = Math.ceil(gross * socialRate)
  const zdravotni = Math.ceil(gross * PAYROLL_2026.healthEmployeeRate)

  const zakladZalohy = gross <= 100 ? Math.ceil(gross) : Math.ceil(gross / 100) * 100
  const hranice23 = PAYROLL_2026.higherTaxThresholdMonthly
  const danPredSlevami = Math.ceil(
    Math.min(zakladZalohy, hranice23) * 0.15 +
      Math.max(0, zakladZalohy - hranice23) * 0.23,
  )

  let mesicniSlevy = 0
  if (slevaNaPoplatnika) mesicniSlevy += PAYROLL_2026.monthlyTaxpayerDiscount
  mesicniSlevy += getPersonalDisabilityDiscount(postizeni)

  // Sleva na manžela/manželku se uplatňuje ročně, nikoli v měsíční záloze.
  const slevaNaManzelaNezahrnuta = Boolean(slevaNaManzela)
  const danPoOsobnichSlevach = Math.max(0, danPredSlevami - mesicniSlevy)

  const danoveZvyhodneniDeti = getChildTaxAdvantage(pocetDetiProBonus, pocetDetiZtpP)
  const danPoDetech = Math.max(0, danPoOsobnichSlevach - danoveZvyhodneniDeti)
  const potencialniBonus = Math.max(0, danoveZvyhodneniDeti - danPoOsobnichSlevach)
  const bonusNaDeti =
    gross >= PAYROLL_2026.monthlyChildBonusIncomeThreshold && potencialniBonus >= 50
      ? potencialniBonus
      : 0

  const cistyPrijem = Math.round(gross - socialni - zdravotni - danPoDetech + bonusNaDeti)

  return {
    cistyPrijem,
    socialni,
    zdravotni,
    dan: danPoDetech,
    bonusNaDeti,
    danoveZvyhodneniDeti,
    slevaNaManzelaNezahrnuta,
    zakladZalohy,
    danPredSlevami,
  }
}
