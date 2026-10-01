import { DEFAULT_2026_PARAMS } from '../lib/calculations2026.js';

export const INCOME_TYPES = [
  ['mzda', 'Mzda / plat'], ['starobni', 'Starobní důchod'],
  ['invalidni1', 'Invalidní důchod I. stupně'], ['invalidni2', 'Invalidní důchod II. stupně'],
  ['invalidni3', 'Invalidní důchod III. stupně'], ['sirotci', 'Sirotčí důchod'],
  ['dpp_dpc', 'DPP / DPČ'], ['nemocenske', 'Nemocenské / PPM'],
  ['podpora', 'Podpora v nezaměstnanosti'], ['jiny', 'Jiný postižitelný příjem'],
];
export const OPTIONAL_FIELDS = {
  spolecneDeti: 'desktopManzeleMaSpolecneDeti',
  vyzivovaneOsoby1: 'desktopJednotlivecMaVyzivovaneOsoby',
  vyzivovaneOsoby2: 'desktopManzeleMaVyzivovaneOsoby2',
  osobySVykonemProVyzivne1: 'desktopJednotlivecMaVymahaneVyzivne',
  osobySVykonemProVyzivne2: 'desktopManzeleMaVymahaneVyzivne2',
  bezneMesicniVyzivne1: 'desktopJednotlivecPlatiVyzivne',
  bezneMesicniVyzivne2: 'desktopManzelePlatiVyzivne2',
  chranenePrijmy1: 'desktopJednotlivecMaChranenePrijmy',
  chranenePrijmy2: 'desktopManzeleMaChranenePrijmy2',
  vytezekZpenezeni: 'desktopJednotlivecProdejMajetku',
  dluhyZajistene: 'desktopJednotlivecMaZajisteneDluhy',
  dluhyNeosvoboditelne: 'desktopJednotlivecMaNeosvoboditelneDluhy',
};
export const PARAM_LABELS = {
  zivotniMinimum: 'Životní minimum', normativniNajemne: 'Normativní nájemné',
  energetickyPausal: 'Energetický paušál', odmenaSpravceJednotlivec: 'Odměna a výdaje správce – jednotlivec',
  odmenaSpravceManzele: 'Odměna a výdaje správce – manželé', pausalniNahradaPlatce: 'Paušální náhrada plátce',
  koeficientZahladu: 'Podíl pro nezabavitelnou částku (%)', koeficientZabavitelnosti: 'Násobek hranice plné zabavitelnosti',
};
export const MODEL_NOTE = 'Model měsíční částky pro nezajištěné věřitele a procenta splacení nezahrnuje závazný příslib ani příspěvek třetí osoby. Tyto zdroje slouží pouze ke kontrole minimálního měsíčního plnění. Splnění tohoto minima není rozhodnutím o povolení nebo schválení oddlužení.';
export const EXECUTION_NOTE = 'Jde o modelovou maximální srážku pro zadaný režim, nikoli o rozvrh konkrétních pohledávek. Skutečná srážka je omezena vymáhaným dluhem a příslušenstvím.';
export const present = value => value !== null && value !== undefined && String(value).trim() !== '';
export const validNumber = value => present(value) && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= Number.MAX_SAFE_INTEGER / 100;
export const number = value => validNumber(value) ? Number(value) : 0;
export const validMoney = value => validNumber(value) && Math.abs(Number(value)*100 - Math.round(Number(value)*100)) < 0.000001;
export const readNumber = value => value === '' ? '' : Number(value);
export const formatKc = value => {
  const n = number(value);
  if (n > 0 && n < 0.005) return 'méně než 0,01 Kč';
  return `${n.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} Kč`;
};
export const incomeLabel = type => INCOME_TYPES.find(([id]) => id === type)?.[1] || 'Příjem';
export const hasQualifyingPension = sources => (Array.isArray(sources) ? sources : []).some(s => ['starobni','invalidni2','invalidni3','sirotci'].includes(s.typ) && number(s.castka) > 0);
export const sumIncomeSources = sources => (Array.isArray(sources) ? sources : []).reduce((sum, s) => sum + number(s.castka), 0);
// § 301 odst. 2 OSŘ: pensions, sickness/PPM and unemployment benefits are excluded.
// Unknown income is never assumed eligible; its legal classification needs confirmation.
export const feeEligible = source => ['mzda','dpp_dpc'].includes(source.typ) || (source.typ === 'jiny' && source.narokNaPausalOveren === true);
export const optionalOpen = (data, field) => data[OPTIONAL_FIELDS[field]] === true || (present(data[field]) && (!validNumber(data[field]) || Number(data[field]) !== 0));
export function toggleOptional(data, field, checked) {
  if (!OPTIONAL_FIELDS[field]) throw new Error('Neznámé volitelné pole');
  return { ...data, [OPTIONAL_FIELDS[field]]: checked, ...(!checked ? { [field]: 0 } : {}) };
}
export function createDefaultData() {
  const data = {
    schemaVersion: 2, delkaOddluzeni: 36, dluhyNezajistene: '', dluhNeznamy: false,
    typPohledavky: 'neprednostni', pocetExekuci: '1-3', uplatnitPausalPlatce: false,
    partnerProNezabavitelnou1: false, _confirmed: {},
  };
  for (const [field, flag] of Object.entries(OPTIONAL_FIELDS)) { data[field] = 0; data[flag] = false; }
  for (const person of [1,2]) {
    data[`prijmy${person}`] = [{ id: `p${person}-mzda`, typ: 'mzda', castka: '', pridelenaNezabavitelna: '' }];
    data[`vicePlatcu${person}`] = false;
    data[`bezPostizitelnehoPrijmu${person}`] = false;
  }
  for (const suffix of ['1','M']) {
    for (const field of ['povolitPrislibDluznika','povolitPlneniTretiOsoby']) data[field + suffix] = false;
    for (const field of ['zakladniPotreby','zavaznyPrislib','pravidelnePlneniTretiOsoby']) data[field + suffix] = '';
  }
  return data;
}
export function migrateData(saved) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Neplatné uložené údaje');
  const data = { ...createDefaultData(), ...saved, schemaVersion: 2 };
  for (const person of [1,2]) {
    const key = `prijmy${person}`;
    if (!Array.isArray(saved[key])) {
      if (saved[key] !== undefined) throw new Error('Poškozený seznam příjmů');
      data[key] = [['Mzda','mzda'],['Duchod',saved[`duchodPovinny${person}`] ? 'starobni' : 'jiny'],['Dalsi','jiny']]
        .filter(([old]) => number(saved[`prijem${old}${person}`]) > 0)
        .map(([old,typ]) => ({ id: `p${person}-${old}`, typ, castka: Number(saved[`prijem${old}${person}`]), pridelenaNezabavitelna: '' }));
    }
    if (!data[key].length) data[key] = createDefaultData()[key];
    if (data[key].some(s => !s || typeof s !== 'object' || Array.isArray(s))) throw new Error('Poškozený příjem');
    data[`bezPostizitelnehoPrijmu${person}`] = saved[`bezPostizitelnehoPrijmu${person}`] === true || (saved.schemaVersion !== 2 && saved[`desktopManzeleBezPrijmu${person}`] === true);
    const usedIds = new Set();
    data[key] = data[key].map((s,index) => {
      let id = typeof s.id === 'string' && s.id.trim() ? s.id : `p${person}-${index}`;
      if (usedIds.has(id)) throw new Error('Duplicitní identifikátor příjmu');
      usedIds.add(id);
      return { ...s, id, typ: s.typ || 'mzda', castka: s.castka ?? '', pridelenaNezabavitelna: s.pridelenaNezabavitelna ?? '' };
    });
    if (data[key].some(s => present(s.platceId) && typeof s.platceId !== 'string')) throw new Error('Poškozené propojení plátců');
    if (saved.schemaVersion !== 2 && !data[`bezPostizitelnehoPrijmu${person}`]) {
      data[key] = data[key].map(s => ({ ...s, castka: Number(s.castka) === 0 ? '' : s.castka }));
    }
  }
  for (const [key,value] of Object.entries(createDefaultData())) {
    if (typeof value === 'boolean' && data[key] !== true && data[key] !== false) throw new Error('Poškozená odpověď ano/ne');
  }
  for (const p of [1,2]) for (const row of data[`prijmy${p}`]) {
    for (const key of ['castka','pridelenaNezabavitelna']) if (typeof row[key] !== 'number' && typeof row[key] !== 'string') throw new Error('Poškozená částka příjmu');
  }
  // Migrate a formerly global fee only for a single payer. Never apply it to a pension.
  if (!data.vicePlatcu1 && data.uplatnitPausalPlatce && data.prijmy1[0]?.uplatnitPausal === undefined && data.prijmy1.some(feeEligible)) data.prijmy1[0].uplatnitPausal = true;
  data.uplatnitPausalPlatce = false;
  if (saved.partnerProNezabavitelnou1 === undefined) data.partnerProNezabavitelnou1 = hasQualifyingPension(data.prijmy1)
    ? Boolean(saved.maManzelaPartnera1) : Boolean(saved.maManzelaPartnera1 && (saved.partnerMaKvalifikovanyDuchod1 || saved.duchodPartner1));
  if (saved.schemaVersion !== 2 && Number(saved.dluhyNezajistene || 0) === 0) data.dluhyNezajistene = '';
  if (!data._confirmed || typeof data._confirmed !== 'object' || Array.isArray(data._confirmed)) data._confirmed = {};
  // Unrecognized legacy zero/touched values do not count as an explicit answer.
  if (saved.schemaVersion !== 2) data._confirmed = {};
  return data;
}
export function setIncomeSources(data, person, sources) {
  return { ...data, [`prijmy${person}`]: sources, [`bezPostizitelnehoPrijmu${person}`]: false };
}
export function confirmNoIncome(data, person, checked) {
  const patch = { [`bezPostizitelnehoPrijmu${person}`]: checked };
  if (checked) { patch[`prijmy${person}`] = [{ id: `p${person}-none`, typ: 'mzda', castka: 0, pridelenaNezabavitelna: '' }]; patch[`vicePlatcu${person}`] = false; }
  return { ...data, ...patch };
}
export function incomeReady(data, person) {
  const sources = data[`prijmy${person}`];
  if (!Array.isArray(sources) || !sources.length) return false;
  if (!sources.every(s => validNumber(s.castka))) return false;
  if (sumIncomeSources(sources) === 0) return data[`bezPostizitelnehoPrijmu${person}`] === true;
  return data[`bezPostizitelnehoPrijmu${person}`] !== true;
}
export function flowFor(data, mode, results) {
  if (mode === 'nezabavitelna') return ['income','family','execution'];
  const suffix = mode === 'manzele' ? 'M' : '1';
  const coverage = mode === 'manzele' ? results.coverageM : results.coverageJ;
  const extras = data['povolitPrislibDluznika'+suffix] || data['povolitPlneniTretiOsoby'+suffix]
    || present(data['zavaznyPrislib'+suffix]) || present(data['pravidelnePlneniTretiOsoby'+suffix]);
  return [...(mode === 'manzele' ? ['incomeA','incomeB'] : ['income']), 'family','other','debts',
    ...(!coverage.coveredByStatutoryDeduction || extras ? ['minimum'] : [])];
}
export const sectionTitle = step => ({ income:'Vaše příjmy', incomeA:'Příjmy manžela A', incomeB:'Příjmy manžela B', family:'Rodinná situace', other:'Další příjmy a platby', debts:'Dluhy a majetek', execution:'Nastavení exekuce', minimum:'Doplnění měsíčního minima' }[step] || step);
export function sectionSignature(data, mode, step, params) {
  const people = mode === 'manzele' ? [1,2] : [1];
  let fields = [];
  if (step.startsWith('income')) { const p = step === 'incomeB' ? 2 : 1; fields = [`prijmy${p}`,`bezPostizitelnehoPrijmu${p}`,`vicePlatcu${p}`]; }
  if (step === 'family') fields = [...(mode === 'manzele' ? ['spolecneDeti'] : ['partnerProNezabavitelnou1']), ...people.flatMap(p => [`vyzivovaneOsoby${p}`,`osobySVykonemProVyzivne${p}`])];
  if (step === 'other') fields = people.flatMap(p => [`chranenePrijmy${p}`,`bezneMesicniVyzivne${p}`]);
  if (step === 'debts') fields = ['dluhyNezajistene','dluhNeznamy','dluhyZajistene','dluhyNeosvoboditelne','vytezekZpenezeni','delkaOddluzeni'];
  if (step === 'execution') fields = ['typPohledavky','pocetExekuci','uplatnitPausalPlatce','prijmy1','chranenePrijmy1'];
  if (step === 'minimum') {
    // Capacity changes invalidate this check, but never silently delete its entered amounts.
    const copy = { ...data }; delete copy._confirmed;
    return JSON.stringify([copy, params]);
  }
  const valueFor = field => {
    // Fee confirmation belongs to the execution step. It must not invalidate the
    // previously checked income step and create a loop in the mobile workflow.
    if (step.startsWith('income') && field.startsWith('prijmy')) return data[field].map(({uplatnitPausal,narokNaPausalOveren,...source}) => source);
    return data[field] ?? '';
  };
  return JSON.stringify([fields.map(f => [f, valueFor(f), data[OPTIONAL_FIELDS[f]] === true]), step.startsWith('income') ? params : null]);
}
export const sectionReviewed = (data, mode, step, params) => data._confirmed?.[mode]?.[step] === sectionSignature(data,mode,step,params);
export const confirmSection = (data, mode, step, params) => ({ ...data, _confirmed: { ...data._confirmed, [mode]: { ...data._confirmed?.[mode], [step]: sectionSignature(data,mode,step,params) } } });
export function caseStatus(data, mode, results, params = DEFAULT_2026_PARAMS) {
  const errors = [];
  const add = (field, section, message) => errors.push({ field, section, message });
  const people = mode === 'manzele' ? [1,2] : [1];
  for (const p of people) {
    const section = mode === 'manzele' ? (p === 1 ? 'incomeA' : 'incomeB') : 'income';
    if (!incomeReady(data,p)) add(`prijmy${p}`,section,`Doplňte všechny částky příjmů${mode === 'manzele' ? ` manžela ${p === 1 ? 'A' : 'B'}` : ''}, nebo výslovně potvrďte nulový postižitelný příjem.`);
    for (const [index, s] of (data[`prijmy${p}`] || []).entries()) {
      if (present(s.castka) && !validMoney(s.castka)) add(`prijmy${p}`,section,'Částky příjmů zadávejte jako nezáporná konečná čísla, nejvýše na dvě desetinná místa.');
      if (!INCOME_TYPES.some(([id]) => id === s.typ)) add(`prijmy${p}`,section,`Vyberte platný typ příjmu ${index+1}.`);
      if (present(s.pridelenaNezabavitelna) && !validMoney(s.pridelenaNezabavitelna)) add(`prijmy${p}`,section,'Přidělená nezabavitelná částka musí být nezáporné konečné číslo nejvýše na dvě desetinná místa.');
    }
    const r = mode === 'manzele' ? results[`insM_${p === 1 ? 'A' : 'B'}`] : mode === 'nezabavitelna' ? results.ex : results.insJ;
    const countFields = [`vyzivovaneOsoby${p}`,`osobySVykonemProVyzivne${p}`];
    if (p === 1 && mode === 'manzele') countFields.push('spolecneDeti');
    for (const f of countFields) if (!validNumber(data[f]) || !Number.isInteger(Number(data[f]))) add(f,'family','Počet osob musí být celé nezáporné číslo.');
    if (number(data[`osobySVykonemProVyzivne${p}`]) > r.pocetVsechOsob) add(`osobySVykonemProVyzivne${p}`,'family',`Počet osob s vymáhaným výživným${mode === 'manzele' ? ` – manžel ${p === 1 ? 'A' : 'B'}` : ''} přesahuje zadanou rodinnou situaci (nejvýše ${r.pocetVsechOsob}). Opravte počet nebo doplňte rodinné údaje.`);
    for (const f of [`chranenePrijmy${p}`, ...(mode !== 'nezabavitelna' ? [`bezneMesicniVyzivne${p}`] : [])]) if (!validMoney(data[f])) add(f,mode === 'nezabavitelna' ? 'execution' : 'other','Částka musí být nezáporné konečné číslo nejvýše na dvě desetinná místa.');
  }
  if (mode !== 'nezabavitelna') {
    if (!data.dluhNeznamy && !validMoney(data.dluhyNezajistene)) add('dluhyNezajistene','debts','Doplňte výši nezajištěných dluhů, nebo zvolte „Výši dluhů zatím neznám“.');
    if (![36,60].includes(Number(data.delkaOddluzeni))) add('delkaOddluzeni','debts','Vyberte délku oddlužení.');
    for (const f of ['dluhyZajistene','dluhyNeosvoboditelne','vytezekZpenezeni']) if (!validMoney(data[f])) add(f,'debts','Částka musí být nezáporné konečné číslo nejvýše na dvě desetinná místa.');
    const suffix = mode === 'manzele' ? 'M' : '1';
    for (const [flag,fields] of [['povolitPrislibDluznika',['zakladniPotreby','zavaznyPrislib']],['povolitPlneniTretiOsoby',['pravidelnePlneniTretiOsoby']]]) {
      if (data[flag+suffix]) for (const base of fields) {
        const f = base+suffix;
        if (!validMoney(data[f]) || (base === 'zakladniPotreby' && number(data[f]) <= 0)) add(f,'minimum','Doplňte platnou částku; základní potřeby musí být vyšší než nula. Nepoužitý zdroj vypněte.');
      }
    }
  } else {
    if (!['1-3','4+'].includes(data.pocetExekuci)) add('pocetExekuci','execution','Vyberte počet exekucí.');
    if (!['neprednostni','prednostni','vyzivne'].includes(data.typPohledavky)) add('typPohledavky','execution','Vyberte druh pohledávky.');
  }
  for (const key of Object.keys(PARAM_LABELS)) if (!validNumber(params[key]) || (['koeficientZahladu','koeficientZabavitelnosti'].includes(key) && Number(params[key]) === 0)) add(key,'settings',`Opravte odborný parametr: ${PARAM_LABELS[key]}.`);
  for (const [field,flag] of Object.entries(OPTIONAL_FIELDS)) {
    const relevant = field === 'spolecneDeti' ? mode === 'manzele' : /2$/.test(field) ? mode === 'manzele' : true;
    const section = field.includes('Osoby') || field.startsWith('osoby') || field === 'spolecneDeti' ? 'family' : field.startsWith('chranene') ? (mode === 'nezabavitelna' ? 'execution' : 'other') : field.startsWith('bezne') ? 'other' : 'debts';
    if (relevant && !(mode === 'nezabavitelna' && ['other','debts'].includes(section)) && data[flag] === true && number(data[field]) === 0) add(field,section,'U vybrané odpovědi doplňte hodnotu vyšší než nula, nebo odpověď vypněte.');
  }
  const flow = flowFor(data,mode,results);
  const warnings = [];
  for (const [person,r] of mode === 'manzele' ? [[1,results.insM_A],[2,results.insM_B]] : [[1,mode === 'nezabavitelna' ? results.ex : results.insJ]]) {
    if (r.multiPayerNeedsAllocation) warnings.push(`Příjmy osoby ${person}: neúplné nebo nesouhlasící rozdělení nezabavitelné částky. Zobrazen je pouze souhrnný orientační model, nikoli součet skutečných srážek plátců.`);
    if (r.allocationUnused) warnings.push('Příjem některého plátce je nižší než přidělená nezabavitelná částka. Její nevyužitou část kalkulačka sama nepřesouvá; rozdělení je třeba ověřit podle rozhodnutí nebo pokynu.');
    if (r.feeUnresolved) warnings.push('Náhrada plátce u více příjmů vyžaduje ověření jednotlivých plátců; v souhrnném modelu se neuplatnila.');
  }
  const changedParams = Object.keys(PARAM_LABELS).filter(k => Number(params[k]) !== DEFAULT_2026_PARAMS[k]);
  if (changedParams.length) warnings.push('Použity vlastní odborné parametry: '+changedParams.map(k => `${PARAM_LABELS[k]} = ${params[k]}`).join('; ')+'.');
  const reviewed = flow.every(step => sectionReviewed(data,mode,step,params));
  const valid = errors.length === 0;
  return { errors, warnings, flow, valid, reviewed, canExport: valid && reviewed,
    incomeReady: people.every(p => incomeReady(data,p)),
    debtKnown: data.dluhNeznamy !== true && validNumber(data.dluhyNezajistene) && number(data.dluhyNezajistene) > 0,
    changedParams };
}
export function readStored(storage, key, fallback) {
  try { const text = storage.getItem(key); return { value: text ? JSON.parse(text) : fallback, error: null }; }
  catch { return { value: fallback, error: 'Uložené údaje nelze načíst. Výpočet bude pracovat v paměti; starší uložená kopie nebyla změněna.' }; }
}
export function writeStored(storage, key, value) {
  try { storage.setItem(key,JSON.stringify(value)); return true; } catch { return false; }
}

export function sectionHasData(data, mode, step) {
  if (step.startsWith('income')) { const p = step === 'incomeB' ? 2 : 1; return data[`bezPostizitelnehoPrijmu${p}`] || data[`prijmy${p}`].some(s=>present(s.castka)); }
  const people = mode === 'manzele' ? [1,2] : [1];
  if (step === 'family') return Boolean(data.partnerProNezabavitelnou1) || (mode === 'manzele' && optionalOpen(data,'spolecneDeti')) || people.some(p=>optionalOpen(data,`vyzivovaneOsoby${p}`)||optionalOpen(data,`osobySVykonemProVyzivne${p}`));
  if (step === 'other') return people.some(p=>optionalOpen(data,`bezneMesicniVyzivne${p}`)||optionalOpen(data,`chranenePrijmy${p}`));
  if (step === 'debts') return data.dluhNeznamy || present(data.dluhyNezajistene) || ['dluhyZajistene','dluhyNeosvoboditelne','vytezekZpenezeni'].some(f=>optionalOpen(data,f));
  if (step === 'execution') return data.pocetExekuci === '4+' || data.typPohledavky !== 'neprednostni' || optionalOpen(data,'chranenePrijmy1');
  const suffix = mode === 'manzele' ? 'M' : '1';
  return data['povolitPrislibDluznika'+suffix] || data['povolitPlneniTretiOsoby'+suffix] || present(data['zavaznyPrislib'+suffix]) || present(data['pravidelnePlneniTretiOsoby'+suffix]);
}
