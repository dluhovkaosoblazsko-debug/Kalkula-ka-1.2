import assert from 'node:assert/strict'
import {
  DEFAULT_2026_PARAMS,
  calculateCreditorSatisfaction,
  calculateWageDeduction,
  getMinimumInsolvencyPayment,
} from '../src/lib/calculations2026.js'
import {
  calculateNetIncome2026,
  getChildTaxAdvantage,
} from '../src/lib/payroll2026.js'

const insolvency = (prijem, pocetVyz = 0) =>
  calculateWageDeduction(
    {
      prijem,
      pocetVyz,
      typ: 'prednostni',
      mode: 'insolvence',
    },
    DEFAULT_2026_PARAMS,
  )

assert.equal(
  DEFAULT_2026_PARAMS.zivotniMinimum +
    DEFAULT_2026_PARAMS.normativniNajemne +
    DEFAULT_2026_PARAMS.energetickyPausal,
  16590,
)

assert.deepEqual(
  [insolvency(14102).legalniMinimum, insolvency(14102).srazka],
  [14102, 0],
)
assert.deepEqual(
  [insolvency(17368).tretina, insolvency(17368).srazka],
  [1088, 2176],
)
assert.deepEqual(
  [insolvency(17369).tretina, insolvency(17369).srazka],
  [1089, 2178],
)
assert.equal(insolvency(20000).srazka, 3932)
assert.equal(insolvency(50000).srazka, 25391)
assert.deepEqual(
  [insolvency(20000, 1).legalniMinimum, insolvency(20000, 1).srazka],
  [17627, 1582],
)
assert.deepEqual(
  [insolvency(25000, 2).legalniMinimum, insolvency(25000, 2).srazka],
  [21153, 2564],
)

const withRounding = insolvency(18000)
assert.equal(withRounding.castDoLimitu, 3898)
assert.equal(withRounding.zbytekKDeleni, 3897)
assert.equal(withRounding.zaokrouhlovaciZbytek, 1)
assert.equal(withRounding.tretina, 1299)

assert.equal(
  getMinimumInsolvencyPayment({
    administratorFee: 1089,
    ordinaryAlimony: 2000,
    configuredMinimum: 2178,
  }),
  4178,
)
assert.equal(
  getMinimumInsolvencyPayment({
    administratorFee: 1633.5,
    ordinaryAlimony: 1000,
    configuredMinimum: 3267,
  }),
  4267,
)

const exekuce = calculateWageDeduction(
  {
    prijem: 20000,
    pocetVyz: 0,
    typ: 'neprednostni',
    uplatnitPausal: true,
    mode: 'exekuce',
  },
  DEFAULT_2026_PARAMS,
)
assert.equal(exekuce.srazka, 1966)
assert.equal(exekuce.nahradaPlatci, 50)
assert.equal(exekuce.srazkaCista, 1916)
assert.equal(exekuce.kVyplate, 18034)

assert.equal(getChildTaxAdvantage(1, 0), 1267)
assert.equal(getChildTaxAdvantage(2, 0), 3127)
assert.equal(getChildTaxAdvantage(3, 0), 5447)
assert.equal(getChildTaxAdvantage(2, 1), 4987)

const normal = calculateNetIncome2026({ hrubyPrijem: 50000 })
const pensioner = calculateNetIncome2026({
  hrubyPrijem: 50000,
  slevaPracujiciDuchodce: true,
})
assert.equal(normal.socialni, 3550)
assert.equal(pensioner.socialni, 300)

const spouseOff = calculateNetIncome2026({ hrubyPrijem: 50000, slevaNaManzela: false })
const spouseOn = calculateNetIncome2026({ hrubyPrijem: 50000, slevaNaManzela: true })
assert.equal(spouseOff.cistyPrijem, spouseOn.cistyPrijem)
assert.equal(spouseOn.slevaNaManzelaNezahrnuta, true)

const highIncome = calculateNetIncome2026({ hrubyPrijem: 200000, slevaNaPoplatnika: false })
assert.equal(highIncome.zakladZalohy, 200000)
assert.equal(highIncome.danPredSlevami, Math.ceil(146901 * 0.15 + (200000 - 146901) * 0.23))


const satisfactionOver = calculateCreditorSatisfaction({
  availableForCreditors: 84000,
  unsecuredDebt: 6000,
})
assert.equal(satisfactionOver.percentage, 100)
assert.equal(satisfactionOver.actualPayment, 6000)
assert.equal(satisfactionOver.excessPotential, 78000)
assert.equal(satisfactionOver.isFullySatisfied, true)

const satisfactionPartial = calculateCreditorSatisfaction({
  availableForCreditors: 300000,
  unsecuredDebt: 600000,
})
assert.equal(satisfactionPartial.percentage, 50)
assert.equal(satisfactionPartial.actualPayment, 300000)
assert.equal(satisfactionPartial.isFullySatisfied, false)

console.log('OK: všechny referenční výpočty 2026 prošly.')
