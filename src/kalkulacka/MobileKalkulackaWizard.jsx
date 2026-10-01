import React, { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ShieldAlert, User, Users } from 'lucide-react'

const INCOME_TYPES = [
  { value: 'mzda', label: 'Mzda / plat' },
  { value: 'starobni', label: 'Starobní důchod' },
  { value: 'invalidni1', label: 'Invalidní důchod I. stupně' },
  { value: 'invalidni2', label: 'Invalidní důchod II. stupně' },
  { value: 'invalidni3', label: 'Invalidní důchod III. stupně' },
  { value: 'sirotci', label: 'Sirotčí důchod' },
  { value: 'dpp_dpc', label: 'DPP / DPČ' },
  { value: 'nemocenske', label: 'Nemocenské / PPM' },
  { value: 'podpora', label: 'Podpora v nezaměstnanosti' },
  { value: 'jiny', label: 'Jiný postižitelný příjem' },
]

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base font-semibold text-slate-900 outline-none focus:border-blue-500'
const labelClass = 'mb-1.5 block text-sm font-bold text-slate-800'

const Section = ({ title, children, note }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <h2 className="text-lg font-black text-slate-900">{title}</h2>
    {note && <p className="mt-1 text-sm leading-relaxed text-slate-500">{note}</p>}
    <div className="mt-4 space-y-4">{children}</div>
  </section>
)

const NumberField = ({ label, value, onChange, help, min = 0 }) => (
  <div>
    <label className={labelClass}>{label}</label>
    <input
      type="number"
      min={min}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      className={inputClass}
    />
    {help && <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{help}</p>}
  </div>
)

const Choice = ({ checked, onChange, children, help }) => (
  <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
    <input
      type="checkbox"
      checked={Boolean(checked)}
      onChange={(event) => onChange(event.target.checked)}
      className="mt-1 h-5 w-5 shrink-0 accent-blue-600"
    />
    <span className="text-sm font-semibold leading-relaxed text-slate-800">
      {children}
      {help && <span className="mt-1 block text-xs font-normal text-slate-500">{help}</span>}
    </span>
  </label>
)

const Summary = ({ label, value, emphasis = false }) => (
  <div className={['rounded-2xl border p-4', emphasis ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'].join(' ')}>
    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
    <p className={['mt-1 font-black text-slate-900', emphasis ? 'text-3xl' : 'text-2xl'].join(' ')}>{value}</p>
  </div>
)

const MobileIncomeEditor = ({
  title,
  sources,
  onSourcesChange,
  multiplePayers,
  onMultiplePayersChange,
}) => {
  const safe = Array.isArray(sources) && sources.length
    ? sources
    : [{ id: 'mobile-income-1', typ: 'mzda', castka: 0, pridelenaNezabavitelna: '' }]

  const update = (id, patch) => {
    onSourcesChange(safe.map((source) => source.id === id ? { ...source, ...patch } : source))
  }

  const add = () => {
    onSourcesChange([
      ...safe,
      {
        id: 'mobile-income-' + Date.now() + '-' + safe.length,
        typ: 'jiny',
        castka: 0,
        pridelenaNezabavitelna: '',
      },
    ])
  }

  const remove = (id) => {
    if (safe.length <= 1) return
    onSourcesChange(safe.filter((source) => source.id !== id))
  }

  return (
    <Section title={title} note="Každý příjem uveďte samostatně.">
      {safe.map((source, index) => (
        <div key={source.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <strong className="text-sm text-slate-700">Příjem {index + 1}</strong>
            {safe.length > 1 && (
              <button type="button" onClick={() => remove(source.id)} className="text-xs font-bold text-red-600">
                Odebrat
              </button>
            )}
          </div>

          <div className="mt-3 space-y-3">
            <div>
              <label className={labelClass}>Typ příjmu</label>
              <select
                value={source.typ}
                onChange={(event) => update(source.id, { typ: event.target.value })}
                className={inputClass}
              >
                {INCOME_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>

            <NumberField
              label="Čistá měsíční částka"
              value={source.castka}
              onChange={(value) => update(source.id, { castka: Math.max(0, Number(value) || 0) })}
              help="Částka, kterou byste dostali, kdyby vám z ní nebyly strhávány peníze kvůli dluhům."
            />

            {multiplePayers && safe.length > 1 && (
              <NumberField
                label="Nezabavitelná částka u tohoto plátce"
                value={source.pridelenaNezabavitelna}
                onChange={(value) => update(source.id, { pridelenaNezabavitelna: value === '' ? '' : Math.max(0, Number(value) || 0) })}
                help="Uveďte částku podle rozhodnutí nebo pokynu plátci."
              />
            )}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700"
      >
        + Přidat další příjem
      </button>

      {safe.length > 1 && (
        <Choice checked={multiplePayers} onChange={onMultiplePayersChange}>
          Příjem dostávám z více stran
        </Choice>
      )}
    </Section>
  )
}

const MobileKalkulackaWizard = ({
  activeTab,
  setActiveTab,
  data,
  setData,
  results,
  params,
  dluhyNezajisteneDraft,
  setDluhyNezajisteneDraft,
  commitDluhyNezajistene,
  handleIncomeSourcesChange,
  handleMultiplePayersChange,
  formatKc,
}) => {
  const [step, setStep] = useState('mode')

  const mode = ['jednotlivec', 'manzele', 'nezabavitelna'].includes(activeTab)
    ? activeTab
    : 'jednotlivec'

  const coverage = mode === 'manzele' ? results.coverageM : results.coverageJ
  const needsMinimumStep = mode !== 'nezabavitelna'
    && (!coverage.coveredByStatutoryDeduction || step === 'minimum')

  const flow = useMemo(() => {
    if (mode === 'nezabavitelna') return ['mode', 'income', 'family', 'execution', 'result']

    if (mode === 'manzele') {
      return [
        'mode',
        'incomeA',
        'incomeB',
        'family',
        'other',
        'debts',
        ...(needsMinimumStep ? ['minimum'] : []),
        'result',
      ]
    }

    return [
      'mode',
      'income',
      'family',
      'other',
      'debts',
      ...(needsMinimumStep ? ['minimum'] : []),
      'result',
    ]
  }, [mode, needsMinimumStep])

  const currentIndex = Math.max(0, flow.indexOf(step))

  useEffect(() => {
    if (step !== 'mode') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  const setNumber = (key, value) => {
    setData((prev) => ({ ...prev, [key]: Math.max(0, Number(value) || 0) }))
  }

  const setBool = (key, checked) => {
    setData((prev) => ({ ...prev, [key]: checked }))
  }

  const chooseMode = (nextMode) => {
    setActiveTab(nextMode)
    setStep(nextMode === 'manzele' ? 'incomeA' : 'income')
  }

  const goBack = () => {
    const index = flow.indexOf(step)
    if (index <= 0) {
      setStep('mode')
      return
    }
    setStep(flow[index - 1])
  }

  const goNext = () => {
    if (step === 'debts') commitDluhyNezajistene()

    const currentFlow = mode === 'nezabavitelna'
      ? ['mode', 'income', 'family', 'execution', 'result']
      : mode === 'manzele'
        ? ['mode', 'incomeA', 'incomeB', 'family', 'other', 'debts', ...(!coverage.coveredByStatutoryDeduction ? ['minimum'] : []), 'result']
        : ['mode', 'income', 'family', 'other', 'debts', ...(!coverage.coveredByStatutoryDeduction ? ['minimum'] : []), 'result']

    const index = currentFlow.indexOf(step)
    if (index >= 0 && index < currentFlow.length - 1) {
      setStep(currentFlow[index + 1])
    } else {
      setStep('result')
    }
  }

  const firstDataStep = mode === 'manzele' ? 'incomeA' : 'income'

  const progressLabel = step === 'mode'
    ? null
    : 'Krok ' + currentIndex + ' z ' + (flow.length - 1)

  const renderMode = () => (
    <div className="space-y-4">
      <div>
        <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">ORIENTAČNÍ VÝPOČET · 2026</span>
        <h1 className="mt-3 text-3xl font-black leading-tight text-slate-900">Co chcete spočítat?</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">Vyberte situaci. Další otázky se zobrazí postupně.</p>
      </div>

      <button
        type="button"
        onClick={() => chooseMode('jednotlivec')}
        className="flex w-full items-center gap-4 rounded-2xl border border-blue-200 bg-white p-5 text-left shadow-sm"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><User size={24} /></span>
        <span><strong className="block text-lg text-slate-900">Oddlužení jednotlivce</strong><small className="mt-1 block text-sm text-slate-500">Kolik se bude srážet a zda příjem pro oddlužení stačí.</small></span>
      </button>

      <button
        type="button"
        onClick={() => chooseMode('manzele')}
        className="flex w-full items-center gap-4 rounded-2xl border border-indigo-200 bg-white p-5 text-left shadow-sm"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><Users size={24} /></span>
        <span><strong className="block text-lg text-slate-900">Společné oddlužení manželů</strong><small className="mt-1 block text-sm text-slate-500">Samostatné srážky obou manželů a společný výsledek.</small></span>
      </button>

      <button
        type="button"
        onClick={() => chooseMode('nezabavitelna')}
        className="flex w-full items-center gap-4 rounded-2xl border border-rose-200 bg-white p-5 text-left shadow-sm"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-700"><ShieldAlert size={24} /></span>
        <span><strong className="block text-lg text-slate-900">Exekuční srážka</strong><small className="mt-1 block text-sm text-slate-500">Kolik vám může být maximálně sraženo a kolik vám může zůstat.</small></span>
      </button>
    </div>
  )

  const renderFamilyIndividual = () => (
    <Section title="Rodinná situace" note="Tyto údaje ovlivňují nezabavitelnou částku.">
      <NumberField
        label="Vyživované osoby"
        value={data.vyzivovaneOsoby1}
        onChange={(value) => setNumber('vyzivovaneOsoby1', value)}
        help="Zadejte počet dětí a dalších osob, které vyživujete. Manžela nebo partnera sem nepočítejte."
      />

      <NumberField
        label="Z toho osoby s vymáhaným výživným"
        value={data.osobySVykonemProVyzivne1}
        onChange={(value) => setNumber('osobySVykonemProVyzivne1', value)}
        help="Pokud dlužíte na výživném a kvůli tomu proti vám běží exekuce, tato osoba se do nezabavitelné částky nezapočítá."
      />

      <Choice
        checked={data.partnerProNezabavitelnou1}
        onChange={(checked) => setBool('partnerProNezabavitelnou1', checked)}
        help={results.duchodPovinny1
          ? 'Pobíráte rozhodný důchod. Manžel nebo partner vám proto může zvýšit nezabavitelnou částku.'
          : 'Zaškrtněte jen tehdy, pokud manžel nebo partner pobírá starobní, invalidní důchod II./III. stupně nebo sirotčí důchod.'}
      >
        {results.duchodPovinny1
          ? 'Mám manžela/manželku nebo partnera/partnerku'
          : 'Manžel/partner pobírá rozhodný důchod'}
      </Choice>
    </Section>
  )

  const renderOtherIndividual = () => (
    <Section title="Další příjmy a platby">
      <NumberField
        label="Měsíční výživné"
        value={data.bezneMesicniVyzivne1}
        onChange={(value) => setNumber('bezneMesicniVyzivne1', value)}
        help="Uveďte měsíční výživné, které platíte na děti, které nemáte ve své péči."
      />
      <NumberField
        label="Jiné příjmy chráněné před srážkami"
        value={data.chranenePrijmy1}
        onChange={(value) => setNumber('chranenePrijmy1', value)}
        help="Například příspěvek na péči, dávky pro osoby se zdravotním postižením, náhradní výživné, daňový bonus nebo výživné na dítě."
      />
    </Section>
  )

  const renderDebts = () => (
    <Section title="Dluhy a majetek" note="Z těchto údajů se odhaduje průběh oddlužení.">
      <div>
        <label className={labelClass}>Délka oddlužení</label>
        <select
          value={data.delkaOddluzeni}
          onChange={(event) => setNumber('delkaOddluzeni', event.target.value)}
          className={inputClass}
        >
          <option value={36}>3 roky – běžná doba</option>
          <option value={60}>5 let – předchozí osvobození v posledních 20 letech</option>
        </select>
      </div>

      <div>
        <label className={labelClass}>Nezajištěné dluhy</label>
        <input
          type="number"
          min="0"
          value={dluhyNezajisteneDraft}
          onChange={(event) => setDluhyNezajisteneDraft(event.target.value)}
          onBlur={commitDluhyNezajistene}
          className={inputClass}
        />
        <p className="mt-1.5 text-xs text-slate-500">Půjčky, úvěry, kreditní karty, kontokorenty nebo nezaplacené faktury.</p>
      </div>

      <NumberField
        label="Zajištěné dluhy"
        value={data.dluhyZajistene}
        onChange={(value) => setNumber('dluhyZajistene', value)}
        help="Například hypotéka zajištěná domem."
      />

      <NumberField
        label="Dluhy, které se oddlužením neodpouštějí"
        value={data.dluhyNeosvoboditelne}
        onChange={(value) => setNumber('dluhyNeosvoboditelne', value)}
        help="Například dlužné výživné, náhrada škody na zdraví nebo úmyslně způsobená škoda."
      />

      <NumberField
        label="Odhad peněz z prodeje majetku"
        value={data.vytezekZpenezeni}
        onChange={(value) => setNumber('vytezekZpenezeni', value)}
        help="Pokud se bude majetek prodávat, odhadněte částku, která z prodeje půjde na dluhy."
      />
    </Section>
  )

  const renderMinimum = () => {
    const suffix = mode === 'manzele' ? 'M' : '1'
    const promiseEnabled = Boolean(data['povolitPrislibDluznika' + suffix])
    const thirdEnabled = Boolean(data['povolitPlneniTretiOsoby' + suffix])
    const promiseKey = 'zavaznyPrislib' + suffix
    const thirdKey = 'pravidelnePlneniTretiOsoby' + suffix

    return (
      <Section title="Stačí příjem pro oddlužení?">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex justify-between gap-3 text-sm"><span>Potřebné minimum</span><strong>{formatKc(coverage.requiredMinimum)}</strong></div>
          <div className="mt-2 flex justify-between gap-3 text-sm"><span>Zákonná srážka</span><strong>{formatKc(coverage.statutoryDeduction)}</strong></div>
          <div className="mt-3 flex justify-between gap-3 border-t border-amber-200 pt-3 font-black text-amber-900">
            <span>Chybí</span><span>{formatKc(coverage.deficitAfterStatutoryDeduction)}</span>
          </div>
        </div>

        <Choice
          checked={promiseEnabled}
          onChange={(checked) => setData((prev) => ({
            ...prev,
            ['povolitPrislibDluznika' + suffix]: checked,
            ...(checked ? {} : { [promiseKey]: '' }),
          }))}
        >
          Chybějící částku budu doplácet ze svých peněz
        </Choice>

        {promiseEnabled && (
          <NumberField
            label="Kolik budete měsíčně doplácet?"
            value={data[promiseKey]}
            onChange={(value) => setData((prev) => ({ ...prev, [promiseKey]: Math.max(0, Number(value) || 0) }))}
            help="Vám pak zůstane méně, ale chybějící částku pro oddlužení tím můžete dorovnat."
          />
        )}

        {coverage.deficitAfterDebtorPromise > 0 && (
          <>
            <Choice
              checked={thirdEnabled}
              onChange={(checked) => setData((prev) => ({
                ...prev,
                ['povolitPlneniTretiOsoby' + suffix]: checked,
                ...(checked ? {} : { [thirdKey]: '' }),
              }))}
            >
              Chybějící částku bude hradit někdo jiný
            </Choice>

            {thirdEnabled && (
              <NumberField
                label="Kolik bude měsíčně hradit?"
                value={data[thirdKey]}
                onChange={(value) => setData((prev) => ({ ...prev, [thirdKey]: Math.max(0, Number(value) || 0) }))}
                help="Například rodič nebo partner se zaváže každý měsíc hradit do oddlužení určitou částku za vás."
              />
            )}
          </>
        )}

        <div className={['rounded-xl border p-4 text-sm font-bold', coverage.finalDeficit === 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'].join(' ')}>
          {coverage.finalDeficit === 0
            ? 'Podle zadaných údajů je potřebné měsíční minimum pokryto.'
            : 'Stále chybí ' + formatKc(coverage.finalDeficit) + '.'}
        </div>
      </Section>
    )
  }

  const renderResult = () => {
    if (mode === 'nezabavitelna') {
      return (
        <div className="space-y-4">
          <Section title="Výsledek exekuční srážky" note="Výsledek je orientační.">
            <Summary label="Maximální orientační srážka" value={formatKc(results.ex.srazka)} emphasis />
            <Summary label="Po srážce vám může zůstat" value={formatKc(results.ex.kVyplate)} />
            <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <summary className="cursor-pointer text-sm font-black text-slate-800">Jak se částka skládá?</summary>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div className="flex justify-between gap-4"><span>Nezabavitelná částka</span><strong>{formatKc(results.ex.legalniMinimum)}</strong></div>
                <div className="flex justify-between gap-4"><span>Na dluh po náhradě plátci</span><strong>{formatKc(results.ex.srazkaCista)}</strong></div>
                {data.chranenePrijmy1 > 0 && <div className="flex justify-between gap-4"><span>Chráněné příjmy</span><strong>{formatKc(data.chranenePrijmy1)}</strong></div>}
              </div>
            </details>
          </Section>
        </div>
      )
    }

    const isSpouses = mode === 'manzele'
    const deduction = isSpouses ? results.srazkaCelkemM : results.insJ.srazka
    const retained = isSpouses ? results.kVyplateCelkemM : results.insJ.kVyplate
    const promise = isSpouses ? results.coverageM.debtorPromise : results.coverageJ.debtorPromise
    const retainedAfterPromise = Math.max(0, retained - promise)
    const forCreditors = isSpouses ? results.proVeriteleM : results.proVeriteleJ
    const satisfaction = isSpouses ? results.uspokojeniM : results.uspokojeniJ
    const finalCoverage = isSpouses ? results.coverageM : results.coverageJ

    return (
      <div className="space-y-4">
        <Section title={isSpouses ? 'Výsledek společného oddlužení' : 'Výsledek oddlužení'} note="Výsledek je orientační a vychází z právě zadaných údajů.">
          <div className={['rounded-xl border p-4 text-sm font-bold', finalCoverage.finalDeficit === 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'].join(' ')}>
            {finalCoverage.finalDeficit === 0
              ? 'Potřebné minimální měsíční plnění je podle zadaných údajů pokryto.'
              : 'Potřebné minimum zatím není pokryto. Chybí ' + formatKc(finalCoverage.finalDeficit) + '.'}
          </div>

          <Summary label={isSpouses ? 'Celková měsíční srážka' : 'Měsíční srážka'} value={formatKc(deduction)} emphasis />

          <Summary
            label={promise > 0 ? (isSpouses ? 'Manželům po příslibu zbývá' : 'Po příslibu vám zbývá') : (isSpouses ? 'Manželům může po srážkách zůstat' : 'Po srážce vám může zůstat')}
            value={formatKc(promise > 0 ? retainedAfterPromise : retained)}
          />

          {promise > 0 && (
            <div className="flex justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <span>Závazný příslib</span><strong>− {formatKc(promise)}</strong>
            </div>
          )}

          <Summary label="Orientačně na běžné dluhy měsíčně" value={formatKc(forCreditors)} />
          <Summary label="Odhad splacení běžných dluhů" value={(Number.isFinite(satisfaction) ? satisfaction.toFixed(1) : '0.0') + ' %'} />

          <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <summary className="cursor-pointer text-sm font-black text-slate-800">Co výsledek znamená?</summary>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Odhad procenta není slib ani pevně stanovený výsledek. Během oddlužení se může změnit podle příjmů, skutečné výše pohledávek a dalších nákladů.
            </p>
          </details>
        </Section>
      </div>
    )
  }

  const content = (() => {
    if (step === 'mode') return renderMode()

    if (step === 'income' || step === 'incomeA') {
      return (
        <MobileIncomeEditor
          title={mode === 'manzele' ? 'Příjmy manžela A' : 'Vaše příjmy'}
          sources={data.prijmy1}
          onSourcesChange={(sources) => handleIncomeSourcesChange(1, sources)}
          multiplePayers={Boolean(data.vicePlatcu1)}
          onMultiplePayersChange={(checked) => handleMultiplePayersChange(1, checked)}
        />
      )
    }

    if (step === 'incomeB') {
      return (
        <MobileIncomeEditor
          title="Příjmy manžela B"
          sources={data.prijmy2}
          onSourcesChange={(sources) => handleIncomeSourcesChange(2, sources)}
          multiplePayers={Boolean(data.vicePlatcu2)}
          onMultiplePayersChange={(checked) => handleMultiplePayersChange(2, checked)}
        />
      )
    }

    if (step === 'family' && mode !== 'manzele') {
      return renderFamilyIndividual()
    }

    if (step === 'family' && mode === 'manzele') {
      return (
        <Section title="Rodinná situace">
          <NumberField
            label="Společné děti"
            value={data.spolecneDeti}
            onChange={(value) => setNumber('spolecneDeti', value)}
            help="Zadejte počet společných dětí, o které se spolu staráte."
          />
          <NumberField
            label="Další vyživované osoby manžela A"
            value={data.vyzivovaneOsoby1}
            onChange={(value) => setNumber('vyzivovaneOsoby1', value)}
            help="Například děti z předchozího vztahu. Společné děti sem už nepočítejte."
          />
          <NumberField
            label="Další vyživované osoby manžela B"
            value={data.vyzivovaneOsoby2}
            onChange={(value) => setNumber('vyzivovaneOsoby2', value)}
            help="Například děti z předchozího vztahu. Společné děti sem už nepočítejte."
          />
        </Section>
      )
    }

    if (step === 'other' && mode === 'jednotlivec') return renderOtherIndividual()

    if (step === 'other' && mode === 'manzele') {
      return (
        <Section title="Další příjmy a platby">
          <NumberField label="Výživné – manžel A" value={data.bezneMesicniVyzivne1} onChange={(value) => setNumber('bezneMesicniVyzivne1', value)} />
          <NumberField label="Výživné – manžel B" value={data.bezneMesicniVyzivne2} onChange={(value) => setNumber('bezneMesicniVyzivne2', value)} />
          <NumberField label="Chráněné příjmy – manžel A" value={data.chranenePrijmy1} onChange={(value) => setNumber('chranenePrijmy1', value)} />
          <NumberField label="Chráněné příjmy – manžel B" value={data.chranenePrijmy2} onChange={(value) => setNumber('chranenePrijmy2', value)} />
        </Section>
      )
    }

    if (step === 'execution') {
      return (
        <Section title="Nastavení exekuce">
          <div>
            <label className={labelClass}>Počet souběžných exekucí</label>
            <select value={data.pocetExekuci} onChange={(event) => setData((prev) => ({ ...prev, pocetExekuci: event.target.value }))} className={inputClass}>
              <option value="1-3">1 až 3 exekuce</option>
              <option value="4+">4 a více exekucí</option>
            </select>
            <p className="mt-1.5 text-xs text-slate-500">Při 4 a více exekucích může být srážka vyšší. U některých důchodců platí výjimka.</p>
          </div>

          <div>
            <label className={labelClass}>Druh dluhu</label>
            <select value={data.typPohledavky} onChange={(event) => setData((prev) => ({ ...prev, typPohledavky: event.target.value }))} className={inputClass}>
              <option value="neprednostni">Nepřednostní dluh</option>
              <option value="prednostni">Přednostní dluh</option>
              <option value="vyzivne">Výživné</option>
            </select>
            <p className="mt-1.5 text-xs text-slate-500">U přednostního dluhu je vyšší srážka.</p>
          </div>

          <NumberField
            label="Jiné příjmy chráněné před srážkami"
            value={data.chranenePrijmy1}
            onChange={(value) => setNumber('chranenePrijmy1', value)}
          />

          <Choice checked={data.uplatnitPausalPlatce} onChange={(checked) => setBool('uplatnitPausalPlatce', checked)}>
            Plátce příjmu uplatňuje paušální náhradu nákladů
          </Choice>
        </Section>
      )
    }

    if (step === 'debts') return renderDebts()
    if (step === 'minimum') return renderMinimum()
    if (step === 'result') return renderResult()

    return null
  })()

  if (step === 'mode') {
    return <div className="md:hidden min-h-[calc(100vh-2rem)] pb-6">{content}</div>
  }

  return (
    <div className="md:hidden min-h-screen pb-24">
      <div className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={goBack} className="flex items-center gap-1 text-sm font-black text-blue-700">
            <ChevronLeft size={18} /> Zpět
          </button>
          <button type="button" onClick={() => setStep('mode')} className="text-xs font-bold text-slate-500">
            Změnit výpočet
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500">{progressLabel}</span>
          <span className="text-xs font-bold text-slate-500">
            {mode === 'jednotlivec' ? 'Oddlužení jednotlivce' : mode === 'manzele' ? 'Oddlužení manželů' : 'Exekuční srážka'}
          </span>
        </div>

        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: Math.max(8, (currentIndex / Math.max(1, flow.length - 1)) * 100) + '%' }}
          />
        </div>
      </div>

      {content}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-xl gap-3">
          <button
            type="button"
            onClick={goBack}
            className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-700"
          >
            <ChevronLeft size={18} /> Zpět
          </button>
          {step === 'result' ? (
            <button
              type="button"
              onClick={() => setStep(firstDataStep)}
              className="flex flex-[1.4] items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white"
            >
              Upravit údaje
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              className="flex flex-[1.4] items-center justify-center gap-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white"
            >
              Pokračovat <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default MobileKalkulackaWizard
