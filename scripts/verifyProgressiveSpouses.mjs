import assert from 'node:assert/strict';
import {
  OPTIONAL_FIELDS, normalizeFormNumber, optionalFieldIsOpen, toggleOptionalField,
  spouseIncomeState, spouseFamilyErrors,
} from '../src/kalkulacka/progressiveSpouses.js';

let passed = 0;
const check = (name, run) => { run(); passed += 1; console.log(`OK ${passed}: ${name}`); };
const result = (a = 0, b = 0, peopleA = 0, peopleB = 0) => ({
  totalPrijem1: a, totalPrijem2: b,
  insM_A: { pocetVsechOsob: peopleA, legalniMinimum: 14102 },
  insM_B: { pocetVsechOsob: peopleB, legalniMinimum: 14102 },
});

check('Prázdný formulář neodkryje manžela B ani rodinné údaje', () => {
  assert.deepEqual(spouseIncomeState({}, result()), { a: false, b: false, showSecond: false, ready: false });
});
check('Příjem A odkryje B, ale nestačí k dokončení zadání příjmů', () => {
  assert.deepEqual(spouseIncomeState({}, result(26000)), { a: true, b: false, showSecond: true, ready: false });
});
check('Dva vyplněné příjmy odkryjí další otázky', () => assert(spouseIncomeState({}, result(26000, 18000)).ready));
check('Výslovné potvrzení nuly A umožní vyplnit příjem B', () => {
  assert(spouseIncomeState({ desktopManzeleBezPrijmu1: true }, result()).showSecond);
});
check('Jeden nulový příjem neblokuje domácnost po potvrzení', () => {
  assert(spouseIncomeState({ desktopManzeleBezPrijmu2: true }, result(26000)).ready);
});
check('Dva potvrzené nulové příjmy umožní další zadání, včetně pomoci třetí osoby', () => {
  assert(spouseIncomeState({ desktopManzeleBezPrijmu1: true, desktopManzeleBezPrijmu2: true }, result()).ready);
});
check('Uložený příjem B je vidět i před potvrzením příjmu A', () => {
  const state = spouseIncomeState({}, result(0, 18000));
  assert(state.showSecond && !state.ready);
});
check('Záporná a nečíselná částka se normalizuje bezpečně', () => {
  for (const value of [-5, 'abc', Infinity, NaN, '']) assert.equal(normalizeFormNumber(value), 0);
  assert.equal(normalizeFormNumber(1633.5), 1633.5);
  assert.equal(normalizeFormNumber(2.7, true), 2);
});
for (const [field, flag] of Object.entries(OPTIONAL_FIELDS)) {
  check(`${field}: nenulová částka z mobilu nebo starého uložení nemůže být skrytá`, () => {
    assert(optionalFieldIsOpen({ [field]: 3000 }, field));
    assert(optionalFieldIsOpen({ [field]: 3000, [flag]: false }, field));
    assert(!optionalFieldIsOpen({ [field]: 0, [flag]: false }, field));
    assert(optionalFieldIsOpen({ [field]: 0, [flag]: true }, field));
  });
}
check('Vypnutí výživného A vymaže pouze jeho hodnotu, nikoli B nebo ostatní údaje', () => {
  const original = Object.freeze({ bezneMesicniVyzivne1: 3000, bezneMesicniVyzivne2: 1500, chranenePrijmy1: 700, spolecneDeti: 2 });
  const next = toggleOptionalField(original, 'bezneMesicniVyzivne1', false);
  assert.equal(next.bezneMesicniVyzivne1, 0);
  assert.equal(next.bezneMesicniVyzivne2, 1500);
  assert.equal(next.chranenePrijmy1, 700);
  assert.equal(next.spolecneDeti, 2);
  assert.equal(original.bezneMesicniVyzivne1, 3000);
  assert(!optionalFieldIsOpen(next, 'bezneMesicniVyzivne1'));
});
check('Vypnutí společných dětí nesmaže další děti ani vymáhané výživné manželů', () => {
  const next = toggleOptionalField({ spolecneDeti: 2, vyzivovaneOsoby1: 1, osobySVykonemProVyzivne2: 1 }, 'spolecneDeti', false);
  assert.equal(next.spolecneDeti, 0);
  assert.equal(next.vyzivovaneOsoby1, 1);
  assert.equal(next.osobySVykonemProVyzivne2, 1);
});
check('Opt-in s nulovou částkou přežije uložení a opětovné načtení', () => {
  const next = JSON.parse(JSON.stringify(toggleOptionalField({ chranenePrijmy2: 0 }, 'chranenePrijmy2', true)));
  assert(optionalFieldIsOpen(next, 'chranenePrijmy2'));
});
check('Reset do čistých dat zavře všechny volitelné části', () => {
  for (const field of Object.keys(OPTIONAL_FIELDS)) assert(!optionalFieldIsOpen({}, field));
});
check('Počet osob s vymáháním se kontroluje pro každého manžela samostatně', () => {
  const errors = spouseFamilyErrors({ osobySVykonemProVyzivne1: 3, osobySVykonemProVyzivne2: 1 }, result(26000, 18000, 2, 2));
  assert(errors.osobySVykonemProVyzivne1);
  assert(!errors.osobySVykonemProVyzivne2);
});
check('Započteného partnera přebírá validace z jádra, ne z nové kopie pravidel', () => {
  assert.deepEqual(spouseFamilyErrors({ osobySVykonemProVyzivne1: 1 }, result(0, 18000, 1, 1)), {});
});
check('Snížení počtu rodinných osob vyvolá chybu místo tichého smazání vymáhání', () => {
  const data = Object.freeze({ osobySVykonemProVyzivne1: 2 });
  assert(spouseFamilyErrors(data, result(26000, 18000, 1, 1)).osobySVykonemProVyzivne1);
  assert.equal(data.osobySVykonemProVyzivne1, 2);
});
check('Opravený počet rodinných osob zruší chybu', () => {
  assert.deepEqual(spouseFamilyErrors({ osobySVykonemProVyzivne1: 1, osobySVykonemProVyzivne2: 2 }, result(26000, 18000, 1, 2)), {});
});
check('Neznámý přepínač nemůže měnit libovolné pole', () => assert.throws(() => toggleOptionalField({}, 'prijmy1', false)));

if (process.argv.includes('--render')) {
  const { createServer } = await import('vite');
  const React = (await import('react')).default;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', esbuild: { jsx: 'transform' } });
  try {
    const { default: Form } = await vite.ssrLoadModule('/src/kalkulacka/DesktopSpousesForm.jsx');
    const baseData = {
      prijmy1: [{ id: 'a', typ: 'mzda', castka: 0 }], prijmy2: [{ id: 'b', typ: 'mzda', castka: 0 }],
      spolecneDeti: 0, vyzivovaneOsoby1: 0, vyzivovaneOsoby2: 0,
      osobySVykonemProVyzivne1: 0, osobySVykonemProVyzivne2: 0,
      bezneMesicniVyzivne1: 0, bezneMesicniVyzivne2: 0,
      chranenePrijmy1: 0, chranenePrijmy2: 0, delkaOddluzeni: 36,
    };
    const render = (data, results) => renderToStaticMarkup(React.createElement(Form, {
      data: { ...baseData, ...data }, results, setData: () => {},
      IncomeSourcesEditor: ({ label }) => React.createElement('div', null, label),
      handleIncomeSourcesChange: () => {}, handleMultiplePayersChange: () => {},
      dluhyNezajisteneDraft: '0', setDluhyNezajisteneDraft: () => {},
      commitDluhyNezajistene: () => {}, setEditingDluhyNezajistene: () => {},
      formatKc: (amount) => `${amount} Kč`,
    }));
    check('Render: čistý formulář obsahuje jen příjem A', () => {
      const html = render({}, result());
      assert(html.includes('1. Příjmy manžela A'));
      assert(!html.includes('2. Příjmy manžela B'));
      assert(!html.includes('3. Rodinná situace'));
    });
    check('Render: vyplnění příjmu A odkryje B, ne rodinnou situaci', () => {
      const html = render({}, result(26000));
      assert(html.includes('2. Příjmy manžela B'));
      assert(!html.includes('3. Rodinná situace'));
    });
    check('Render: po příjmech jsou otázky vidět, nevybraná peněžní pole nikoli', () => {
      const html = render({}, result(26000, 18000));
      assert(html.includes('3. Rodinná situace'));
      assert(html.includes('5. Společné dluhy a majetek'));
      assert(!html.includes('name="bezneMesicniVyzivne1"'));
      assert(!html.includes('name="bezneMesicniVyzivne2"'));
      assert(!html.includes('name="dluhyZajistene"'));
    });
    check('Render: stará nenulová hodnota odkryje vstup i s vypnutým UI příznakem', () => {
      const html = render({ bezneMesicniVyzivne2: 1800, desktopManzelePlatiVyzivne2: false }, result(26000, 18000));
      assert(html.includes('name="bezneMesicniVyzivne2"'));
      assert(!html.includes('name="bezneMesicniVyzivne1"'));
    });
    check('Render: chyba počtu je viditelná a navázaná na vstup', () => {
      const html = render({ osobySVykonemProVyzivne1: 3 }, result(26000, 18000, 2, 2));
      assert(html.includes('aria-invalid="true"'));
      assert(html.includes('role="alert"'));
      assert(html.includes('nejvýše 2'));
    });
    check('Render: dvě potvrzené nuly neblokují volbu chráněných příjmů a dluhů', () => {
      const html = render({ desktopManzeleBezPrijmu1: true, desktopManzeleBezPrijmu2: true }, result());
      assert(html.includes('5. Společné dluhy a majetek'));
    });
  } finally { await vite.close(); }
}
console.log(`Celkem ${passed} kontrol prošlo.`);
