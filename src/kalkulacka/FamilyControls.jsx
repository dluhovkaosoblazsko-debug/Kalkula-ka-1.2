import React, { createContext, useContext, useId, useState } from 'react';
import { familyCopySources, previewFamilyCopy } from './familyState.js';

export const FamilyWorkspaceContext = createContext(null);
export const FAMILY_MODE_LABELS = {
  jednotlivec: 'Oddlužení jednotlivce', manzele: 'Společné oddlužení manželů', nezabavitelna: 'Exekuční srážka',
};
// These two additions were separately approved. Do not paraphrase the originals.
export const ENFORCED_ALIMONY_NOTE = 'Do počtu vyživovaných osob nejprve zahrňte i děti, na které je proti vám vymáháno výživné. V následující otázce je označíte zvlášť a kalkulačka je při výpočtu nezabavitelné částky odečte.';
export const LEGAL_PARTNER_NOTE = 'Partnerem se zde rozumí partner v právně uzavřeném partnerství. Samotné soužití s přítelem nebo přítelkyní pro toto započtení nestačí.';
const show = value => value === '' ? 'nezadáno' : String(value);
export function legacyFamilyQuestion(workspace, mode) {
  const f = workspace.legacy;
  return 'Starší uložené rodinné údaje nemají uvedený typ výpočtu.\n\n'
    + `Společné děti: ${show(f.spolecneDeti)}\nVyživované osoby 1: ${show(f.vyzivovaneOsoby1)}\nVyživované osoby 2: ${show(f.vyzivovaneOsoby2)}\n`
    + `Osoby s vymáhaným výživným 1 / 2: ${show(f.osobySVykonemProVyzivne1)} / ${show(f.osobySVykonemProVyzivne2)}\n`
    + `Započtení manžela/partnera: ${f.partnerProNezabavitelnou1 ? 'ANO' : 'NE'}\n\n`
    + `Použít tyto údaje pro „${FAMILY_MODE_LABELS[mode]}“? Potom zkontrolujte rodinnou situaci.`;
}
function FamilySummary({ family, mode, original = false }) {
  const spouses = mode === 'manzele' || original;
  return <div className="space-y-1 text-sm text-slate-700">
    {spouses && <p>Společné děti: <strong>{show(family.spolecneDeti)}</strong></p>}
    <p>{original ? 'Vyživované osoby 1' : spouses ? 'Další vyživované osoby – manžel A' : 'Vyživované osoby'}: <strong>{show(family.vyzivovaneOsoby1)}</strong></p>
    <p>Osoby s vymáhaným výživným{spouses ? ' – manžel A' : ''}: <strong>{show(family.osobySVykonemProVyzivne1)}</strong></p>
    {spouses && <><p>{original ? 'Vyživované osoby 2' : 'Další vyživované osoby – manžel B'}: <strong>{show(family.vyzivovaneOsoby2)}</strong></p>
      <p>Osoby s vymáhaným výživným – manžel B: <strong>{show(family.osobySVykonemProVyzivne2)}</strong></p></>}
    {(!spouses || original) && <p>Započtení manžela/partnera: <strong>{family.partnerProNezabavitelnou1 ? 'ANO' : 'NE'}</strong></p>}
  </div>;
}
export default function FamilyTransfer() {
  const context = useContext(FamilyWorkspaceContext);
  const [source, setSource] = useState('');
  const [common, setCommon] = useState('');
  const id = useId();
  if (!context) return null;
  const { workspace, onCopy } = context;
  const sources = familyCopySources(workspace);
  let preview = null, error = '';
  if (source && sources.includes(source)) {
    try { preview = previewFamilyCopy(workspace, source, common); }
    catch (problem) { error = problem.message; }
  }
  return <div className="space-y-2" data-testid="family-transfer">
    <p className="text-xs text-slate-600">Rodinné údaje: <strong>{FAMILY_MODE_LABELS[workspace.mode]}</strong>. Přepnutí výpočtu tyto údaje nepřevádí.</p>
    {sources.length > 0 && <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <summary className="cursor-pointer text-sm font-bold text-blue-700">Převzít rodinné údaje z jiného výpočtu</summary>
      <div className="mt-3 space-y-3">
        <label className="block text-sm font-bold text-slate-800" htmlFor={id}>Z kterého výpočtu?</label>
        <select id={id} data-testid="family-copy-source" value={source} onChange={event => { setSource(event.target.value); setCommon(''); }} className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900">
          <option value="">Vyberte výpočet</option>
          {sources.map(mode => <option key={mode} value={mode}>{FAMILY_MODE_LABELS[mode]}{mode === 'manzele' ? ' – manžel A' : ''}</option>)}
        </select>
        {source && workspace.mode === 'manzele' && <div>
          <label htmlFor={`${id}-common`} className="block text-sm font-bold text-slate-800">Z převzatých {show(workspace.byMode[source].vyzivovaneOsoby1)} vyživovaných osob: kolik jsou společné děti?</label>
          <input id={`${id}-common`} data-testid="family-copy-common" type="number" inputMode="numeric" min="0" step="1" value={common} onChange={event => setCommon(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900" />
          <p className="mt-1 text-xs text-slate-600">Přebírají se údaje pro manžela A. Další osoby a vymáhané výživné manžela B zůstávají zachované.</p>
        </div>}
        {error && <p className="text-sm text-amber-800">{error}</p>}
        {preview && <div data-testid="family-copy-preview" className="space-y-2">
          <p className="text-sm font-bold text-slate-800">Po převzetí:</p><FamilySummary family={preview} mode={workspace.mode} />
          <button type="button" data-testid="apply-family-copy" className="min-h-11 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-700" onClick={() => { onCopy(source, common); setSource(''); setCommon(''); }}>Převzít a zkontrolovat rodinné údaje</button>
        </div>}
      </div>
    </details>}
    {workspace.legacy && <details className="text-xs text-slate-600"><summary className="cursor-pointer">Původní uložené rodinné údaje</summary>
      <div className="mt-2"><FamilySummary family={workspace.legacy} original /></div>
    </details>}
  </div>;
}
