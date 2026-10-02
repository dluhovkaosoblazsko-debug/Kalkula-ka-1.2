import assert from 'node:assert/strict';
import { DEFAULT_2026_PARAMS as params } from '../src/lib/calculations2026.js';
import { createDefaultData, caseStatus, formatKc, confirmSection, flowFor } from '../src/kalkulacka/caseState.js';
import { calculateCase } from '../src/kalkulacka/calculateCase.js';

// All displayed scenarios use the unchanged production calculation, not mocked coverage.
const fixture = (mode = 'jednotlivec') => {
  const d = createDefaultData();
  d.prijmy1[0].castka = 16800;
  d.prijmy2[0].castka = 0;
  d.bezPostizitelnehoPrijmu2 = true;
  d[mode === 'manzele' ? 'spolecneDeti' : 'vyzivovaneOsoby1'] = 1;
  d.dluhyNezajistene = 600000;
  const suffix = mode === 'manzele' ? 'M' : '1';
  d['povolitPrislibDluznika' + suffix] = true;
  d['zakladniPotreby' + suffix] = 12000;
  d['zavaznyPrislib' + suffix] = mode === 'manzele' ? 3267 : 2178;
  return d;
};
let count = 0;
const test = (name, run) => { run(); console.log(`OK ${++count}: ${name}`); };
const plain = html => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
const fmt = n => formatKc(n).replace(/\s+/g, ' ');
const { createServer } = await import('vite');
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', esbuild: { jsx: 'transform' } });
try {
  const { default: Fields } = await vite.ssrLoadModule('/src/kalkulacka/CaseFields.jsx');
  const render = (d, mode = 'jednotlivec') => {
    const snapshot = JSON.stringify(d);
    const results = calculateCase(d, params, mode);
    const status = caseStatus(d, mode, results, params);
    const html = renderToStaticMarkup(React.createElement(Fields, { data: d, mode, step: 'minimum', results, errors: status.errors.filter(e => e.section === 'minimum'), setData: () => {} }));
    assert.equal(JSON.stringify(d), snapshot, 'Rendering must never delete or overwrite entered data.');
    return { html, text: plain(html), c: mode === 'manzele' ? results.coverageM : results.coverageJ, status };
  };
  for (const mode of ['jednotlivec', 'manzele']) {
    const suffix = mode === 'manzele' ? 'M' : '1';
    const need = mode === 'manzele' ? 3267 : 2178;
    const own = 'zavaznyPrislib' + suffix, needs = 'zakladniPotreby' + suffix;
    const third = 'pravidelnePlneniTretiOsoby' + suffix, enabled = 'povolitPlneniTretiOsoby' + suffix;
    test(`${mode}: potřebné doplnění není maximální rozpočet`, () => {
      const { html, text, c } = render(fixture(mode), mode);
      assert.equal(c.deficitAfterStatutoryDeduction, need);
      assert.equal(c.availableAboveBasicNeeds, 4800);
      assert(text.includes(`Do potřebné měsíční splátky chybí ${fmt(need)}.`));
      assert(text.includes(`Kolik z chybějících ${fmt(need)}`));
      assert(text.includes(fmt(16800 - need)));
      assert(text.includes('4 800 Kč'));
      assert(!text.includes(`nejvýše ${fmt(need)}`));
      assert(!html.includes('data-testid="third-party-funding"'));
      assert(text.includes('Podle zadaného rozpočtu'));
    });
    test(`${mode}: vlastní část platby vede k přesnému zbývajícímu rozdílu`, () => {
      const { html, text, c } = render({ ...fixture(mode), [own]: 1000 }, mode);
      assert.equal(c.deficitAfterDebtorPromise, need - 1000);
      assert(text.includes(`je potřeba zajistit ještě ${fmt(need - 1000)} měsíčně.`));
      assert(text.includes('15 800 Kč'));
      assert(html.includes('data-testid="third-party-funding"'));
    });
    test(`${mode}: rozpočet 16000 dovolí započítat pouze 800, ne celé doplnění`, () => {
      const { text, c } = render({ ...fixture(mode), [needs]: 16000 }, mode);
      assert.equal(c.debtorPromise, 800);
      assert.equal(c.deficitAfterDebtorPromise, need - 800);
      assert(text.includes(`Zadali jste ${fmt(need)}, ale`));
      assert(text.includes('zbývá jen 800 Kč'));
      assert(text.includes(`stále chybí ${fmt(need - 800)}`));
    });
    test(`${mode}: vyšší zadaná platba se vysvětluje potřebou, ne zákazem platit více`, () => {
      const { text, c } = render({ ...fixture(mode), [own]: 4000 }, mode);
      assert.equal(c.debtorPromise, need);
      assert(text.includes(`K doplnění celého minima je potřeba ${fmt(need)}, nikoli celá zadaná platba 4 000 Kč.`));
      assert(text.includes('Zadanou částku jsme nesmazali'));
    });
    for (const active of [true, false]) test(`${mode}: dřívější pomoc zůstane dostupná, aktivní=${active}`, () => {
      const { html, text } = render({ ...fixture(mode), [enabled]: active, [third]: 900 }, mode);
      assert(html.includes('data-testid="third-party-funding"'));
      assert(html.includes(`name="${third}"`));
      assert(text.includes('Minimum je už pokryté bez této pomoci.'));
      if (!active) assert(text.includes('Tuto dříve zadanou pomoc teď nepočítáme.'));
    });
    test(`${mode}: zapnutá pomoc s prázdnou částkou nezmizí a nedá falešné potvrzení`, () => {
      const { html, text, status } = render({ ...fixture(mode), [enabled]: true, [third]: '' }, mode);
      assert(html.includes(`name="${third}"`));
      assert(text.includes('Nejdřív opravte označené částky.'));
      assert(!text.includes('Podle zadaných údajů je potřebné měsíční minimum pokryté.'));
      assert(!status.canExport);
    });
    test(`${mode}: neznámé potřeby nejsou nulový rozpočet ani potvrzená schopnost doplatit`, () => {
      const { html, text, status } = render({ ...fixture(mode), [needs]: '' }, mode);
      assert(text.includes('Nejdřív uveďte platnou částku na živobytí.'));
      assert(!html.includes('data-testid="own-budget"'));
      assert(!html.includes('data-testid="own-funding-summary"'));
      assert(!status.canExport);
    });
    test(`${mode}: kombinace vlastních peněz a pomoci pokryje minimum`, () => {
      let d = { ...fixture(mode), [own]: 1000, [enabled]: true, [third]: need - 1000 };
      for (const step of flowFor(d, mode, calculateCase(d, params, mode))) d = confirmSection(d, mode, step, params);
      const { text, c, status } = render(d, mode);
      assert.equal(c.finalDeficit, 0);
      assert(status.canExport);
      assert(text.includes('Podle zadaných údajů je potřebné měsíční minimum pokryté.'));
      assert(text.includes('tato verze kalkulačky zatím nezahrnuje'));
      assert(text.includes('Právně přesně'));
    });
  }
  test('Nedostatek peněz po srážce se nezobrazuje jako záporný zůstatek na život', () => {
    const d = fixture(); d.prijmy1[0].castka = 1000; d.zakladniPotreby1 = 1500;
    const { text } = render(d);
    assert(text.includes('Samotné peníze po srážce na celé doplnění nestačí.'));
    assert(text.includes('Na zadané živobytí vám už po srážce chybí 500 Kč.'));
    assert(!text.includes('-1 178'));
  });
  test('Výživné mění potřebnou částku, nikoli jen popisek pevné hodnoty 2178', () => {
    const { text, c } = render({ ...fixture(), bezneMesicniVyzivne1: 1000, zavaznyPrislib1: 3178 });
    assert.equal(c.deficitAfterStatutoryDeduction, 3178);
    assert(text.includes('z chybějících 3 178 Kč'));
  });
  test('Haléřový rozdíl zůstává viditelný', () => {
    const { text, c } = render({ ...fixture(), zavaznyPrislib1: 2177.6 });
    assert.equal(c.finalDeficit, 0.4);
    assert(text.includes('je potřeba zajistit ještě 0,4 Kč'));
  });
  test('Bez chybějícího minima se nenabízí nové zbytečné příspěvky', () => {
    const d = createDefaultData(); d.prijmy1[0].castka = 30000;
    const { html, text } = render(d);
    assert(text.includes('Nic navíc není potřeba doplňovat.'));
    assert(!html.includes('data-testid="third-party-funding"'));
    assert(!text.includes('Chci chybějící částku'));
  });
} finally { await vite.close(); }
console.log(`Minimum funding checks: ${count} úspěšných.`);
