import { createDefaultData, OPTIONAL_FIELDS, hasQualifyingPension, validNumber } from './caseState.js';

// Keep the audited flat calculation input unchanged. Only this adapter stores
// independent family answers; cached families never enter a result/signature.
export const FAMILY_MODES = ['jednotlivec', 'manzele', 'nezabavitelna'];
export const FAMILY_STORAGE_KEY = '_familyWorkspace';
const COUNTS = ['spolecneDeti', 'vyzivovaneOsoby1', 'vyzivovaneOsoby2', 'osobySVykonemProVyzivne1', 'osobySVykonemProVyzivne2'];
const ALL_KEYS = [...COUNTS, ...COUNTS.map(key => OPTIONAL_FIELDS[key]), 'partnerProNezabavitelnou1'];
const keysFor = mode => mode === 'manzele'
  ? ALL_KEYS.filter(key => key !== 'partnerProNezabavitelnou1')
  : ['vyzivovaneOsoby1', 'osobySVykonemProVyzivne1', OPTIONAL_FIELDS.vyzivovaneOsoby1, OPTIONAL_FIELDS.osobySVykonemProVyzivne1, 'partnerProNezabavitelnou1'];
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const requireMode = mode => { if (!FAMILY_MODES.includes(mode)) throw new Error('Neplatný typ výpočtu'); };
const defaults = () => Object.fromEntries(ALL_KEYS.map(key => [key, createDefaultData()[key]]));
const pick = (data, mode) => Object.fromEntries(keysFor(mode).map(key => [key, data[key]]));
const strip = data => {
  const next = { ...data };
  for (const key of [...ALL_KEYS, FAMILY_STORAGE_KEY]) delete next[key];
  return next;
};
function checkShape(family, keys) {
  if (!isObject(family)) throw new Error('Poškozené rodinné údaje');
  for (const key of keys) {
    if (COUNTS.includes(key)) {
      if (typeof family[key] !== 'number' && typeof family[key] !== 'string') throw new Error('Poškozený počet osob');
    } else if (typeof family[key] !== 'boolean') throw new Error('Poškozená rodinná odpověď');
  }
}
function clearReview(shared, modes) {
  const confirmed = { ...shared._confirmed };
  for (const mode of modes) {
    confirmed[mode] = { ...confirmed[mode] };
    delete confirmed[mode].family;
    delete confirmed[mode].minimum;
  }
  return { ...shared, _confirmed: confirmed };
}
export const legacyReviewPending = workspace => Boolean(workspace.legacy && !workspace.legacyResolvedTo);

export function restoreFamilyWorkspace(data = createDefaultData()) {
  const stored = data[FAMILY_STORAGE_KEY];
  const empty = defaults();
  if (stored !== undefined) {
    if (!isObject(stored) || stored.version !== 1 || !isObject(stored.byMode)) throw new Error('Neplatné uložené rodinné varianty');
    requireMode(stored.mode);
    if (!Array.isArray(stored.visited) || stored.visited.some(mode => !FAMILY_MODES.includes(mode))) throw new Error('Poškozené rodinné varianty');
    const byMode = {};
    for (const mode of FAMILY_MODES) {
      checkShape(stored.byMode[mode], keysFor(mode));
      byMode[mode] = pick(stored.byMode[mode], mode);
    }
    if (stored.legacy !== null) checkShape(stored.legacy, ALL_KEYS);
    if (stored.legacyResolvedTo !== null) requireMode(stored.legacyResolvedTo);
    return { shared: strip(data), byMode, mode: stored.mode, visited: [...stored.visited],
      legacy: stored.legacy === null ? null : { ...stored.legacy }, legacyResolvedTo: stored.legacyResolvedTo };
  }
  // Old versions never stored the active mode. Do not guess whether person 1's
  // count meant all dependents or extra dependents beside the common children.
  const legacy = { ...empty, ...Object.fromEntries(ALL_KEYS.filter(key => data[key] !== undefined).map(key => [key, data[key]])) };
  checkShape(legacy, ALL_KEYS);
  const meaningful = ALL_KEYS.some(key => COUNTS.includes(key)
    ? legacy[key] === '' || Number(legacy[key]) !== 0
    : legacy[key] === true);
  return { shared: clearReview(strip(data), FAMILY_MODES), mode: 'jednotlivec', visited: [],
    byMode: Object.fromEntries(FAMILY_MODES.map(mode => [mode, pick(empty, mode)])),
    legacy: meaningful ? legacy : null, legacyResolvedTo: null };
}
export function activeFamilyData(workspace) {
  requireMode(workspace.mode);
  return { ...workspace.shared, ...defaults(), ...workspace.byMode[workspace.mode] };
}
export function serializeFamilyWorkspace(workspace) {
  return { ...activeFamilyData(workspace), [FAMILY_STORAGE_KEY]: {
    version: 1, mode: workspace.mode, byMode: workspace.byMode, visited: workspace.visited,
    legacy: workspace.legacy, legacyResolvedTo: workspace.legacyResolvedTo,
  } };
}
export function updateFamilyCase(workspace, update) {
  if (legacyReviewPending(workspace)) throw new Error('Nejprve zařaďte starší rodinné údaje');
  const before = activeFamilyData(workspace);
  const next = typeof update === 'function' ? update(before) : update;
  if (!isObject(next)) throw new Error('Neplatné zadání');
  const family = pick(next, workspace.mode);
  checkShape(family, keysFor(workspace.mode));
  return { ...workspace, shared: strip(next), byMode: { ...workspace.byMode, [workspace.mode]: family },
    visited: [...new Set([...workspace.visited, workspace.mode])] };
}
export function switchFamilyMode(workspace, mode) {
  requireMode(mode);
  if (legacyReviewPending(workspace)) throw new Error('Nejprve zařaďte starší rodinné údaje');
  return { ...workspace, mode, visited: [...new Set([...workspace.visited, mode])] };
}
export function assignLegacyFamily(workspace, mode) {
  requireMode(mode);
  if (!legacyReviewPending(workspace)) throw new Error('Starší rodinné údaje již byly zařazeny');
  // Keep the complete original snapshot for inspection, including fields that
  // do not belong to the selected mode. Never erase or reinterpret them.
  return { ...workspace, mode, byMode: { ...workspace.byMode, [mode]: pick(workspace.legacy, mode) },
    visited: [...new Set([...workspace.visited, mode])], legacyResolvedTo: mode,
    shared: clearReview(workspace.shared, [mode]) };
}
const validCount = value => validNumber(value) && Number.isInteger(Number(value));
export function familyCopySources(workspace) {
  return workspace.visited.filter(mode => mode !== workspace.mode);
}
export function previewFamilyCopy(workspace, from, commonChildren = '') {
  requireMode(from);
  if (legacyReviewPending(workspace) || !familyCopySources(workspace).includes(from)) throw new Error('Neplatný zdroj rodinných údajů');
  const source = workspace.byMode[from], target = workspace.mode;
  for (const key of keysFor(from).filter(key => COUNTS.includes(key))) {
    if (!validCount(source[key])) throw new Error('Nejprve opravte počty osob ve zdrojovém výpočtu');
  }
  if (target === 'manzele') {
    // An individual total cannot identify shared children. Require an explicit
    // split, preserve B's own answers, and replace A rather than adding to A.
    if (!validCount(commonChildren) || Number(commonChildren) > Number(source.vyzivovaneOsoby1)) throw new Error('Doplňte počet společných dětí z převzatého počtu osob');
    const common = Number(commonChildren), extraA = Number(source.vyzivovaneOsoby1) - common;
    return { ...workspace.byMode.manzele, spolecneDeti: common, vyzivovaneOsoby1: extraA,
      [OPTIONAL_FIELDS.spolecneDeti]: common > 0,
      [OPTIONAL_FIELDS.vyzivovaneOsoby1]: extraA > 0,
      osobySVykonemProVyzivne1: source.osobySVykonemProVyzivne1,
      [OPTIONAL_FIELDS.osobySVykonemProVyzivne1]: source[OPTIONAL_FIELDS.osobySVykonemProVyzivne1] };
  }
  if (from === 'manzele') {
    // Single-person modes use income/person A. Never transfer B's family to A.
    const total = Number(source.spolecneDeti) + Number(source.vyzivovaneOsoby1);
    if (!validCount(total)) throw new Error('Neplatný celkový počet osob');
    return { vyzivovaneOsoby1: total, osobySVykonemProVyzivne1: source.osobySVykonemProVyzivne1,
      [OPTIONAL_FIELDS.vyzivovaneOsoby1]: total > 0 || source[OPTIONAL_FIELDS.vyzivovaneOsoby1] || source[OPTIONAL_FIELDS.spolecneDeti],
      [OPTIONAL_FIELDS.osobySVykonemProVyzivne1]: source[OPTIONAL_FIELDS.osobySVykonemProVyzivne1],
      partnerProNezabavitelnou1: hasQualifyingPension(workspace.shared.prijmy1) || hasQualifyingPension(workspace.shared.prijmy2) };
  }
  return pick(source, target);
}
export function applyFamilyCopy(workspace, from, commonChildren = '') {
  const next = previewFamilyCopy(workspace, from, commonChildren);
  return { ...workspace, byMode: { ...workspace.byMode, [workspace.mode]: next },
    shared: clearReview(workspace.shared, [workspace.mode]) };
}
