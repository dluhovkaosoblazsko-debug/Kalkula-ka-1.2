import React, { useEffect, useId, useRef, useState } from 'react';
import CaseFields from './CaseFields';
import CaseResults, { InputSummary } from './CaseResults';
import { caseStatus, confirmSection, sectionReviewed, sectionTitle, sectionHasData } from './caseState.js';
import { buildCalculationShareText } from './PrintableCalculationReport';

const buttonClass = 'min-h-12 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400';
export function DesktopForm({data,setData,mode,results,params}) {
  const status = caseStatus(data,mode,results,params);
  const [attempted,setAttempted] = useState('');
  const [expanded,setExpanded] = useState({});
  const first = status.flow.findIndex(step=>!sectionReviewed(data,mode,step,params));
  const progress = first < 0 ? status.flow.length : first;
  return <div className="space-y-4" data-testid="desktop-case-form">
    {status.flow.map((step,index)=>{
      const reviewed = sectionReviewed(data,mode,step,params);
      const unlocked = index <= progress || data._confirmed?.[mode]?.[step] !== undefined || expanded[mode+step];
      if (!unlocked && !sectionHasData(data,mode,step)) return null;
      const errors = status.errors.filter(e=>e.section===step);
      return <section key={step} className="rounded-xl border border-slate-200 bg-white p-4" data-step={step}>
        <h3 className="mb-2 text-base font-black text-slate-900">{index+1}. {sectionTitle(step)}</h3>
        {reviewed && <p className="mb-2 text-xs font-bold text-green-700">Zkontrolováno. Změna údaje vyžaduje nové potvrzení.</p>}
        {unlocked ? <details open={!reviewed}>
          <summary className="cursor-pointer text-sm text-slate-600"><InputSummary data={data} mode={mode} step={step} /></summary>
          <div className="mt-4 space-y-4"><CaseFields step={step} mode={mode} data={data} setData={setData} results={results} errors={errors} />
            {attempted === step && errors.length > 0 && <p role="alert" className="text-sm font-bold text-red-700">Nejprve opravte údaje tohoto oddílu.</p>}
            <button type="button" className={buttonClass} onClick={()=>{setAttempted(step); if (!errors.length) setData(prev=>confirmSection(prev,mode,step,params));}}>Potvrdit {sectionTitle(step).toLocaleLowerCase('cs-CZ')}{index < status.flow.length-1 ? ' a pokračovat' : ''}</button>
          </div>
        </details> : <div className="space-y-2 text-sm text-slate-600"><p>Otevře se po potvrzení předchozích oddílů. Dříve zadané hodnoty zůstávají zachované.</p><p><InputSummary data={data} mode={mode} step={step} /></p><button type="button" className="min-h-10 font-bold text-blue-700" onClick={()=>setExpanded(prev=>({...prev,[mode+step]:true}))}>Otevřít pro kontrolu</button></div>}
      </section>;
    })}
  </div>;
}
export function MobileForm({data,setData,mode,setMode,results,params,onReset,onPrint,storageMessage}) {
  const [step,setStep] = useState('mode');
  const [editing,setEditing] = useState(false);
  const [message,setMessage] = useState('');
  const titleRef = useRef(null);
  const status = caseStatus(data,mode,results,params);
  const id = useId();
  const previousMode = useRef(mode);
  useEffect(()=>{if (previousMode.current !== mode) {previousMode.current = mode;setStep(mode === 'manzele' ? 'incomeA' : 'income');setEditing(false);setMessage('');}},[mode]);
  useEffect(()=>{ if (step !== 'mode') { titleRef.current?.focus({preventScroll:true}); window.scrollTo({top:0,behavior:'instant'}); } },[step]);
  const go = next => {setMessage('');setStep(next);};
  const confirm = () => {
    const errors = status.errors.filter(e=>e.section===step);
    if (errors.length) { setMessage(errors.map(e=>e.message).join(' ')); return; }
    const nextData = confirmSection(data,mode,step,params);
    const nextStatus = caseStatus(nextData,mode,results,params);
    setData(nextData);
    if (editing) {
      const pending = nextStatus.errors[0]?.section || nextStatus.flow.find(s=>!sectionReviewed(nextData,mode,s,params));
      if (pending && pending !== 'settings') {setMessage('Změna vyžaduje kontrolu navazujícího oddílu.');setStep(pending);} else {setEditing(false);go('result');}
      return;
    }
    const index = nextStatus.flow.indexOf(step);
    if (index < nextStatus.flow.length-1) go(nextStatus.flow[index+1]);
    else {
      const invalid = nextStatus.errors[0]?.section || nextStatus.flow.find(s=>!sectionReviewed(nextData,mode,s,params));
      if (invalid && invalid !== 'settings') {setMessage('Před dokončením opravte uvedené údaje.');setStep(invalid);}
      else go('result');
    }
  };
  const back = () => {
    if (editing) {setEditing(false);go('result');return;}
    const index = status.flow.indexOf(step);
    go(step === 'result' ? status.flow.at(-1) : index > 0 ? status.flow[index-1] : 'mode');
  };
  const share = async () => {
    try {
      const text = buildCalculationShareText({mode,data,results,params});
      if (navigator.share) await navigator.share({title:'Výsledek kalkulačky srážek a oddlužení',text});
      else if (navigator.clipboard?.writeText) {await navigator.clipboard.writeText(text);setMessage('Souhrn byl zkopírován.');}
      else setMessage('Sdílení není podporováno. Použijte Tisk / PDF.');
    } catch(error) {if(error?.name !== 'AbortError') setMessage('Výsledek nelze sdílet. Zkontrolujte zadání nebo zkuste tisk.');}
  };
  if (step === 'mode') return <div className="space-y-4 pb-6">
    <h1 className="text-3xl font-black text-slate-900">Co chcete spočítat?</h1>
    <p className="text-sm text-slate-600">Vyberte situaci. Otázky se budou zobrazovat postupně.</p>
    <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{storageMessage}</p>
    {[["jednotlivec","Oddlužení jednotlivce"],["manzele","Společné oddlužení manželů"],["nezabavitelna","Exekuční srážka"]].map(([key,label])=><button type="button" key={key} className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left text-lg font-bold text-slate-900" onClick={()=>{if(key!==mode) {setMode(key);} go(key==='manzele'?'incomeA':'income');}}>{label}</button>)}
    <button type="button" className={buttonClass} onClick={()=>{if(onReset()){setEditing(false);go('mode');}}}>Nový výpočet / vymazat údaje</button>
  </div>;
  return <div className="space-y-4 pb-28">
    <p role="status" className="text-xs leading-relaxed text-slate-600">{storageMessage}</p>
    <div className="flex items-center justify-between gap-3"><button type="button" onClick={()=>{setEditing(false);go('mode');}} className="min-h-10 text-sm font-bold text-blue-700">Změnit výpočet</button><span className="text-xs font-bold text-slate-500">{step === 'result' ? 'Výsledek' : `Krok ${status.flow.indexOf(step)+1} z ${status.flow.length}`}</span></div>
    <h2 ref={titleRef} tabIndex={-1} id={id} className="text-xl font-black text-slate-900">{step === 'result' ? 'Výsledek a kontrola zadání' : sectionTitle(step)}</h2>
    {message && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">{message}</p>}
    {step === 'result' ? <>
      <CaseResults data={data} mode={mode} results={results} params={params} />
      <section className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="mb-3 font-bold text-slate-900">Zadané údaje</h3><div className="space-y-3">{status.flow.map(s=><button type="button" key={s} className="w-full rounded-xl border border-slate-200 p-3 text-left" onClick={()=>{setEditing(true);go(s);}}><strong className="block text-sm text-blue-700">Upravit: {sectionTitle(s)}</strong><span className="mt-1 block text-xs text-slate-600"><InputSummary data={data} mode={mode} step={s} /></span></button>)}</div></section>
      {status.canExport && <div className="grid grid-cols-2 gap-3"><button type="button" className={buttonClass} onClick={onPrint}>Tisk / PDF</button><button type="button" className={buttonClass} onClick={share}>Sdílet</button></div>}
    </> : <section aria-labelledby={id} className="rounded-xl border border-slate-200 bg-white p-4"><CaseFields step={step} mode={mode} data={data} setData={setData} results={results} errors={status.errors.filter(e=>e.section===step)} /></section>}
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white p-3" style={{paddingBottom:'max(0.75rem, env(safe-area-inset-bottom))'}}>
      <div className="mx-auto flex max-w-xl gap-3"><button type="button" className={buttonClass+' flex-1'} onClick={back}>{editing ? 'Zpět na výsledek' : 'Zpět'}</button>
        {step !== 'result' && <button type="button" className={buttonClass+' flex-[1.5]'} onClick={confirm}>{editing ? 'Potvrdit a zpět na výsledek' : 'Potvrdit a pokračovat'}</button>}
      </div>
    </div>
  </div>;
}
