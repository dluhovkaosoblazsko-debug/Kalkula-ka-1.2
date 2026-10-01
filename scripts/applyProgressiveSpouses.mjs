// One-time, guarded source migration on the feature branch. Removed before merge.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const path = 'src/kalkulacka/HlavniKalkulackaPage.jsx';
const original = fs.readFileSync(path, 'utf8');
const bytes = Buffer.from(original);
const blobSha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
assert.equal(blobSha, 'd58a1ea84c2463f03a5124d053aedb5930f8cd81', 'Main component changed: do not apply the migration to another version.');
let source = original;
function once(before, after) {
  assert.equal(source.split(before).length, 2, `Expected exactly one anchor: ${before.slice(0, 100)}`);
  source = source.replace(before, after);
}
function cut(start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  assert(first >= 0 && last > first, `Missing source block: ${start}`);
  source = source.slice(0, first) + source.slice(last);
}

once("import PrintableCalculationReport from './PrintableCalculationReport';", `import PrintableCalculationReport from './PrintableCalculationReport';
import DesktopSpousesForm from './DesktopSpousesForm';
import { optionalFieldIsOpen, spouseIncomeState, spouseFamilyErrors } from './progressiveSpouses';`);

once('const IncomeSourcesEditor = ({ sources, multiplePayers, onSourcesChange, onMultiplePayersChange, label }) => {',
  "const IncomeSourcesEditor = ({ sources, multiplePayers, onSourcesChange, onMultiplePayersChange, label, idPrefix = 'desktop' }) => {");
const editorStart = source.indexOf('const IncomeSourcesEditor =');
const editorEnd = source.indexOf('const MinimumCoveragePanel =');
const editor = source.slice(editorStart, editorEnd).replaceAll('${source.id}-', '${idPrefix}-${source.id}-');
source = source.slice(0, editorStart) + editor + source.slice(editorEnd);

once('    setData((prev) => ({ ...prev, [`prijmy${person}`]: sources }));',
  '    setData((prev) => ({ ...prev, [`prijmy${person}`]: sources, [`desktopManzeleBezPrijmu${person}`]: false }));');

once(`  const hasActiveIncome = activeTab === 'manzele'
    ? (results.totalPrijem1 + results.totalPrijem2) > 0
    : results.totalPrijem1 > 0;`, `  const spouseIncome = spouseIncomeState(data, results);
  const spouseErrors = spouseFamilyErrors(data, results);
  const hasSpouseErrors = Object.keys(spouseErrors).length > 0;
  const hasActiveIncome = activeTab === 'manzele'
    ? spouseIncome.ready && !hasSpouseErrors
    : results.totalPrijem1 > 0;`);

// Preserve the original individual and execution UI while moving the spouses
// inputs to their own component. The numerical results still come from here.
cut('              {/* SEKCE 1: RODINA (SPOLEČNÉ ÚDAJE) */}', '              {/* SEKCE 2: DLUŽNÍK 1 */}');
cut('              {/* SEKCE 3: DLUŽNÍK 2 (JEN PRO MANŽELE) */}', '              {/* SEKCE 4: PARAMETRY ŘÍZENÍ A DLUHŮ */}');
once('            <aside className="lg:col-span-5 space-y-4 print:hidden">', `            <aside className="lg:col-span-5 space-y-4 print:hidden">
              {activeTab === 'manzele' ? (
                <DesktopSpousesForm
                  data={data} setData={setData} results={results}
                  IncomeSourcesEditor={IncomeSourcesEditor}
                  handleIncomeSourcesChange={handleIncomeSourcesChange}
                  handleMultiplePayersChange={handleMultiplePayersChange}
                  dluhyNezajisteneDraft={dluhyNezajisteneDraft}
                  setDluhyNezajisteneDraft={setDluhyNezajisteneDraft}
                  commitDluhyNezajistene={commitDluhyNezajistene}
                  setEditingDluhyNezajistene={setEditingDluhyNezajistene}
                  formatKc={formatKc}
                />
              ) : (
                <>`);
once('            </aside>', '                </>\n              )}\n            </aside>');

const flags = {
  desktopJednotlivecMaVyzivovaneOsoby: 'vyzivovaneOsoby1',
  desktopJednotlivecMaVymahaneVyzivne: 'osobySVykonemProVyzivne1',
  desktopJednotlivecPlatiVyzivne: 'bezneMesicniVyzivne1',
  desktopJednotlivecMaChranenePrijmy: 'chranenePrijmy1',
  desktopJednotlivecProdejMajetku: 'vytezekZpenezeni',
  desktopJednotlivecMaZajisteneDluhy: 'dluhyZajistene',
  desktopJednotlivecMaNeosvoboditelneDluhy: 'dluhyNeosvoboditelne',
};
for (const [flag, field] of Object.entries(flags)) {
  once(`checked={Boolean(data.${flag})}`, `checked={optionalFieldIsOpen(data, '${field}')}`);
  once(`{data.${flag} && (`, `{optionalFieldIsOpen(data, '${field}') && (`);
}

once(`      <PrintableCalculationReport
        mode={activeTab}
        data={data}
        results={results}
        params={params}
      />`, `      {(activeTab !== 'manzele' || hasActiveIncome) && (
        <PrintableCalculationReport
          mode={activeTab}
          data={data}
          results={results}
          params={params}
        />
      )}`);

once('                <h2 className="mt-2 text-xl font-black text-slate-900">Výsledek se zobrazí po zadání příjmu.</h2>', `                <h2 className="mt-2 text-xl font-black text-slate-900">
                  {activeTab === 'manzele'
                    ? (hasSpouseErrors ? 'Zkontrolujte rodinné údaje.' : 'Doplňte příjmy obou manželů.')
                    : 'Výsledek se zobrazí po zadání příjmu.'}
                </h2>`);
once('                  Začněte vlevo zadáním čistého měsíčního příjmu. Teprve potom kalkulačka zobrazí srážku, zůstatek a případnou kontrolu minima.', `                  {activeTab === 'manzele'
                    ? (hasSpouseErrors
                      ? 'Opravte nesoulad v počtu osob s vymáhaným výživným. U příslušného pole vlevo je uvedeno, co je potřeba změnit.'
                      : 'U každého manžela zadejte čistý měsíční příjem, nebo výslovně potvrďte, že postižitelný příjem nemá. Potom se zobrazí společný výsledek.')
                    : 'Začněte vlevo zadáním čistého měsíčního příjmu. Teprve potom kalkulačka zobrazí srážku, zůstatek a případnou kontrolu minima.'}`);
once("{activeTab === 'nezabavitelna' ? '3. Výsledek' : '5. Výsledek'}", "{activeTab === 'nezabavitelna' ? '3. Výsledek' : activeTab === 'manzele' ? '6. Výsledek' : '5. Výsledek'}");

const mathBlock = (text) => text.slice(text.indexOf('  // --- JÁDRO VÝPOČTU ---'), text.indexOf('  const normalizeNumericValue ='));
assert.equal(mathBlock(source), mathBlock(original), 'Calculation orchestration must be unchanged.');
assert(source.includes('<DesktopSpousesForm'));
fs.writeFileSync(path, source);
console.log('Spouses source migration applied; numerical calculation block unchanged.');
