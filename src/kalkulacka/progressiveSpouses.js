// UI-only helpers. Legal calculations remain in src/lib/calculations2026.js.
export const OPTIONAL_FIELDS = Object.freeze({
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
});

export function normalizeFormNumber(value, integer = false) {
  const number = Number(value);
  const safe = Number.isFinite(number) ? Math.max(0, number) : 0;
  return integer ? Math.floor(safe) : safe;
}

export function optionalFieldIsOpen(data, field) {
  // Nonzero values from mobile, another mode, or an older save must stay visible,
  // even when a saved UI flag is false. No data is modified during rendering.
  return Boolean(data[OPTIONAL_FIELDS[field]]) || normalizeFormNumber(data[field]) > 0;
}

export function toggleOptionalField(data, field, checked) {
  const flag = OPTIONAL_FIELDS[field];
  if (!flag) throw new Error(`Unknown progressive field: ${field}`);
  return { ...data, [flag]: Boolean(checked), ...(!checked ? { [field]: 0 } : {}) };
}

export function spouseIncomeState(data, results) {
  const a = Number(results.totalPrijem1) > 0 || data.desktopManzeleBezPrijmu1 === true;
  const b = Number(results.totalPrijem2) > 0 || data.desktopManzeleBezPrijmu2 === true;
  return { a, b, showSecond: a || b, ready: a && b };
}

export function spouseFamilyErrors(data, results) {
  const errors = {};
  for (const [person, letter] of [[1, 'A'], [2, 'B']]) {
    const field = `osobySVykonemProVyzivne${person}`;
    // Use the existing calculation result, including the spouse when applicable.
    // Do not reproduce pension/partner eligibility rules in the UI.
    const maximum = normalizeFormNumber(results[`insM_${letter}`]?.pocetVsechOsob);
    if (normalizeFormNumber(data[field]) > maximum) {
      errors[field] = `U manžela ${letter} je uvedeno více osob s vymáhaným výživným, než připouštějí zadané rodinné údaje (nejvýše ${maximum}). Opravte počet nebo doplňte rodinnou situaci.`;
    }
  }
  return errors;
}
