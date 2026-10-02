import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createDefaultData, migrateData, confirmSection, caseStatus, flowFor, OPTIONAL_FIELDS } from '../src/kalkulacka/caseState.js';
import { calculateCase } from '../src/kalkulacka/calculateCase.js';
import { DEFAULT_2026_PARAMS as params } from '../src/lib/calculations2026.js';
import { restoreFamilyWorkspace, activeFamilyData, serializeFamilyWorkspace, updateFamilyCase, switchFamilyMode, assignLegacyFamily, legacyReviewPending, previewFamilyCopy, applyFamilyCopy, FAMILY_MODES } from '../src/kalkulacka/familyState.js';
let count = 0;
function test(name, run) { run(); console.log(`OK ${++count}: ${name}`); }
const base = () => {
  const d = createDefaultData(); d.prijmy1[0].castka = 30000; d.prijmy2[0].castka = 25000; d.dluhyNezajistene = 600000; return d;
};
const create = () => restoreFamilyWorkspace(base());
const data = activeFamilyData;
const result = w => calculateCase(data(w), params, w.mode);
const status = w => caseStatus(data(w), w.mode, result(w), params);
const edit = (w, patch) => updateFamilyCase(w, d => ({ ...d, ...patch }));
const finish = w => { for (const s of flowFor(data(w), w.mode, result(w))) w = updateFamilyCase(w, d => confirmSection(d, w.mode, s, params)); return w; };
const reload = w => restoreFamilyWorkspace(migrateData(JSON.parse(JSON.stringify(serializeFamilyWorkspace(w)))));
function married() { return edit(switchFamilyMode(create(), 'manzele'), { spolecneDeti: 2 }); }

test('Nález poradce: po návratu se dvě děti nepočítají čtyřikrát', () => {
  let w = finish(married()); assert.equal(result(w).srazkaCelkemM, 8462);
  const original = structuredClone(w.byMode.manzele);
  w = switchFamilyMode(w, 'jednotlivec'); assert.equal(data(w).vyzivovaneOsoby1, 0); assert(!status(w).canExport);
  w = applyFamilyCopy(w, 'manzele'); assert.equal(data(w).vyzivovaneOsoby1, 2); assert.equal(result(w).insJ.srazka, 5898);
  w = finish(edit(w, { vyzivovaneOsoby1: 2 }));
  w = switchFamilyMode(w, 'manzele');
  assert.deepEqual(w.byMode.manzele, original); assert.equal(result(w).srazkaCelkemM, 8462); assert(status(w).canExport);
});
for (const from of FAMILY_MODES) for (const to of FAMILY_MODES.filter(m => m !== from)) test(`Bez implicitního kopírování ${from} → ${to} → ${from}`, () => {
  let w = switchFamilyMode(create(), from);
  w = edit(w, { vyzivovaneOsoby1: 3, osobySVykonemProVyzivne1: 1, partnerProNezabavitelnou1: true });
  const original = structuredClone(w.byMode[from]);
  w = switchFamilyMode(w, to); assert.equal(data(w).vyzivovaneOsoby1, 0); assert.equal(data(w).osobySVykonemProVyzivne1, 0);
  w = edit(w, { vyzivovaneOsoby1: 6, osobySVykonemProVyzivne1: 2 });
  w = reload(switchFamilyMode(w, from)); assert.deepEqual(w.byMode[from], original); assert.equal(data(w).vyzivovaneOsoby1, 3);
});
test('Příjmy zůstávají sdílené, neschováváme změny peněz do rodinných variant', () => {
  let w = married(); w = switchFamilyMode(w, 'jednotlivec');
  w = updateFamilyCase(w, d => ({ ...d, prijmy1: d.prijmy1.map(s => ({...s, castka:31000})) }));
  w = switchFamilyMode(w, 'manzele'); assert.equal(data(w).prijmy1[0].castka,31000); assert.equal(data(w).spolecneDeti,2);
});
test('Převzetí z manželů sčítá společné a další osoby A právě jednou', () => {
  let w = edit(married(), { vyzivovaneOsoby1:1, vyzivovaneOsoby2:7, osobySVykonemProVyzivne1:1 });
  const original = structuredClone(w.byMode.manzele);
  w = switchFamilyMode(w,'nezabavitelna'); w = applyFamilyCopy(w,'manzele');
  assert.equal(data(w).vyzivovaneOsoby1,3); assert.equal(data(w).osobySVykonemProVyzivne1,1);
  w = applyFamilyCopy(w,'manzele'); assert.equal(data(w).vyzivovaneOsoby1,3); assert.deepEqual(w.byMode.manzele,original);
});
test('Do manželů nelze hádat rozdělení mezi společné a další děti', () => {
  let w = edit(switchFamilyMode(create(),'jednotlivec'),{vyzivovaneOsoby1:4});
  w = switchFamilyMode(w,'manzele');
  for(const count of ['',-1,1.5,5,'abc',Infinity]) assert.throws(()=>previewFamilyCopy(w,'jednotlivec',count));
  assert.equal(data(w).spolecneDeti,0);
});
test('Vědomé rozdělení při převzetí nemění vlastní údaje manžela B', () => {
  let w = edit(married(),{vyzivovaneOsoby2:3,osobySVykonemProVyzivne2:1});
  w = edit(switchFamilyMode(w,'jednotlivec'),{vyzivovaneOsoby1:4,osobySVykonemProVyzivne1:1});
  const original = structuredClone(w.byMode.jednotlivec);
  w = switchFamilyMode(w,'manzele'); w = applyFamilyCopy(w,'jednotlivec',2);
  assert.equal(data(w).spolecneDeti,2); assert.equal(data(w).vyzivovaneOsoby1,2);
  assert.equal(data(w).vyzivovaneOsoby2,3); assert.equal(data(w).osobySVykonemProVyzivne2,1);
  assert.deepEqual(w.byMode.jednotlivec,original);
  w=applyFamilyCopy(w,'jednotlivec',2); assert.equal(data(w).vyzivovaneOsoby1,2);
});
for(const total of [0,1,4,10]) for(const common of [0,total]) test(`Explicitní rozdělení celku ${total}, společné ${common}`,()=>{
  let w=edit(switchFamilyMode(create(),'nezabavitelna'),{vyzivovaneOsoby1:total});
  w=switchFamilyMode(w,'manzele'); w=applyFamilyCopy(w,'nezabavitelna',common);
  assert.equal(data(w).spolecneDeti,common);assert.equal(data(w).vyzivovaneOsoby1,total-common);
});
test('Převzetí mezi jednotlivcem a exekucí zachová započtení partnera i příznaky',()=>{
  let w=edit(switchFamilyMode(create(),'jednotlivec'),{partnerProNezabavitelnou1:true,vyzivovaneOsoby1:2,[OPTIONAL_FIELDS.vyzivovaneOsoby1]:true});
  w=switchFamilyMode(w,'nezabavitelna');w=applyFamilyCopy(w,'jednotlivec');
  assert.equal(data(w).partnerProNezabavitelnou1,true);assert.equal(data(w)[OPTIONAL_FIELDS.vyzivovaneOsoby1],true);
});
test('Převzetí A z manželů zohlední důchod B, nikoli domnělý ruční příznak',()=>{
  let w=married();w=updateFamilyCase(w,d=>({...d,prijmy2:d.prijmy2.map(s=>({...s,typ:'starobni'}))}));
  w=switchFamilyMode(w,'jednotlivec');w=applyFamilyCopy(w,'manzele');
  assert.equal(data(w).partnerProNezabavitelnou1,true);assert.equal(result(w).insJ.partnerZapocitan,true);
});
test('Převzetí ruší pouze cílovou kontrolu rodiny/minima',()=>{
  let w=finish(married()); w=finish(switchFamilyMode(w,'jednotlivec'));
  const source=structuredClone(w.shared._confirmed.manzele);
  w=applyFamilyCopy(w,'manzele');assert(!status(w).canExport);assert.equal(w.shared._confirmed.jednotlivec.family,undefined);
  assert(w.shared._confirmed.jednotlivec.income);assert.deepEqual(w.shared._confirmed.manzele,source);
});
for(const mode of FAMILY_MODES) test(`Načtení nové uložené varianty zachová ${mode} a potvrzení`,()=>{
  let w=finish(switchFamilyMode(create(),mode));assert(status(w).canExport);
  const before=data(w);w=reload(w);assert.equal(w.mode,mode);assert.deepEqual(data(w),before);assert(status(w).canExport);
});
test('Potvrzení minima nezneplatní přepnutí a nezměněný návrat',()=>{
  let w=create();w=edit(w,{prijmy1:[{id:'a',typ:'mzda',castka:16800,pridelenaNezabavitelna:''}],vyzivovaneOsoby1:1,povolitPrislibDluznika1:true,zakladniPotreby1:12000,zavaznyPrislib1:2178});
  w=finish(w);assert(status(w).canExport);w=switchFamilyMode(w,'manzele');
  w=edit(w,{spolecneDeti:3});w=reload(switchFamilyMode(w,'jednotlivec'));assert(status(w).canExport);
});
test('Starší údaje bez režimu se nepřisoudí automaticky jednotlivci',()=>{
  const original={...base(),spolecneDeti:2,vyzivovaneOsoby1:2,vyzivovaneOsoby2:3};
  let w=restoreFamilyWorkspace(migrateData(original));assert(legacyReviewPending(w));assert(!status(w).canExport);
  assert.throws(()=>switchFamilyMode(w,'jednotlivec'));assert.throws(()=>updateFamilyCase(w,{...data(w)}));
  w=assignLegacyFamily(w,'manzele');assert.equal(data(w).spolecneDeti,2);assert.equal(data(w).vyzivovaneOsoby1,2);
  assert.equal(w.legacy.vyzivovaneOsoby2,3);assert(!status(w).canExport);
  w=switchFamilyMode(w,'jednotlivec');assert.equal(data(w).vyzivovaneOsoby1,0);
});
for(const mode of FAMILY_MODES) test(`Zařazení starších údajů do ${mode} je výslovné a bez změn zdroje`,()=>{
  let w=restoreFamilyWorkspace({...base(),spolecneDeti:2,vyzivovaneOsoby1:3,osobySVykonemProVyzivne1:1});
  const original=structuredClone(w.legacy);w=assignLegacyFamily(w,mode);w=reload(w);
  assert.deepEqual(w.legacy,original);assert.equal(w.legacyResolvedTo,mode);assert.equal(data(w).vyzivovaneOsoby1,3);
  assert.equal(data(w).spolecneDeti,mode==='manzele'?2:0);
});
test('I neplatný starší počet je zachován pro opravu, nikoli znormalizován',()=>{
  let w=restoreFamilyWorkspace({...base(),vyzivovaneOsoby1:1,osobySVykonemProVyzivne1:5});
  w=assignLegacyFamily(w,'jednotlivec');assert.equal(data(w).osobySVykonemProVyzivne1,5);assert(!status(w).valid);
});
test('Poškozené varianty odmítneme, aby se nepřepsala původní kopie',()=>{
  const saved=serializeFamilyWorkspace(create());
  for(const change of [s=>s._familyWorkspace.version=9,s=>s._familyWorkspace.mode='unknown',s=>s._familyWorkspace.byMode=null,s=>s._familyWorkspace.byMode.manzele.spolecneDeti={},s=>s._familyWorkspace.visited=['unknown']]) {
    const broken=structuredClone(saved);change(broken);assert.throws(()=>restoreFamilyWorkspace(broken));
  }
});
test('Reset odstraní všechny varianty i původní archiv rodiny',()=>{
  const clean=restoreFamilyWorkspace(createDefaultData());assert.deepEqual(clean.visited,[]);assert.equal(clean.legacy,null);
  for(const mode of FAMILY_MODES) assert.equal(data(switchFamilyMode(clean,mode)).vyzivovaneOsoby1,0);
});
test('Do původního výpočetního API nevstupují žádné cache ostatních rodin',()=>{
  const d=data(married());assert.equal(d._familyWorkspace,undefined);assert.equal(d.byMode,undefined);
});
const unchanged={
 'src/kalkulacka/approvedHelp.json':'fa15e5e5dd484c1e6cf5a16bb51ef94719c3b0c2',
 'src/kalkulacka/caseState.js':'7ebec0307954da7b1b800572d17c22b2bfa402a1',
 'src/kalkulacka/calculateCase.js':'ea7949e62867978d18832f26eb8c0871976d634c',
 'src/lib/calculations2026.js':'d6d3ccad97f10a69bb1697825ac23cb9890f3a7f',
};
for(const [file,sha] of Object.entries(unchanged)) test(`Původní texty/pravidla beze změny: ${file}`,()=>{
 const bytes=fs.readFileSync(file);assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),sha);
});
if(process.argv.includes('--render')) {
 const React=(await import('react')).default;
 const {renderToStaticMarkup}=await import('react-dom/server');
 const {createServer}=await import('vite');
 const server=await createServer({configFile:false,server:{middlewareMode:true},appType:'custom',esbuild:{jsx:'transform'},optimizeDeps:{noDiscovery:true,include:[]}});
 try {
   const {default:Fields}=await server.ssrLoadModule('/src/kalkulacka/CaseFields.jsx');
   const {ENFORCED_ALIMONY_NOTE,LEGAL_PARTNER_NOTE}=await server.ssrLoadModule('/src/kalkulacka/FamilyControls.jsx');
   test('Obě návazné věty odpovídají přesně schválenému znění',()=>{
     assert.equal(ENFORCED_ALIMONY_NOTE,'Do počtu vyživovaných osob nejprve zahrňte i děti, na které je proti vám vymáháno výživné. V následující otázce je označíte zvlášť a kalkulačka je při výpočtu nezabavitelné částky odečte.');
     assert.equal(LEGAL_PARTNER_NOTE,'Partnerem se zde rozumí partner v právně uzavřeném partnerství. Samotné soužití s přítelem nebo přítelkyní pro toto započtení nestačí.');
   });
   for(const mode of FAMILY_MODES) test(`Návazné vysvětlení rodiny: ${mode}`,()=>{
     const d=base(),r=calculateCase(d,params,mode);
     const html=renderToStaticMarkup(React.createElement(Fields,{data:d,setData:()=>{},mode,step:'family',results:r,errors:[]}));
     assert(html.includes(ENFORCED_ALIMONY_NOTE));assert.equal(html.includes(LEGAL_PARTNER_NOTE),mode!=='manzele');
     assert(html.includes('Lidsky řečeno:'));assert(html.includes('Pokud je vaše odpověď ANO, políčko zaškrtněte.'));
   });
 } finally { await server.close(); }
}
console.log(`Family isolation checks: ${count} úspěšných.`);
