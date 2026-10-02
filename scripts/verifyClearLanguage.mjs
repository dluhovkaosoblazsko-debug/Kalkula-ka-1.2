import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { DEFAULT_2026_PARAMS as params } from '../src/lib/calculations2026.js';
import { createDefaultData, confirmSection, flowFor, caseStatus } from '../src/kalkulacka/caseState.js';
import { calculateCase } from '../src/kalkulacka/calculateCase.js';
import { nextStepMessage, sectionTitle } from '../src/kalkulacka/uiCopy.js';
let count = 0;
const test = (name, run) => { run(); console.log(`OK ${++count}: ${name}`); };
const base = (income = 30000) => ({ ...createDefaultData(), prijmy1: [{ id: 'a', typ: 'mzda', castka: income, pridelenaNezabavitelna: '' }], prijmy2: [{ id: 'b', typ: 'mzda', castka: 25000, pridelenaNezabavitelna: '' }], dluhyNezajistene: 600000 });
const done = (data, mode = 'jednotlivec') => { for (const step of flowFor(data, mode, calculateCase(data, params, mode))) data = confirmSection(data, mode, step, params); return data; };
const status = (d, mode = 'jednotlivec') => caseStatus(d, mode, calculateCase(d, params, mode), params);
// These source fingerprints lock the numerical model, validation, persisted state
// and export guards to the audited baseline. A later deliberate logic change must
// review this snapshot test rather than silently turn it off.
const protectedFiles = {
  'src/kalkulacka/caseState.js': '7ebec0307954da7b1b800572d17c22b2bfa402a1',
  'src/kalkulacka/calculateCase.js': 'ea7949e62867978d18832f26eb8c0871976d634c',
  'src/kalkulacka/PrintableCalculationReport.jsx': 'f821ccf7493c11e277f0e8f35bd6a48cfcdf089c',
  'src/kalkulacka/CalculationBreakdown.jsx': '0839f011c6dbf03f8f7236fe330061fc95a30cc4',
  'src/lib/calculations2026.js': 'd6d3ccad97f10a69bb1697825ac23cb9890f3a7f',
};
for (const [path, expected] of Object.entries(protectedFiles)) test(`Beze změny: ${path}`, () => {
  const bytes = fs.readFileSync(path);
  assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), expected);
});
test('Nápověda vede k prvnímu nedokončenému kroku, ne k pozdějším dluhům', () => {
  const d = createDefaultData(); assert(nextStepMessage(status(d), d, 'jednotlivec', params).startsWith('Nejdřív doplňte příjem'));
});
test('U druhého manžela nápověda jmenuje právě jeho', () => {
  let d = base(); d.prijmy2[0].castka = ''; d = confirmSection(d, 'manzele', 'incomeA', params);
  assert(nextStepMessage(status(d, 'manzele'), d, 'manzele', params).includes('manžela B'));
});
test('Nové názvy částí nemění interní identifikátory', () => {
  assert.equal(sectionTitle('family'), 'Rodinná situace'); assert.equal(sectionTitle('minimum'), 'Jak doplnit chybějící částku');
  assert(status(base(15000)).flow.includes('minimum'));
});
test('Teprve platné dokončené zadání smí hlásit připravenost k tisku', () => {
  assert(!nextStepMessage(status(base()), base(), 'jednotlivec', params).includes('připravený k tisku'));
  const d = done(base()); assert(nextStepMessage(status(d), d, 'jednotlivec', params).includes('připravený k tisku'));
});
if (process.argv.includes('--render')) {
  const { createServer } = await import('vite');
  const React = (await import('react')).default;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', esbuild: { jsx: 'transform' } });
  try {
    const { default: Results, InputSummary } = await vite.ssrLoadModule('/src/kalkulacka/CaseResults.jsx');
    const { default: Fields } = await vite.ssrLoadModule('/src/kalkulacka/CaseFields.jsx');
    const { default: Report, buildCalculationShareText } = await vite.ssrLoadModule('/src/kalkulacka/PrintableCalculationReport.jsx');
    const render = (C, data, mode = 'jednotlivec', more = {}) => renderToStaticMarkup(React.createElement(C, { data, mode, params, results: calculateCase(data, params, mode), setData: () => {}, ...more }));
    test('Výsledek zachovává částky a nejprve ukazuje srážku, zůstatek a minimum', () => {
      const text = render(Results, done(base()));
      assert(text.includes('10 598')); assert(text.includes('19 402')); assert(text.includes('data-state="complete"'));
      assert(text.indexOf('monthly-deduction') < text.indexOf('minimum-summary'));
      assert(text.indexOf('minimum-summary') < text.indexOf('repayment-estimate'));
    });
    test('Bez další pomoci výsledek nezobrazuje nuly příslibu a třetí osoby', () => {
      const text = render(Results, done(base())); assert(!text.includes('own-payment-summary')); assert(!text.includes('third-party-summary'));
      assert(!text.includes('Příslib použitý pro minimum')); assert(!text.includes('Zadaný aktivní příspěvek'));
    });
    test('Vlastní platba ukazuje také zůstatek po této platbě', () => {
      const d = done({ ...base(15000), povolitPrislibDluznika1: true, zakladniPotreby1: 12000, zavaznyPrislib1: 1000 });
      const text = render(Results, d); assert(text.includes('own-payment-summary')); assert(text.includes('13 402')); assert(!text.includes('third-party-summary'));
    });
    test('Pomoc jiné osoby nezmizí a dlouhodobé omezení zůstává viditelné', () => {
      const d = done({ ...base(15000), povolitPlneniTretiOsoby1: true, pravidelnePlneniTretiOsoby1: 2000 });
      const text = render(Results, d); assert(text.includes('third-party-summary')); assert(text.includes('2 000')); assert(text.includes('Odhad splacení níže nezahrnuje'));
      assert(text.includes('Samotné pokrytí minima neznamená schválení oddlužení.'));
    });
    test('Neznámý dluh je vysvětlen bez fiktivního procenta v UI, reportu i sdílení', () => {
      const d = done({ ...base(), dluhNeznamy: true, dluhyNezajistene: '' });
      for (const text of [render(Results, d), render(Report, d), buildCalculationShareText({ mode: 'jednotlivec', data: d, results: calculateCase(d, params), params })]) {
        assert(text.includes('Odhad zatím nelze určit')); assert(!text.includes('0 %'));
      }
      assert(render(Results, d).includes('Výši dluhů zatím neznáme'));
    });
    test('Nulový dluh se nevydává za neznámý', () => {
      const text = render(Results, done({ ...base(), dluhyNezajistene: 0 })); assert(text.includes('U běžných dluhů je zadáno 0 Kč')); assert(!text.includes('Výši dluhů zatím neznáme'));
    });
    test('Neplatná rodina stále blokuje částky i sdílení', () => {
      const d = done({ ...base(), osobySVykonemProVyzivne1: 5 });
      const text = render(Results, d); assert(text.includes('data-state="draft"')); assert(!text.includes('monthly-deduction')); assert(!text.includes('připravený k tisku'));
      assert.throws(() => buildCalculationShareText({ mode: 'jednotlivec', data: d, results: calculateCase(d, params), params }));
    });
    test('Placené a přijaté výživné je srozumitelně rozlišeno', () => {
      const text = render(Fields, base(), 'jednotlivec', { step: 'other' });
      assert(text.includes('Platíte někomu pravidelně výživné?')); assert(text.includes('Výživné, které dostáváte, uvedete zvlášť.')); assert(text.includes('Právně přesně'));
    });
    test('Shrnutí neukazuje interní klíč typu pohledávky', () => {
      const text = render(InputSummary, base(), 'nezabavitelna', { step: 'execution' }); assert(text.includes('nepřednostní dluh')); assert(!text.includes('neprednostni'));
    });
    test('Neaktivní dříve zadaná pomoc je ve shrnutí stále dostupná', () => {
      const text = render(InputSummary, { ...base(), pravidelnePlneniTretiOsoby1: 2000 }, 'jednotlivec', { step: 'minimum' }); assert(text.includes('2 000')); assert(text.includes('nepoužívá se'));
    });
  } finally { await vite.close(); }
}
console.log(`Kontroly srozumitelnosti: ${count} úspěšných.`);
