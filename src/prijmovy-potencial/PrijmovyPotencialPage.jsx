import React, { useMemo, useState } from 'react'
import {
  Briefcase,
  Calculator,
  FileBarChart,
  Gauge,
  Info,
  Landmark,
  Percent,
  User,
  Users,
  Wallet,
} from 'lucide-react'

import educationOptions from '../data/prijmovyPotencial/education_options.json'
import regionOptions from '../data/prijmovyPotencial/region_options.json'
import regionGroups from '../data/prijmovyPotencial/region_groups.json'
import naceOptions from '../data/prijmovyPotencial/nace_options.json'
import naceGroups from '../data/prijmovyPotencial/nace_groups.json'
import percentileMap from '../data/prijmovyPotencial/percentile_map.json'
import statisticalData2024 from '../data/prijmovyPotencial/statistical_data_2024.json'
import { DEFAULT_2026_PARAMS, calculateCreditorSatisfaction, calculateWageDeduction, getMinimumInsolvencyPayment } from '../lib/calculations2026'
import { calculateNetIncome2026 } from '../lib/payroll2026'

const initialPotentialData = {
  jmeno: '',
  spisovaZnacka: '',

  pohlavi: '',
  vek: '',
  vzdelani: '',
  region: '',
  czNace: '',
  uvazek: 1,

  aktualniHrubyPrijem: 0,
  nejvyssiMinulyHrubyPrijem: 0,
  pozadovanyPercentil: 50,

  slevaNaPoplatnika: true,
  pocetDetiProBonus: 0,
  pocetDetiZtpP: 0,
  postizeni: 'bez',
  slevaNaManzela: false,
  slevaPracujiciDuchodce: false,

  zapnoutDopadDoOddluzeni: false,
  pocetVyzivovanychOsob: 0,
  bezneMesicniVyzivne: 0,
  delkaOddluzeni: 36,
  nezajisteneDluhy: 0,
  zavaznyPrislib: 0,
  pravidelnePlneniTretiOsoby: 0,
  mimoradnaSplatka: 0,
  vytezekZpenezeni: 0,
}

const genderOptions = ['Muž', 'Žena']

const disabilityOptions = [
  { value: 'bez', label: 'Bez postižení' },
  { value: 'ztp-p', label: 'ZTP/P' },
  { value: 'invalidita1', label: 'Invalidita I. stupně' },
  { value: 'invalidita2', label: 'Invalidita II. stupně' },
  { value: 'invalidita3', label: 'Invalidita III. stupně' },
]

const percentileOptions = percentileMap.map((item) => item.percentile)

function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('cs-CZ')
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)} %`
}

function getAgeGroup(age) {
  const n = Number(age)
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n <= 34) return 'do 34 let'
  if (n <= 54) return '35 až 54 let'
  return '55 a více let'
}

function getRegionCategory(regionLabel) {
  const match = regionOptions.find((item) => item.label === regionLabel)
  return match?.category ?? null
}

function getRegionGroup(regionLabel) {
  const category = getRegionCategory(regionLabel)
  if (category == null) return null
  const match = regionGroups.find((item) => item.category === category)
  return match?.group ?? null
}

function getGroupedNace(naceLabel) {
  const match = naceOptions.find((item) => item.label === naceLabel)
  return match?.grouped ?? null
}

function getNaceSections(naceLabel) {
  const grouped = getGroupedNace(naceLabel)
  if (!grouped) return null
  const match = naceGroups.find((item) => item.grouped === grouped)
  return match?.sections ?? null
}

function getPercentileKey(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return `p${n}`
}

function validatePotentialInput(data) {
  const errors = []

  if (!data.pohlavi) errors.push('Vyberte pohlaví.')
  if (!data.vek) errors.push('Zadejte věk.')
  if (!data.vzdelani) errors.push('Vyberte vzdělání.')
  if (!data.region) errors.push('Vyberte region.')
  if (!data.czNace) errors.push('Vyberte obor činnosti.')
  if (!data.pozadovanyPercentil) errors.push('Vyberte zvolený percentil srovnávací skupiny.')
  if (Number(data.uvazek) <= 0) errors.push('Úvazek musí být větší než 0.')
  if (Number(data.pocetDetiZtpP) > Number(data.pocetDetiProBonus)) {
    errors.push('Počet dětí ZTP/P nemůže být vyšší než počet dětí uplatňovaných pro daňové zvýhodnění.')
  }

  return errors
}

function matchStatGroup(data) {
  const ageGroup = getAgeGroup(data.vek)
  const regionCategory = getRegionCategory(data.region)
  const groupedNace = getGroupedNace(data.czNace)

  if (!ageGroup || regionCategory == null || !groupedNace) return null

  return (
    statisticalData2024.find((row) => {
      return (
        row.gender === data.pohlavi &&
        row.education === data.vzdelani &&
        Number(row.regionCategory) === Number(regionCategory) &&
        row.groupedNace === groupedNace &&
        row.ageGroup === ageGroup
      )
    }) || null
  )
}

function getGrossIncomeByPercentile(data, matchedRow) {
  if (!matchedRow) {
    return {
      pozadovanyHrubyPrijem: 0,
      pocetPodobnychOsob: 0,
      porovnaniText: 'Nebyla nalezena odpovídající statistická skupina.',
    }
  }

  const key = getPercentileKey(data.pozadovanyPercentil)
  const baseGross = Number(matchedRow.percentiles?.[key] || 0)
  const uvazek = Number(data.uvazek || 1)
  const pozadovanyHrubyPrijem = Math.round(baseGross * uvazek)

  let porovnaniText = 'Odhad vychází ze statistické skupiny s podobnými charakteristikami.'
  if (Number(data.aktualniHrubyPrijem) > 0) {
    if (pozadovanyHrubyPrijem > Number(data.aktualniHrubyPrijem)) {
      porovnaniText = 'Modelový hrubý příjem je vyšší než aktuálně zadaný hrubý příjem.'
    } else {
      porovnaniText = 'Modelový hrubý příjem nepřevyšuje aktuálně zadaný hrubý příjem.'
    }
  }

  return {
    pozadovanyHrubyPrijem,
    pocetPodobnychOsob: Math.round(Number(matchedRow.employeeCount || 0)),
    porovnaniText,
  }
}

function buildPercentileTable(data, matchedRow) {
  if (!matchedRow) return []

  return percentileOptions
    .map((percentil) => {
      const key = getPercentileKey(percentil)
      const hruby = Math.round(Number(matchedRow.percentiles?.[key] || 0) * Number(data.uvazek || 1))
      const { cistyPrijem } = calculateNetIncome2026({
        hrubyPrijem: hruby,
        slevaNaPoplatnika: data.slevaNaPoplatnika,
        pocetDetiProBonus: data.pocetDetiProBonus,
        pocetDetiZtpP: data.pocetDetiZtpP,
        postizeni: data.postizeni,
        slevaNaManzela: data.slevaNaManzela,
        slevaPracujiciDuchodce: data.slevaPracujiciDuchodce,
      })

      return {
        percentil,
        hruby,
        cisty: cistyPrijem,
      }
    })
    .filter((row) => row.hruby > 0)
}

function calculateOddluzeniImpact(data, cistyPrijem) {
  if (!data.zapnoutDopadDoOddluzeni) {
    return {
      mesicniSrazka: 0,
      mesicneProVeritele: 0,
      celkemProVeritele: 0,
      miraUspokojeniSplatkovyKalendar: 0,
      miraUspokojeniZpenezeni: 0,
      celkovaMiraUspokojeni: 0,
      rizikoMinimalniSplatky: false,
      minimalniNutneMesicniPlneni: 0,
      legalniNezabavitelnaCastka: 0,
    }
  }

  const vypocetSrazky = calculateWageDeduction(
    {
      prijem: cistyPrijem,
      pocetVyz: Number(data.pocetVyzivovanychOsob || 0),
      typ: 'prednostni',
      pocetExekuci: '1-3',
      uplatnitPausal: false,
      mode: 'insolvence',
    },
    DEFAULT_2026_PARAMS,
  )

  const mesicniSrazka = vypocetSrazky.srazka
  const pravidelnePlneniNavic =
    Math.max(0, Number(data.zavaznyPrislib || 0)) +
    Math.max(0, Number(data.pravidelnePlneniTretiOsoby || 0))
  const celkoveMesicniPlneni = mesicniSrazka + pravidelnePlneniNavic
  const bezneVyzivne = Math.max(0, Number(data.bezneMesicniVyzivne || 0))
  const odmenaSpravce = DEFAULT_2026_PARAMS.odmenaSpravceJednotlivec

  const mesicneProVeritele = Math.max(
    0,
    celkoveMesicniPlneni - odmenaSpravce - bezneVyzivne,
  )
  const minimalniNutneMesicniPlneni = getMinimumInsolvencyPayment({
    administratorFee: odmenaSpravce,
    ordinaryAlimony: bezneVyzivne,
    configuredMinimum: 0,
  })
  const rizikoMinimalniSplatky =
    celkoveMesicniPlneni < minimalniNutneMesicniPlneni ||
    mesicneProVeritele < odmenaSpravce

  const celkemProVeritele =
    mesicneProVeritele * Number(data.delkaOddluzeni || 36) +
    Math.max(0, Number(data.mimoradnaSplatka || 0)) +
    Math.max(0, Number(data.vytezekZpenezeni || 0))

  const nezajisteneDluhy = Math.max(0, Number(data.nezajisteneDluhy || 0))
  const miraUspokojeniSplatkovyKalendar = calculateCreditorSatisfaction({
    availableForCreditors: mesicneProVeritele * Number(data.delkaOddluzeni || 36),
    unsecuredDebt: nezajisteneDluhy,
  }).percentage

  const miraUspokojeniZpenezeni = calculateCreditorSatisfaction({
    availableForCreditors:
      Math.max(0, Number(data.mimoradnaSplatka || 0)) +
      Math.max(0, Number(data.vytezekZpenezeni || 0)),
    unsecuredDebt: nezajisteneDluhy,
  }).percentage

  const celkovaUspokojeniInfo = calculateCreditorSatisfaction({
    availableForCreditors: celkemProVeritele,
    unsecuredDebt: nezajisteneDluhy,
  })
  const celkovaMiraUspokojeni = celkovaUspokojeniInfo.percentage

  return {
    mesicniSrazka,
    mesicneProVeritele,
    celkemProVeritele,
    miraUspokojeniSplatkovyKalendar,
    miraUspokojeniZpenezeni,
    celkovaMiraUspokojeni,
    celkovaUspokojeniInfo,
    rizikoMinimalniSplatky,
    minimalniNutneMesicniPlneni,
    legalniNezabavitelnaCastka: vypocetSrazky.legalniMinimum,
  }
}

function TooltipLabel({ label, help }) {
  return (
    <div className="group relative flex w-fit items-center gap-1 cursor-help">
      <span className="border-b border-dotted border-slate-400 text-[11px] font-bold text-slate-700">{label}</span>
      <Info size={12} className="text-slate-400" />
      <div className="pointer-events-none absolute left-0 top-full z-50 mt-2 hidden max-w-72 rounded-lg bg-slate-800 px-3 py-2 text-[11px] leading-snug text-white shadow-xl group-hover:block">
        {help}
      </div>
    </div>
  )
}

function Field({ label, help, children }) {
  return (
    <div>
      <TooltipLabel label={label} help={help} />
      <div className="mt-1">{children}</div>
    </div>
  )
}

function NumberInput(props) {
  return (
    <input
      type="number"
      {...props}
      className={cn(
        'w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 text-sm font-medium text-slate-800 outline-none',
        'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
        props.className,
      )}
    />
  )
}

function Select(props) {
  return (
    <select
      {...props}
      className={cn(
        'w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 text-sm font-medium text-slate-800 outline-none',
        'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
        props.className,
      )}
    />
  )
}

function SummaryCard({ icon: Icon, title, value, subtitle, color = 'blue' }) {
  const colorClass = {
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    green: 'border-green-200 bg-green-50 text-green-900',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
  }[color]

  return (
    <div className={cn('rounded-2xl border p-5 shadow-sm', colorClass)}>
      <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest">
        <Icon size={16} />
        <span>{title}</span>
      </div>
      <div className="text-3xl font-black tracking-tight">{value}</div>
      {subtitle && <div className="mt-2 text-xs opacity-80">{subtitle}</div>}
    </div>
  )
}

export default function PrijmovyPotencialPage() {
  const [data, setData] = useState(initialPotentialData)

  const [nezajisteneDluhyDraft, setNezajisteneDluhyDraft] = useState(String(initialPotentialData.nezajisteneDluhy))
  const [editingNezajisteneDluhy, setEditingNezajisteneDluhy] = useState(false)

  const commitNezajisteneDluhy = () => {
    const parsed = Number(nezajisteneDluhyDraft)
    const normalized = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
    setData((prev) => ({ ...prev, nezajisteneDluhy: normalized }))
    setNezajisteneDluhyDraft(String(normalized))
    setEditingNezajisteneDluhy(false)
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value,
    }))
  }

  const results = useMemo(() => {
    const validace = validatePotentialInput(data)
    const matchedRow = matchStatGroup(data)
    const grossStats = getGrossIncomeByPercentile(data, matchedRow)
    const net = calculateNetIncome2026({
      hrubyPrijem: grossStats.pozadovanyHrubyPrijem,
      slevaNaPoplatnika: data.slevaNaPoplatnika,
      pocetDetiProBonus: data.pocetDetiProBonus,
      pocetDetiZtpP: data.pocetDetiZtpP,
      postizeni: data.postizeni,
      slevaNaManzela: data.slevaNaManzela,
      slevaPracujiciDuchodce: data.slevaPracujiciDuchodce,
    })
    const percentilovaTabulka = buildPercentileTable(data, matchedRow)
    const oddluzeni = calculateOddluzeniImpact(data, net.cistyPrijem)

    const warnings = []
    if (!matchedRow) warnings.push('Pro zadanou kombinaci profilových údajů nebyla nalezena odpovídající statistická skupina.')
    if (Number(data.nejvyssiMinulyHrubyPrijem || 0) > grossStats.pozadovanyHrubyPrijem && grossStats.pozadovanyHrubyPrijem > 0) {
      warnings.push('Nejvyšší minulý příjem převyšuje odhadnutý příjmový potenciál podle zvolené statistické skupiny.')
    }
    if (data.slevaNaManzela) {
      warnings.push('Sleva na manžela/manželku je roční sleva a do orientační měsíční čisté mzdy se nezapočítává.')
    }
    if (oddluzeni.rizikoMinimalniSplatky) {
      warnings.push(`Při zapnutém dopadu do oddlužení nevychází orientační pravidlo „1 + 1“. Potřebné měsíční plnění je alespoň ${oddluzeni.minimalniNutneMesicniPlneni.toLocaleString('cs-CZ')} Kč.`)
    }

    return {
      validace,
      warnings,
      ...grossStats,
      pozadovanyCistyPrijem: net.cistyPrijem,
      percentilovaTabulka,
      regionGroup: getRegionGroup(data.region),
      naceGroup: getGroupedNace(data.czNace),
      naceSections: getNaceSections(data.czNace),
      ...oddluzeni,
    }
  }, [data])

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-2 inline-flex rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-800">
            Příjmový potenciál dlužníka
          </div>
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-slate-900">
            <Calculator className="text-blue-600" size={30} />
            Vyhodnocení příjmového potenciálu
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Samostatná stránka pro odhad požadovaného hrubého a čistého příjmu dlužníka podle statistické skupiny,
            s volitelným přepočtem dopadu do oddlužení.
          </p>
        </header>

        {!!results.validace.length && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm">
            <div className="mb-2 flex items-center gap-2 font-bold uppercase tracking-wide">
              <Info size={16} /> Chybějící vstupy
            </div>
            <ul className="space-y-1">
              {results.validace.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        )}

        {!!results.warnings.length && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
            <div className="mb-2 flex items-center gap-2 font-bold uppercase tracking-wide">
              <Info size={16} /> Upozornění k modelu
            </div>
            <ul className="space-y-1">
              {results.warnings.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-12">
          <aside className="space-y-6 lg:col-span-5">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                <User size={15} /> Profil dlužníka
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Pohlaví" help="Používá se při výběru statistické skupiny.">
                  <Select name="pohlavi" value={data.pohlavi} onChange={handleInputChange}>
                    <option value="">Vyberte</option>
                    {genderOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </Select>
                </Field>

                <Field label="Věk" help="Věk se převádí do věkové skupiny.">
                  <NumberInput name="vek" value={data.vek} onChange={handleInputChange} min={18} />
                </Field>

                <Field label="Vzdělání" help="Použije se pro porovnání s osobami se stejnou vzdělanostní kategorií.">
                  <Select name="vzdelani" value={data.vzdelani} onChange={handleInputChange}>
                    <option value="">Vyberte</option>
                    {educationOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </Select>
                </Field>

                <Field label="Region pro statistické srovnání" help="Kraj používaný pouze pro výběr statistické srovnávací skupiny.">
                  <Select name="region" value={data.region} onChange={handleInputChange}>
                    <option value="">Vyberte</option>
                    {regionOptions.map((option) => (
                      <option key={option.label} value={option.label}>{option.label}</option>
                    ))}
                  </Select>
                </Field>

                <Field label="Obor výdělečné činnosti" help="Vyberte obor podle CZ-NACE; položka se interně převádí do seskupené statistické skupiny.">
                  <Select name="czNace" value={data.czNace} onChange={handleInputChange}>
                    <option value="">Vyberte</option>
                    {naceOptions.map((option) => (
                      <option key={option.label} value={option.label}>{option.label}</option>
                    ))}
                  </Select>
                </Field>

                <Field label="Rozsah úvazku" help="Zadejte poměr úvazku, např. 1 = 100 %, 0,75 = 75 %, 0,5 = 50 %.">
                  <NumberInput name="uvazek" value={data.uvazek} onChange={handleInputChange} step="0.1" min="0.1" max="1.5" />
                </Field>
              </div>

              {(results.regionGroup || results.naceGroup) && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  {results.regionGroup && <div><strong>Regionální skupina:</strong> {results.regionGroup}</div>}
                  {results.naceGroup && <div><strong>Seskupený CZ-NACE:</strong> {results.naceGroup}</div>}
                  {results.naceSections && <div><strong>Sekce:</strong> {results.naceSections}</div>}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                <Gauge size={15} /> Příjmová historie
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Aktuální hrubý příjem" help="Současný hrubý měsíční příjem dlužníka.">
                  <NumberInput name="aktualniHrubyPrijem" value={data.aktualniHrubyPrijem} onChange={handleInputChange} />
                </Field>

                <Field label="Nejvyšší doložený hrubý příjem v posuzovaném období" help="Nejvyšší doložený hrubý měsíční příjem, který je relevantní pro posouzení výdělečných možností dlužníka.">
                  <NumberInput name="nejvyssiMinulyHrubyPrijem" value={data.nejvyssiMinulyHrubyPrijem} onChange={handleInputChange} />
                </Field>

                <Field label="Zvolený percentil srovnávací skupiny" help="Statistická úroveň příjmu v rámci srovnávací skupiny. Percentil není sám o sobě právně závazným příjmovým cílem.">
                  <Select name="pozadovanyPercentil" value={data.pozadovanyPercentil} onChange={handleInputChange}>
                    {percentileOptions.map((value) => (
                      <option key={value} value={value}>{value}. percentil</option>
                    ))}
                  </Select>
                </Field>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                <Wallet size={15} /> Parametry čistého příjmu
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700">
                  <input type="checkbox" name="slevaNaPoplatnika" checked={data.slevaNaPoplatnika} onChange={handleInputChange} className="accent-blue-600" />
                  Sleva na poplatníka
                </label>

                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700">
                  <input type="checkbox" name="slevaNaManzela" checked={data.slevaNaManzela} onChange={handleInputChange} className="accent-blue-600" />
                  Sleva na manžela / manželku (roční)
                </label>

                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700 md:col-span-2">
                  <input type="checkbox" name="slevaPracujiciDuchodce" checked={data.slevaPracujiciDuchodce} onChange={handleInputChange} className="accent-blue-600" />
                  Sleva na pojistném pro pracujícího důchodce
                </label>

                <Field label="Počet dětí uplatňovaných pro daňové zvýhodnění" help="Počet vyživovaných dětí, na které se v orientačním výpočtu uplatňuje daňové zvýhodnění. Daňový bonus je pouze případný výsledek po odečtení zvýhodnění od daně.">
                  <NumberInput name="pocetDetiProBonus" value={data.pocetDetiProBonus} onChange={handleInputChange} min={0} />
                </Field>

                <Field label="Z toho dětí ZTP/P" help="Počet dětí s průkazem ZTP/P.">
                  <NumberInput name="pocetDetiZtpP" value={data.pocetDetiZtpP} onChange={handleInputChange} min={0} />
                </Field>

                <Field label="Daňová sleva – invalidita / ZTP/P" help="Orientační měsíční sleva na dani podle zvoleného statusu. Samotný průkaz ZTP bez /P tuto slevu nezakládá.">
                  <Select name="postizeni" value={data.postizeni} onChange={handleInputChange}>
                    {disabilityOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </Select>
                </Field>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                <Landmark size={15} /> Dopad do oddlužení
              </div>

              <label className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  name="zapnoutDopadDoOddluzeni"
                  checked={data.zapnoutDopadDoOddluzeni}
                  onChange={handleInputChange}
                  className="accent-blue-600"
                />
                Zapnout dopad do oddlužení podle výpočtu 2026
              </label>

              <div className={cn('grid gap-4 md:grid-cols-2', !data.zapnoutDopadDoOddluzeni && 'opacity-50')}>
                <Field label="Vyživované osoby započitatelné do nezabavitelné částky" help="Počet osob, za které se při výpočtu nezabavitelné částky uplatní jedna čtvrtina. Modul příjmového potenciálu nezná typ důchodu manžela/partnera, proto případné zvláštní započtení partnera zohledněte v tomto počtu pouze tehdy, pokud jsou splněny zákonné podmínky.">
                  <NumberInput name="pocetVyzivovanychOsob" value={data.pocetVyzivovanychOsob} onChange={handleInputChange} min={0} disabled={!data.zapnoutDopadDoOddluzeni} />
                </Field>

                <Field label="Běžné zákonné výživné" help="Běžné zákonné výživné hrazené v průběhu oddlužení před rozdělením zbytku mezi nezajištěné věřitele.">
                  <NumberInput name="bezneMesicniVyzivne" value={data.bezneMesicniVyzivne} onChange={handleInputChange} min={0} disabled={!data.zapnoutDopadDoOddluzeni} />
                </Field>

                <Field label="Délka oddlužení" help="Standardně 3 roky; 5 let zejména při předchozím osvobození v posledních 20 letech.">
                  <Select name="delkaOddluzeni" value={data.delkaOddluzeni} onChange={handleInputChange} disabled={!data.zapnoutDopadDoOddluzeni}>
                    <option value={36}>3 roky – standardní doba</option>
                    <option value={60}>5 let – předchozí osvobození v posledních 20 letech</option>
                  </Select>
                </Field>

                <Field label="Nezajištěné pohledávky věřitelů" help="Odhad celkové výše nezajištěných pohledávek, vůči kterým se orientačně počítá míra uspokojení. Skutečný základ se může lišit podle výsledku přezkumu pohledávek.">
                  <NumberInput
                    name="nezajisteneDluhy"
                    min={0}
                    value={nezajisteneDluhyDraft}
                    onFocus={() => setEditingNezajisteneDluhy(true)}
                    onChange={(e) => setNezajisteneDluhyDraft(e.target.value)}
                    onBlur={commitNezajisteneDluhy}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                    disabled={!data.zapnoutDopadDoOddluzeni}
                  />
                </Field>

                <Field label="Závazný příslib dlužníka" help="Pravidelné dobrovolné plnění dlužníka z nezabavitelné částky nebo jiných nepostižitelných příjmů. Nesmí ohrozit základní potřeby dlužníka ani vyživovaných osob. Pokud částku zadáte, model předpokládá její placení každý měsíc po celou zadanou dobu oddlužení.">
                  <NumberInput name="zavaznyPrislib" value={data.zavaznyPrislib} onChange={handleInputChange} disabled={!data.zapnoutDopadDoOddluzeni} />
                </Field>

                <Field label="Plnění třetí osoby" help="Pravidelné plnění třetí osoby, například na základě darovací smlouvy nebo smlouvy o důchodu. Model neposuzuje platnost závazku ani schopnost třetí osoby plnit a při zadání částky předpokládá její placení každý měsíc po celou zadanou dobu.">
                  <NumberInput name="pravidelnePlneniTretiOsoby" value={data.pravidelnePlneniTretiOsoby} onChange={handleInputChange} disabled={!data.zapnoutDopadDoOddluzeni} />
                </Field>

                <Field label="Mimořádná splátka" help="Jednorázová mimořádná splátka.">
                  <NumberInput name="mimoradnaSplatka" value={data.mimoradnaSplatka} onChange={handleInputChange} disabled={!data.zapnoutDopadDoOddluzeni} />
                </Field>

                <Field label="Výtěžek zpeněžení dostupný nezajištěným věřitelům" help="Odhad částky z případného zpeněžení, která bude po nákladech a zohlednění práv třetích osob dostupná nezajištěným věřitelům.">
                  <NumberInput name="vytezekZpenezeni" value={data.vytezekZpenezeni} onChange={handleInputChange} disabled={!data.zapnoutDopadDoOddluzeni} />
                </Field>
              </div>
            </section>
          </aside>

          <main className="space-y-6 lg:col-span-7">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SummaryCard icon={Users} title="Velikost srovnávací skupiny" value={formatCurrency(results.pocetPodobnychOsob)} subtitle="Počet zaměstnanců v odpovídající statistické skupině" color="blue" />
              <SummaryCard icon={Briefcase} title="Modelový hrubý příjem" value={`${formatCurrency(results.pozadovanyHrubyPrijem)} Kč`} subtitle="Statistický odhad podle zvoleného percentilu" color="indigo" />
              <SummaryCard icon={Wallet} title="Modelový čistý příjem" value={`${formatCurrency(results.pozadovanyCistyPrijem)} Kč`} subtitle="Orientační čistý příjem po slevách" color="green" />
              <SummaryCard icon={Percent} title="Aktuální vs. modelový příjem" value={`${formatCurrency(data.aktualniHrubyPrijem)} / ${formatCurrency(results.pozadovanyHrubyPrijem)}`} subtitle="Aktuální hrubý příjem vs. statisticky modelovaný hrubý příjem" color="amber" />
              <SummaryCard icon={Landmark} title="Měsíčně pro věřitele" value={`${formatCurrency(results.mesicneProVeritele)} Kč`} subtitle="Po odměně správce a zadaném běžném výživném" color="blue" />
              <SummaryCard
                icon={FileBarChart}
                title="Modelová míra uspokojení"
                value={editingNezajisteneDluhy ? '—' : formatPercent(results.celkovaMiraUspokojeni)}
                subtitle={editingNezajisteneDluhy ? 'Přepočítá se po potvrzení částky dluhů' : 'Orientační modelová míra uspokojení nezajištěných pohledávek; maximum 100 %'}
                color="indigo"
              />
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                <Gauge size={15} /> Slovní vyhodnocení
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                {results.porovnaniText || 'Zatím bez výsledku.'}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                <FileBarChart size={15} /> Percentilová tabulka
              </div>
              <div className="overflow-auto rounded-2xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold">Percentil</th>
                      <th className="px-4 py-3 text-left font-bold">Hrubý příjem</th>
                      <th className="px-4 py-3 text-left font-bold">Čistý příjem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.percentilovaTabulka.map((row) => (
                      <tr key={row.percentil} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium text-slate-700">{row.percentil}</td>
                        <td className="px-4 py-3 text-slate-800">{formatCurrency(row.hruby)} Kč</td>
                        <td className="px-4 py-3 text-slate-800">{formatCurrency(row.cisty)} Kč</td>
                      </tr>
                    ))}
                    {!results.percentilovaTabulka.length && (
                      <tr>
                        <td className="px-4 py-8 text-center text-slate-500" colSpan={3}>
                          Percentilová tabulka se zobrazí po doplnění vstupů.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                <Info size={15} /> Metodická poznámka
              </div>
              <div className="space-y-3 text-sm leading-relaxed text-slate-600">
                <p>
                  Tato stránka používá statistická data z podkladového XLSM jako orientační srovnávací vodítko; statistický percentil sám o sobě neurčuje právně závazný příjem dlužníka. Dopad do oddlužení je napojen na stejné výpočtové jádro srážek pro rok 2026 jako hlavní kalkulačka. Přepočet čisté mzdy je orientační mzdový model; nezohledňuje všechny zvláštní režimy pojistného, více zaměstnavatelů ani roční daňové zúčtování.
                </p>
                <p>
                  Pokud nebude nalezena odpovídající statistická skupina, zkontroluj hlavně kombinaci regionu, vzdělání, věku a oboru CZ-NACE. Pokud zadáš závazný příslib nebo plnění třetí osoby, model uspokojení předpokládá, že se tato částka poskytuje pravidelně každý měsíc po celou zadanou dobu oddlužení.
                </p>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}
