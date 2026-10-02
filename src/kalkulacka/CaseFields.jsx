import React, { useId } from 'react';
import {
  INCOME_TYPES, OPTIONAL_FIELDS, present, number, readNumber, optionalOpen, toggleOptional,
  setIncomeSources, confirmNoIncome, feeEligible, formatKc, incomeReady, MODEL_NOTE,
} from './caseState.js';
import { groupPayers, moveIncomeToPayer, removeIncomeSource } from './calculateCase.js';

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400';
let nextId = 1;
export const uniqueId = () => globalThis.crypto?.randomUUID?.() || `income-${Date.now()}-${nextId++}`;
export function NumberField({ field, label, value, onChange, integer = false, max, hint, error, money = !integer, disabled = false }) {
  const id = useId();
  return <div className="space-y-1.5" data-field={field}>
    <label htmlFor={id} className="block text-sm font-bold text-slate-800">{label}{money && ' (Kč)'}</label>
    <input id={id} name={field} type="number" inputMode={integer ? 'numeric' : 'decimal'} min="0" max={max} step={integer ? '1' : '0.01'}
      value={value ?? ''} disabled={disabled} onFocus={e => { if (e.currentTarget.value === '0') e.currentTarget.select(); }}
      onChange={e => onChange(readNumber(e.target.value))} className={inputClass}
      aria-invalid={Boolean(error)} aria-describedby={[hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined} />
    {hint && <p id={`${id}-hint`} className="text-xs leading-relaxed text-slate-500">{hint}</p>}
    {error && <p id={`${id}-error`} role="alert" className="text-sm font-bold text-red-700">{error}</p>}
  </div>;
}
export function Choice({ checked, onChange, children, hint, controls }) {
  return <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
    <input type="checkbox" checked={Boolean(checked)} onChange={e => onChange(e.target.checked)}
      aria-controls={controls} aria-expanded={controls ? Boolean(checked) : undefined} className="mt-1 h-5 w-5 shrink-0 accent-blue-600" />
    <span className="text-sm font-bold text-slate-800">{children}{hint && <span className="mt-1 block text-xs font-normal leading-relaxed text-slate-500">{hint}</span>}</span>
  </label>;
}
function SelectField({ field, label, value, onChange, options }) {
  const id = useId();
  return <div><label className="mb-1.5 block text-sm font-bold text-slate-800" htmlFor={id}>{label}</label>
    <select id={id} name={field} className={inputClass} value={value} onChange={e => onChange(e.target.value)}>
      {options.map(([key,text]) => <option key={key} value={key}>{text}</option>)}
    </select></div>;
}
function OptionalNumber({ data, setData, field, question, label, hint, legal, errors, integer, max }) {
  const id = useId();
  const open = optionalOpen(data,field);
  return <div className="space-y-3">
    <Choice checked={open} controls={id} onChange={checked => setData(prev => toggleOptional(prev,field,checked))} hint={hint}>{question}</Choice>
    <div id={id} hidden={!open}>{open && <NumberField field={field} label={label} integer={integer} max={max}
      value={data[field]} error={errors.find(e => e.field === field)?.message}
      onChange={value => setData(prev => ({ ...prev, [field]: value }))} />}</div>
    {legal && <details className="text-xs leading-relaxed text-slate-500"><summary className="cursor-pointer font-bold">Právně přesně</summary><p className="mt-2">{legal}</p></details>}
  </div>;
}
function IncomeFields({ data, setData, person, errors }) {
  const key = `prijmy${person}`;
  const sources = data[key];
  const multiple = data[`vicePlatcu${person}`];
  const groups = groupPayers(sources);
  const change = (id,patch) => setData(prev => setIncomeSources(prev,person,prev[key].map(s => s.id === id ? { ...s, ...patch } : s)));
  const setGroup = (source,group) => {
    const groupId = group === 'new' ? uniqueId() : group;
    setData(prev => setIncomeSources(prev,person,moveIncomeToPayer(prev[key],source.id,groupId)));
  };
  return <div className="space-y-4">
    <p className="text-sm text-slate-600">Začněte částkou, kterou byste dostali, kdyby se z ní nestrhávaly peníze na dluhy. Další příjem přidáte tlačítkem níže.</p>
    {sources.map((s,index) => <div key={s.id} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3"><strong className="text-sm text-slate-800">Příjem {index+1}</strong>
        {sources.length > 1 && <button type="button" className="min-h-10 px-2 text-sm font-bold text-red-700" onClick={() => setData(prev => setIncomeSources(prev,person,removeIncomeSource(prev[key],s.id)))}>Odebrat příjem {index+1}</button>}
      </div>
      <SelectField label="Typ příjmu" field={`${key}-${index}-typ`} value={s.typ} options={INCOME_TYPES} onChange={typ => change(s.id,{typ, narokNaPausalOveren:false, uplatnitPausal:false})} />
      <NumberField label="Čistá měsíční částka" field={`${key}-${index}-castka`} value={s.castka} onChange={castka => change(s.id,{castka})}
        hint="U mzdy jde o částku po dani a pojištění, ale ještě před srážkou na dluhy." />
      {multiple && sources.length > 1 && <SelectField label={`Plátce příjmu ${index+1}`} field={`${key}-${index}-platce`} value={s.platceId || s.id}
        options={[...groups.map((g,i) => [g.id,`Plátce ${i+1} (příjmy ${g.sources.map(x => sources.indexOf(x)+1).join(', ')})`]),['new','Nový samostatný plátce']]}
        onChange={group => setGroup(s,group)} />}
    </div>)}
    <button type="button" className="w-full rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-700"
      onClick={() => setData(prev => setIncomeSources(prev,person,[...prev[key],{id:uniqueId(),typ:'mzda',castka:'',pridelenaNezabavitelna:''}]))}>Přidat další příjem</button>
    {sources.length > 1 && <Choice checked={multiple} onChange={checked => setData(prev => ({...prev,[`vicePlatcu${person}`]:checked}))}
      hint="Například mzdu od zaměstnavatele a důchod od ČSSZ. Když dva příjmy vyplácí stejný zaměstnavatel nebo instituce, vyberte u nich stejného plátce.">Dostáváte příjmy od více zaměstnavatelů nebo institucí?</Choice>}
    {multiple && groups.length > 1 && <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <p className="text-xs leading-relaxed text-amber-900">Uveďte podle rozhodnutí nebo pokynu, kolik má každý plátce ponechat bez srážky. Nevíte částku? Nechte pole prázdné. Bez úplného rozdělení bude výsledek jen souhrnným odhadem; nulu vyplňte pouze tehdy, byla-li skutečně určena.</p>
      {groups.map((g,i) => <NumberField key={g.id} field={`${key}-allocation-${i}`} label={`Nezabavitelná částka – plátce ${i+1}`}
        value={g.source.pridelenaNezabavitelna} onChange={pridelenaNezabavitelna => change(g.source.id,{pridelenaNezabavitelna})} />)}
    </div>}
    {sources.every(s => !present(s.castka) || Number(s.castka) === 0) && <Choice checked={data[`bezPostizitelnehoPrijmu${person}`]}
      onChange={checked => setData(prev => confirmNoIncome(prev,person,checked))} hint="Nemáte mzdu, důchod ani jiný příjem pro výpočet srážky? Zaškrtněte tuto možnost. Například příspěvek na péči nebo přijaté výživné můžete uvést později.">Nemám žádný postižitelný příjem</Choice>}
    {errors.filter(e => e.field === key).map((e,i) => <p key={i} role="alert" className="text-sm font-bold text-red-700">{e.message}</p>)}
  </div>;
}
function MinimumFields({ data, setData, mode, results, errors }) {
  const suffix = mode === 'manzele' ? 'M' : '1';
  const c = mode === 'manzele' ? results.coverageM : results.coverageJ;
  const promiseKey = 'zavaznyPrislib'+suffix, thirdKey = 'pravidelnePlneniTretiOsoby'+suffix, needsKey = 'zakladniPotreby'+suffix;
  const promiseEnabled = data['povolitPrislibDluznika'+suffix], thirdEnabled = data['povolitPlneniTretiOsoby'+suffix];
  const set = (key,value) => setData(prev => ({...prev,[key]:value}));
  const toggle = (flag,field,checked) => setData(prev => ({...prev,[flag]:checked,...(!checked ? {[field]:''} : {})}));
  // The missing payment is not the household's spending capacity. Keep both
  // concepts separate; all amounts used for coverage still come from the core.
  const missing = c.deficitAfterStatutoryDeduction;
  const remaining = c.deficitAfterDebtorPromise;
  const retained = c.retainedAfterStatutoryDeduction;
  const afterOwnPayment = Math.max(0, retained - c.debtorPromise);
  const needsError = errors.find(e => e.field === needsKey)?.message;
  const promiseError = errors.find(e => e.field === promiseKey)?.message;
  const thirdError = errors.find(e => e.field === thirdKey)?.message;
  const needsKnown = c.basicNeedsDeclared && !needsError;
  const ownPaymentKnown = present(data[promiseKey]) && !promiseError;
  const showOwn = missing > 0 || promiseEnabled || present(data[promiseKey]) || present(data[needsKey]);
  // Never hide an existing contribution merely because the user's own payment
  // now covers the shortfall. It must remain available to review or switch off.
  const showThird = remaining > 0 || thirdEnabled || present(data[thirdKey]);
  const hasErrors = Boolean(needsError || promiseError || thirdError);
  return <div className="space-y-4" data-testid="minimum-funding">
    <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900" data-testid="funding-need">
      <p className="font-bold">{missing > 0
        ? `Do potřebné měsíční splátky chybí ${formatKc(missing)}.`
        : 'Samotná srážka už potřebné měsíční minimum pokrývá. Nic navíc není potřeba doplňovat.'}</p>
      {missing > 0 && <p>Tuto částku je potřeba zajistit navíc k vypočtené srážce. Můžete ji doplnit ze svých zbývajících peněz, pomocí jiné osoby nebo kombinací obojího.</p>}
      <p>Po srážce vám{mode === 'manzele' ? ' společně' : ''} zůstává <strong>{formatKc(retained)}</strong>.</p>
      {missing > 0 && (retained >= missing
        ? <p>Pokud z těchto peněz doplníte celých {formatKc(missing)}, na živobytí vám zůstane <strong>{formatKc(retained - missing)} měsíčně</strong>.</p>
        : <p>Samotné peníze po srážce na celé doplnění nestačí. Nejdřív je potřeba ponechat peníze na živobytí; zbytek musí pokrýt jiná pomoc.</p>)}
    </div>
    {showOwn && <>
      <Choice checked={promiseEnabled} onChange={checked => toggle('povolitPrislibDluznika'+suffix,promiseKey,checked)}
        hint="Nejdřív porovnáme, kolik vám po doplacení zůstane, s částkou, kterou potřebujete na živobytí.">Chci chybějící částku nebo její část hradit ze svých peněz</Choice>
      {(promiseEnabled || present(data[promiseKey]) || present(data[needsKey])) && <div className="space-y-3">
        {!promiseEnabled && <p className="text-sm text-amber-800">Tuto dříve zadanou platbu teď nepočítáme. Zapněte možnost výše, nebo částku vymažte.</p>}
        <NumberField field={needsKey} label="Kolik z těchto peněz potřebujete každý měsíc na živobytí?" value={data[needsKey]} onChange={v => set(needsKey,v)}
          hint="Počítejte bydlení, jídlo a další nutné výdaje, které z těchto peněz hradíte. Kalkulačka vychází z vašeho odhadu; sama neposoudí, zda vám tato částka stačí." error={needsError} />
        {promiseEnabled && needsKnown && <p className="text-sm text-slate-700" data-testid="own-budget">{c.basicNeeds > retained
          ? `Na zadané živobytí vám už po srážce chybí ${formatKc(c.basicNeeds - retained)}. Podle tohoto rozpočtu z vlastních peněz na doplnění splátky nic nezbývá.`
          : `Po ponechání ${formatKc(c.basicNeeds)} na živobytí vám z vlastních peněz zbývá ${formatKc(c.availableAboveBasicNeeds)}.`}</p>}
        <NumberField field={promiseKey} label={missing > 0
          ? `Kolik z chybějících ${formatKc(missing)} budete měsíčně hradit ze svých peněz?`
          : 'Dříve zadaná měsíční platba ze svých peněz'}
          value={data[promiseKey]} onChange={v => set(promiseKey,v)} error={promiseError} />
        {promiseEnabled && !needsKnown && <p className="text-sm text-slate-700">Nejdřív uveďte platnou částku na živobytí. Pak ukážeme, kolik z chybějící splátky můžete podle svého rozpočtu doplnit.</p>}
        {promiseEnabled && needsKnown && ownPaymentKnown && <div className="space-y-2 text-sm text-slate-700" data-testid="own-funding-summary">
          <p className="font-bold">{c.debtorPromise > 0
            ? (remaining === 0 ? `Chybějících ${formatKc(missing)} doplníte ze svých peněz.` : `Ze svých peněz doplníte ${formatKc(c.debtorPromise)} měsíčně.`)
            : 'Z vašich peněz teď do doplnění minima nic nezapočítáváme.'}</p>
          <p>Po této platbě vám zůstane <strong>{formatKc(afterOwnPayment)} měsíčně</strong>.</p>
          {c.debtorPromise > 0 && afterOwnPayment >= c.basicNeeds && <p>Podle zadaného rozpočtu vám zůstává alespoň částka, kterou jste uvedli na živobytí.</p>}
          {c.promiseWasLimited && <div role="status" className="space-y-1 text-amber-800">
            {number(data[promiseKey]) > c.availableAboveBasicNeeds && <p>Zadali jste {formatKc(data[promiseKey])}, ale po ponechání peněz na živobytí vám zbývá jen {formatKc(c.availableAboveBasicNeeds)}.</p>}
            {number(data[promiseKey]) > missing && <p>K doplnění celého minima je potřeba {formatKc(missing)}, nikoli celá zadaná platba {formatKc(data[promiseKey])}.</p>}
            <p>V této kontrole proto z vaší platby započítáváme {formatKc(c.debtorPromise)}. Zadanou částku jsme nesmazali; uvedený zůstatek vychází pouze ze započtené platby.</p>
          </div>}
        </div>}
      </div>}
    </>}
    {showThird && <div className="space-y-3" data-testid="third-party-funding">
      <p className="text-sm font-bold text-slate-800">{remaining > 0
        ? `Po započtení vašich peněz je potřeba zajistit ještě ${formatKc(remaining)} měsíčně.`
        : 'Minimum je už pokryté bez této pomoci. Dříve zadaný příspěvek zůstává dostupný ke kontrole a úpravě.'}</p>
      <Choice checked={thirdEnabled} onChange={checked => toggle('povolitPlneniTretiOsoby'+suffix,thirdKey,checked)}
        hint="Například rodič, partner nebo jiná osoba, která se zaváže pravidelně přispívat.">{remaining > 0
          ? 'Bude vám tuto částku nebo její část pravidelně poskytovat někdo jiný?'
          : 'Chci dál počítat s dříve zadanou pomocí jiné osoby'}</Choice>
      {(thirdEnabled || present(data[thirdKey])) && <>
        {!thirdEnabled && <p className="text-sm text-amber-800">Tuto dříve zadanou pomoc teď nepočítáme. Zapněte možnost výše, nebo částku vymažte.</p>}
        <NumberField field={thirdKey} label="Kolik vám bude tato osoba měsíčně přispívat?" value={data[thirdKey]} onChange={v => set(thirdKey,v)} error={thirdError}
          hint="Počítejte jen s pravidelnou pomocí. Zda je dohoda platná a druhá osoba bude schopná platit, kalkulačka neověřuje." />
        {thirdEnabled && !thirdError && <p className="text-sm text-slate-700">K doplnění minima z této pomoci potřebujete {formatKc(Math.min(c.thirdPartyContribution,remaining))}.</p>}
      </>}
    </div>}
    <p className="text-sm font-bold text-slate-800" data-testid="funding-status">{hasErrors
      ? 'Nejdřív opravte označené částky. Potom ověříme, zda je potřebné měsíční minimum pokryté.'
      : c.finalDeficit > 0 ? `Do potřebného měsíčního minima stále chybí ${formatKc(c.finalDeficit)}.` : 'Podle zadaných údajů je potřebné měsíční minimum pokryté.'}</p>
    <p className="text-sm leading-relaxed text-slate-700">Tyto další platby započítáváme do kontroly měsíčního minima. Do odhadu, kolik dluhů za celé oddlužení splatíte, je tato verze kalkulačky zatím nezahrnuje.</p>
    <details className="text-xs leading-relaxed text-slate-600"><summary className="cursor-pointer font-bold">Právně přesně</summary><p className="mt-2">{MODEL_NOTE}</p></details>
  </div>;
}
function ExecutionFees({data,setData}) {
  const groups = data.vicePlatcu1 ? groupPayers(data.prijmy1) : [{ id:'all',sources:data.prijmy1,source:data.prijmy1[0] }];
  const change = (id,patch) => setData(prev => ({...prev, prijmy1:prev.prijmy1.map(s => s.id === id ? {...s,...patch}:s)}));
  return <div className="space-y-3">
    <h4 className="text-sm font-bold text-slate-800">Náhrada nákladů jednotlivých plátců</h4>
    <p className="text-xs text-slate-600">Potvrďte pouze u plátce s nárokem na náhradu a při splnění časových podmínek řízení (u exekuce příkaz od 1. 1. 2022). U důchodů, nemocenského, PPM a podpory v nezaměstnanosti se paušál neuplatní. Z jedné skupiny plátce se odečítá nejvýše jednou.</p>
    {groups.map((g,i) => <div key={g.id} className="space-y-2">
      {g.sources.filter(s => s.typ === 'jiny').map(s => <Choice key={s.id} checked={s.narokNaPausalOveren} onChange={checked => change(s.id,{narokNaPausalOveren:checked,uplatnitPausal:false})}>U jiného příjmu plátce {i+1} je právně ověřen nárok na paušální náhradu</Choice>)}
      {g.sources.some(feeEligible) ? <Choice checked={g.source.uplatnitPausal === true}
        onChange={checked => {change(g.source.id,{uplatnitPausal:checked});setData(prev=>({...prev,uplatnitPausalPlatce:false}));}}>Plátce {i+1} uplatňuje náhradu a podmínky byly ověřeny</Choice>
        : <p className="text-xs text-slate-600">Plátce {i+1}: podle zadaného typu příjmu se náhrada nezapočítává.</p>}
    </div>)}
  </div>;
}
export default function CaseFields({ step, mode, data, setData, results, errors = [] }) {
  const people = mode === 'manzele' ? [1,2] : [1];
  const set = (field,value) => setData(prev => ({...prev,[field]:value}));
  const field = props => <OptionalNumber {...props} data={data} setData={setData} errors={errors} />;
  if (step.startsWith('income')) return <IncomeFields data={data} setData={setData} person={step === 'incomeB' ? 2 : 1} errors={errors} />;
  if (step === 'minimum') return <MinimumFields data={data} setData={setData} mode={mode} results={results} errors={errors} />;
  if (step === 'family') return <div className="space-y-4">
    <p className="text-sm text-slate-600">Uveďte, koho vyživujete. Tyto údaje pomáhají určit část příjmu, která se nesráží. Zaškrtněte jen to, co se vás týká.</p>
    {mode === 'manzele' && field({field:'spolecneDeti',question:'Máte společně vyživované děti?',label:'Počet společných dětí',integer:true,hint:'Společné děti napište jen sem. K dalším osobám jednotlivých manželů je už nepřidávejte.'})}
    {people.map(p => { const letter = p === 1 ? 'A' : 'B'; const suffix = mode === 'manzele' ? ` – manžel ${letter}` : '';
      const r = mode === 'manzele' ? results[`insM_${letter}`] : mode === 'nezabavitelna' ? results.ex : results.insJ;
      return <div key={p} className="space-y-4">
        {field({field:`vyzivovaneOsoby${p}`,question:mode === 'manzele' ? `Vyživuje manžel ${letter} ještě další osoby?` : 'Vyživujete děti nebo jiné osoby?',label:`Počet vyživovaných osob${suffix}`,integer:true,hint:mode === 'manzele' ? 'Například děti z předchozího vztahu. Společné děti nepočítejte znovu.' : 'Manžela nebo partnera sem nepočítejte; posuzuje se zvlášť.'})}
        {field({field:`osobySVykonemProVyzivne${p}`,question:mode === 'manzele' ? `Vymáhá někdo po manželovi ${letter} dlužné výživné přes soud nebo exekutora?` : 'Vymáhá po vás někdo dlužné výživné přes soud nebo exekutora?',label:`Počet osob s vymáhaným výživným${suffix}`,integer:true,max:r.pocetVsechOsob,hint:'Tady uveďďte počet osob, na které se výživné právě vymáhá. Pravidelnou měsíční platbu výživného zadáte zvlášť.',legal:'Na osobu, v jejíž prospěch trvá nařízený výkon rozhodnutí nebo exekuce pro výživné, se jedna čtvrtina nezabavitelné částky nezapočítává.'})}
      </div>; })}
    {mode !== 'manzele' && <Choice checked={data.partnerProNezabavitelnou1} onChange={v=>set('partnerProNezabavitelnou1',v)}
      hint="Jde o starobní důchod, invalidní důchod II. nebo III. stupně nebo sirotčí důchod. Manžela či partnera nepřidávejte znovu mezi osoby výše.">{results.duchodPovinny1 ? 'Mám manžela/manželku nebo partnera/partnerku' : 'Manžel nebo partner pobírá některý z uvedených důchodů'}</Choice>}
    {mode === 'manzele' && (results.insM_A.partnerZapocitan || results.insM_B.partnerZapocitan) && <p className="text-sm text-blue-800">Kalkulačka už zohlednila zadaný důchod při započtení manžela nebo partnera. Mezi další osoby jej znovu nepřidávejte.</p>}
  </div>;
  if (step === 'other') return <div className="space-y-4">{people.map(p => <div key={p} className="space-y-4">
    {mode === 'manzele' && <h4 className="text-base font-bold text-slate-800">Manžel {p === 1 ? 'A' : 'B'}</h4>}
    {field({field:`bezneMesicniVyzivne${p}`,question:'Platíte někomu pravidelně výživné?',label:'Kolik měsíčně platíte?',hint:'Sem patří výživné, které platíte vy. Výživné, které dostáváte, uvedete zvlášť.',legal:'Běžné zákonné výživné se hradí před nezajištěnými věřiteli a zvyšuje potřebné minimální měsíční plnění.'})}
    {field({field:`chranenePrijmy${p}`,question:'Dostáváte ještě peníze, ze kterých se srážky neprovádějí?',label:'Kolik takto měsíčně dostáváte?',hint:'Například příspěvek na péči, daňový bonus nebo výživné na dítě. Mzdu a důchod sem neuvádějte.',legal:'Důchod, nemocenské, peněžitá pomoc v mateřství, podpora v nezaměstnanosti ani DPP/DPČ sem obecně nepatří. Právní povahu konkrétního příjmu kalkulačka sama neověřuje.'})}
  </div>)}</div>;
  if (step === 'execution') return <div className="space-y-4">
    <SelectField field="pocetExekuci" label="Počet souběžných exekucí" value={data.pocetExekuci} options={[["1-3","1 až 3 exekuce"],["4+","4 a více exekucí splňujících zákonné podmínky"]]} onChange={v=>set('pocetExekuci',v)} />
    <SelectField field="typPohledavky" label="O jaký dluh jde?" value={data.typPohledavky} options={[["neprednostni","Běžný nepřednostní dluh"],["prednostni","Přednostní dluh"],["vyzivne","Výživné"]]} onChange={v=>set('typPohledavky',v)} />
    <p className="text-xs text-slate-600">Běžná půjčka bývá nepřednostní. Přednostní jsou například výživné, daně či dluhy na sociálním a zdravotním pojištění. U některých důchodců platí výjimka z pravidla 4+.</p>
    {field({field:'chranenePrijmy1',question:'Dostáváte ještě peníze, ze kterých se srážky neprovádějí?',label:'Kolik takto měsíčně dostáváte?',hint:'Například příspěvek na péči nebo výživné na dítě. Mzdu a důchod sem neuvádějte.'})}
    <ExecutionFees data={data} setData={setData} />
  </div>;
  if (step === 'debts') return <div className="space-y-4">
    <SelectField field="delkaOddluzeni" label="Délka oddlužení" value={data.delkaOddluzeni} options={[[36,'3 roky – standardní doba'],[60,'5 let – předchozí osvobození v posledních 20 letech']]} onChange={v=>set('delkaOddluzeni',Number(v))} />
    <p className="text-xs text-slate-600">Odhad počítá s novým oddlužením podle současných pravidel. U staršího, prodlouženého nebo přerušeného řízení záleží na konkrétním rozhodnutí.</p>
    <Choice checked={data.dluhNeznamy} onChange={checked=>setData(prev=>({...prev,dluhNeznamy:checked,dluhyNezajistene:''}))}>Výši běžných dluhů zatím neznám</Choice>
    {!data.dluhNeznamy && <NumberField field="dluhyNezajistene" label={mode === 'manzele' ? 'Běžné nezajištěné dluhy manželů celkem' : 'Běžné nezajištěné dluhy'}
      value={data.dluhyNezajistene} onChange={v=>set('dluhyNezajistene',v)} error={errors.find(e=>e.field==='dluhyNezajistene')?.message}
      hint="Patří sem půjčky, úvěry, kreditní karty nebo nezaplacené faktury. Společný dluh manželů započítejte jen jednou. Po kontrole této části ukážeme odhad splacení." />}
    {field({field:'vytezekZpenezeni',question:'Počítáte s prodejem majetku?',label:'Kolik z prodeje půjde na běžné dluhy?',hint:'Uveďte jen peníze, které po odečtení nákladů prodeje skutečně půjdou na běžné nezajištěné dluhy.'})}
    {field({field:'dluhyZajistene',question:'Máte dluhy zajištěné konkrétním majetkem?',label:'Zajištěné dluhy celkem',hint:'Například hypotéku zajištěnou domem. Tyto dluhy uvedeme v přehledu, ale nepočítáme je do procenta splacení běžných dluhů.'})}
    {field({field:'dluhyNeosvoboditelne',question:'Máte dluhy, které se oddlužením neodpouštějí?',label:'Výše těchto dluhů',hint:'Například dlužné výživné, škoda na zdraví nebo úmyslně způsobená škoda. Uvedeme je zvlášť v přehledu. Zda se konkrétní dluh neodpouští, je potřeba ověřit.'})}
  </div>;
  return null;
}
