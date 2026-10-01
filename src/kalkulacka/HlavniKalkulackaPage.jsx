import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calculator, Users, User, Info, AlertCircle,
  ShieldAlert, Settings, Layers, Printer, Gavel, RotateCcw
} from 'lucide-react';
import { DEFAULT_2026_PARAMS, calculateCreditorSatisfaction, calculateDebtorPromiseLimit, calculateMinimumPaymentCoverage, calculateWageDeduction, getMinimumInsolvencyPayment } from '../lib/calculations2026';
import MobileKalkulackaWizard from './MobileKalkulackaWizard';
import PrintableCalculationReport from './PrintableCalculationReport';

// --- POMOCNÁ KOMPONENTA PRO VYSVĚTLIVKY ---
const Tooltip = ({ children, text }) => {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="group relative flex items-center gap-1.5 w-fit"
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      {children}
      <button
        type="button"
        aria-label={open ? 'Skrýt vysvětlení' : 'Zobrazit vysvětlení'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
            event.currentTarget.blur();
          }
        }}
        className="shrink-0 rounded p-0.5 text-slate-400 transition-colors hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 print:hidden"
      >
        <Info size={14} aria-hidden="true" />
      </button>
      <div
        role="tooltip"
        className={`absolute bottom-full left-1/2 z-50 mb-2 w-80 max-w-[calc(100vw-2rem)] -translate-x-1/2 whitespace-pre-line rounded-lg bg-slate-800 p-3 text-left text-xs font-medium leading-snug text-white shadow-xl print:hidden ${open ? 'block' : 'hidden group-hover:block group-focus-within:block'}`}
      >
        {text}
        <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
      </div>
    </div>
  );
};


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

const selectZeroOnFocus = (event) => {
  if (event.currentTarget.value === '0') {
    event.currentTarget.select();
  }
};


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
        <Tooltip text={"Právně přesně: Srážky se mohou provádět nejen ze mzdy, ale také z dalších zákonem určených příjmů, například z důchodu, DPP/DPČ, nemocenského, peněžité pomoci v mateřství nebo podpory v nezaměstnanosti. Každý zdroj příjmu zadejte samostatně; typ důchodu kalkulačka používá i pro zvláštní pravidla srážek.\n\nLidsky řečeno: Srážky se mohou provádět nejen ze mzdy, ale také z dalších příjmů, například z důchodu, odměny z DPP/DPČ, nemocenského, podpory v nezaměstnanosti nebo rodičovského příspěvku („rodičáku“). Každý příjem zadejte samostatně; kalkulačka to potřebuje pro uplatnění zvláštních pravidel."}>
          <span className="text-[10px] font-bold text-slate-600 border-b border-dotted border-slate-400">{label}</span>
        </Tooltip>
        <button type="button" onClick={addSource} className="text-[10px] font-bold text-blue-700 hover:text-blue-900">+ Přidat další příjem</button>
      </div>
      {safeSources.map((source, index) => (
        <div key={source.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr_auto] items-end">
            <div>
              <Tooltip text="Vyberte, o jaký příjem jde. Kalkulačka podle typu příjmu pozná, jaká pravidla má při výpočtu použít – například u některých druhů důchodů.">
                <label htmlFor={`${source.id}-typ`} className="block text-[9px] font-bold text-slate-500 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">Typ příjmu</label>
              </Tooltip>
              <select id={`${source.id}-typ`} value={source.typ} onChange={(e) => updateSource(source.id, { typ: e.target.value })} className="w-full p-2 bg-white border border-slate-300 rounded-lg font-semibold text-xs">
                {INCOME_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div>
              <Tooltip text={"Právně přesně: Zadejte čistou měsíční částku před provedením exekuční nebo insolvenční srážky. U mzdy jde o částku po odečtení daně a povinného pojistného; u důchodu nebo jiné dávky o měsíční částku před srážkou.\n\nLidsky řečeno: Zadejte částku, kterou byste dostali, kdyby vám z ní nebyly strhávány peníze kvůli dluhům."}>
                <label htmlFor={`${source.id}-castka`} className="block text-[9px] font-bold text-slate-500 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">Čistá měsíční částka (Kč)</label>
              </Tooltip>
              <input id={`${source.id}-castka`} type="number" onFocus={selectZeroOnFocus} onClick={selectZeroOnFocus} min="0" value={source.castka ?? ''} onChange={(e) => updateSource(source.id, { castka: Math.max(0, Number(e.target.value) || 0) })} className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-sm" />
            </div>
            <button type="button" onClick={() => removeSource(source.id)} disabled={safeSources.length <= 1} className="px-2 py-2 text-[10px] font-bold text-slate-500 disabled:opacity-30 hover:text-red-600">Odebrat</button>
          </div>
          {multiplePayers && safeSources.length > 1 && (
            <div className="mt-2">
              <Tooltip text={"Právně přesně: Pokud srážky provádí několik plátců současně, určí se, jakou část nezabavitelné částky má každý z nich ponechat. Pro přesný výpočet zadejte částku přidělenou právě tomuto plátci; součet má odpovídat celkové nezabavitelné částce.\n\nLidsky řečeno: Pokud příjem dostáváte od více plátců, například od zaměstnavatele a ČSSZ, nezabavitelná částka se mezi ně rozdělí. Zadejte částku, kterou vám má ponechat tento plátce."}>
                <label htmlFor={`${source.id}-nezabavitelna`} className="block text-[9px] font-bold text-amber-700 mb-1 border-b border-dotted border-amber-500">Nezabavitelná částka přidělená tomuto plátci (Kč)</label>
              </Tooltip>
              <input id={`${source.id}-nezabavitelna`} type="number" onFocus={selectZeroOnFocus} onClick={selectZeroOnFocus} min="0" value={source.pridelenaNezabavitelna ?? ''} onChange={(e) => updateSource(source.id, { pridelenaNezabavitelna: e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0) })} className="w-full p-2 bg-amber-50 border border-amber-200 rounded-lg font-bold text-sm text-amber-900" placeholder="Podle rozhodnutí / pokynu plátci" />
            </div>
          )}
        </div>
      ))}
      {safeSources.length > 1 && (
        <label className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-2.5 text-[10px] text-blue-900">
          <input type="checkbox" checked={multiplePayers} onChange={(e) => onMultiplePayersChange(e.target.checked)} className="mt-0.5 accent-blue-600" />
          <span><strong>Příjmy vyplácí více plátců.</strong> Zaškrtněte, pokud příjem dostáváte z více stran.</span>
        </label>
      )}
    </div>
  );
};

const MinimumCoveragePanel = ({ coverage, data, onToggle, onAmountChange, onValueChange, modeLabel, fieldSuffix }) => {
  const promiseEnabled = Boolean(data[`povolitPrislibDluznika${fieldSuffix}`]);
  const thirdPartyEnabled = Boolean(data[`povolitPlneniTretiOsoby${fieldSuffix}`]);
  const basicNeedsKey = `zakladniPotreby${fieldSuffix}`;
  const promiseKey = `zavaznyPrislib${fieldSuffix}`;
  const thirdPartyKey = `pravidelnePlneniTretiOsoby${fieldSuffix}`;
  const rawPromise = Math.max(0, Number(data[promiseKey]) || 0);
  const stillNeedsThirdParty = coverage.deficitAfterDebtorPromise > 0;
  const afterPromiseRetained = Math.max(0, coverage.retainedAfterStatutoryDeduction - coverage.debtorPromise);
  const reserveAfterPromise = coverage.basicNeedsDeclared
    ? Math.max(0, afterPromiseRetained - coverage.basicNeeds)
    : 0;
  const ownFundsCoverDeficit = coverage.basicNeedsDeclared
    && coverage.availableAboveBasicNeeds >= coverage.deficitAfterStatutoryDeduction;

  const handleBasicNeedsChange = (event) => {
    const rawValue = event.target.value;
    const nextNeeds = rawValue === '' ? '' : Math.max(0, Number(rawValue) || 0);
    onValueChange(basicNeedsKey, nextNeeds);

    if (nextNeeds === '' || Number(nextNeeds) <= 0) {
      onValueChange(promiseKey, '');
      return;
    }

    const nextLimit = Math.min(
      coverage.deficitAfterStatutoryDeduction,
      Math.max(0, coverage.retainedAfterStatutoryDeduction - Number(nextNeeds)),
    );
    if (rawPromise > nextLimit) onValueChange(promiseKey, nextLimit);
  };

  const handlePromiseChange = (event) => {
    const requested = Math.max(0, Number(event.target.value) || 0);
    onValueChange(promiseKey, Math.min(requested, coverage.maxDebtorPromise));
  };

  if (coverage.coveredByStatutoryDeduction) {
    return (
      <section className="rounded-xl border border-emerald-400/50 bg-emerald-950/35 p-4 text-emerald-100 print:border-emerald-300 print:bg-emerald-50 print:text-emerald-900">
        <p className="font-bold">Minimum pro {modeLabel} je splněno zákonnou srážkou.</p>
        <p className="mt-1 text-xs">Zákonná srážka {formatKc(coverage.statutoryDeduction)} pokrývá požadované minimum {formatKc(coverage.requiredMinimum)}. Další zdroj není pro splnění minima potřeba.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-700/70 bg-slate-950/45 p-4 space-y-4 print:bg-white print:border-slate-300">
      <div className="rounded-lg border border-amber-400/60 bg-amber-950/30 p-3 text-sm text-amber-100 print:border-amber-300 print:bg-amber-50 print:text-amber-900">
        <p className="font-bold">Do potřebného měsíčního minima chybí {formatKc(coverage.deficitAfterStatutoryDeduction)}.</p>
        <div className="mt-2 grid gap-1 text-xs">
          <div className="flex justify-between gap-4"><span>Zákonná srážka</span><strong>{formatKc(coverage.statutoryDeduction)}</strong></div>
          <div className="flex justify-between gap-4"><span>Potřebné minimum</span><strong>{formatKc(coverage.requiredMinimum)}</strong></div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 space-y-3 print:border-slate-300 print:bg-slate-50">
        <label className="flex items-start gap-2 text-sm text-slate-100 print:text-slate-800">
          <input
            type="checkbox"
            checked={promiseEnabled}
            onChange={(event) => onToggle(`povolitPrislibDluznika${fieldSuffix}`, promiseKey, event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-cyan-400"
          />
          <span>
            <strong>Chci chybějící částku doplnit ze svých peněz.</strong>
            <span className="mt-1 block text-xs font-normal text-slate-400 print:text-slate-600">
              Kalkulačka nejdřív ověří, kolik vám musí podle vámi zadaných potřeb zůstat.
            </span>
          </span>
        </label>

        {promiseEnabled && (
          <div className="pl-6 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-200 print:text-slate-700">
                Kolik nejméně potřebujete měsíčně ponechat na základní potřeby domácnosti? (Kč)
              </label>
              <input
                type="number"
                onFocus={selectZeroOnFocus}
                onClick={selectZeroOnFocus}
                min="0"
                step="1"
                name={basicNeedsKey}
                value={data[basicNeedsKey] ?? ''}
                onChange={handleBasicNeedsChange}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 print:bg-white print:text-slate-900"
                placeholder="Např. 14 000"
              />
              <p className="mt-1 text-xs text-slate-400 print:text-slate-600">
                Uveďte částku na základní životní potřeby své domácnosti. Kalkulačka sama neposuzuje, zda je zadaná částka přiměřená.
              </p>
            </div>

            {coverage.basicNeedsDeclared ? (
              <>
                <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-2.5 text-xs text-slate-300 print:border-slate-300 print:bg-white print:text-slate-700">
                  <div className="flex justify-between gap-4"><span>Po zákonné srážce vám zůstává</span><strong>{formatKc(coverage.retainedAfterStatutoryDeduction)}</strong></div>
                  <div className="mt-1 flex justify-between gap-4"><span>Základní potřeby domácnosti</span><strong>− {formatKc(coverage.basicNeeds)}</strong></div>
                  <div className="mt-1 flex justify-between gap-4 border-t border-slate-700 pt-1 print:border-slate-300"><span>Nad základní potřeby zbývá</span><strong>{formatKc(coverage.availableAboveBasicNeeds)}</strong></div>
                  <div className="mt-2 flex justify-between gap-4 font-bold text-cyan-200 print:text-cyan-800">
                    <span>{ownFundsCoverDeficit ? 'K doplnění minima stačí' : 'Z vlastních peněz lze použít nejvýše'}</span>
                    <strong>{formatKc(coverage.maxDebtorPromise)}</strong>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-200 print:text-slate-700">
                    Kolik chcete každý měsíc přidávat? (Kč)
                  </label>
                  <input
                    type="number"
                    onFocus={selectZeroOnFocus}
                    onClick={selectZeroOnFocus}
                    min="0"
                    max={coverage.maxDebtorPromise}
                    step="1"
                    name={promiseKey}
                    value={coverage.effectiveDebtorPromise}
                    onChange={handlePromiseChange}
                    disabled={coverage.maxDebtorPromise <= 0}
                    className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 print:bg-white print:text-slate-900"
                  />
                  {coverage.maxDebtorPromise <= 0 ? (
                    <p className="mt-1 text-xs font-semibold text-amber-200 print:text-amber-800">
                      Podle zadaných údajů vám nad základními potřebami nezbývá částka použitelná pro příslib.
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-400 print:text-slate-600">
                      Nejvýše {formatKc(coverage.maxDebtorPromise)}. Vyšší částku kalkulačka pro splnění minima nepoužije.
                    </p>
                  )}
                </div>

                <div className="rounded-lg border border-cyan-800/70 bg-cyan-950/20 p-2.5 text-xs text-cyan-100 print:border-cyan-200 print:bg-cyan-50 print:text-cyan-900">
                  <div className="flex justify-between gap-4"><span>Po příslibu vám zůstane</span><strong>{formatKc(afterPromiseRetained)}</strong></div>
                  <div className="mt-1 flex justify-between gap-4"><span>Z toho nad zadané základní potřeby</span><strong>{formatKc(reserveAfterPromise)}</strong></div>
                </div>

                <details className="rounded-lg border border-slate-700 bg-slate-950/30 p-2.5 text-xs text-slate-300 print:border-slate-300 print:bg-white print:text-slate-700">
                  <summary className="cursor-pointer font-bold">Proč se závazný příslib omezuje?</summary>
                  <div className="mt-2 space-y-2 leading-relaxed">
                    <p><strong>Právně přesně:</strong> Dlužník může chybějící plnění hradit ze své nezabavitelné částky nebo z jiných nepostižitelných příjmů, nesmí tím však ohrozit své základní hmotné potřeby ani potřeby osob odkázaných výživou.</p>
                    <p><strong>Lidsky řečeno:</strong> Kalkulačka proto nepovolí pro příslib více, než vám podle zadaných potřeb zbývá, ani více, než kolik chybí do potřebného minima.</p>
                  </div>
                </details>
              </>
            ) : (
              <div className="rounded-lg border border-amber-500/40 bg-amber-950/25 p-2.5 text-xs font-semibold text-amber-200 print:border-amber-300 print:bg-amber-50 print:text-amber-800">
                Nejprve zadejte základní potřeby domácnosti. Teprve potom lze určit bezpečný strop příslibu.
              </div>
            )}
          </div>
        )}
      </div>

      {stillNeedsThirdParty && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 space-y-3 print:border-slate-300 print:bg-slate-50">
          <p className="text-sm font-bold text-slate-100 print:text-slate-800">
            Zbývá pokrýt {formatKc(coverage.deficitAfterDebtorPromise)}.
          </p>
          <label className="flex items-start gap-2 text-sm text-slate-100 print:text-slate-800">
            <input
              type="checkbox"
              checked={thirdPartyEnabled}
              onChange={(event) => onToggle(`povolitPlneniTretiOsoby${fieldSuffix}`, thirdPartyKey, event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-cyan-400"
            />
            <span>
              <strong>Chci chybějící částku pokrýt pomocí třetí osoby.</strong>
              <span className="mt-1 block text-xs font-normal text-slate-400 print:text-slate-600">Například rodiče, partnera nebo jiné osoby, která se zaváže pravidelně přispívat.</span>
            </span>
          </label>

          {thirdPartyEnabled && (
            <div className="pl-6">
              <label className="mb-1 block text-xs font-bold text-slate-200 print:text-slate-700">Kolik bude třetí osoba měsíčně hradit? (Kč)</label>
              <input
                type="number"
                onFocus={selectZeroOnFocus}
                onClick={selectZeroOnFocus}
                min="0"
                step="1"
                name={thirdPartyKey}
                value={data[thirdPartyKey] ?? ''}
                onChange={onAmountChange}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 print:bg-white print:text-slate-900"
                placeholder="Např. 500"
              />
              <p className="mt-1 text-xs text-slate-400 print:text-slate-600">Kalkulačka ověřuje pouze matematické pokrytí. Neposuzuje platnost závazku ani schopnost třetí osoby plnit.</p>
            </div>
          )}
        </div>
      )}

      <div className={`rounded-lg border p-3 text-sm font-bold ${
        coverage.finalDeficit === 0
          ? 'border-emerald-400/60 bg-emerald-950/35 text-emerald-100 print:border-emerald-300 print:bg-emerald-50 print:text-emerald-900'
          : 'border-rose-400/60 bg-rose-950/35 text-rose-100 print:border-rose-300 print:bg-rose-50 print:text-rose-900'
      }`}>
        {coverage.finalDeficit === 0 ? (
          <>
            <p>Minimum je pokryto.</p>
            <p className="mt-1 text-xs font-normal">Do minima se započítává {formatKc(coverage.statutoryDeduction)} zákonné srážky{coverage.debtorPromise > 0 ? ` + ${formatKc(coverage.debtorPromise)} příslibu` : ''}{coverage.thirdPartyContribution > 0 ? ` + ${formatKc(coverage.thirdPartyContribution)} od třetí osoby` : ''}.</p>
          </>
        ) : (
          <p>Do potřebného minima stále chybí {formatKc(coverage.finalDeficit)}.</p>
        )}
      </div>

      <details className="rounded-lg border border-slate-700 bg-slate-900/30 p-2.5 text-[11px] text-slate-400 print:border-slate-300 print:bg-white print:text-slate-600">
        <summary className="cursor-pointer font-bold text-slate-300 print:text-slate-700">Jak kalkulačka s doplňkovými zdroji pracuje?</summary>
        <div className="mt-2 space-y-2 leading-relaxed">
          <p><strong>Právně přesně:</strong> Doplňkové zdroje slouží v této verzi ke kontrole minimálního plnění. Model dlouhodobého uspokojení věřitelů pracuje pouze se zákonnou srážkou, protože pravidelnost a trvání příslibu nebo plnění třetí osoby musí být doloženy.</p>
          <p><strong>Lidsky řečeno:</strong> Příslib a pomoc třetí osoby kalkulačka používá jen pro ověření, zda je pokryto minimum pro vstup do oddlužení. Do dlouhodobého odhadu splacení dluhů je zatím nezapočítává.</p>
        </div>
      </details>


    </section>
  );
};
const INTEGER_DATA_FIELDS = new Set([
  'spolecneDeti',
  'vyzivovaneOsoby1',
  'vyzivovaneOsoby2',
  'osobySVykonemProVyzivne1',
  'osobySVykonemProVyzivne2',
]);

const createDefaultData = () => ({
  prijmy1: [{ id: 'p1-mzda', typ: 'mzda', castka: 0, pridelenaNezabavitelna: '' }],
  prijmy2: [{ id: 'p2-mzda', typ: 'mzda', castka: 0, pridelenaNezabavitelna: '' }],
  // Legacy pole zůstávají kvůli migraci starších uložených dat.
  prijemMzda1: 0,
  prijemDuchod1: 0,
  prijemDalsi1: 0,
  prijemMzda2: 0,
  prijemDuchod2: 0,
  prijemDalsi2: 0,
  chranenePrijmy1: 0,
  chranenePrijmy2: 0,
  vicePlatcu1: false,
  vicePlatcu2: false,
  spolecneDeti: 0,
  vyzivovaneOsoby1: 0,
  osobySVykonemProVyzivne1: 0,
  partnerProNezabavitelnou1: false,
  bezneMesicniVyzivne1: 0,
  povolitPrislibDluznika1: false,
  zakladniPotreby1: '',
  zavaznyPrislib1: '',
  povolitPlneniTretiOsoby1: false,
  pravidelnePlneniTretiOsoby1: '',
  vyzivovaneOsoby2: 0,
  osobySVykonemProVyzivne2: 0,
  bezneMesicniVyzivne2: 0,
  povolitPrislibDluznikaM: false,
  zakladniPotrebyM: '',
  zavaznyPrislibM: '',
  povolitPlneniTretiOsobyM: false,
  pravidelnePlneniTretiOsobyM: '',
  typPohledavky: 'neprednostni',
  pocetExekuci: '1-3',
  uplatnitPausalPlatce: false,
  delkaOddluzeni: 36,
  dluhyNezajistene: 0,
  dluhyZajistene: 0,
  dluhyNeosvoboditelne: 0,
  vytezekZpenezeni: 0,
});

const HlavniKalkulackaPage = () => {
  const [activeTab, setActiveTab] = useState('jednotlivec');
  const [lastPublicTab, setLastPublicTab] = useState('jednotlivec');
  const [desktopStarted, setDesktopStarted] = useState(false);
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
    const defaultData = createDefaultData();
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
  }, [data, params, activeTab]);

  const normalizeNumericValue = (name, value) => {
    const parsed = Number(value);
    const nonNegative = Math.max(0, Number.isFinite(parsed) ? parsed : 0);
    return INTEGER_DATA_FIELDS.has(name) ? Math.floor(nonNegative) : nonNegative;
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setData(prev => ({
      ...prev,
      [name]: type === 'checkbox'
        ? checked
        : (type === 'number' ? normalizeNumericValue(name, value) : value)
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

  const handleValueChange = (name, value) => {
    setData(prev => ({
      ...prev,
      [name]: value === '' ? '' : normalizeNumericValue(name, value),
    }));
  };

  const handleResetCalculation = () => {
    const confirmed = window.confirm(
      'Začít nový výpočet? Smažou se všechny zadané údaje kalkulačky. Odborné parametry výpočtu zůstanou zachované.'
    );
    if (!confirmed) return false;

    const freshData = createDefaultData();
    setData(freshData);
    setDluhyNezajisteneDraft('0');
    setEditingDluhyNezajistene(false);
    setActiveTab('jednotlivec');
    setLastPublicTab('jednotlivec');
    setDesktopStarted(false);
    return true;
  };

  const handleDesktopModeSelect = (mode) => {
    setActiveTab(mode);
    setLastPublicTab(mode);
    setDesktopStarted(true);
  };

  const handleDesktopTabChange = (mode) => {
    setActiveTab(mode);
    setLastPublicTab(mode);
  };

  const handleExpertSettingsToggle = () => {
    if (activeTab === 'nastaveni') {
      setActiveTab(lastPublicTab);
      return;
    }
    setLastPublicTab(activeTab);
    setActiveTab('nastaveni');
  };

  const hasActiveIncome = activeTab === 'manzele'
    ? (results.totalPrijem1 + results.totalPrijem2) > 0
    : results.totalPrijem1 > 0;

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
    <div className="calculator-page min-h-screen p-4 md:p-6 font-sans text-slate-800 print:p-0">
      <MobileKalkulackaWizard
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        data={data}
        setData={setData}
        results={results}
        params={params}
        dluhyNezajisteneDraft={dluhyNezajisteneDraft}
        setDluhyNezajisteneDraft={setDluhyNezajisteneDraft}
        commitDluhyNezajistene={commitDluhyNezajistene}
        handleIncomeSourcesChange={handleIncomeSourcesChange}
        handleMultiplePayersChange={handleMultiplePayersChange}
        onReset={handleResetCalculation}
        formatKc={formatKc}
      />

      <PrintableCalculationReport
        mode={activeTab}
        data={data}
        results={results}
        params={params}
      />

      <div className="desktop-calculator max-w-6xl mx-auto print:hidden">
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
          <div className="flex flex-wrap justify-end gap-2 print:hidden">
            {desktopStarted && activeTab !== 'nastaveni' && hasActiveIncome && (
              <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm">
                <Printer size={14} /> Tisk / PDF
              </button>
            )}
            {desktopStarted && activeTab !== 'nastaveni' && (
              <button onClick={handleResetCalculation} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm">
                <RotateCcw size={14} /> Nový výpočet
              </button>
            )}
            <button
              onClick={handleExpertSettingsToggle}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-500 rounded-lg text-xs font-bold hover:bg-slate-50 hover:text-slate-700 transition-colors"
            >
              <Settings size={14} /> {activeTab === 'nastaveni' ? 'Zpět ke kalkulačce' : 'Odborné nastavení'}
            </button>
          </div>
        </header>

        {!desktopStarted && activeTab !== 'nastaveni' && (
          <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-widest text-blue-700">Začněte tady</p>
            <h2 className="mt-2 text-2xl font-black text-slate-900">Co chcete spočítat?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              Vyberte svou situaci. Až potom se zobrazí potřebná pole a výsledek.
            </p>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <button
                type="button"
                onClick={() => handleDesktopModeSelect('jednotlivec')}
                className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-left transition hover:border-blue-400 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <span className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-white text-blue-700"><User size={20} /></span>
                <strong className="block text-base text-slate-900">Oddlužení jednotlivce</strong>
                <span className="mt-1 block text-sm leading-relaxed text-slate-600">Kolik se může měsíčně srážet, kolik vám zůstane a zda příjem stačí pro orientační minimum.</span>
              </button>

              <button
                type="button"
                onClick={() => handleDesktopModeSelect('manzele')}
                className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 text-left transition hover:border-indigo-400 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <span className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-white text-indigo-700"><Users size={20} /></span>
                <strong className="block text-base text-slate-900">Společné oddlužení manželů</strong>
                <span className="mt-1 block text-sm leading-relaxed text-slate-600">Samostatné srážky obou manželů a společný orientační výsledek.</span>
              </button>

              <button
                type="button"
                onClick={() => handleDesktopModeSelect('nezabavitelna')}
                className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-left transition hover:border-rose-400 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-400"
              >
                <span className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-white text-rose-700"><ShieldAlert size={20} /></span>
                <strong className="block text-base text-slate-900">Exekuční srážka</strong>
                <span className="mt-1 block text-sm leading-relaxed text-slate-600">Kolik vám může být z příjmu sraženo a kolik vám může orientačně zůstat.</span>
              </button>
            </div>
          </section>
        )}

        {desktopStarted && activeTab !== 'nastaveni' && (
          <nav className="flex flex-wrap p-1 bg-slate-200 rounded-xl mb-6 print:hidden" aria-label="Typ výpočtu">
            {[
              { id: 'jednotlivec', label: 'Oddlužení (Jednotlivec)', icon: User },
              { id: 'manzele', label: 'Oddlužení (Manželé)', icon: Users },
              { id: 'nezabavitelna', label: 'Exekuce (Srážky)', icon: ShieldAlert },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => handleDesktopTabChange(tab.id)}
                aria-pressed={activeTab === tab.id}
                className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all ${
                  activeTab === tab.id ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <tab.icon size={16} /><span>{tab.label}</span>
              </button>
            ))}
          </nav>
        )}

        {(desktopStarted || activeTab === 'nastaveni') && (
        <div className="grid lg:grid-cols-12 gap-6 print:block">
          {/* LEVÝ PANEL - Vstupy */}
          {activeTab !== 'nastaveni' && (
            <aside className="lg:col-span-5 space-y-4 print:hidden">
              
              {/* SEKCE 1: RODINA (SPOLEČNÉ ÚDAJE) */}
              {activeTab === 'manzele' && (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3 border-t-4 border-t-indigo-400">
                <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                  <Users size={14}/> 1. Společná situace rodiny
                </h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Tooltip text={activeTab === 'manzele'
                      ? 'Právně přesně: Společně vyživované dítě se při srážkách z příjmu obou manželů započítává do nezabavitelné částky každému z nich zvlášť.\n\nLidsky řečeno: Zadejte počet společných dětí, o které se spolu staráte. Kalkulačka je započítá každému z vás.'
                      : 'Právně přesně: Společně vyživované dítě se u jednotlivce započítá jako vyživovaná osoba, pokud jsou splněny zákonné podmínky.\n\nLidsky řečeno: Zadejte počet dětí, o které se staráte.'}>
                      <label htmlFor="spolecneDeti" className="block text-[10px] font-bold text-slate-600 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">
                        {activeTab === 'manzele' ? 'Společné děti' : 'Společné děti / děti ve společné péči'}
                      </label>
                    </Tooltip>
                    <input type="number" onFocus={selectZeroOnFocus} onClick={selectZeroOnFocus} id="spolecneDeti" min="0" step="1" name="spolecneDeti" value={data.spolecneDeti} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold" />
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
                  <User size={14}/> {activeTab === 'manzele' ? '2. Příjmy a status: Manžel A' : '1. Začněte svým příjmem'}
                </h3>
                
                {activeTab !== 'manzele' && (
                  <p className="rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-xs leading-relaxed text-blue-900">
                    Nejdřív zadejte alespoň jeden postižitelný příjem. Potom doplňte rodinnou situaci a další údaje níže.
                  </p>
                )}

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
                    <Tooltip text={activeTab === 'manzele'
                      ? "Právně přesně: Uveďte další osoby, kterým je tento dlužník povinen poskytovat výživné a které nejsou zahrnuty mezi společně vyživované děti. Za každou započitatelnou osobu se zvyšuje nezabavitelná částka o jednu čtvrtinu základní nezabavitelné částky.\n\nLidsky řečeno: Uveďte další osoby, které tento manžel vyživuje, například děti z předchozího vztahu. Společné děti sem už nepočítejte."
                      : "Právně přesně: Uveďte osoby, kterým jste povinen/povinna poskytovat výživné. Za každou započitatelnou osobu se zvyšuje nezabavitelná částka o jednu čtvrtinu základní nezabavitelné částky. Manžela/partnera sem nepočítejte; ten má zvláštní pravidlo.\n\nLidsky řečeno: Zadejte počet dětí a dalších osob, které vyživujete. Manžela nebo partnera sem nepočítejte."}>
                      <label htmlFor="vyzivovaneOsoby1" className="block text-[10px] font-bold text-slate-600 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">
                        {activeTab === 'manzele' ? 'Další vyživované osoby tohoto dlužníka' : 'Vyživované osoby'}
                      </label>
                    </Tooltip>
                    <input type="number" onFocus={selectZeroOnFocus} onClick={selectZeroOnFocus} id="vyzivovaneOsoby1" min="0" step="1" name="vyzivovaneOsoby1" value={data.vyzivovaneOsoby1} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm" />
                  </div>
                  <div>
                    <Tooltip text={"Právně přesně: Jedna čtvrtina nezabavitelné částky se nezapočítá na osobu, v jejíž prospěch byl nařízen výkon rozhodnutí nebo exekuce pro výživné, pokud toto vymáhání stále trvá.\n\nLidsky řečeno: Pokud dlužíte na výživném a kvůli tomu proti vám běží exekuce, osoba, na kterou výživné dlužíte, se vám do nezabavitelné částky nezapočítá."}>
                       <label htmlFor="osobySVykonemProVyzivne1" className="block text-[10px] font-bold text-amber-700 mb-1 w-fit cursor-help border-b border-dotted border-amber-600">Z toho osoby s vymáhaným výživným</label>
                    </Tooltip>
                    <input type="number" onFocus={selectZeroOnFocus} onClick={selectZeroOnFocus} id="osobySVykonemProVyzivne1" min="0" step="1" name="osobySVykonemProVyzivne1" value={data.osobySVykonemProVyzivne1} onChange={handleInputChange} max={(activeTab === 'manzele' ? data.spolecneDeti : 0) + data.vyzivovaneOsoby1 + (results.insM_A?.partnerZapocitan || results.insJ?.partnerZapocitan ? 1 : 0)} className="w-full p-2 bg-amber-50 border border-amber-200 rounded-lg font-bold text-amber-900 text-sm" />
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
                        <Tooltip text={"Právně přesně: Kalkulačka z vašich příjmů rozpoznala starobní důchod, invalidní důchod II. nebo III. stupně nebo sirotčí důchod. Pokud máte manžela/manželku nebo partnera/partnerku, započte se na něj/ni jedna čtvrtina nezabavitelné částky.\n\nLidsky řečeno: Pokud pobíráte starobní, invalidní důchod II. nebo III. stupně nebo sirotčí důchod a máte manžela nebo partnera, zvýší se vám nezabavitelná částka."}>
                          <span className="text-xs font-bold text-slate-700 cursor-help border-b border-dotted border-slate-400">Mám manžela/manželku nebo partnera/partnerku</span>
                        </Tooltip>
                      ) : (
                        <Tooltip text={"Právně přesně: Pokud rozhodný důchod nepobíráte vy, započte se na manžela/partnera jedna čtvrtina nezabavitelné částky jen tehdy, pokud byl starobní důchod, invalidní důchod II. nebo III. stupně nebo sirotčí důchod přiznán jemu/jí.\n\nLidsky řečeno: Pokud starobní, invalidní důchod II. nebo III. stupně nebo sirotčí důchod pobírá váš manžel nebo partner, zvýší se vám nezabavitelná částka."}>
                          <span className="text-xs font-bold text-slate-700 cursor-help border-b border-dotted border-slate-400">Manžel/partner pobírá důchod rozhodný pro zvýšení nezabavitelné částky</span>
                        </Tooltip>
                      )}
                    </label>
                  </div>
                )}

                {results.duchodPovinny1 && (
                  <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-100 text-[10px] text-blue-800 leading-relaxed space-y-1">
                    <p><strong>Rozpoznán rozhodný důchod – právně přesně:</strong> Kalkulačka automaticky zohlední zvláštní pravidla: tento důchod může za splnění dalších podmínek založit výjimku z režimu 4+ exekucí a při existenci manžela/partnera umožní započítat na něj/ni jednu čtvrtinu nezabavitelné částky.</p>
                    <p><strong>Lidsky řečeno:</strong> Zadaný důchod ovlivňuje výpočet srážky. Může zvýšit nezabavitelnou částku kvůli manželovi nebo partnerovi a u některých důchodců ovlivnit výši srážky při 4 a více exekucích.</p>
                  </div>
                )}

                {activeTab !== 'nezabavitelna' && (
                  <div className="pt-2 border-t border-slate-100">
                    <Tooltip text={"Právně přesně: Uveďte běžné zákonné výživné, které máte během oddlužení pravidelně hradit. Tato pohledávka se hradí před nezajištěnými věřiteli a ovlivňuje i minimální částku potřebnou pro oddlužení.\n\nLidsky řečeno: Uveďte měsíční výživné, které platíte na děti, které nemáte ve své péči."}>
                      <label htmlFor="bezneMesicniVyzivne1" className="block text-[10px] font-bold text-red-600 mb-1 w-fit cursor-help border-b border-dotted border-red-400">Běžné zákonné výživné hrazené během oddlužení (Kč)</label>
                    </Tooltip>
                    <input type="number" onFocus={selectZeroOnFocus} onClick={selectZeroOnFocus} id="bezneMesicniVyzivne1" min="0" name="bezneMesicniVyzivne1" value={data.bezneMesicniVyzivne1} onChange={handleInputChange} className="w-full p-2 bg-red-50 border border-red-200 rounded-lg outline-none font-bold text-red-800 text-sm" />
                  </div>
                )}
                <div className="pt-2 border-t border-slate-100">
                  <Tooltip text={"Právně přesně: Uveďte pouze příjmy, z nichž se podle pravidel srážek ze mzdy a jiných příjmů srážka neprovádí. Důchod, nemocenské, peněžitá pomoc v mateřství, podpora v nezaměstnanosti, DPP/DPČ ani nejednorázové dávky státní sociální podpory sem obecně nepatří.\n\nLidsky řečeno: Sem patří například příspěvek na péči, dávky pro osoby se zdravotním postižením, náhradní výživné, daňový bonus nebo výživné na dítě. Důchod, nemocenská, mateřská ani podpora v nezaměstnanosti sem nepatří."}>
                    <label htmlFor="chranenePrijmy1" className="block text-[10px] font-bold text-green-700 mb-1 w-fit cursor-help border-b border-dotted border-green-500">Jiné příjmy chráněné před srážkami (Kč)</label>
                  </Tooltip>
                  <input type="number" onFocus={selectZeroOnFocus} onClick={selectZeroOnFocus} id="chranenePrijmy1" min="0" name="chranenePrijmy1" value={data.chranenePrijmy1} onChange={handleInputChange} className="w-full p-2 bg-green-50 border border-green-200 rounded-lg outline-none font-bold text-green-900 text-sm" />
                </div>
              </div>

              {/* SEKCE 3: DLUŽNÍK 2 (JEN PRO MANŽELE) */}
              {activeTab === 'manzele' && (
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3 border-t-4 border-t-purple-400">
                  <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                    <User size={14}/> 3. Příjmy a status: Manžel B
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
                      <Tooltip text={"Právně přesně: Uveďte další osoby, kterým je druhý dlužník povinen poskytovat výživné a které nejsou zahrnuty mezi společně vyživované děti. Za každou započitatelnou osobu se zvyšuje jeho nezabavitelná částka o jednu čtvrtinu základní nezabavitelné částky.\n\nLidsky řečeno: Uveďte další osoby, které tento manžel vyživuje, například děti z předchozího vztahu. Společné děti sem už nepočítejte."}>
                        <label htmlFor="vyzivovaneOsoby2" className="block text-[10px] font-bold text-slate-600 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">Další vyživované osoby tohoto dlužníka</label>
                      </Tooltip>
                      <input type="number" onFocus={selectZeroOnFocus} onClick={selectZeroOnFocus} id="vyzivovaneOsoby2" min="0" step="1" name="vyzivovaneOsoby2" value={data.vyzivovaneOsoby2} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm" />
                    </div>
                    <div>
                      <Tooltip text={"Právně přesně: Uveďte počet vyživovaných osob druhého dlužníka, v jejichž prospěch právě trvá výkon rozhodnutí nebo exekuce pro výživné. Na takovou osobu se jedna čtvrtina nezabavitelné částky nezapočítává.\n\nLidsky řečeno: Pokud tento manžel dluží na výživném a kvůli tomu proti němu běží exekuce, osoba, na kterou výživné dluží, se mu do nezabavitelné částky nezapočítá."}>
                        <label htmlFor="osobySVykonemProVyzivne2" className="block text-[10px] font-bold text-amber-700 mb-1 w-fit cursor-help border-b border-dotted border-amber-600">Z toho osoby s vymáhaným výživným</label>
                      </Tooltip>
                      <input type="number" onFocus={selectZeroOnFocus} onClick={selectZeroOnFocus} id="osobySVykonemProVyzivne2" min="0" step="1" name="osobySVykonemProVyzivne2" value={data.osobySVykonemProVyzivne2} onChange={handleInputChange} max={data.spolecneDeti + data.vyzivovaneOsoby2 + (results.insM_B?.partnerZapocitan ? 1 : 0)} className="w-full p-2 bg-amber-50 border border-amber-200 rounded-lg font-bold text-amber-900 text-sm" />
                    </div>
                  </div>

                  {results.duchodPovinny2 && (
                    <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-100 text-[10px] text-purple-800 leading-relaxed space-y-1">
                      <p><strong>Rozpoznán rozhodný důchod – právně přesně:</strong> Kalkulačka jej automaticky použije při posouzení zvláštních pravidel srážek a při započtení manžela/partnera do nezabavitelné částky.</p>
                      <p><strong>Lidsky řečeno:</strong> Zadaný důchod ovlivňuje výpočet srážky a může zvýšit nezabavitelnou částku druhého manžela.</p>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100">
                    <Tooltip text={"Právně přesně: Uveďte běžné zákonné výživné druhého manžela hrazené během oddlužení. Hradí se před nezajištěnými věřiteli a zvyšuje potřebné minimální měsíční plnění.\n\nLidsky řečeno: Pokud druhý manžel pravidelně platí alimenty, napište je sem. Tyto peníze se v oddlužení hradí před běžnými nezajištěnými dluhy."}>
                      <label htmlFor="bezneMesicniVyzivne2" className="block text-[10px] font-bold text-red-600 mb-1 w-fit cursor-help border-b border-dotted border-red-400">Běžné zákonné výživné hrazené během oddlužení (M2, Kč)</label>
                    </Tooltip>
                    <input type="number" onFocus={selectZeroOnFocus} onClick={selectZeroOnFocus} id="bezneMesicniVyzivne2" min="0" name="bezneMesicniVyzivne2" value={data.bezneMesicniVyzivne2} onChange={handleInputChange} className="w-full p-2 bg-red-50 border border-red-200 rounded-lg outline-none font-bold text-red-800 text-sm" />
                  </div>
                  <div className="pt-2 border-t border-slate-100">
                    <Tooltip text={"Právně přesně: Uveďte pouze příjmy druhého manžela, z nichž se podle pravidel srážek ze mzdy a jiných příjmů srážka neprovádí. Kalkulačka právní povahu konkrétního příjmu sama neověřuje.\n\nLidsky řečeno: Sem patří například příspěvek na péči, dávky pro osoby se zdravotním postižením, náhradní výživné, daňový bonus nebo výživné na dítě. Důchod, nemocenská, mateřská ani podpora v nezaměstnanosti sem nepatří."}>
                      <label htmlFor="chranenePrijmy2" className="block text-[10px] font-bold text-green-700 mb-1 w-fit cursor-help border-b border-dotted border-green-500">Jiné příjmy chráněné před srážkami (Kč)</label>
                    </Tooltip>
                    <input type="number" onFocus={selectZeroOnFocus} onClick={selectZeroOnFocus} min="0" id="chranenePrijmy2" name="chranenePrijmy2" value={data.chranenePrijmy2} onChange={handleInputChange} className="w-full p-2 bg-green-50 border border-green-200 rounded-lg outline-none font-bold text-green-900 text-sm" />
                  </div>
                </div>
              )}

              {/* SEKCE 4: PARAMETRY ŘÍZENÍ A DLUHŮ */}
              {activeTab === 'nezabavitelna' ? (
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">2. Nastavení exekuce</h3>
                  <div>
                     <Tooltip text={"Právně přesně: Při nejméně čtyřech současně vedených výkonech rozhodnutí nebo exekucích k vymožení splatných peněžitých pohledávek se za zákonných podmínek srážejí dvě třetiny zbytku příjmu, i když jde jinak o nepřednostní dluh. Existuje zvláštní výjimka pro některé důchodce s nízkou jednou třetinou.\n\nLidsky řečeno: Pokud proti vám běží 4 nebo více exekucí, může se vám srážet více peněz než při 1–3 exekucích. U některých důchodců platí výjimka."}>
                       <label htmlFor="pocetExekuci" className="block text-[10px] font-bold text-slate-700 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">Počet souběžných exekucí</label>
                     </Tooltip>
                     <select id="pocetExekuci" name="pocetExekuci" value={data.pocetExekuci} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm">
                        <option value="1-3">1 až 3 exekuce</option>
                        <option value="4+">Nejméně 4 exekuce splňující podmínky pro srážku ze dvou třetin</option>
                     </select>
                  </div>
                  <div>
                     <Tooltip text={"Právně přesně: U nepřednostní pohledávky se zpravidla sráží jedna třetina zbytku příjmu. U přednostních pohledávek se srážejí dvě třetiny; mezi přednostní patří například výživné, náhrada újmy na zdraví, některé daně nebo pojistné. Výživné má v druhé třetině zvláštní pořadí.\n\nLidsky řečeno: Běžná půjčka nebo nezaplacená faktura je obvykle nepřednostní dluh. Přednostní jsou například dluhy na výživném, náhrada škody na zdraví, daně, dluhy na sociálním či zdravotním pojištění a některé přeplatky na dávkách. U přednostního dluhu je vyšší srážka."}>
                       <label htmlFor="typPohledavky" className="block text-[10px] font-bold text-slate-700 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">Druh pohledávky</label>
                     </Tooltip>
                     <select id="typPohledavky" name="typPohledavky" value={data.typPohledavky} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm">
                        <option value="neprednostni">Nepřednostní pohledávka</option>
                        <option value="prednostni">Přednostní pohledávka</option>
                        <option value="vyzivne">Pohledávka výživného</option>
                     </select>
                  </div>
                  <label className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200 w-fit cursor-pointer">
                    <input type="checkbox" name="uplatnitPausalPlatce" checked={data.uplatnitPausalPlatce} onChange={handleInputChange} className="mt-0.5 accent-blue-600" />
                    <Tooltip text={"Právně přesně: Plátci mzdy nebo jiného příjmu může náležet paušální náhrada nákladů až 50 Kč za měsíc, nejvýše však jedna třetina sražené částky zaokrouhlená nahoru. Tato náhrada se hradí z už provedené srážky, nikoli navíc z příjmu dlužníka.\n\nLidsky řečeno: Zaměstnavatel nebo jiný plátce si může ze sražených peněz ponechat až 50 Kč za zpracování srážky. Vám se tato částka nestrhne navíc, jen o ni méně odejde na dluh."}>
                      <span className="text-[10px] font-medium text-slate-700 cursor-help border-b border-dotted border-slate-400">Plátce příjmu uplatňuje paušální náhradu nákladů.</span>
                    </Tooltip>
                  </label>
                </div>
              ) : (
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3 border-t-4 border-t-slate-400">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">{activeTab === 'manzele' ? '4. Dluhy a majetek' : '2. Dluhy a majetek'}</h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                     <div>
                       <Tooltip text={"Právně přesně: Kalkulačka používá 36 měsíců jako standardní dobu oddlužení. Variantu 60 měsíců použijte zejména tehdy, pokud bylo dlužníku v posledních 20 letech před podáním nového návrhu přiznáno osvobození od placení pohledávek zahrnutých do předchozího oddlužení.\n\nLidsky řečeno: Oddlužení běžně trvá 3 roky. Pokud jste už v posledních 20 letech oddlužením prošli a byli osvobozeni od zbytku dluhů, trvá nové oddlužení 5 let."}>
                         <label htmlFor="delkaOddluzeni" className="block text-[10px] font-bold text-slate-600 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">Délka oddlužení</label>
                       </Tooltip>
                       <select id="delkaOddluzeni" name="delkaOddluzeni" value={data.delkaOddluzeni} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm">
                          <option value={36}>3 roky – standardní doba</option>
                          <option value={60}>5 let – předchozí osvobození v posledních 20 letech</option>
                       </select>
                     </div>
                     <div>
                       <Tooltip text={"Právně přesně: Zadejte odhad částky, která po případném zpeněžení majetku a souvisejících nákladech skutečně připadne nezajištěným věřitelům. Ne každý majetek musí být v oddlužení zpeněžen.\n\nLidsky řečeno: Pokud se v oddlužení bude prodávat váš majetek, odhadněte částku, která z jeho prodeje půjde na dluhy. Například peníze z prodeje auta."}>
                         <label htmlFor="vytezekZpenezeni" className="block text-[10px] font-bold text-green-700 mb-1 w-fit cursor-help border-b border-dotted border-green-500">Výtěžek ze zpeněžení majetku (Kč)</label>
                       </Tooltip>
                       <input type="number" onFocus={selectZeroOnFocus} onClick={selectZeroOnFocus} id="vytezekZpenezeni" min="0" name="vytezekZpenezeni" value={data.vytezekZpenezeni} onChange={handleInputChange} className="w-full p-2 bg-green-50 border border-green-200 rounded-lg font-bold text-green-900 text-sm" />
                     </div>
                  </div>
                  
                  <div>
                    <Tooltip text={"Právně přesně: Jde o pohledávky věřitelů, které nejsou zajištěny konkrétním majetkem. Z této částky kalkulačka počítá modelovou míru uspokojení nezajištěných věřitelů.\n\nLidsky řečeno: Uveďte běžné dluhy, za které neručíte konkrétním majetkem. Typicky půjčky, úvěry, kreditní karty, kontokorenty nebo nezaplacené faktury."}>
                      <label htmlFor="dluhyNezajistene" className="block text-[10px] font-bold text-indigo-700 mb-1 w-fit cursor-help border-b border-dotted border-indigo-400">Nezajištěné pohledávky věřitelů (Kč)</label>
                    </Tooltip>
                    <input
                      type="number"
                      id="dluhyNezajistene" name="dluhyNezajistene"
                      min="0"
                      value={dluhyNezajisteneDraft}
                      onFocus={(e) => {
                        selectZeroOnFocus(e);
                        setEditingDluhyNezajistene(true);
                      }}
                      onClick={selectZeroOnFocus}
                      onChange={(e) => setDluhyNezajisteneDraft(e.target.value)}
                      onBlur={commitDluhyNezajistene}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                      className="w-full p-2 bg-indigo-50 border border-indigo-200 rounded-lg font-bold text-indigo-900 text-sm"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Tooltip text={"Právně přesně: Zajištěný věřitel se v rozsahu zajištění uspokojuje ze zpeněžení majetku, kterým je jeho pohledávka zajištěna. Pokud hodnota zajištění nestačí, rozdíl se může za zákonných podmínek považovat za nezajištěnou pohledávku. Toto pole je zde informativní a nevstupuje přímo do modelového procenta nezajištěných věřitelů.\n\nLidsky řečeno: Uveďte dluhy, za které ručíte konkrétním majetkem, například hypotéku zajištěnou domem. Pokud se tento majetek v oddlužení prodá, peníze z prodeje jdou přednostně na tento dluh. Pokud nestačí na celý dluh, zbytek může pokračovat jako nezajištěný dluh."}>
                        <label htmlFor="dluhyZajistene" className="block text-[10px] font-bold text-slate-600 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">Zajištěné pohledávky (Kč)</label>
                      </Tooltip>
                      <input type="number" onFocus={selectZeroOnFocus} onClick={selectZeroOnFocus} id="dluhyZajistene" min="0" name="dluhyZajistene" value={data.dluhyZajistene} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                    </div>
                    <div>
                      <Tooltip text={"Právně přesně: Osvobození se nedotýká například zákonného výživného, náhrady škody způsobené na zdraví, škody způsobené úmyslným porušením právní povinnosti, některých peněžitých trestů nebo majetkových sankcí za úmyslný trestný čin a pohledávky insolvenčního správce na odměnu a hotové výdaje. Toto pole je informativní a nevstupuje do modelového procenta nezajištěných věřitelů.\n\nLidsky řečeno: Tyto dluhy se vám ani po úspěšném oddlužení neodpustí. Patří sem například dlužné výživné, náhrada škody na zdraví, škoda způsobená úmyslně nebo peněžitý trest za úmyslný trestný čin."}>
                        <label htmlFor="dluhyNeosvoboditelne" className="block text-[10px] font-bold text-slate-600 mb-1 w-fit cursor-help border-b border-dotted border-slate-400">Dluhy, které se oddlužením neodpouštějí (Kč)</label>
                      </Tooltip>
                      <input type="number" onFocus={selectZeroOnFocus} onClick={selectZeroOnFocus} id="dluhyNeosvoboditelne" min="0" name="dluhyNeosvoboditelne" value={data.dluhyNeosvoboditelne} onChange={handleInputChange} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
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
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Životní minimum</label><input type="number" onFocus={selectZeroOnFocus} onClick={selectZeroOnFocus} value={params.zivotniMinimum} onChange={(e) => setParams({...params, zivotniMinimum: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded font-bold" /></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Normativní nájemné – 1 osoba, obec 70 000+ obyvatel</label><input type="number" onFocus={selectZeroOnFocus} onClick={selectZeroOnFocus} value={params.normativniNajemne} onChange={(e) => setParams({...params, normativniNajemne: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded font-bold" /></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Energetický paušál</label><input type="number" onFocus={selectZeroOnFocus} onClick={selectZeroOnFocus} value={params.energetickyPausal} onChange={(e) => setParams({...params, energetickyPausal: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded font-bold" /></div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Odměny a náhrady</h4>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Měsíční odměna a hotové výdaje správce – jednotlivec</label><input type="number" onFocus={selectZeroOnFocus} onClick={selectZeroOnFocus} value={params.odmenaSpravceJednotlivec} onChange={(e) => setParams({...params, odmenaSpravceJednotlivec: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded font-bold" /></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Měsíční odměna a hotové výdaje správce – manželé</label><input type="number" onFocus={selectZeroOnFocus} onClick={selectZeroOnFocus} value={params.odmenaSpravceManzele} onChange={(e) => setParams({...params, odmenaSpravceManzele: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded font-bold" /></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Maximální paušální náhrada nákladů plátce</label><input type="number" onFocus={selectZeroOnFocus} onClick={selectZeroOnFocus} value={params.pausalniNahradaPlatce} onChange={(e) => setParams({...params, pausalniNahradaPlatce: parseFloat(e.target.value) || 0})} className="w-full p-2 border rounded font-bold" /></div>
                    
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 pt-4">Zákonné koeficienty a podmínky</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Tooltip text={"Právně přesně: Tento koeficient určuje, jaká část zákonného základu se použije pro výpočet základní nezabavitelné částky na dlužníka. Pro výpočty roku 2026 kalkulačka používá 85 %. Z této základní částky se následně odvozují i čtvrtiny za započitatelné vyživované osoby.\n\nLidsky řečeno: Hodnota určená zákonem pro výpočet nezabavitelné částky. Pro rok 2026 je 85 %. Běžně ji neměňte."}>
                          <label className="block text-xs font-bold text-slate-600 mb-1 w-full text-left cursor-help border-b border-dotted border-slate-400">Podíl pro základní nezabavitelnou částku (%)</label>
                        </Tooltip>
                        <input type="number" onFocus={selectZeroOnFocus} onClick={selectZeroOnFocus} value={params.koeficientZahladu} onChange={(e) => setParams({...params, koeficientZahladu: parseFloat(e.target.value) || 0})} className="w-full p-2 border border-blue-200 bg-blue-50 rounded font-bold text-sm" />
                      </div>
                      <div>
                        <Tooltip text={"Právně přesně: Tento koeficient se používá pro výpočet hranice, nad kterou je část zbytku příjmu po odečtení nezabavitelné částky postižitelná bez omezení. Pro rok 2026 kalkulačka používá násobek 1,9. Část nad takto vypočtenou hranicí se už nerozděluje na třetiny a připočítává se ke srážce celá.\n\nLidsky řečeno: Tato hodnota určuje hranici, nad kterou se část příjmu srazí celá. Pro rok 2026 je 1,9. Běžně ji neměňte."}>
                          <label className="block text-xs font-bold text-slate-600 mb-1 w-full text-left cursor-help border-b border-dotted border-slate-400">Násobek pro hranici srážky bez omezení</label>
                        </Tooltip>
                        <input type="number" onFocus={selectZeroOnFocus} onClick={selectZeroOnFocus} step="0.1" value={params.koeficientZabavitelnosti} onChange={(e) => setParams({...params, koeficientZabavitelnosti: parseFloat(e.target.value) || 0})} className="w-full p-2 border border-blue-200 bg-blue-50 rounded font-bold text-sm" />
                      </div>
                      <div className="col-span-2 rounded-lg border border-blue-100 bg-blue-50 p-3">
                        <Tooltip text={"Právně přesně: Tento limit není samostatně nastavovaná zákonná konstanta. Při posouzení výjimky z režimu 4+ exekucí u dlužníka s rozhodným důchodem se jedna třetina porovnává s částkou odpovídající měsíční odměně a hotovým výdajům insolvenčního správce pro jednotlivce. Kalkulačka proto limit odvozuje automaticky z aktuálně nastavené částky správce.\n\nLidsky řečeno: Tato hodnota slouží k posouzení výjimky pro některé důchodce se 4 a více exekucemi. Počítá se automaticky a běžně ji neměňte."}>
                          <span className="block text-xs font-bold text-slate-600 mb-1 border-b border-dotted border-slate-400 w-fit">Limit jedné třetiny pro výjimku u 4+ exekucí (odvozený)</span>
                        </Tooltip>
                        <strong className="text-sm text-blue-900">{params.odmenaSpravceJednotlivec.toLocaleString('cs-CZ')} Kč</strong>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-slate-100 mt-4 text-xs text-slate-600 leading-relaxed">
                      <strong>Minimum oddlužení se počítá automaticky.</strong>
                      <span className="block mt-1"><strong>Právně přesně:</strong> Kalkulačka vychází z pravidla „1 + 1“: měsíční odměna a hotové výdaje správce + alespoň stejná částka pro ostatní věřitele + zadané běžné zákonné výživné. Nejde o samostatně editovatelnou zákonnou konstantu.</span>
                      <span className="block mt-1"><strong>Lidsky řečeno:</strong> Pro vstup do oddlužení musíte každý měsíc uhradit alespoň odměnu a náklady insolvenčního správce, stejnou částku pro věřitele a případné běžné výživné. Potřebné minimum se spočítá automaticky.</span>
                    </div>
</div>
                </div>
              </div>
            )}

            {activeTab !== 'nastaveni' && !hasActiveIncome && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
                <p className="text-xs font-black uppercase tracking-widest text-blue-700">Výsledek</p>
                <h2 className="mt-2 text-xl font-black text-slate-900">Výsledek se zobrazí po zadání příjmu.</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Začněte vlevo zadáním čistého měsíčního příjmu. Teprve potom kalkulačka zobrazí srážku, zůstatek a případnou kontrolu minima.
                </p>
              </div>
            )}

            {activeTab !== 'nastaveni' && hasActiveIncome && (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-black uppercase tracking-widest text-blue-700">
                  {activeTab === 'manzele' ? '5. Výsledek' : '3. Výsledek'}
                </p>
              </div>
            )}

            {activeTab === 'nezabavitelna' && hasActiveIncome && (
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
                    titleTooltip={"Právně přesně: Jde o součet části postižitelného příjmu, která po provedení zákonné srážky zůstává dlužníkovi, a případných zadaných příjmů nepodléhajících srážkám. Není to totéž co samotná nezabavitelná částka – podle režimu vám může zůstat i jedna nebo dvě třetiny zbytku příjmu.\n\nLidsky řečeno: Orientačně tolik peněz vám po exekuční srážce může zůstat."}
                    value={results.ex.kVyplate} 
                    color="green" 
                    subtitle="Částka k výplatě po odečtení srážek."
                  >
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs text-green-800">
                        <Tooltip text={"Právně přesně: Nezabavitelná částka je základní část příjmu, kterou při výpočtu srážky nelze dlužníkovi srazit. Vychází ze zákonného základu a z počtu započitatelných vyživovaných osob.\n\nLidsky řečeno: To je část příjmu, kterou vám při srážce musí nechat. Podle vaší situace vám ale může zůstat i více."}>
                          <span className="cursor-help border-b border-dotted border-green-400">Nezabavitelná částka</span>
                        </Tooltip>
                        <strong>{results.ex.legalniMinimum.toLocaleString()} Kč</strong>
                      </div>
                      <div className="flex justify-between items-center text-xs text-green-800">
                        <Tooltip text={"Právně přesně: Jde o vámi zadané příjmy, u nichž kalkulačka předpokládá, že z nich nelze provádět srážky podle pravidel srážek ze mzdy a jiných příjmů. Kalkulačka jejich právní povahu sama neověřuje.\n\nLidsky řečeno: Sem patří například příspěvek na péči, dávky pro osoby se zdravotním postižením, náhradní výživné, daňový bonus nebo výživné na dítě. Důchod, nemocenská, mateřská ani podpora v nezaměstnanosti sem nepatří."}>
                          <span className="cursor-help border-b border-dotted border-green-400">Jiné příjmy chráněné před srážkami</span>
                        </Tooltip>
                        <strong>{data.chranenePrijmy1.toLocaleString()} Kč</strong>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-green-700 pt-1 mt-1 border-t border-green-200/50">
                        <Tooltip text={`Právně přesně: Po odečtení nezabavitelné částky se zkoumá zbytek příjmu. Pokud tento zbytek přesáhne ${results.ex.hranicePlneZabavitelna.toLocaleString()} Kč, vše nad tuto hranici je postižitelné bez omezení a připočítá se ke srážce.\n\nLidsky řečeno: Po odečtení nezabavitelné částky se vše nad tuto hranici srazí celé.`}>
                          <span className="cursor-help border-b border-dotted border-green-400">Hranice částky postižitelné bez omezení</span>
                        </Tooltip>
                        <strong>{results.ex.hranicePlneZabavitelna.toLocaleString()} Kč</strong>
                      </div>
                    </div>
                  </AnalyticCard>

                  <AnalyticCard 
                    title="Zákonná srážka" 
                    titleTooltip={"Právně přesně: Jde o celkovou částku, kterou lze podle zadaného typu pohledávky a režimu exekuce z příjmu srazit. Případná paušální náhrada plátce se hradí z této částky, nikoli navíc.\n\nLidsky řečeno: Orientačně jde o maximální částku, která vám může být z příjmu kvůli exekuci sražena."}
                    value={results.ex.srazka} 
                    color="red" 
                    subtitle={results.ex.forceTwoThirds ? "Uplatněna srážka ze DVOU třetin zbytku." : "Uplatněna srážka z JEDNÉ třetiny zbytku."}
                  >
                    <div className="flex justify-between items-center text-xs text-red-800">
                      <Tooltip text={"Právně přesně: Paušální náhrada nákladů plátce se uspokojuje ze sražené částky před ostatními pohledávkami. Nezvyšuje celkovou zákonnou srážku.\n\nLidsky řečeno: Tuto částku si ze sražených peněz ponechá zaměstnavatel nebo jiný plátce za zpracování srážky. Vám se nic dalšího nestrhává."}>
                        <span className="cursor-help border-b border-dotted border-red-400">Paušální náhrada nákladů plátce</span>
                      </Tooltip>
                      <strong>{results.ex.nahradaPlatci} Kč</strong>
                    </div>
                    {results.ex.nahradaPlatci > 0 && (
                      <div className="flex justify-between items-center text-xs text-red-800 mt-1 border-t border-red-100 pt-1">
                        <Tooltip text={"Právně přesně: Jde o část zákonné srážky, která po odečtení paušální náhrady plátci pokračuje k uspokojení vymáhaných pohledávek.\n\nLidsky řečeno: Tolik ze sražených peněz skutečně odejde na vaše dluhy."}>
                          <span className="cursor-help border-b border-dotted border-red-400">Část srážky po odečtení náhrady plátci</span>
                        </Tooltip>
                        <strong>{results.ex.srazkaCista.toLocaleString()} Kč</strong>
                      </div>
                    )}
                    {results.ex.exception4PlusApplied && (
                       <div className="mt-2 p-2 bg-red-100 rounded text-[10px] text-red-800 font-bold leading-tight print:border print:border-red-300">
                         Výjimka pro 4+ exekucí
                         <span className="mt-1 block font-normal"><strong>Právně přesně:</strong> Dlužník má rozhodný důchod a jedna třetina je pod zákonným limitem ({params.odmenaSpravceJednotlivec} Kč). Samotné pravidlo 4+ proto nezpůsobí připočtení druhé třetiny; případné přednostní pohledávky se posuzují samostatně.</span>
                         <span className="mt-1 block font-normal"><strong>Lidsky řečeno:</strong> Přestože proti vám běží 4 nebo více exekucí, v tomto případě se kvůli jejich počtu srážka nezvýší. Pokud ale máte přednostní dluh, například výživné, vyšší srážka se může použít z tohoto důvodu.</span>
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
                       <Tooltip text={"Právně přesně: Základní nezabavitelná částka na dlužníka je pro rok 2026 stanovena jako 85 % zákonného součtu; za každou započitatelnou vyživovanou osobu se přidává jedna čtvrtina základní nezabavitelné částky. Výsledná částka se zaokrouhluje podle zákonných pravidel.\n\nLidsky řečeno: To je část příjmu, kterou vám při srážce musí nechat. Pokud vyživujete další osoby, může být vyšší."}>
                         <p className="text-[9px] text-slate-500 uppercase font-bold mb-1 cursor-help border-b border-dotted border-slate-400 w-fit">Nezabavitelná částka</p>
                       </Tooltip>
                       <p className="font-black text-slate-800 text-lg">{results.ex.legalniMinimum.toLocaleString()}</p>
                       <p className="text-[8px] text-slate-400 mt-1">Započítán partner: {results.ex.partnerZapocitan ? 'ANO' : 'NE'}</p>
                     </div>
                     <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                       <Tooltip text={"Právně přesně: Po odečtení nezabavitelné částky a oddělení části postižitelné bez omezení se zbývající část příjmu sníží na nejbližší nižší částku dělitelnou třemi. Tato část se následně rozdělí na třetiny; případný zbytek 1–2 Kč zůstává dlužníkovi.\n\nLidsky řečeno: Tato část příjmu se rozdělí na tři stejné části. Podle typu dluhu se pak určí, kolik vám zůstane a kolik se srazí."}>
                         <p className="text-[9px] text-slate-500 uppercase font-bold mb-1 cursor-help border-b border-dotted border-slate-400 w-fit">Část příjmu určená k rozdělení na třetiny</p>
                       </Tooltip>
                       <p className="font-black text-slate-800 text-lg">{results.ex.zbytekKDeleni.toLocaleString()}</p>
                     </div>
                     <div className="p-3 bg-amber-50 rounded-lg border-l-2 border-amber-400">
                       <Tooltip text={"Právně přesně: Jedna třetina je třetina zákonem určené části zbytku příjmu. První třetina se používá na pohledávky, třetí třetina zůstává dlužníkovi a použití druhé třetiny závisí na typu pohledávky nebo na režimu 4+ exekucí.\n\nLidsky řečeno: Je to jedna ze tří stejných částí příjmu nad nezabavitelnou částkou. Podle typu dluhu a počtu exekucí se pak určí, kolik těchto třetin se srazí."}>
                         <p className="text-[9px] text-amber-800 uppercase font-bold mb-1 cursor-help border-b border-dotted border-amber-600 w-fit">Jedna třetina</p>
                       </Tooltip>
                       <p className="font-black text-amber-900 text-lg">{results.ex.tretina.toLocaleString()}</p>
                     </div>
                     <div className="p-3 bg-red-50 rounded-lg border-l-2 border-red-400">
                       <Tooltip text={`Právně přesně: Část zbytku příjmu nad hranici ${results.ex.hranicePlneZabavitelna.toLocaleString()} Kč je postižitelná bez omezení a připočítává se ke srážce.\n\nLidsky řečeno: Co je nad tuto hranici, už se nedělí na třetiny a srazí se celé.`}>
                         <p className="text-[9px] text-red-800 uppercase font-bold mb-1 cursor-help border-b border-dotted border-red-600 w-fit">Část postižitelná bez omezení</p>
                       </Tooltip>
                       <p className="font-black text-red-900 text-lg">{results.ex.plneZabavitelna.toLocaleString()}</p>
                     </div>
                  </div>

                  {/* VÝUKOVÝ MATEMATICKÝ BLOK - EXEKUCE */}
                  <details className="mt-5 pt-4 border-t border-slate-100">
                    <summary className="cursor-pointer text-sm font-black text-slate-700">Jak jsme k výsledku došli?</summary>
                    <div className="mt-3 space-y-1.5 text-[10px] text-slate-600 font-mono bg-slate-50 p-3 rounded border border-slate-100 overflow-x-auto whitespace-nowrap">
                      {renderMathStep1(results.ex, params)}
                      <p>2. <strong className="text-slate-700">Část příjmu nad nezabavitelnou částku:</strong> {results.ex.prijemPredSrazkou.toLocaleString()} (Příjem) - {results.ex.legalniMinimum.toLocaleString()} (Nezabavitelná částka) = {Math.max(0, results.ex.zbytekMzdyRaw).toLocaleString()} Kč</p>
                      {results.ex.zbytekMzdyRaw > 0 && (
                        <>
                          <p>3. <strong className="text-slate-700">Jedna třetina:</strong> {results.ex.zbytekKDeleni.toLocaleString()} (část po snížení na násobek 3) ÷ 3 = {results.ex.tretina.toLocaleString()} Kč (zaokrouhlovací zbytek {results.ex.zaokrouhlovaciZbytek} Kč dlužníkovi)</p>
                          <p>4. <strong className="text-slate-700">Srážka:</strong> {results.ex.forceTwoThirds ? '2' : '1'} × {results.ex.tretina.toLocaleString()} ({results.ex.forceTwoThirds ? ((data.typPohledavky === 'prednostni' || data.typPohledavky === 'vyzivne') ? 'přednostní pohledávka / výživné' : 'režim 4+ exekucí') : 'nepřednostní pohledávka'}) + {results.ex.plneZabavitelna.toLocaleString()} (část postižitelná bez omezení) = {results.ex.srazka.toLocaleString()} Kč</p>
                          <p>5. <strong className="text-slate-700">K výplatě:</strong> {results.ex.prijemPredSrazkou.toLocaleString()} (Příjem) - {results.ex.srazka.toLocaleString()} (Srážka){data.chranenePrijmy1 > 0 ? ` + ${data.chranenePrijmy1.toLocaleString()} (jiné příjmy chráněné před srážkami)` : ''} = {results.ex.kVyplate.toLocaleString()} Kč</p>
                        </>
                      )}
                    </div>
                  </details>
                </div>
              </div>
            )}

            {activeTab === 'jednotlivec' && hasActiveIncome && (
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
                  onValueChange={handleValueChange}
                  modeLabel="jednotlivce"
                  fieldSuffix="1"
                />

                <div className="grid sm:grid-cols-2 gap-4">
                  <AnalyticCard 
                    title="Zákonná měsíční srážka" 
                    titleTooltip={"Právně přesně: Při oddlužení plněním splátkového kalendáře se z příjmů dlužníka standardně odvádí částka ve stejném rozsahu, v jakém mohou být při výkonu rozhodnutí nebo exekuci uspokojeny přednostní pohledávky. Prakticky se tedy vychází ze dvou třetin zbytku příjmu a případné části postižitelné bez omezení.\n\nLidsky řečeno: Z vašeho příjmu vám zůstane zákonem chráněná část a z další části se vypočítá splátka pro oddlužení. Tohle je částka, která každý měsíc odchází do oddlužení ještě před jejím dalším rozdělením."}
                    value={results.insJ.srazka} 
                    color="slate" 
                    subtitle="Sráží se vždy jako pro přednostní pohledávky."
                  >
                    <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-2 mb-2">
                      <Tooltip text={"Právně přesně: Z měsíční částky určené pro oddlužení se hradí odměna a náhrada hotových výdajů insolvenčního správce. Kalkulačka tuto položku odečítá před výpočtem částky dostupné nezajištěným věřitelům.\n\nLidsky řečeno: V oddlužení je nutné kromě dluhů hradit také odměnu a hotové výdaje insolvenčního správce."}>
                        <span className="text-slate-500 cursor-help border-b border-dotted border-slate-400">Měsíční odměna a hotové výdaje insolvenčního správce</span>
                      </Tooltip>
                      <strong className="text-slate-700">-{params.odmenaSpravceJednotlivec} Kč</strong>
                    </div>
                    {data.bezneMesicniVyzivne1 > 0 && (
                       <div className="flex justify-between items-center text-xs text-red-600 bg-red-50 p-1.5 rounded">
                        <Tooltip text={"Právně přesně: Běžné zákonné výživné se v oddlužení hradí před nezajištěnými věřiteli. Kalkulačka proto zadané výživné odečítá před výpočtem částky, která zbývá na běžné nezajištěné pohledávky.\n\nLidsky řečeno: Alimenty mají přednost před běžnými dluhy. Pokud je platíte, nejdřív se z měsíčních peněz pro oddlužení uhradí výživné a až potom se dělí peníze mezi ostatní věřitele."}>
                          <span className="flex items-center gap-1 cursor-help border-b border-dotted border-red-400"><Gavel size={12}/> Běžné zákonné výživné</span>
                        </Tooltip>
                        <strong>-{data.bezneMesicniVyzivne1} Kč</strong>
                      </div>
                    )}
                  </AnalyticCard>

                  <AnalyticCard 
                    title="Orientačně pro nezajištěné věřitele" 
                    titleTooltip={"Právně přesně: Jde o modelovou část měsíční srážky, která po odečtení zadaných prioritních položek, zejména odměny a hotových výdajů správce a běžného výživného, zbývá pro nezajištěné věřitele. Skutečný rozvrh může ovlivnit i další pohledávky a náklady řízení.\n\nLidsky řečeno: Orientačně tolik z vaší měsíční splátky zbývá na běžné dluhy, například půjčky, kreditní karty nebo nezaplacené faktury."}
                    value={results.proVeriteleJ} 
                    color="indigo" 
                    subtitle="Modelová částka po odečtení správce a zadaného běžného výživného."
                  >
                    <div className="text-[11px] text-green-800 bg-green-50 p-2.5 rounded mt-2 border border-green-100 space-y-1.5">
                      <div className="flex justify-between items-center gap-3">
                        <Tooltip text={"Právně přesně: Jde o částku, která dlužníkovi zůstává po provedení zákonné srážky, ještě před případným dobrovolným plněním ze závazného příslibu. Příslib není další zákonnou srážkou; jde o dobrovolné plnění z peněz, které by jinak dlužníkovi zůstaly.\n\nLidsky řečeno: Orientačně tolik vám po zákonné srážce zůstane ještě před případným závazným příslibem."}>
                          <span className="cursor-help border-b border-dotted border-green-400">
                            {results.coverageJ.debtorPromise > 0 ? 'Po zákonné srážce zůstává' : 'Dlužníkovi po zákonné srážce zůstává'}
                          </span>
                        </Tooltip>
                        <strong className="text-sm whitespace-nowrap">{results.insJ.kVyplate.toLocaleString()} Kč</strong>
                      </div>

                      {results.coverageJ.debtorPromise > 0 && (
                        <>
                          <div className="flex justify-between items-center gap-3 text-slate-600">
                            <span>Závazný příslib dlužníka</span>
                            <strong className="whitespace-nowrap">−{Math.round(results.coverageJ.debtorPromise).toLocaleString()} Kč</strong>
                          </div>
                          <div className="flex justify-between items-center gap-3 pt-1.5 border-t border-green-200 font-bold text-green-900">
                            <span>Dlužníkovi po příslibu zbývá</span>
                            <strong className="text-sm whitespace-nowrap">{Math.max(0, Math.round(results.insJ.kVyplate - results.coverageJ.debtorPromise)).toLocaleString()} Kč</strong>
                          </div>
                        </>
                      )}
                    </div>
                  </AnalyticCard>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 print:break-inside-avoid">
                   {/* VÝUKOVÝ MATEMATICKÝ BLOK - INSOLVENCE JEDNOTLIVEC */}
                   <details>
                     <summary className="cursor-pointer text-sm font-black text-slate-700">Jak jsme k výsledku došli?</summary>
                     <div className="mt-3 space-y-1.5 text-[10px] text-slate-600 font-mono bg-slate-50 p-3 rounded border border-slate-100 overflow-x-auto whitespace-nowrap mb-6">
                     {renderMathStep1(results.insJ, params)}
                     <p>2. <strong className="text-slate-700">Část příjmu nad nezabavitelnou částku:</strong> {results.insJ.prijemPredSrazkou.toLocaleString()} (Příjem) - {results.insJ.legalniMinimum.toLocaleString()} (Nezabavitelná částka) = {Math.max(0, results.insJ.zbytekMzdyRaw).toLocaleString()} Kč</p>
                     {results.insJ.zbytekMzdyRaw > 0 && (
                       <>
                         <p>3. <strong className="text-slate-700">Jedna třetina:</strong> {results.insJ.zbytekKDeleni.toLocaleString()} (část po snížení na násobek 3) ÷ 3 = {results.insJ.tretina.toLocaleString()} Kč (zaokrouhlovací zbytek {results.insJ.zaokrouhlovaciZbytek} Kč dlužníkovi)</p>
                         <p>4. <strong className="text-slate-700">Srážka:</strong> 2 × {results.insJ.tretina.toLocaleString()} (Oddlužení bere 2/3) + {results.insJ.plneZabavitelna.toLocaleString()} (Nad limit) = {results.insJ.srazka.toLocaleString()} Kč</p>
                         <p>5. <strong className="text-slate-700">K výplatě:</strong> {results.insJ.prijemPredSrazkou.toLocaleString()} (Příjem) - {results.insJ.srazka.toLocaleString()} (Srážka){data.chranenePrijmy1 > 0 ? ` + ${data.chranenePrijmy1.toLocaleString()} (jiné příjmy chráněné před srážkami)` : ''} = {results.insJ.kVyplate.toLocaleString()} Kč</p>
                       </>
                     )}
                     </div>
                   </details>

                   <div className="bg-slate-900 p-6 rounded-xl shadow-sm text-white flex flex-col justify-between print:bg-white print:border print:text-black">
                     <div>
                       <Tooltip text={"Právně přesně: Jde o orientační modelovou míru uspokojení zadaných nezajištěných pohledávek. Nejde o soudem stanovený cíl ani o záruku výsledku. Skutečné plnění ovlivní zejména výše zjištěných pohledávek, změny příjmů, další prioritní pohledávky a náklady řízení. V této verzi se do dlouhodobého procenta nezapočítává závazný příslib ani plnění třetí osoby; ty slouží ke kontrole minimálního plnění.\n\nLidsky řečeno: Ukazuje odhad, kolik procent běžných dluhů byste při zadaných údajích mohli během oddlužení zaplatit. Skutečný výsledek se může změnit."}>
                         <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 cursor-help border-b border-dotted border-blue-500 w-fit print:text-gray-600 print:border-none">Orientační odhad splacení běžných dluhů</p>
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
                       {data.dluhyNeosvoboditelne > 0 && <li>• <strong>Dluhy, které se oddlužením neodpouštějí ({data.dluhyNeosvoboditelne.toLocaleString()} Kč):</strong> Osvobození se těchto pohledávek může podle jejich právního důvodu nedotýkat; konkrétní režim je nutné posoudit individuálně.</li>}
                     </ul>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'manzele' && hasActiveIncome && (
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
                  onValueChange={handleValueChange}
                  modeLabel="společné oddlužení manželů"
                  fieldSuffix="M"
                />

                <div className="grid sm:grid-cols-2 gap-4">
                  <AnalyticCard 
                    title="Celková měsíční srážka manželů" 
                    titleTooltip={"Právně přesně: Srážka se vypočte samostatně z příjmu každého manžela podle pravidel oddlužení a následně se obě částky sečtou. Nejde o jednu srážku vypočtenou ze společného příjmu domácnosti.\n\nLidsky řečeno: Srážka se vypočítá každému z manželů zvlášť. Tady vidíte jejich součet."}
                    value={results.srazkaCelkemM} 
                    color="slate" 
                    subtitle="Součet samostatně vypočtených srážek obou manželů."
                  >
                    <div className="flex justify-between items-center text-xs">
                      <Tooltip text={"Právně přesně: U každého manžela se zákonná srážka stanoví samostatně z jeho vlastních příjmů a jeho započitatelných údajů.\n\nLidsky řečeno: Tady vidíte, kolik se srazí každému z manželů zvlášť."}>
                        <span className="text-slate-500 cursor-help border-b border-dotted border-slate-400">Srážka Manžel A / Manžel B</span>
                      </Tooltip>
                      <strong className="text-slate-700">{results.insM_A.srazka.toLocaleString()} / {results.insM_B.srazka.toLocaleString()} Kč</strong>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-400 mt-2 border-t pt-2">
                      <Tooltip text={"Právně přesně: U společného oddlužení manželů se z měsíční částky hradí odměna a náhrada hotových výdajů insolvenčního správce v částce stanovené pro společné oddlužení. Kalkulačka ji odečítá před výpočtem částky pro nezajištěné věřitele.\n\nLidsky řečeno: V oddlužení je nutné kromě dluhů hradit také odměnu a hotové výdaje insolvenčního správce."}>
                        <span className="cursor-help border-b border-dotted border-slate-400">Měsíční odměna a hotové výdaje správce – manželé</span>
                      </Tooltip>
                      <span>-{params.odmenaSpravceManzele} Kč</span>
                    </div>
                    {(data.bezneMesicniVyzivne1 > 0 || data.bezneMesicniVyzivne2 > 0) && (
                      <div className="flex justify-between items-center text-[10px] text-red-500 mt-1">
                        <Tooltip text={"Právně přesně: Běžné zákonné výživné obou manželů se hradí před nezajištěnými věřiteli a snižuje částku dostupnou pro jejich běžné dluhy.\n\nLidsky řečeno: Pokud některý z manželů platí alimenty, ty se musí zaplatit dříve než půjčky a ostatní běžné dluhy."}>
                          <span className="cursor-help border-b border-dotted border-red-300">Běžné zákonné výživné celkem</span>
                        </Tooltip>
                        <span>-{data.bezneMesicniVyzivne1 + data.bezneMesicniVyzivne2} Kč</span>
                      </div>
                    )}
                  </AnalyticCard>

                  <AnalyticCard 
                    title="Orientačně pro nezajištěné věřitele" 
                    titleTooltip={"Právně přesně: Jde o modelovou část součtu měsíčních srážek obou manželů, která po odečtení zadaných prioritních položek zbývá pro nezajištěné věřitele. Skutečné plnění může ovlivnit i další pohledávky a náklady řízení.\n\nLidsky řečeno: Orientačně tolik ze společné měsíční splátky zbývá na běžné dluhy manželů."}
                    value={results.proVeriteleM} 
                    color="indigo" 
                    subtitle="Společná částka k rozvrhu po odečtení priorit."
                  >
                    <div className="text-[11px] text-green-800 bg-green-50 p-2.5 rounded mt-2 border border-green-100 space-y-1.5">
                      <div className="flex justify-between items-center gap-3">
                        <Tooltip text={"Právně přesně: Jde o součet částek, které oběma manželům zůstávají po zákonných srážkách, ještě před případným dobrovolným závazným příslibem.\n\nLidsky řečeno: Tohle jsou peníze, které manželům dohromady zůstanou po povinných srážkách. Pokud se zavážou platit ještě něco navíc ze svých peněz, níže se tato částka odečte."}>
                          <span className="cursor-help border-b border-dotted border-green-400">
                            {results.coverageM.debtorPromise > 0 ? 'Po zákonných srážkách manželům zůstává' : 'Manželům po zákonných srážkách zůstává celkem'}
                          </span>
                        </Tooltip>
                        <strong className="text-sm whitespace-nowrap">{results.kVyplateCelkemM.toLocaleString()} Kč</strong>
                      </div>
                      {results.coverageM.debtorPromise > 0 && (
                        <>
                          <div className="flex justify-between items-center gap-3 text-slate-600">
                            <span>Závazný příslib manželů</span>
                            <strong className="whitespace-nowrap">−{Math.round(results.coverageM.debtorPromise).toLocaleString()} Kč</strong>
                          </div>
                          <div className="flex justify-between items-center gap-3 pt-1.5 border-t border-green-200 font-bold text-green-900">
                            <span>Manželům po příslibu zbývá</span>
                            <strong className="text-sm whitespace-nowrap">{Math.max(0, Math.round(results.kVyplateCelkemM - results.coverageM.debtorPromise)).toLocaleString()} Kč</strong>
                          </div>
                        </>
                      )}
                    </div>
                  </AnalyticCard>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 print:break-inside-avoid">
                   <div className="bg-slate-900 p-6 rounded-xl shadow-sm text-white flex flex-col justify-between print:bg-white print:border print:text-black">
                     <div>
                       <Tooltip text={"Právně přesně: Jde o orientační modelovou míru uspokojení zadaných nezajištěných pohledávek. Nejde o soudem stanovený cíl ani o záruku výsledku. Skutečné plnění ovlivní zejména výše zjištěných pohledávek, změny příjmů, další prioritní pohledávky a náklady řízení. V této verzi se do dlouhodobého procenta nezapočítává závazný příslib ani plnění třetí osoby; ty slouží ke kontrole minimálního plnění.\n\nLidsky řečeno: Ukazuje odhad, kolik procent běžných dluhů byste při zadaných údajích mohli během oddlužení zaplatit. Skutečný výsledek se může změnit."}>
                         <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 cursor-help border-b border-dotted border-blue-500 w-fit print:text-gray-600 print:border-none">Orientační odhad splacení běžných dluhů</p>
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

            {activeTab !== 'nastaveni' && hasActiveIncome && (
              <div className="mt-8 p-4 bg-slate-100 rounded-xl border border-slate-200 text-[10px] text-slate-500 leading-relaxed print:text-black print:border-none print:bg-transparent">
                <strong>Doložka k výsledku:</strong> Kalkulačka pracuje s právním stavem pro příjmy vyplácené v roce 2026 a poskytuje orientační výsledek. U exekucí nerozpočítává pořadí několika souběžných pohledávek mezi jednotlivé věřitele. Při více plátcích je přesný výpočet možný pouze tehdy, jsou-li zadány části nezabavitelné částky určené jednotlivým plátcům; bez nich je výsledek označen jako orientační. U oddlužení je míra uspokojení modelová a nezohledňuje všechny náklady řízení, budoucí změny příjmů ani všechny další prioritní pohledávky. Kalkulačka neposuzuje skutečnou udržitelnost závazného příslibu, platnost závazku třetí osoby ani to, zda soud oddlužení povolí nebo schválí.
              </div>
            )}
          </main>
        </div>
        )}
      </div>
    </div>
  );
};

export default HlavniKalkulackaPage
