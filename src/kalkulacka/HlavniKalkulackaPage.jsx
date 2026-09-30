import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calculator, Users, User, Info, AlertCircle,
  ShieldAlert, Settings, Layers, Printer, Gavel
} from 'lucide-react';
import { DEFAULT_2026_PARAMS, calculateCreditorSatisfaction, calculateMinimumPaymentCoverage, calculateWageDeduction, getMinimumInsolvencyPayment } from '../lib/calculations2026';

// --- POMOCNÁ KOMPONENTA PRO TOOLTIPY ---
const Tooltip = ({ children, text }) => (
  <div className="group relative flex items-center gap-1.5 w-fit cursor-help">
    {children}
    <Info size={13} className="text-slate-400 group-hover:text-blue-500 transition-colors shrink-0 print:hidden" />
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-3 bg-slate-800 text-white text-[11px] font-medium rounded-lg shadow-xl z-50 text-center pointer-events-none print:hidden leading-snug">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
    </div>
  </div>
);


const colorMap = {
  blue: {
    border: 'border-blue-200',
    title: 'text-blue-600',
    value: 'text-blue-900',
    unit: 'text-blue-700',
    subtitle: 'text-blue-600',
    dotted: 'border-blue-400',
  },
  green: {
    border: 'border-green-200',
    title: 'text-green-600',
    value: 'text-green-900',
    unit: 'text-green-700',
    subtitle: 'text-green-600',
    dotted: 'border-green-400',
  },
  red: {
    border: 'border-red-200',
    title: 'text-red-600',
    value: 'text-red-900',
    unit: 'text-red-700',
    subtitle: 'text-red-600',
    dotted: 'border-red-400',
  },
  slate: {
    border: 'border-slate-200',
    title: 'text-slate-600',
    value: 'text-slate-900',
    unit: 'text-slate-700',
    subtitle: 'text-slate-600',
    dotted: 'border-slate-400',
  },
  indigo: {
    border: 'border-indigo-200',
    title: 'text-indigo-600',
    value: 'text-indigo-900',
    unit: 'text-indigo-700',
    subtitle: 'text-indigo-600',
    dotted: 'border-indigo-400',
  },
}

const formatKc = (value) => `${Math.round(Math.max(0, Number(value) || 0)).toLocaleString('cs-CZ')} Kč`;


const INCOME_TYPES = [
  { value: 'mzda', label: 'Mzda / plat' },
  { value: 'starobni', label: 'Starobní důchod', qualifyingPension: true },
  { value: 'invalidni1', label: 'Invalidní důchod I. stupně' },
  { value: 'invalidni2', label: 'Invalidní důchod II. stupně', qualifyingPension: true },
  { value: 'invalidni3', label: 'Invalidní důchod III. stupně', qualifyingPension: true },
  { value: 'sirotci', label: 'Sirotčí důchod', qualifyingPension: true },
  { value: 'dpp_dpc', label: 'DPP / DPČ' },
  { value: 'nemocenske', label: 'Nemocenské / PPM' },
  { value: 'podpora', label: 'Podpora v nezaměstnanosti' },
  { value: 'jiny', label: 'Jiný postižitelný příjem' },
];

const hasQualifyingPension = (sources = []) => sources.some((source) =>
  INCOME_TYPES.find((option) => option.value === source.typ)?.qualifyingPension && Number(source.castka) > 0
);

const sumIncomeSources = (sources = []) => sources.reduce((sum, source) => sum + Math.max(0, Number(source.castka) || 0), 0);

const IncomeSourcesEditor = ({ sources, multiplePayers, onSourcesChange, onMultiplePayersChange, label }) => {
  const safeSources = Array.isArray(sources) && sources.length ? sources : [{ id: 'income-1', typ: 'mzda', castka: 0, pridelenaNezabavitelna: '' }];

  const updateSource = (id, patch) => {
    onSourcesChange(safeSources.map((source) => source.id === id ? { ...source, ...patch } : source));
  };
  const addSource = () => {
    onSourcesChange([...safeSources, { id: `income-${Date.now()}-${safeSources.length}`, typ: 'jiny', castka: 0, pridelenaNezabavitelna: '' }]);
  };
  const removeSource = (id) => {
    if (safeSources.length <= 1) return;
    onSourcesChange(safeSources.filter((source) => source.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Tooltip text="Zadejte každý postižitelný měsíční příjem samostatně. Typ důchodu kalkulačce zároveň umožní automaticky rozpoznat zvláštní důchodový režim pro 4+ exekucí a započtení manžela/partnera.">
          <span className="text-[10px] font-bold text-slate-600 border-b border-dotted border-slate-400">{label}</span>
        </Tooltip>
        <button type="button" onClick={addSource} className="text-[10px] font-bold text-blue-700 hover:text-blue-900">+ Přidat další příjem</button>
      </div>
      {safeSources.map((source, index) => (
        <div key={source.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr_auto] items-end">
            <div>
              <label className="block text-[9px] font-bold text-slate-500 mb-1">Typ příjmu</label>
              <select value={source.typ} onChange={(e) => updateSource(source.id, { typ: e.target.value })} className="w-full p-2 bg-white border border-slate-300 rounded-lg font-semibold text-xs">
                {INCOME_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-500 mb-1">Čistá měsíční částka</label>
              <input type="number" min="0" value={source.castka ?? ''} onChange={(e) => updateSource(source.id, { castka: Math.max(0, Number(e.target.value) || 0) })} className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-sm" />
            </div>
            <button type="button" onClick={() => removeSource(source.id)} disabled={safeSources.length <= 1} className="px-2 py-2 text-[10px] font-bold text-slate-500 disabled:opacity-30 hover:text-red-600">Odebrat</button>
          </div>
          {multiplePayers && safeSources.length > 1 && (
            <div className="mt-2">
              <Tooltip text="Při několika plátcích určuje soud nebo exekuční orgán jednotlivě, jakou část nezabavitelné částky nemá každý plátce srážet (§ 298 OSŘ). Pro přesný výpočet zadejte částku určenou tomuto plátci. Součet přidělených částí by měl odpovídat celkové nezabavitelné částce.">
                <label className="block text-[9px] font-bold text-amber-700 mb-1 border-b border-dotted border-amber-500">Nezabavitelná částka přidělená tomuto plátci</label>
              </Tooltip>
              <input type="number" min="0" value={source.pridelenaNezabavitelna ?? ''} onChange={(e) => updateSource(source.id, { pridelenaNezabavitelna: e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0) })} className="w-full p-2 bg-amber-50 border border-amber-200 rounded-lg font-bold text-sm text-amber-900" placeholder="Podle rozhodnutí / pokynu plátci" />
            </div>
          )}
        </div>
      ))}
      {safeSources.length > 1 && (
        <label className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-2.5 text-[10px] text-blue-900">
          <input type="checkbox" checked={multiplePayers} onChange={(e) => onMultiplePayersChange(e.target.checked)} className="mt-0.5 accent-blue-600" />
          <span><strong>Příjmy vyplácí více plátců.</strong> Zaškrtněte jen tehdy, když srážky provádí více samostatných plátců. Pak je pro přesný výpočet nutné zadat rozdělení nezabavitelné částky mezi plátce.</span>
        </label>
      )}
    </div>
  );
};

const MinimumCoveragePanel = ({ coverage, data, onToggle, onAmountChange, modeLabel, fieldSuffix }) => {
  const promiseEnabled = Boolean(data[`povolitPrislibDluznika${fieldSuffix}`]);
  const thirdPartyEnabled = Boolean(data[`povolitPlneniTretiOsoby${fieldSuffix}`]);
  const promiseKey = `zavaznyPrislib${fieldSuffix}`;
  const thirdPartyKey = `pravidelnePlneniTretiOsoby${fieldSuffix}`;
  const stillNeedsThirdParty = coverage.deficitAfterDebtorPromise > 0;
  const hasAdditionalSources = promiseEnabled || thirdPartyEnabled;
  const finalDeficitConfirmed = thirdPartyEnabled && coverage.finalDeficit > 0;

  return (
    <section className="rounded-xl border border-slate-700/70 bg-slate-950/45 p-4 space-y-3 print:bg-white print:border-slate-300">
      <div className="flex items-start gap-3">
        {coverage.coveredByStatutoryDeduction ? (
          <div className="flex-1 rounded-lg border border-emerald-400/50 bg-emerald-950/40 p-3 text-sm text-emerald-100 print:bg-emerald-50 print:text-emerald-900">
            <p className="font-bold">Minimum splněno zákonnou srážkou</p>
            <p className="mt-1 text-xs">Zákonná srážka {formatKc(coverage.statutoryDeduction)} pokrývá požadované minimum {formatKc(coverage.requiredMinimum)}.</p>
          </div>
        ) : (
          <div className={`flex-1 rounded-lg border p-3 text-sm ${finalDeficitConfirmed ? 'border-rose-400/70 bg-rose-950/40 text-rose-100' : 'border-amber-400/70 bg-amber-950/35 text-amber-100'} print:bg-white print:text-slate-900`}>
            <p className="font-bold">{finalDeficitConfirmed ? 'Ani všechny aktivní zdroje nestačí' : (coverage.finalDeficit === 0 ? 'Minimum pokryto doplňkovými zdroji' : 'Zákonná srážka sama nestačí')}</p>
            <p className="mt-1 text-xs">Pro {modeLabel} činí požadované minimum {formatKc(coverage.requiredMinimum)}. Zákonná srážka pokrývá {formatKc(coverage.statutoryDeduction)}.</p>
          </div>
        )}
      </div>

      {!coverage.coveredByStatutoryDeduction && (
        <div className="grid gap-2 text-xs text-slate-200 print:text-slate-700">
          <div className="flex justify-between gap-4"><span>Požadované minimum</span><strong>{formatKc(coverage.requiredMinimum)}</strong></div>
          <div className="flex justify-between gap-4"><span>Zákonná srážka</span><strong>{formatKc(coverage.statutoryDeduction)}</strong></div>
          <div className="flex justify-between gap-4 font-semibold text-amber-200 print:text-amber-800"><span>Chybí bez dalších zdrojů</span><strong>{formatKc(coverage.deficitAfterStatutoryDeduction)}</strong></div>
        </div>
      )}

      {!coverage.coveredByStatutoryDeduction && (
        <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3 print:border-slate-300 print:bg-slate-50">
          <label className="flex items-start gap-2 text-sm text-slate-100 print:text-slate-800">
            <input
              type="checkbox"
              checked={promiseEnabled}
              onChange={(event) => onToggle(`povolitPrislibDluznika${fieldSuffix}`, promiseKey, event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-cyan-400"
            />
            <span><strong>Dlužník může část chybějící částky hradit ze své nezabavitelné částky nebo jiných nepostižitelných příjmů.</strong></span>
          </label>
          {promiseEnabled && (
            <div className="pl-6">
              <input type="number" min="0" step="1" name={promiseKey} value={data[promiseKey] ?? ''} onChange={onAmountChange} className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 print:bg-white print:text-slate-900" placeholder="Např. 500" />
              <p className="mt-1 text-xs text-slate-400 print:text-slate-600">Dlužník může k návrhu připojit závazný příslib, že chybějící plnění bude hradit ze základní částky, která mu nesmí být sražena, nebo z jiných příjmů, které nelze postihnout výkonem rozhodnutí či exekucí. Takové plnění nesmí ohrozit základní hmotné potřeby dlužníka ani osob odkázaných výživou. Kalkulačka posuzuje pouze matematické pokrytí, nikoli udržitelnost příslibu.</p>
            </div>
          )}

          {stillNeedsThirdParty && (
            <>
              <p className="text-xs text-slate-300 print:text-slate-700">Po započtení příslibu aktuálně chybí {formatKc(coverage.deficitAfterDebtorPromise)}.</p>
              <label className="flex items-start gap-2 text-sm text-slate-100 print:text-slate-800">
                <input
                  type="checkbox"
                  checked={thirdPartyEnabled}
                  onChange={(event) => onToggle(`povolitPlneniTretiOsoby${fieldSuffix}`, thirdPartyKey, event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-cyan-400"
                />
                <span><strong>Chybějící částku může poskytovat třetí osoba.</strong><span className="block text-xs text-slate-400 print:text-slate-600">Další plnění může být zajištěno například darovací smlouvou nebo smlouvou o důchodu.</span></span>
              </label>
              {thirdPartyEnabled && (
                <div className="pl-6">
                  <input type="number" min="0" step="1" name={thirdPartyKey} value={data[thirdPartyKey] ?? ''} onChange={onAmountChange} className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 print:bg-white print:text-slate-900" placeholder="Např. 1000" />
                  <p className="mt-1 text-xs text-slate-400 print:text-slate-600">Kalkulačka ověřuje pouze matematické pokrytí minimální částky, neposuzuje platnost smlouvy ani schopnost třetí osoby závazek plnit.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {hasAdditionalSources && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3 text-xs text-slate-200 print:border-slate-300 print:bg-slate-50 print:text-slate-700">
          <div className="flex justify-between"><span>Zákonná srážka</span><strong>{formatKc(coverage.statutoryDeduction)}</strong></div>
          <div className="flex justify-between"><span>Závazný příslib</span><strong>{formatKc(coverage.debtorPromise)}</strong></div>
          <div className="flex justify-between"><span>Plnění třetí osoby</span><strong>{formatKc(coverage.thirdPartyContribution)}</strong></div>
          <div className="mt-2 flex justify-between border-t border-slate-700 pt-2 font-bold"><span>Celkem měsíčně</span><strong>{formatKc(coverage.totalAvailable)}</strong></div>
          <div className="flex justify-between"><span>Požadované minimum</span><strong>{formatKc(coverage.requiredMinimum)}</strong></div>
          <p className={`mt-2 font-semibold ${finalDeficitConfirmed ? 'text-rose-300 print:text-rose-700' : 'text-amber-200 print:text-amber-800'}`}>
            {finalDeficitConfirmed ? `Stále chybí ${formatKc(coverage.finalDeficit)}.` : (coverage.finalDeficit > 0 ? `Po započtení dosud aktivních zdrojů chybí ${formatKc(coverage.finalDeficit)}; lze doplnit další zdroj.` : 'Minimum je pokryto.')}
          </p>
        </div>
      )}

      {finalDeficitConfirmed && (
        <div className="rounded-lg border border-rose-400/70 bg-rose-950/45 p-3 text-xs text-rose-100 print:bg-rose-50 print:text-rose-900">
          <p className="font-bold">Riziko nepovolení oddlužení</p>
            <p className="mt-1">Ani po započtení všech zadaných zdrojů není orientační minimální měsíční plnění pokryto. Stále chybí {formatKc(coverage.finalDeficit)}. Při zadaných údajích může jít o riziko nesplnění podmínky pro povolení oddlužení.</p>
          </div>
      )}

      <p className="text-[11px] leading-relaxed text-slate-400 print:text-slate-600">Doplňkové zdroje slouží v této verzi ke kontrole minima. Model dlouhodobého uspokojení věřitelů níže pracuje pouze se zákonnou srážkou, protože pravidelnost a trvání příslibu či plnění třetí osoby musí být doloženy.</p>
    </section>
  );
};

const HlavniKalkulackaPage = () => {
  const [activeTab, setActiveTab] = useState('jednotlivec');
  const [isLoaded, setIsLoaded] = useState(false);

  // --- LEGISLATIVNÍ DATA (Stav pro výplaty v roce 2026) ---
  const [params, setParams] = useState(() => {
    const defaultParams = { ...DEFAULT_2026_PARAMS };
    try {
      const saved = localStorage.getItem('insCalcParams2026_v10');
      return saved ? { ...defaultParams, ...JSON.parse(saved) } : defaultParams;
    } catch { 
      return defaultParams; 
    }
  });

  // --- VSTUPNÍ DATA ---
  const [data, setData] = useState(() => {
    const defaultData = {
      // Příjmy 1
      prijemMzda1: 200000,
      prijemDuchod1: 0,
      prijemDalsi1: 0,
      chranenePrijmy1: 0, 
      
      // Příjmy 2
      prijemMzda2: 25000,
      prijemDuchod2: 0,
      prijemDalsi2: 0,
      
      // Domácnost
      spolecneDeti: 2,
      
      // Parametry dlužníka 1
      vyzivovaneOsoby1: 0, 
      osobySVykonemProVyzivne1: 0, 
      // Jeden zjednodušený údaj pro započtení manžela/partnera u jednotlivce.
      // Pokud má rozhodný důchod sám dlužník, checkbox znamená pouze existenci manžela/partnera.
      // Pokud dlužník rozhodný důchod nemá, checkbox znamená manžela/partnera s rozhodným důchodem.
      partnerProNezabavitelnou1: false,
      bezneMesicniVyzivne1: 0,
      // Doplňkové zdroje pro krytí minima oddlužení (jednotlivec)
      povolitPrislibDluznika1: false,
      zavaznyPrislib1: '',
      povolitPlneniTretiOsoby1: false,
      pravidelnePlneniTretiOsoby1: '',
      
      // Parametry dlužníka 2
      vyzivovaneOsoby2: 0,
      osobySVykonemProVyzivne2: 0,
      bezneMesicniVyzivne2: 0,
      // Doplňkové zdroje pro krytí minima oddlužení (manželé)
      povolitPrislibDluznikaM: false,
      zavaznyPrislibM: '',
      povolitPlneniTretiOsobyM: false,
      pravidelnePlneniTretiOsobyM: '',

      // Exekuční parametry
      typPohledavky: 'neprednostni', 
      pocetExekuci: '1-3',
      uplatnitPausalPlatce: false,
      
      // Insolvenční parametry a dluhy
      delkaOddluzeni: 36,
      dluhyNezajistene: 600000,
      dluhyZajistene: 0,
      dluhyNeosvoboditelne: 0, 
      vytezekZpenezeni: 0, 
    };
    try {
      const saved = localStorage.getItem('insCalcData2026_v10');
      if (!saved) return defaultData;
      const parsed = JSON.parse(saved);
      const migrated = { ...defaultData, ...parsed };
      if (!Array.isArray(parsed.prijmy1)) {
        const legacy = [];
        if (Number(parsed.prijemMzda1) > 0) legacy.push({ id: 'p1-mzda', typ: 'mzda', castka: Number(parsed.prijemMzda1), pridelenaNezabavitelna: '' });
        if (Number(parsed.prijemDuchod1) > 0) legacy.push({ id: 'p1-duchod', typ: parsed.duchodPovinny1 ? 'starobni' : 'jiny', castka: Number(parsed.prijemDuchod1), pridelenaNezabavitelna: '' });
        if (Number(parsed.prijemDalsi1) > 0) legacy.push({ id: 'p1-jiny', typ: 'jiny', castka: Number(parsed.prijemDalsi1), pridelenaNezabavitelna: '' });
        migrated.prijmy1 = legacy.length ? legacy : defaultData.prijmy1;
      }
      if (!Array.isArray(parsed.prijmy2)) {
        const legacy = [];
        if (Number(parsed.prijemMzda2) > 0) legacy.push({ id: 'p2-mzda', typ: 'mzda', castka: Number(parsed.prijemMzda2), pridelenaNezabavitelna: '' });
        if (Number(parsed.prijemDuchod2) > 0) legacy.push({ id: 'p2-duchod', typ: parsed.duchodPovinny2 ? 'starobni' : 'jiny', castka: Number(parsed.prijemDuchod2), pridelenaNezabavitelna: '' });
        if (Number(parsed.prijemDalsi2) > 0) legacy.push({ id: 'p2-jiny', typ: 'jiny', castka: Number(parsed.prijemDalsi2), pridelenaNezabavitelna: '' });
        migrated.prijmy2 = legacy.length ? legacy : defaultData.prijmy2;
      }
      if (parsed.partnerProNezabavitelnou1 === undefined) {
        const debtorHasQualifyingPension = hasQualifyingPension(migrated.prijmy1);
        migrated.partnerProNezabavitelnou1 = debtorHasQualifyingPension
          ? Boolean(parsed.maManzelaPartnera1)
          : Boolean(parsed.maManzelaPartnera1 && (parsed.partnerMaKvalifikovanyDuchod1 || parsed.duchodPartner1));
      }
      return migrated;
    } catch { 
      return defaultData; 
    }
  });

  useEffect(() => {
    localStorage.setItem('insCalcParams2026_v10', JSON.stringify(params));
    localStorage.setItem('insCalcData2026_v10', JSON.stringify(data));
    setIsLoaded(true);
  }, [params, data]);

  // Nezajištěný dluh se při psaní drží jako textový koncept.
  // Do výpočtu se promítne až po opuštění pole / potvrzení Enterem,
  // aby rozepsaná částka (např. 6 při zadávání 600 000) nevytvářela
  // dočasně nesmyslné procento uspokojení.
  const [dluhyNezajisteneDraft, setDluhyNezajisteneDraft] = useState(() => String(data.dluhyNezajistene ?? ''));
  const [editingDluhyNezajistene, setEditingDluhyNezajistene] = useState(false);

  const commitDluhyNezajistene = () => {
    const parsed = Number(dluhyNezajisteneDraft);
    const normalized = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    setData(prev => ({ ...prev, dluhyNezajistene: normalized }));
    setDluhyNezajisteneDraft(String(normalized));
    setEditingDluhyNezajistene(false);
  };

  // --- JÁDRO VÝPOČTU ---
  // Jediný výpočet srážky je sdílen i s modulem Příjmový potenciál.
  const calculateResult = (input) => calculateWageDeduction(input, params);

  const calculatePersonResult = ({
    sources,
    multiplePayers,
    chranenyPrijem = 0,
    pocetVyz = 0,
    maPartnera = false,
    duchodPartner = false,
    vykonProVyzivne = 0,
    typ = 'neprednostni',
    pocetExekuci = '1-3',
    uplatnitPausal = false,
    mode = 'exekuce',
  }) => {
    const safeSources = Array.isArray(sources) ? sources.filter((source) => Number(source.castka) > 0) : [];
    const totalPrijem = sumIncomeSources(safeSources);
    const duchodPovinny = hasQualifyingPension(safeSources);
    const commonInput = {
      chranenyPrijem,
      pocetVyz,
      maPartnera,
      duchodPovinny,
      duchodPartner,
      vykonProVyzivne,
      typ,
      pocetExekuci,
      uplatnitPausal,
      mode,
    };
    const combined = calculateResult({ ...commonInput, prijem: totalPrijem });

    if (!multiplePayers || safeSources.length <= 1) {
      return { ...combined, payerBreakdown: [], multiPayerExact: false, multiPayerNeedsAllocation: false, totalPrijem, duchodPovinny };
    }

    const assigned = safeSources.map((source) => Number(source.pridelenaNezabavitelna));
    const allocationsComplete = assigned.every((value) => Number.isFinite(value) && value >= 0);
    const assignedTotal = allocationsComplete ? assigned.reduce((a, b) => a + b, 0) : 0;
    const allocationsMatch = allocationsComplete && Math.abs(assignedTotal - combined.legalniMinimum) <= 1;

    if (!allocationsMatch) {
      return {
        ...combined,
        payerBreakdown: [],
        multiPayerExact: false,
        multiPayerNeedsAllocation: true,
        assignedNezabavitelnaTotal: assignedTotal,
        totalPrijem,
        duchodPovinny,
      };
    }

    const payerBreakdown = safeSources.map((source) => ({
      source,
      result: calculateResult({
        ...commonInput,
        prijem: Math.max(0, Number(source.castka) || 0),
        chranenyPrijem: 0,
        nezabavitelnaOverride: Math.max(0, Number(source.pridelenaNezabavitelna) || 0),
      }),
    }));
    const srazka = payerBreakdown.reduce((sum, item) => sum + item.result.srazka, 0);
    const nahradaPlatci = payerBreakdown.reduce((sum, item) => sum + item.result.nahradaPlatci, 0);
    const kVyplateZeSrazek = payerBreakdown.reduce((sum, item) => sum + item.result.kVyplateZeSrazek, 0);
    return {
      ...combined,
      srazka,
      srazkaCista: srazka - nahradaPlatci,
      nahradaPlatci,
      kVyplateZeSrazek,
      kVyplate: kVyplateZeSrazek + Math.max(0, Number(chranenyPrijem) || 0),
      payerBreakdown,
      multiPayerExact: true,
      multiPayerNeedsAllocation: false,
      assignedNezabavitelnaTotal: assignedTotal,
      totalPrijem,
      duchodPovinny,
    };
  };

  const results = useMemo(() => {
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
    const coverageJ = calculateMinimumPaymentCoverage({
      statutoryDeduction: insJ.srazka,
      requiredMinimum: minimalniNutnaSrazkaJ,
      debtorPromise: data.povolitPrislibDluznika1 ? data.zavaznyPrislib1 : 0,
      thirdPartyContribution: data.povolitPlneniTretiOsoby1 ? data.pravidelnePlneniTretiOsoby1 : 0,
    });

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
    const coverageM = calculateMinimumPaymentCoverage({
      statutoryDeduction: srazkaCelkemM,
      requiredMinimum: minimalniNutnaSrazkaM,
      debtorPromise: data.povolitPrislibDluznikaM ? data.zavaznyPrislibM : 0,
      thirdPartyContribution: data.povolitPlneniTretiOsobyM ? data.pravidelnePlneniTretiOsobyM : 0,
    });

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
  }, [data, params, activeTab]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseFloat(value) || 0 : value)
    }));
  };

  const handleIncomeSourcesChange = (person, sources) => {
    setData((prev) => ({ ...prev, [`prijmy${person}`]: sources }));
  };

  const handleMultiplePayersChange = (person, checked) => {
    setData((prev) => ({ ...prev, [`vicePlatcu${person}`]: checked }));
  };

  const handleAdditionalSourceToggle = (enabledKey, amountKey, checked) => {
    setData(prev => ({
      ...prev,
      [enabledKey]: checked,
      ...(checked ? {} : { [amountKey]: '' }),
    }));
  };

  const handlePrint = () => window.print();

  if (!isLoaded) return null;

  const renderMathStep1 = (res, params) => {
    const textZaklad = res.zakladNaPovinneho.toLocaleString('cs-CZ', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    const textCtvrtina = res.jednaCtvrtina.toLocaleString('cs-CZ', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    const textSuma = res.celkovaNezabavitelnaRaw.toLocaleString('cs-CZ', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    let note = res.pocetCtvrtin > 0 ? `(Osoby k zápočtu)` : `(Bez osob)`;
    if (res.vykonProVyzivne > 0) {
        note = `(Z ${res.pocetVsechOsob} osob odečteno ${res.vykonProVyzivne} pro výživné)`;
    }
    return (
        <p>1. <strong className="text-slate-700">Nezab. částka:</strong> {textZaklad} (Základ {params.koeficientZahladu} %) + {res.pocetCtvrtin} × {textCtvrtina} {note} = {textSuma} → zaokrouhleno <strong className="text-slate-700">{res.legalniMinimum.toLocaleString()} Kč</strong></p>
    );
  };

  const AnalyticCard = ({ title, titleTooltip, value, unit="Kč", subtitle, color="blue", children }) => {
    const c = colorMap[color] ?? colorMap.blue

    return (
      <div className={`p-5 rounded-xl border bg-white ${c.border} shadow-sm flex flex-col h-full print:border-gray-300 print:shadow-none`}>
        <div className="flex items-center gap-1.5 mb-2">
          {titleTooltip ? (
            <Tooltip text={titleTooltip}>
              <span className={`text-[11px] font-bold ${c.title} uppercase tracking-widest cursor-help border-b border-dotted ${c.dotted} print:border-none print:text-gray-800`}>{title}</span>
            </Tooltip>
          ) : (
            <p className={`text-[11px] font-bold ${c.title} uppercase tracking-widest print:text-gray-800`}>{title}</p>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          {value !== undefined && <span className={`text-3xl font-black ${c.value} print:text-black`}>{Math.round(value).toLocaleString()}</span>}
          {unit && value !== undefined && <span className={`text-sm font-bold ${c.unit} print:text-gray-600`}>{unit}</span>}
        </div>
        {subtitle && <p className={`text-[11px] ${c.subtitle} mt-2 font-medium leading-relaxed print:text-gray-600`}>{subtitle}</p>}
        {children && <div className="mt-4 pt-4 border-t border-slate-100 flex-1">{children}</div>}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 font-sans text-slate-800 print:bg-white print:p-0">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-4 print:pb-2">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2 print:hidden">
              <span className="bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded">PRÁVNÍ STAV 2026</span>
              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-1 rounded">ORIENTAČNÍ VÝPOČET</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-2 print:text-xl">
              <Calculator className="text-blue-600 print:text-black" /> Kalkulačka srážek a oddlužení
            </h1>
          </div>
          <div className="flex gap-2 print:hidden">
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm">
              <Printer size={14} /> Tisk / PDF
            </button>
          </div>
        </header>

        <nav className="flex flex-wrap p-1 bg-slate-200 rounded-xl mb-6 print:hidden">
          {[
            { id: 'jednotlivec', label: 'Oddlužení (Jednotlivec)', icon: User },
            { id: 'manzele', label: 'Oddlužení (Manželé)', icon: Users },
            { id: 'nezabavitelna', label: 'Exekuce (Srážky)', icon: ShieldAlert },
            { id: 'nastaveni', label: 'Parametry výpočtu 2026', icon: Settings },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all ${
                activeTab === tab.id ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <tab.icon size={16} /><span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="grid lg:grid-cols-12 gap-6 print:block">
          {/* LEVÝ PANEL - Vstupy */}
          {activeTab !== 'nastaveni' && (
            <aside className="lg:col-span-5 space-y-4 print:hidden">
              
              {/* SEKCE 1: RODINA (SPOLEČNÉ ÚDAJE) */}
              {activeTab === 'manzele' && (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3 border-t-4 border-t-indigo-400">
                <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                  <Users size={14}/> {activeTab === 'manzele' ? 'Společná situace rodiny' : 'Rodinná situace'}
                </h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Tooltip text={activeTab === 'manzele'
                      ? 'Společné děti, ke kterým máte vyživovací povinnost vy i manžel/ka. V oddlužení manželů se započítají do nezabavitelné částky oběma dlužníkům.'
                      : 'Děti, ke kterým máte vy i druhý rodič společnou vyživovací povinnost. V režimu jednotlivce se započtou do vaší nezabavitelné částky stejně jako jiné vyživované děti.'}>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">
                        {activeTab === 'manzele' ? 'Společné děti' : 'Společné děti / děti ve společné péči'}
                      </label>
                    </Tooltip>
                    <input type="number" name="spolecneDeti" value={data.spolecneDeti} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold" />
                    {activeTab !== 'manzele' && (
                      <p className="mt-1 text-[9px] leading-snug text-slate-500">
                        Tato hodnota se u jednotlivce také započítává do nezabavitelné částky.
                      </p>
                    )}
                  </div>
                </div>
              </div>
              )}

              {/* SEKCE 2: DLUŽNÍK 1 */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3 border-t-4 border-t-blue-400">
                <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                  <User size={14}/> {activeTab === 'manzele' ? 'Příjmy a status: Manžel A' : 'Příjmy a status dlužníka'}
                </h3>
                
                <IncomeSourcesEditor
                  sources={data.prijmy1}
                  multiplePayers={Boolean(data.vicePlatcu1)}
                  onSourcesChange={(sources) => handleIncomeSourcesChange(1, sources)}
                  onMultiplePayersChange={(checked) => handleMultiplePayersChange(1, checked)}
                  label="Postižitelné měsíční příjmy"
                />
                {data.vicePlatcu1 && results.ex.multiPayerNeedsAllocation && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-[10px] text-amber-900 leading-snug">
                    <strong>Pro přesný výpočet více plátců chybí rozdělení nezabavitelné částky.</strong> Zadejte u každého plátce částku, kterou mu bylo určeno ponechat. Součet má odpovídat celkové nezabavitelné částce {formatKc(results.ex.legalniMinimum)}. Do té doby je zobrazený výsledek pouze orientační.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <Tooltip text={activeTab === 'manzele' ? "Další osoby, kterým je tento dlužník povinen poskytovat výživné a které nejsou zahrnuty mezi společně vyživované děti." : "Zadejte počet dětí a dalších osob, ke kterým máte zákonnou vyživovací povinnost. Manžela/partnera sem nepočítejte, ten se zaškrtává zvlášť."}>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">
                        {activeTab === 'manzele' ? 'Další vyživované osoby tohoto dlužníka' : 'Vyživované osoby'}
                      </label>
                    </Tooltip>
                    <input type="number" name="vyzivovaneOsoby1" value={data.vyzivovaneOsoby1} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm" />
                  </div>
                  <div>
                    <Tooltip text="Pokud na některou z osob (např. dítě) aktuálně probíhá exekuce pro výživné, tato osoba se vám do nezabavitelného minima nezapočítává. Zadejte jejich počet.">
                       <label className="block text-[10px] font-bold text-amber-700 mb-1 w-fit cursor-help border-b border-dotted border-amber-600">Z toho osoby s vymáhaným výživným</label>
                    </Tooltip>
                    <input type="number" name="osobySVykonemProVyzivne1" value={data.osobySVykonemProVyzivne1} onChange={handleInputChange} max={(activeTab === 'manzele' ? data.spolecneDeti : 0) + data.vyzivovaneOsoby1 + (results.insM_A?.partnerZapocitan || results.insJ?.partnerZapocitan ? 1 : 0)} className="w-full p-2 bg-amber-50 border border-amber-200 rounded-lg font-bold text-amber-900 text-sm" />
                  </div>
                </div>

                {activeTab !== 'manzele' && (
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <label className="flex items-start gap-2 cursor-pointer w-fit">
                      <input
                        type="checkbox"
                        name="partnerProNezabavitelnou1"
                        checked={Boolean(data.partnerProNezabavitelnou1)}
                        onChange={handleInputChange}
                        className="mt-0.5 accent-blue-600"
                      />
                      {results.duchodPovinny1 ? (
                        <Tooltip text="Z typu vašeho příjmu kalkulačka poznala rozhodný důchod. Pokud máte manžela/manželku nebo partnera/partnerku, započte se na něj/ni jedna čtvrtina nezabavitelné částky.">
                          <span className="text-xs font-bold text-slate-700 cursor-help border-b border-dotted border-slate-400">Mám manžela/manželku nebo partnera/partnerku</span>
                        </Tooltip>
                      ) : (
                        <Tooltip text="Zaškrtněte pouze tehdy, pokud máte manžela/manželku nebo partnera/partnerku, kterému/které byl přiznán starobní důchod, invalidní důchod II. nebo III. stupně nebo sirotčí důchod. V takovém případě se na něj/ni započte jedna čtvrtina nezabavitelné částky.">
                          <span className="text-xs font-bold text-slate-700 cursor-help border-b border-dotted border-slate-400">Manžel/partner pobírá důchod rozhodný pro zvýšení nezabavitelné částky</span>
                        </Tooltip>
                      )}
                    </label>
                  </div>
                )}

                {results.duchodPovinny1 && (
                  <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-100 text-[10px] text-blue-800">
                    Z typu zadaného příjmu byl automaticky rozpoznán starobní, invalidní důchod II./III. stupně nebo sirotčí důchod. Kalkulačka proto použije související zvláštní pravidla automaticky.
                  </div>
                )}

                {activeTab !== 'nezabavitelna' && (
                  <div className="pt-2 border-t border-slate-100">
                    <Tooltip text="Zadejte částku běžného měsíčního výživného, kterou máte platit. V insolvenci se tyto peníze srážejí z vašeho příjmu přednostně před ostatními věřiteli.">
                      <label className="block text-[10px] font-bold text-red-600 mb-1 w-fit cursor-help border-b border-dotted border-red-400">Běžné zákonné výživné hrazené během oddlužení</label>
                    </Tooltip>
                    <input type="number" name="bezneMesicniVyzivne1" value={data.bezneMesicniVyzivne1} onChange={handleInputChange} className="w-full p-2 bg-red-50 border border-red-200 rounded-lg outline-none font-bold text-red-800 text-sm" />
                  </div>
                )}
                <div className="pt-2 border-t border-slate-100">
                  <Tooltip text="Uveďte pouze příjmy, o kterých víte, že z nich nelze provádět srážky ze mzdy a jiných příjmů. Důchod, nemocenské, peněžitá pomoc v mateřství, podpora v nezaměstnanosti, DPP/DPČ ani nejednorázové dávky státní sociální podpory sem obecně nepatří.">
                    <label className="block text-[10px] font-bold text-green-700 mb-1 w-fit cursor-help border-b border-dotted border-green-500">Jiné příjmy nepodléhající srážkám</label>
                  </Tooltip>
                  <input type="number" name="chranenePrijmy1" value={data.chranenePrijmy1} onChange={handleInputChange} className="w-full p-2 bg-green-50 border border-green-200 rounded-lg outline-none font-bold text-green-900 text-sm" />
                </div>
              </div>

              {/* SEKCE 3: DLUŽNÍK 2 (JEN PRO MANŽELE) */}
              {activeTab === 'manzele' && (
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3 border-t-4 border-t-purple-400">
                  <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                    <User size={14}/> Příjmy a status: Manžel B
                  </h3>
                  
                  <IncomeSourcesEditor
                    sources={data.prijmy2}
                    multiplePayers={Boolean(data.vicePlatcu2)}
                    onSourcesChange={(sources) => handleIncomeSourcesChange(2, sources)}
                    onMultiplePayersChange={(checked) => handleMultiplePayersChange(2, checked)}
                    label="Postižitelné měsíční příjmy"
                  />
                  {data.vicePlatcu2 && results.insM_B.multiPayerNeedsAllocation && (
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-[10px] text-amber-900 leading-snug">
                      <strong>Pro přesný výpočet více plátců chybí rozdělení nezabavitelné částky.</strong> Součet přidělených částí má odpovídat {formatKc(results.insM_B.legalniMinimum)}.
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <Tooltip text="Další osoby, kterým je tento dlužník povinen poskytovat výživné a které nejsou zahrnuty mezi společně vyživované děti.">
                        <label className="block text-[10px] font-bold text-slate-600 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">Další vyživované osoby tohoto dlužníka</label>
                      </Tooltip>
                      <input type="number" name="vyzivovaneOsoby2" value={data.vyzivovaneOsoby2} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm" />
                    </div>
                    <div>
                      <Tooltip text="Počet vyživovaných osob druhého dlužníka, v jejichž prospěch je vedeno vymáhání výživného a tato okolnost brání jejich započtení do nezabavitelné částky.">
                        <label className="block text-[10px] font-bold text-amber-700 mb-1 w-fit cursor-help border-b border-dotted border-amber-600">Z toho osoby s vymáhaným výživným</label>
                      </Tooltip>
                      <input type="number" name="osobySVykonemProVyzivne2" value={data.osobySVykonemProVyzivne2} onChange={handleInputChange} max={data.spolecneDeti + data.vyzivovaneOsoby2 + (results.insM_B?.partnerZapocitan ? 1 : 0)} className="w-full p-2 bg-amber-50 border border-amber-200 rounded-lg font-bold text-amber-900 text-sm" />
                    </div>
                  </div>

                  {results.duchodPovinny2 && (
                    <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-100 text-[10px] text-purple-800">
                      Z typu příjmu byl automaticky rozpoznán důchod relevantní pro zvláštní pravidla srážek.
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100">
                    <Tooltip text="Přednostně srážené výživné z platu druhého manžela.">
                      <label className="block text-[10px] font-bold text-red-600 mb-1 w-fit cursor-help border-b border-dotted border-red-400">Běžné zákonné výživné hrazené během oddlužení (M2)</label>
                    </Tooltip>
                    <input type="number" name="bezneMesicniVyzivne2" value={data.bezneMesicniVyzivne2} onChange={handleInputChange} className="w-full p-2 bg-red-50 border border-red-200 rounded-lg outline-none font-bold text-red-800 text-sm" />
                  </div>
                  <div className="pt-2 border-t border-slate-100">
                    <Tooltip text="Uveďte pouze příjmy, o kterých víte, že z nich nelze provádět srážky ze mzdy a jiných příjmů.">
                      <label className="block text-[10px] font-bold text-green-700 mb-1 w-fit cursor-help border-b border-dotted border-green-500">Jiné příjmy nepodléhající srážkám</label>
                    </Tooltip>
                    <input type="number" min="0" name="chranenePrijmy2" value={data.chranenePrijmy2} onChange={handleInputChange} className="w-full p-2 bg-green-50 border border-green-200 rounded-lg outline-none font-bold text-green-900 text-sm" />
                  </div>
                </div>
              )}

              {/* SEKCE 4: PARAMETRY ŘÍZENÍ A DLUHŮ */}
              {activeTab === 'nezabavitelna' ? (
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Parametry exekuce</h3>
                  <div>
                     <Tooltip text="Režim srážky ze dvou třetin se při 4+ exekucích uplatní jen tehdy, pokud jde současně o nejméně čtyři exekuce k vymožení splatných peněžitých pohledávek a plátci mzdy byl doručen exekuční příkaz nebo usnesení obsahující vyrozumění o exekuci srážkami.">
                       <label className="block text-[10px] font-bold text-slate-700 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">Počet souběžných exekucí</label>
                     </Tooltip>
                     <select name="pocetExekuci" value={data.pocetExekuci} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm">
                        <option value="1-3">1 až 3 exekuce</option>
                        <option value="4+">Nejméně 4 exekuce splňující podmínky pro srážku ze dvou třetin</option>
                     </select>
                  </div>
                  <div>
                     <Tooltip text="Nepřednostní pohledávky se zpravidla uspokojují z první třetiny. Přednostní pohledávky se uspokojují ze druhé třetiny a podle potřeby i z první třetiny; výživné má v druhé třetině přednost před ostatními přednostními pohledávkami.">
                       <label className="block text-[10px] font-bold text-slate-700 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">Druh pohledávky</label>
                     </Tooltip>
                     <select name="typPohledavky" value={data.typPohledavky} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm">
                        <option value="neprednostni">Nepřednostní pohledávka</option>
                        <option value="prednostni">Přednostní pohledávka</option>
                        <option value="vyzivne">Pohledávka výživného</option>
                     </select>
                  </div>
                  <label className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200 w-fit cursor-pointer">
                    <input type="checkbox" name="uplatnitPausalPlatce" checked={data.uplatnitPausalPlatce} onChange={handleInputChange} className="mt-0.5 accent-blue-600" />
                    <Tooltip text="Plátci mzdy nebo jiného příjmu může za zákonných podmínek náležet paušálně stanovená náhrada nákladů. Její výše činí nejvýše 50 Kč za kalendářní měsíc a zároveň nesmí přesáhnout jednu třetinu sražené částky zaokrouhlenou nahoru. Náhrada se uspokojuje ze sražené částky.">
                      <span className="text-[10px] font-medium text-slate-700 cursor-help border-b border-dotted border-slate-400">Plátce příjmu uplatňuje paušální náhradu nákladů.</span>
                    </Tooltip>
                  </label>
                </div>
              ) : (
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3 border-t-4 border-t-slate-400">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Konfigurace dluhů pro rozvrh</h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                     <div>
                       <Tooltip text="Standardní režim je 36 měsíců. Pětiletá varianta (60 měsíců) se použije zejména tehdy, bylo-li dlužníku v posledních 20 letech přiznáno osvobození od placení pohledávek zahrnutých do oddlužení.">
                         <label className="block text-[10px] font-bold text-slate-600 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">Délka oddlužení</label>
                       </Tooltip>
                       <select name="delkaOddluzeni" value={data.delkaOddluzeni} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm">
                          <option value={36}>3 roky – standardní doba</option>
                          <option value={60}>5 let – předchozí osvobození v posledních 20 letech</option>
                       </select>
                     </div>
                     <div>
                       <Tooltip text="Odhad částky z případného zpeněžení majetku, která bude po nákladech a po zohlednění práv třetích osob dostupná pro nezajištěné věřitele. Ne každý majetek musí být v konkrétním oddlužení zpeněžen.">
                         <label className="block text-[10px] font-bold text-green-700 mb-1 w-fit cursor-help border-b border-dotted border-green-500">Výtěžek ze zpeněžení majetku</label>
                       </Tooltip>
                       <input type="number" name="vytezekZpenezeni" value={data.vytezekZpenezeni} onChange={handleInputChange} className="w-full p-2 bg-green-50 border border-green-200 rounded-lg font-bold text-green-900 text-sm" />
                     </div>
                  </div>
                  
                  <div>
                    <Tooltip text="Součet všech vašich běžných dluhů (spotřebitelské úvěry, kreditní karty, nezaplacené faktury), u kterých věřitelé nemají žádnou zástavu. Právě z této částky se na konci počítá, na kolik procent jste dluhy umořili.">
                      <label className="block text-[10px] font-bold text-indigo-700 mb-1 w-fit cursor-help border-b border-dotted border-indigo-400">Nezajištěné pohledávky věřitelů</label>
                    </Tooltip>
                    <input
                      type="number"
                      name="dluhyNezajistene"
                      min="0"
                      value={dluhyNezajisteneDraft}
                      onFocus={() => setEditingDluhyNezajistene(true)}
                      onChange={(e) => setDluhyNezajisteneDraft(e.target.value)}
                      onBlur={commitDluhyNezajistene}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                      className="w-full p-2 bg-indigo-50 border border-indigo-200 rounded-lg font-bold text-indigo-900 text-sm"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Tooltip text="Zadejte pohledávky zajištěných věřitelů. Hodnota je v této verzi informativní a nevstupuje do procenta modelového uspokojení nezajištěných věřitelů; zajištění věřitelé se uspokojují z výtěžku zpeněžení zajištění.">
                        <label className="block text-[10px] font-bold text-slate-600 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">Zajištěné pohledávky</label>
                      </Tooltip>
                      <input type="number" name="dluhyZajistene" value={data.dluhyZajistene} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                    </div>
                    <div>
                      <Tooltip text="Informativní údaj o pohledávkách, kterých se osvobození podle insolvenčního zákona nedotýká. Konkrétní právní režim závisí na druhu pohledávky; toto pole nevstupuje do procenta modelového uspokojení nezajištěných věřitelů.">
                        <label className="block text-[10px] font-bold text-slate-600 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">Pohledávky, kterých se osvobození nedotýká</label>
                      </Tooltip>
                      <input type="number" name="dluhyNeosvoboditelne" value={data.dluhyNeosvoboditelne} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                    </div>
                  </div>
                </div>
              )}
            </aside>
          )}

          {/* PRAVÝ PANEL - Výsledky */}
          <main className={`${activeTab === 'nastaveni' ? 'lg:col-span-12' : 'lg:col-span-7'} space-y-4 print:space-y-6 print:col-span-12`}>
            
            {activeTab === 'nastaveni' && (
              <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-xl font-black mb-6">Referenční parametry (Stav 2026)</h3>
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Základní hodnoty pro výpočet nezabavitelné částky</h4>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Životní minimum</label><input type="number" value={params.zivotniMinimum} onChange={(e) => setParams({...params, zivotniMinimum: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded font-bold" /></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Normativní nájemné – 1 osoba, obec 70 000+ obyvatel</label><input type="number" value={params.normativniNajemne} onChange={(e) => setParams({...params, normativniNajemne: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded font-bold" /></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Energetický paušál</label><input type="number" value={params.energetickyPausal} onChange={(e) => setParams({...params, energetickyPausal: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded font-bold" /></div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Odměny a náhrady</h4>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Měsíční odměna a hotové výdaje správce – jednotlivec</label><input type="number" value={params.odmenaSpravceJednotlivec} onChange={(e) => setParams({...params, odmenaSpravceJednotlivec: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded font-bold" /></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Měsíční odměna a hotové výdaje správce – manželé</label><input type="number" value={params.odmenaSpravceManzele} onChange={(e) => setParams({...params, odmenaSpravceManzele: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded font-bold" /></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Maximální paušální náhrada nákladů plátce</label><input type="number" value={params.pausalniNahradaPlatce} onChange={(e) => setParams({...params, pausalniNahradaPlatce: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded font-bold" /></div>
                    
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 pt-4">Zákonné koeficienty a podmínky</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Tooltip text="Procento ze součtu zákonných minim, které tvoří základní nezabavitelnou částku. Pro rok 2026 je to 85 %.">
                          <label className="block text-xs font-bold text-slate-600 mb-1 w-full text-left cursor-help border-b border-dotted border-slate-400">Podíl pro základní nezabavitelnou částku (%)</label>
                        </Tooltip>
                        <input type="number" value={params.koeficientZahladu} onChange={(e) => setParams({...params, koeficientZahladu: parseFloat(e.target.value) || 0})} className="w-full p-2 border border-blue-200 bg-blue-50 rounded font-bold text-sm" />
                      </div>
                      <div>
                        <Tooltip text="Násobek součtu minim, nad který je zbytek příjmu plně zabavitelný. Pro rok 2026 je to 1,9.">
                          <label className="block text-xs font-bold text-slate-600 mb-1 w-full text-left cursor-help border-b border-dotted border-slate-400">Násobek pro hranici srážky bez omezení</label>
                        </Tooltip>
                        <input type="number" step="0.1" value={params.koeficientZabavitelnosti} onChange={(e) => setParams({...params, koeficientZabavitelnosti: parseFloat(e.target.value) || 0})} className="w-full p-2 border border-blue-200 bg-blue-50 rounded font-bold text-sm" />
                      </div>
                      <div className="col-span-2 rounded-lg border border-blue-100 bg-blue-50 p-3">
                        <Tooltip text="Tento limit není samostatně nastavovaná částka. Pro výjimku u 4+ exekucí se porovnává jedna třetina se součtem měsíční odměny a hotových výdajů insolvenčního správce zvýšených o DPH. Kalkulačka proto používá aktuální částku pro jednotlivce.">
                          <span className="block text-xs font-bold text-slate-600 mb-1 border-b border-dotted border-slate-400 w-fit">Limit jedné třetiny pro výjimku u 4+ exekucí (odvozený)</span>
                        </Tooltip>
                        <strong className="text-sm text-blue-900">{params.odmenaSpravceJednotlivec.toLocaleString('cs-CZ')} Kč</strong>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-slate-100 mt-4 text-xs text-slate-600 leading-relaxed">
                      <strong>Minimum oddlužení se počítá automaticky.</strong> Kalkulačka vychází z pravidla „1 + 1“: měsíční odměna a hotové výdaje správce + alespoň stejná částka pro ostatní věřitele + zadané běžné zákonné výživné. Nejde o samostatně editovatelnou zákonnou konstantu.
                    </div>
</div>
                </div>
              </div>
            )}

            {activeTab === 'nezabavitelna' && (
              <div className="space-y-4">
                {(results.ex.multiPayerNeedsAllocation || results.ex.multiPayerExact) && (
                  <div className={`rounded-xl border p-3 text-xs ${results.ex.multiPayerExact ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                    {results.ex.multiPayerExact
                      ? 'Výpočet zohledňuje více plátců samostatně podle zadaného rozdělení nezabavitelné částky.'
                      : 'Příjmy pocházejí od více plátců, ale rozdělení nezabavitelné částky není úplné. Zobrazené částky jsou proto pouze orientační.'}
                  </div>
                )}
                <div className="hidden print:block mb-6">
                  <h2 className="text-2xl font-bold border-b pb-2">Report: Exekuční srážky z příjmu (2026)</h2>
                  <div className="flex gap-8 mt-4 text-sm">
                     <p><strong>Základ příjmů:</strong> {results.totalPrijem1.toLocaleString()} Kč</p>
                     <p><strong>Režim srážky:</strong> {results.ex.forceTwoThirds ? 'Ze dvou třetin (přednostní pohledávka / režim 4+)' : 'Z jedné třetiny (nepřednostní pohledávka)'}</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <AnalyticCard 
                    title="Dlužníkovi po srážce zůstává" 
                    titleTooltip="Celkem, co vám po srážce zůstane. U nepřednostních exekucí zpravidla nezabavitelná částka + druhá a třetí třetina; u přednostních nebo v režimu 4+ nezabavitelná částka + třetí třetina; navíc se mohou přičíst zákonem nepostižitelné příjmy."
                    value={results.ex.kVyplate} 
                    color="green" 
                    subtitle="Částka k výplatě po odečtení srážek."
                  >
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs text-green-800">
                        <Tooltip text="Základní částka, která nesmí být při srážkách z příjmu sražena. Vychází ze zákonných částek a počtu započitatelných vyživovaných osob.">
                          <span className="cursor-help border-b border-dotted border-green-400">Nezabavitelná částka</span>
                        </Tooltip>
                        <strong>{results.ex.legalniMinimum.toLocaleString()} Kč</strong>
                      </div>
                      <div className="flex justify-between items-center text-xs text-green-800">
                        <Tooltip text="Vámi zadané jiné příjmy, u nichž se předpokládá, že nepodléhají srážkám. Kalkulačka právní povahu konkrétní dávky nebo příjmu sama neověřuje.">
                          <span className="cursor-help border-b border-dotted border-green-400">Zadané příjmy nepodléhající srážkám</span>
                        </Tooltip>
                        <strong>{data.chranenePrijmy1.toLocaleString()} Kč</strong>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-green-700 pt-1 mt-1 border-t border-green-200/50">
                        <Tooltip text={`Pokud zbytek příjmu přesáhne částku ${results.ex.hranicePlneZabavitelna.toLocaleString()} Kč, tak část příjmu nad tuto hranici je postižitelná bez omezení a připočítává se ke srážce.`}>
                          <span className="cursor-help border-b border-dotted border-green-400">Hranice částky postižitelné bez omezení</span>
                        </Tooltip>
                        <strong>{results.ex.hranicePlneZabavitelna.toLocaleString()} Kč</strong>
                      </div>
                    </div>
                  </AnalyticCard>

                  <AnalyticCard 
                    title="Zákonná srážka" 
                    titleTooltip="Celková částka sražená z příjmu. Paušální náhrada plátci mzdy se neodečítá navíc z čisté mzdy; je uspokojena z této již sražené částky a zbytek srážky se odvádí na exekuci."
                    value={results.ex.srazka} 
                    color="red" 
                    subtitle={results.ex.forceTwoThirds ? "Uplatněna srážka ze DVOU třetin zbytku." : "Uplatněna srážka z JEDNÉ třetiny zbytku."}
                  >
                    <div className="flex justify-between items-center text-xs text-red-800">
                      <Tooltip text="Paušálně stanovená náhrada nákladů plátce. Uspokojuje se ze sražené částky před ostatními pohledávkami.">
                        <span className="cursor-help border-b border-dotted border-red-400">Paušální náhrada nákladů plátce</span>
                      </Tooltip>
                      <strong>{results.ex.nahradaPlatci} Kč</strong>
                    </div>
                    {results.ex.nahradaPlatci > 0 && (
                      <div className="flex justify-between items-center text-xs text-red-800 mt-1 border-t border-red-100 pt-1">
                        <Tooltip text="Část celkové zákonné srážky, která po odečtení paušální náhrady plátci mzdy pokračuje do exekučního rozvrhu.">
                          <span className="cursor-help border-b border-dotted border-red-400">Část srážky po odečtení náhrady plátci</span>
                        </Tooltip>
                        <strong>{results.ex.srazkaCista.toLocaleString()} Kč</strong>
                      </div>
                    )}
                    {results.ex.exception4PlusApplied && (
                       <div className="mt-2 p-2 bg-red-100 rounded text-[10px] text-red-800 font-bold leading-tight print:border print:border-red-300">
                         Výjimka pro 4+ exekucí: dlužník má relevantní důchod a jedna třetina je pod zákonným limitem ({params.odmenaSpravceJednotlivec} Kč). Samotné pravidlo 4+ proto nezpůsobí připočtení druhé třetiny; případné přednostní pohledávky se posuzují samostatně.
                       </div>
                    )}
                  </AnalyticCard>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 print:break-inside-avoid">
                  <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Layers size={16} /> Rozpad na třetiny
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                     <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                       <Tooltip text="Základní částka, která nesmí být sražena. Pro rok 2026 činí 85 % ze součtu životního minima a normativů + přidává se 1/4 za každou vyživovanou osobu.">
                         <p className="text-[9px] text-slate-500 uppercase font-bold mb-1 cursor-help border-b border-dotted border-slate-400 w-fit">Nezabavitelná částka</p>
                       </Tooltip>
                       <p className="font-black text-slate-800 text-lg">{results.ex.legalniMinimum.toLocaleString()}</p>
                       <p className="text-[8px] text-slate-400 mt-1">Započítán partner: {results.ex.partnerZapocitan ? 'ANO' : 'NE'}</p>
                     </div>
                     <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                       <Tooltip text="Část zbytku mzdy určená k dělení na třetiny po omezení zákonným limitem a po snížení na nejbližší nižší násobek tří. Případný zbytek 1–2 Kč zůstává dlužníkovi.">
                         <p className="text-[9px] text-slate-500 uppercase font-bold mb-1 cursor-help border-b border-dotted border-slate-400 w-fit">Část příjmu určená k rozdělení na třetiny</p>
                       </Tooltip>
                       <p className="font-black text-slate-800 text-lg">{results.ex.zbytekKDeleni.toLocaleString()}</p>
                     </div>
                     <div className="p-3 bg-amber-50 rounded-lg border-l-2 border-amber-400">
                       <Tooltip text="Výsledek dělení 'zbytku' třemi (nebo limitu třemi). První třetina jde vždy na dluhy, třetí třetina vám zůstane k výplatě. Osud prostřední (druhé) třetiny závisí na typu dluhu.">
                         <p className="text-[9px] text-amber-800 uppercase font-bold mb-1 cursor-help border-b border-dotted border-amber-600 w-fit">Jedna třetina</p>
                       </Tooltip>
                       <p className="font-black text-amber-900 text-lg">{results.ex.tretina.toLocaleString()}</p>
                     </div>
                     <div className="p-3 bg-red-50 rounded-lg border-l-2 border-red-400">
                       <Tooltip text={`Pokud zbytek příjmu přesáhne částku ${results.ex.hranicePlneZabavitelna.toLocaleString()} Kč, tak část příjmu nad tuto hranici je postižitelná bez omezení a připočítává se ke srážce.`}>
                         <p className="text-[9px] text-red-800 uppercase font-bold mb-1 cursor-help border-b border-dotted border-red-600 w-fit">Část postižitelná bez omezení</p>
                       </Tooltip>
                       <p className="font-black text-red-900 text-lg">{results.ex.plneZabavitelna.toLocaleString()}</p>
                     </div>
                  </div>

                  {/* VÝUKOVÝ MATEMATICKÝ BLOK - EXEKUCE */}
                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Matematický postup výpočtu:</p>
                    <div className="space-y-1.5 text-[10px] text-slate-600 font-mono bg-slate-50 p-3 rounded border border-slate-100 overflow-x-auto whitespace-nowrap">
                      {renderMathStep1(results.ex, params)}
                      <p>2. <strong className="text-slate-700">Část příjmu nad nezabavitelnou částku:</strong> {results.ex.prijemPredSrazkou.toLocaleString()} (Příjem) - {results.ex.legalniMinimum.toLocaleString()} (Nezabavitelná částka) = {Math.max(0, results.ex.zbytekMzdyRaw).toLocaleString()} Kč</p>
                      {results.ex.zbytekMzdyRaw > 0 && (
                        <>
                          <p>3. <strong className="text-slate-700">Jedna třetina:</strong> {results.ex.zbytekKDeleni.toLocaleString()} (část po snížení na násobek 3) ÷ 3 = {results.ex.tretina.toLocaleString()} Kč (zaokrouhlovací zbytek {results.ex.zaokrouhlovaciZbytek} Kč dlužníkovi)</p>
                          <p>4. <strong className="text-slate-700">Srážka:</strong> {results.ex.forceTwoThirds ? '2' : '1'} × {results.ex.tretina.toLocaleString()} ({results.ex.forceTwoThirds ? 'Přednostní' : 'Nepřednostní'}) + {results.ex.plneZabavitelna.toLocaleString()} (Nad limit) = {results.ex.srazka.toLocaleString()} Kč</p>
                          <p>5. <strong className="text-slate-700">K výplatě:</strong> {results.ex.prijemPredSrazkou.toLocaleString()} (Příjem) - {results.ex.srazka.toLocaleString()} (Srážka){data.chranenePrijmy1 > 0 ? ` + ${data.chranenePrijmy1.toLocaleString()} (jiné příjmy nepodléhající srážkám)` : ''} = {results.ex.kVyplate.toLocaleString()} Kč</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'jednotlivec' && (
              <div className="space-y-4">
                <div className="hidden print:block mb-6">
                  <h2 className="text-2xl font-bold border-b pb-2">Report: Prognóza oddlužení (Jednotlivec)</h2>
                </div>

                {(results.insJ.multiPayerNeedsAllocation || results.insJ.multiPayerExact) && (
                  <div className={`rounded-xl border p-3 text-xs ${results.insJ.multiPayerExact ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                    {results.insJ.multiPayerExact
                      ? 'Více plátců je započteno samostatně podle zadaného rozdělení nezabavitelné částky.'
                      : 'Bez přesného rozdělení nezabavitelné částky mezi plátce je posouzení srážky a minimálního plnění pouze orientační.'}
                  </div>
                )}
                <MinimumCoveragePanel
                  coverage={results.coverageJ}
                  data={data}
                  onToggle={handleAdditionalSourceToggle}
                  onAmountChange={handleInputChange}
                  modeLabel="jednotlivce"
                  fieldSuffix="1"
                />

                <div className="grid sm:grid-cols-2 gap-4">
                  <AnalyticCard 
                    title="Zákonná měsíční srážka" 
                    titleTooltip="Celková částka sražená z vašeho příjmu. Při oddlužení plněním splátkového kalendáře se z příjmů dlužníka standardně odvádí částka ve stejném rozsahu, v jakém mohou být při výkonu rozhodnutí nebo exekuci uspokojeny přednostní pohledávky."
                    value={results.insJ.srazka} 
                    color="slate" 
                    subtitle="Sráží se vždy jako pro přednostní pohledávky."
                  >
                    <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-2 mb-2">
                      <Tooltip text="Povinná měsíční odměna a paušální náhrada insolvenčnímu správci. Odečte se jako úplně první položka z vaší celkové srážky.">
                        <span className="text-slate-500 cursor-help border-b border-dotted border-slate-400">Měsíční odměna a hotové výdaje insolvenčního správce</span>
                      </Tooltip>
                      <strong className="text-slate-700">-{params.odmenaSpravceJednotlivec} Kč</strong>
                    </div>
                    {data.bezneMesicniVyzivne1 > 0 && (
                       <div className="flex justify-between items-center text-xs text-red-600 bg-red-50 p-1.5 rounded">
                        <Tooltip text="Pokud platíte běžné výživné, insolvenční správce ho rovnou zaplatí z vaší měsíční srážky (přednostně před ostatními věřiteli).">
                          <span className="flex items-center gap-1 cursor-help border-b border-dotted border-red-400"><Gavel size={12}/> Běžné zákonné výživné</span>
                        </Tooltip>
                        <strong>-{data.bezneMesicniVyzivne1} Kč</strong>
                      </div>
                    )}
                  </AnalyticCard>

                  <AnalyticCard 
                    title="Orientačně pro nezajištěné věřitele" 
                    titleTooltip="Modelová částka, která po odečtení zadaných přednostně hrazených položek zbývá k rozdělení mezi nezajištěné věřitele."
                    value={results.proVeriteleJ} 
                    color="indigo" 
                    subtitle="Modelová částka po odečtení správce a zadaného běžného výživného."
                  >
                    <div className="flex justify-between items-center text-[11px] text-green-800 bg-green-50 p-2.5 rounded mt-2 border border-green-100">
                      <Tooltip text="Část zadaných příjmů, která po zákonné srážce zůstává dlužníkovi, včetně zadaných jiných příjmů nepodléhajících srážkám. Pokud je použit závazný příslib, jeho částka se zde zatím neodečítá.">
                        <span className="cursor-help border-b border-dotted border-green-400">Dlužníkovi po srážce zůstává</span>
                      </Tooltip>
                      <strong className="text-sm">{results.insJ.kVyplate.toLocaleString()} Kč</strong>
                    </div>
                  </AnalyticCard>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 print:break-inside-avoid">
                   {/* VÝUKOVÝ MATEMATICKÝ BLOK - INSOLVENCE JEDNOTLIVEC */}
                   <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Matematický postup výpočtu srážky:</p>
                   <div className="space-y-1.5 text-[10px] text-slate-600 font-mono bg-slate-50 p-3 rounded border border-slate-100 overflow-x-auto whitespace-nowrap mb-6">
                     {renderMathStep1(results.insJ, params)}
                     <p>2. <strong className="text-slate-700">Část příjmu nad nezabavitelnou částku:</strong> {results.insJ.prijemPredSrazkou.toLocaleString()} (Příjem) - {results.insJ.legalniMinimum.toLocaleString()} (Nezabavitelná částka) = {Math.max(0, results.insJ.zbytekMzdyRaw).toLocaleString()} Kč</p>
                     {results.insJ.zbytekMzdyRaw > 0 && (
                       <>
                         <p>3. <strong className="text-slate-700">Jedna třetina:</strong> {results.insJ.zbytekKDeleni.toLocaleString()} (část po snížení na násobek 3) ÷ 3 = {results.insJ.tretina.toLocaleString()} Kč (zaokrouhlovací zbytek {results.insJ.zaokrouhlovaciZbytek} Kč dlužníkovi)</p>
                         <p>4. <strong className="text-slate-700">Srážka:</strong> 2 × {results.insJ.tretina.toLocaleString()} (Oddlužení bere 2/3) + {results.insJ.plneZabavitelna.toLocaleString()} (Nad limit) = {results.insJ.srazka.toLocaleString()} Kč</p>
                         <p>5. <strong className="text-slate-700">K výplatě:</strong> {results.insJ.prijemPredSrazkou.toLocaleString()} (Příjem) - {results.insJ.srazka.toLocaleString()} (Srážka){data.chranenePrijmy1 > 0 ? ` + ${data.chranenePrijmy1.toLocaleString()} (jiné příjmy nepodléhající srážkám)` : ''} = {results.insJ.kVyplate.toLocaleString()} Kč</p>
                       </>
                     )}
                   </div>

                   <div className="bg-slate-900 p-6 rounded-xl shadow-sm text-white flex flex-col justify-between print:bg-white print:border print:text-black">
                     <div>
                       <Tooltip text="Orientační modelová míra uspokojení zadaných nezajištěných pohledávek. Nejde o soudem stanovený cíl ani o záruku výsledku oddlužení; skutečné plnění může ovlivnit změna příjmů, výše zjištěných pohledávek, další prioritní položky a náklady řízení.">
                         <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 cursor-help border-b border-dotted border-blue-500 w-fit print:text-gray-600 print:border-none">Modelové uspokojení</p>
                       </Tooltip>
                       <p className="text-[11px] text-slate-400 mb-3 print:text-gray-800">Nezajištěných věřitelů (Rozvrh {data.delkaOddluzeni} měsíců + Zpeněžení {data.vytezekZpenezeni} Kč)</p>
                     </div>
                     <div>
                       <div className="text-4xl font-black text-white tracking-tighter mb-1 print:text-black">
                         {editingDluhyNezajistene ? '—' : `${Number.isFinite(results.uspokojeniJ) ? results.uspokojeniJ.toFixed(1) : 0} %`}
                       </div>
                       <div className="text-[10px] text-slate-400 border-t border-slate-700 pt-2 print:border-gray-200 print:text-gray-600">
                         {editingDluhyNezajistene
                           ? 'Výsledek se přepočítá po potvrzení částky nezajištěných dluhů.'
                           : <>Odpovídá modelové úhradě {Math.round(results.uspokojeniInfoJ.actualPayment).toLocaleString()} Kč ze základu {data.dluhyNezajistene.toLocaleString()} Kč.{results.uspokojeniInfoJ.excessPotential > 0 ? ` Disponibilní plnění je o ${Math.round(results.uspokojeniInfoJ.excessPotential).toLocaleString()} Kč vyšší než zadaný dluh.` : ''}</>}
                       </div>
                     </div>
                   </div>

                   <div className="bg-amber-50 p-5 rounded-xl border border-amber-200 mt-4 print:bg-white">
                     <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-2 flex items-center gap-1">
                       <AlertCircle size={14} /> Mimořádné vlivy
                     </p>
                     <ul className="text-[10px] text-amber-900 space-y-2 leading-relaxed">
                       <li>• Výpočet je orientační. Nezahrnuje jiné přednostní položky (např. dle § 390a) ani změny příjmů či dary.</li>
                       {data.dluhyZajistene > 0 && <li>• <strong>Zajištěné pohledávky ({data.dluhyZajistene.toLocaleString()} Kč):</strong> Zajištění věřitelé se uspokojují z výtěžku zpeněžení zajištění.</li>}
                       {data.dluhyNeosvoboditelne > 0 && <li>• <strong>Pohledávky, kterých se osvobození nedotýká ({data.dluhyNeosvoboditelne.toLocaleString()} Kč):</strong> Osvobození se těchto pohledávek může podle jejich právního důvodu nedotýkat; konkrétní režim je nutné posoudit individuálně.</li>}
                     </ul>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'manzele' && (
              <div className="space-y-4">
                <div className="hidden print:block mb-6">
                  <h2 className="text-2xl font-bold border-b pb-2">Report: Prognóza oddlužení (Manželé)</h2>
                </div>

                {(results.insM_A.multiPayerNeedsAllocation || results.insM_B.multiPayerNeedsAllocation || results.insM_A.multiPayerExact || results.insM_B.multiPayerExact) && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    U každého manžela se případný souběh více plátců posuzuje samostatně. Přesný výsledek vyžaduje úplné rozdělení nezabavitelné částky u všech dlužníků, kterých se více plátců týká.
                  </div>
                )}
                <MinimumCoveragePanel
                  coverage={results.coverageM}
                  data={data}
                  onToggle={handleAdditionalSourceToggle}
                  onAmountChange={handleInputChange}
                  modeLabel="společné oddlužení manželů"
                  fieldSuffix="M"
                />

                <div className="grid sm:grid-cols-2 gap-4">
                  <AnalyticCard 
                    title="Celková měsíční srážka manželů" 
                    titleTooltip="Součet samostatně vypočtených srážek z příjmů obou manželů. U každého se srážka stanoví podle pravidel pro oddlužení."
                    value={results.srazkaCelkemM} 
                    color="slate" 
                    subtitle="Součet samostatně vypočtených srážek obou manželů."
                  >
                    <div className="flex justify-between items-center text-xs">
                      <Tooltip text="Rozpad, kolik se z celkové sumy přesně strhne každému z manželů z jeho vlastní výplaty.">
                        <span className="text-slate-500 cursor-help border-b border-dotted border-slate-400">Srážka Manžel A / Manžel B</span>
                      </Tooltip>
                      <strong className="text-slate-700">{results.insM_A.srazka.toLocaleString()} / {results.insM_B.srazka.toLocaleString()} Kč</strong>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-400 mt-2 border-t pt-2">
                      <Tooltip text="Poplatek pro insolvenčního správce (1,5násobek poplatku jednotlivce), který se hradí přednostně.">
                        <span className="cursor-help border-b border-dotted border-slate-400">Měsíční odměna a hotové výdaje správce – manželé</span>
                      </Tooltip>
                      <span>-{params.odmenaSpravceManzele} Kč</span>
                    </div>
                    {(data.bezneMesicniVyzivne1 > 0 || data.bezneMesicniVyzivne2 > 0) && (
                      <div className="flex justify-between items-center text-[10px] text-red-500 mt-1">
                        <Tooltip text="Výživné se i v oddlužení hradí přednostně před běžnými dluhy.">
                          <span className="cursor-help border-b border-dotted border-red-300">Běžné zákonné výživné celkem</span>
                        </Tooltip>
                        <span>-{data.bezneMesicniVyzivne1 + data.bezneMesicniVyzivne2} Kč</span>
                      </div>
                    )}
                  </AnalyticCard>

                  <AnalyticCard 
                    title="Orientačně pro nezajištěné věřitele" 
                    titleTooltip="Modelová částka, která ze součtu srážek obou manželů po odečtení zadaných přednostně hrazených položek zbývá k rozdělení mezi nezajištěné věřitele."
                    value={results.proVeriteleM} 
                    color="indigo" 
                    subtitle="Společná částka k rozvrhu po odečtení priorit."
                  >
                    <div className="flex justify-between items-center text-[11px] text-green-800 bg-green-50 p-2.5 rounded mt-2 border border-green-100">
                      <Tooltip text="Součet částek, které po zákonných srážkách zůstávají oběma manželům, včetně zadaných jiných příjmů nepodléhajících srážkám.">
                        <span className="cursor-help border-b border-dotted border-green-400">Manželům po srážkách zůstává celkem</span>
                      </Tooltip>
                      <strong className="text-sm">{results.kVyplateCelkemM.toLocaleString()} Kč</strong>
                    </div>
                  </AnalyticCard>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 print:break-inside-avoid">
                   <div className="bg-slate-900 p-6 rounded-xl shadow-sm text-white flex flex-col justify-between print:bg-white print:border print:text-black">
                     <div>
                       <Tooltip text="Orientační modelová míra uspokojení zadaných nezajištěných pohledávek. Nejde o soudem stanovený cíl ani o záruku výsledku oddlužení; skutečné plnění může ovlivnit změna příjmů, výše zjištěných pohledávek, další prioritní položky a náklady řízení.">
                         <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 cursor-help border-b border-dotted border-blue-500 w-fit print:text-gray-600 print:border-none">Modelové uspokojení</p>
                       </Tooltip>
                       <p className="text-[11px] text-slate-400 mb-3 print:text-gray-800">Společné dluhy rodiny ({data.delkaOddluzeni} měs. + Zpeněžení {data.vytezekZpenezeni} Kč)</p>
                     </div>
                     <div>
                       <div className="text-4xl font-black text-white tracking-tighter mb-1 print:text-black">
                         {editingDluhyNezajistene ? '—' : `${Number.isFinite(results.uspokojeniM) ? results.uspokojeniM.toFixed(1) : 0} %`}
                       </div>
                       <div className="text-[10px] text-slate-400 border-t border-slate-700 pt-2 print:border-gray-200 print:text-gray-600">
                         {editingDluhyNezajistene
                           ? 'Výsledek se přepočítá po potvrzení částky nezajištěných dluhů.'
                           : <>Odpovídá modelové úhradě {Math.round(results.uspokojeniInfoM.actualPayment).toLocaleString()} Kč ze základu {data.dluhyNezajistene.toLocaleString()} Kč.{results.uspokojeniInfoM.excessPotential > 0 ? ` Disponibilní plnění je o ${Math.round(results.uspokojeniInfoM.excessPotential).toLocaleString()} Kč vyšší než zadaný dluh.` : ''}</>}
                       </div>
                     </div>
                   </div>

                   <div className="bg-blue-50 p-5 rounded-xl border border-blue-200 mt-4 print:bg-white">
                     <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest mb-2 flex items-center gap-1">
                       <Info size={14} /> Metodika manželů
                     </p>
                     <p className="text-[10px] text-blue-900 leading-relaxed">
                       Srážka se stanoví samostatně z příjmu každého manžela. Společně vyživované dítě se započítává každému manželovi zvlášť, jsou-li srážky prováděny z příjmu obou. Na manžela/partnera se započítá jedna čtvrtina nezabavitelné částky, pokud byl starobní důchod, invalidní důchod II./III. stupně nebo sirotčí důchod přiznán alespoň jednomu z manželů.
                     </p>
                   </div>
                </div>
              </div>
            )}

            <div className="mt-8 p-4 bg-slate-100 rounded-xl border border-slate-200 text-[10px] text-slate-500 leading-relaxed print:text-black print:border-none print:bg-transparent">
              <strong>Doložka k výsledku:</strong> Kalkulačka pracuje s právním stavem pro příjmy vyplácené v roce 2026 a poskytuje orientační výsledek. U exekucí nerozpočítává pořadí několika souběžných pohledávek mezi jednotlivé věřitele. Při více plátcích je přesný výpočet možný pouze tehdy, jsou-li zadány části nezabavitelné částky určené jednotlivým plátcům; bez nich je výsledek označen jako orientační. U oddlužení je míra uspokojení modelová a nezohledňuje všechny náklady řízení, budoucí změny příjmů ani všechny další prioritní pohledávky. Kalkulačka neposuzuje skutečnou udržitelnost závazného příslibu, platnost závazku třetí osoby ani to, zda soud oddlužení povolí nebo schválí.
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default HlavniKalkulackaPage
