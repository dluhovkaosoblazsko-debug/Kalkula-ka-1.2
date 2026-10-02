import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, User, Users, ShieldAlert, Settings, Printer, RotateCcw } from 'lucide-react';
import { DEFAULT_2026_PARAMS, PENSION_EXCEPTION_LIMIT_2026 } from '../lib/calculations2026.js';
import { createDefaultData, migrateData, caseStatus, PARAM_LABELS, readStored, writeStored } from './caseState.js';
import { calculateCase } from './calculateCase.js';
import { DesktopForm, MobileForm } from './WorkflowForms';
import { NumberField } from './CaseFields';
import CaseResults from './CaseResults';
import PrintableCalculationReport from './PrintableCalculationReport';

const DATA_KEY = 'insCalcData2026_v10';
const PARAMS_KEY = 'insCalcParams2026_v10';
function loadInitialState() {
  let data = createDefaultData(), params = { ...DEFAULT_2026_PARAMS }, error = null;
  try {
    const storedData = readStored(window.localStorage,DATA_KEY,null);
    const storedParams = readStored(window.localStorage,PARAMS_KEY,null);
    error = storedData.error || storedParams.error;
    if (storedData.value !== null) data = migrateData(storedData.value);
    if (storedParams.value !== null) {
      if (typeof storedParams.value !== 'object' || Array.isArray(storedParams.value)) throw new Error('Poškozené parametry');
      params = { ...params, ...storedParams.value };
    }
  } catch {
    error = 'Uložené údaje nelze bezpečně načíst. Původní uložená kopie nebyla přepsána; aplikace pracuje s novým zadáním.';
  }
  return {data,params,error};
}
export default function HlavniKalkulackaPage() {
  const [initial] = useState(loadInitialState);
  const [data,setData] = useState(initial.data);
  const [params,setParams] = useState(initial.params);
  const [mode,setMode] = useState('jednotlivec');
  const [started,setStarted] = useState(false);
  const [settingsOpen,setSettingsOpen] = useState(false);
  const [resetVersion,setResetVersion] = useState(0);
  const [saveAllowed,setSaveAllowed] = useState(!initial.error);
  const [storageMessage,setStorageMessage] = useState(initial.error || 'Údaje se ukládají pouze v tomto prohlížeči. Na sdíleném zařízení je po práci vymažte.');
  const [actionError,setActionError] = useState('');
  const results = useMemo(()=>calculateCase(data,params,mode),[data,params,mode]);
  const status = caseStatus(data,mode,results,params);
  useEffect(()=>{
    if (!saveAllowed) return;
    let saved = false;
    try {
      const dataSaved = writeStored(window.localStorage,DATA_KEY,data);
      const paramsSaved = writeStored(window.localStorage,PARAMS_KEY,params);
      saved = dataSaved && paramsSaved;
    } catch { saved = false; }
    setStorageMessage(saved
      ? 'Údaje se průběžně ukládají pouze v tomto prohlížeči. Na sdíleném zařízení je po práci vymažte.'
      : 'Údaje se nepodařilo uložit. Výpočet funguje v paměti; po obnovení mohou poslední změny zmizet nebo se načíst starší údaje.');
  },[data,params,saveAllowed]);
  const reset = () => {
    if (!window.confirm('Začít nový výpočet a vymazat jeho zadané údaje? Odborné parametry zůstanou zachované.')) return false;
    let removed = false;
    try {window.localStorage.removeItem(DATA_KEY);removed = true;} catch { /* The warning below is visible even when storage is disabled. */ }
    setData(createDefaultData());setMode('jednotlivec');setStarted(false);setSettingsOpen(false);setActionError('');setResetVersion(v=>v+1);
    setSaveAllowed(removed);
    setStorageMessage(removed ? 'Údaje výpočtu byly vymazány.' : 'Údaje v paměti byly vymazány, uloženou kopii se ale smazat nepodařilo. Po obnovení se mohou starší údaje vrátit.');
    return true;
  };
  const print = () => {
    if (!caseStatus(data,mode,results,params).canExport) {setActionError('Před tiskem opravte a potvrďte zadání.');return;}
    setActionError('');window.print();
  };
  const modes = [
    {key:'jednotlivec',title:'Oddlužení jednotlivce',description:'Kolik se vám bude srážet, kolik vám zůstane a zda to stačí na potřebné minimum.',icon:User},
    {key:'manzele',title:'Společné oddlužení manželů',description:'Kolik se bude srážet každému z vás a kolik vám dohromady zůstane.',icon:Users},
    {key:'nezabavitelna',title:'Exekuční srážka',description:'Kolik vám mohou měsíčně srazit a kolik vám po srážce zůstane.',icon:ShieldAlert},
  ];
  return <div className="calculator-page min-h-screen p-4 md:p-6 font-sans text-slate-800 print:p-0">
    <PrintableCalculationReport mode={mode} data={data} results={results} params={params} />
    <div className="mobile-calculator"><MobileForm key={resetVersion} data={data} setData={setData} mode={mode} setMode={setMode}
      results={results} params={params} onReset={reset} onPrint={print} storageMessage={storageMessage} /></div>
    <div className="desktop-calculator mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
        <div><p className="mb-2 text-xs font-bold text-amber-700">PRÁVNÍ STAV 2026 · ORIENTAČNÍ VÝPOČET</p><h1 className="flex items-center gap-2 text-3xl font-black text-slate-900"><Calculator className="text-blue-600" />Kalkulačka srážek a oddlužení</h1></div>
        <div className="flex flex-wrap gap-2">
          {started && !settingsOpen && status.canExport && <button type="button" onClick={print} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold"><Printer size={16}/>Tisk / PDF</button>}
          {started && <button type="button" onClick={reset} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold"><RotateCcw size={16}/>Nový výpočet</button>}
          <button type="button" onClick={()=>setSettingsOpen(v=>!v)} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500"><Settings size={14}/>{settingsOpen ? 'Zpět ke kalkulačce' : 'Odborné nastavení'}</button>
        </div>
      </header>
      <div className="storage-status mb-4 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600" role="status">{storageMessage}
        {!saveAllowed && <button type="button" className="ml-3 min-h-10 font-bold text-blue-700" onClick={()=>{if(window.confirm('Povolit ukládání nového zadání? Tím může být nahrazena dřívější uložená kopie.')) setSaveAllowed(true);}}>Povolit ukládání nového zadání</button>}
      </div>
      {actionError && <p role="alert" className="mb-4 text-sm font-bold text-red-700">{actionError}</p>}
      {settingsOpen ? <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-black text-slate-900">Referenční parametry 2026</h2>
        <p className="text-sm text-slate-600">Změny budou označeny ve výsledku i exportech. Po úpravě je potřeba zadání znovu potvrdit. Zákonný limit výjimky důchodců se změnou odměny správce nemění.</p>
        <div className="grid gap-4 md:grid-cols-2">{Object.entries(PARAM_LABELS).map(([key,label])=><NumberField key={key} field={key} label={label} money={!key.startsWith('koeficient')} value={params[key]} onChange={value=>setParams(prev=>({...prev,[key]:value}))} error={status.errors.find(e=>e.field===key)?.message}/>)}</div>
        <p className="text-sm text-slate-700">Zákonný limit jedné třetiny pro důchodovou výjimku 4+: <strong>{PENSION_EXCEPTION_LIMIT_2026.toLocaleString('cs-CZ')} Kč včetně DPH</strong> (není parametrem odměny konkrétního správce).</p>
        <button type="button" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-700" onClick={()=>setParams({...DEFAULT_2026_PARAMS})}>Obnovit výchozí parametry 2026</button>
      </section> : !started ? <section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-2xl font-black text-slate-900">Co chcete spočítat?</h2><p className="mt-2 text-sm text-slate-600">Vyberte svou situaci. Provedeme vás několika otázkami, krok za krokem.</p><div className="mt-5 grid gap-4 lg:grid-cols-3">{modes.map(({key,title,description,icon:Icon})=><button type="button" key={key} onClick={()=>{setMode(key);setStarted(true);}} className={`rounded-xl border p-5 text-left focus:outline-none focus:ring-2 focus:ring-blue-400 ${key==='nezabavitelna'?'border-rose-200 bg-rose-50':key==='manzele'?'border-indigo-200 bg-indigo-50':'border-blue-200 bg-blue-50'}`}><Icon size={24} className="mb-3 text-blue-700"/><strong className="block text-base text-slate-900">{title}</strong><span className="mt-2 block text-sm text-slate-600">{description}</span></button>)}</div></section> : <>
        <nav className="mb-5 flex flex-wrap gap-2 rounded-xl bg-slate-200 p-1" aria-label="Typ výpočtu">{modes.map(({key,title})=><button type="button" key={key} aria-pressed={mode===key} onClick={()=>setMode(key)} className={`flex-1 rounded-lg px-3 py-3 text-sm font-bold ${mode===key?'bg-white text-blue-700':'text-slate-600'}`}>{title}</button>)}</nav>
        <div className="grid gap-6 lg:grid-cols-12"><aside className="lg:col-span-5"><DesktopForm key={mode+'-'+resetVersion} data={data} setData={setData} mode={mode} results={results} params={params}/></aside><section className="lg:col-span-7"><CaseResults data={data} mode={mode} results={results} params={params}/></section></div>
      </>}
    </div>
  </div>;
}
