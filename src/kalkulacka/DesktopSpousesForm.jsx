import React, { useId } from 'react';
import {
  normalizeFormNumber, optionalFieldIsOpen, toggleOptionalField,
  spouseIncomeState, spouseFamilyErrors,
} from './progressiveSpouses';

const sectionClass = 'bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3';
const inputClass = 'w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-sm';
const selectZero = (event) => {
  if (event.currentTarget.value === '0') event.currentTarget.select();
};

function Section({ title, children }) {
  return (
    <section className={sectionClass}>
      <h3 className="text-sm font-black text-slate-800">{title}</h3>
      {children}
    </section>
  );
}

function Help({ children }) {
  return (
    <details className="mt-2 text-xs leading-relaxed text-slate-500">
      <summary className="cursor-pointer font-bold text-slate-600">Právně přesně</summary>
      <p className="mt-2">{children}</p>
    </details>
  );
}

function OptionalField({ data, setData, field, question, label, hint, legal, integer = false, max, error }) {
  const id = useId();
  const open = optionalFieldIsOpen(data, field);
  return (
    <div className="space-y-2">
      <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3 cursor-pointer">
        <input
          type="checkbox"
          checked={open}
          aria-controls={`${id}-details`}
          aria-expanded={open}
          onChange={(event) => {
            const checked = event.target.checked;
            setData((previous) => toggleOptionalField(previous, field, checked));
          }}
          className="mt-0.5 h-4 w-4 accent-blue-600"
        />
        <span className="text-sm font-bold text-slate-700">
          {question}
          {hint && <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span>}
        </span>
      </label>
      <div id={`${id}-details`} hidden={!open}>
        {open && (
          <>
            <label htmlFor={id} className="mb-1 block text-sm font-bold text-slate-600">
              {label}{!integer && ' (Kč)'}
            </label>
            <input
              id={id}
              name={field}
              type="number"
              min="0"
              max={max}
              step={integer ? '1' : 'any'}
              value={data[field] ?? 0}
              onFocus={selectZero}
              onClick={selectZero}
              onChange={(event) => {
                const value = normalizeFormNumber(event.target.value, integer);
                setData((previous) => ({ ...previous, [field]: value }));
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${id}-error` : undefined}
              className={inputClass}
            />
            {error && <p id={`${id}-error`} role="alert" className="mt-2 text-xs font-bold text-red-700">{error}</p>}
          </>
        )}
      </div>
      {legal && <Help>{legal}</Help>}
    </div>
  );
}

const familyHelp = 'Společně vyživované dítě se při srážkách z příjmů obou manželů započítává do nezabavitelné částky každému z nich zvlášť. Další osoby, které vyživuje pouze jeden z manželů, se uvádějí u tohoto manžela; společné děti se tam znovu neuvádějí.';
const enforcementHelp = 'Jedna čtvrtina nezabavitelné částky se nezapočítá na osobu, v jejíž prospěch byl nařízen výkon rozhodnutí nebo exekuce pro výživné, pokud toto vymáhání stále trvá. Jde o jiný údaj než částka běžného měsíčního výživného níže.';
const alimonyHelp = 'Běžné zákonné výživné se hradí před nezajištěnými věřiteli, snižuje částku dostupnou pro jejich pohledávky a ovlivňuje potřebné minimální měsíční plnění.';
const protectedHelp = 'Uveďte pouze příjmy, z nichž se podle pravidel srážek ze mzdy a jiných příjmů srážka neprovádí. Důchod, nemocenské, peněžitá pomoc v mateřství, podpora v nezaměstnanosti ani DPP/DPČ sem obecně nepatří. Kalkulačka právní povahu konkrétního příjmu sama neověřuje.';

export default function DesktopSpousesForm({
  data, setData, results, IncomeSourcesEditor,
  handleIncomeSourcesChange, handleMultiplePayersChange,
  dluhyNezajisteneDraft, setDluhyNezajisteneDraft,
  commitDluhyNezajistene, setEditingDluhyNezajistene, formatKc,
}) {
  const income = spouseIncomeState(data, results);
  const errors = spouseFamilyErrors(data, results);
  const debtId = useId();
  const durationId = useId();
  const field = (props) => <OptionalField {...props} data={data} setData={setData} />;

  const renderIncome = (person, letter) => {
    const total = results[`totalPrijem${person}`];
    const result = results[`insM_${letter}`];
    const zeroKey = `desktopManzeleBezPrijmu${person}`;
    return (
      <Section title={`${person}. Příjmy manžela ${letter}`}>
        <p className="text-xs leading-relaxed text-slate-500">Příjmy obou manželů zadejte zvlášť. Má-li tento manžel nulový příjem, výslovně to potvrďte níže.</p>
        <IncomeSourcesEditor
          idPrefix={`desktop-spouse-${letter}`}
          sources={data[`prijmy${person}`]}
          multiplePayers={Boolean(data[`vicePlatcu${person}`])}
          onSourcesChange={(sources) => handleIncomeSourcesChange(person, sources)}
          onMultiplePayersChange={(checked) => handleMultiplePayersChange(person, checked)}
          label={`Postižitelné měsíční příjmy – manžel ${letter}`}
        />
        {Number(total) <= 0 && (
          <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={data[zeroKey] === true}
              onChange={(event) => {
                const checked = event.target.checked;
                setData((previous) => ({ ...previous, [zeroKey]: checked }));
              }}
              className="mt-0.5 h-4 w-4 accent-blue-600"
            />
            <span className="text-sm font-bold text-slate-700">Manžel {letter} nemá žádný postižitelný příjem.</span>
          </label>
        )}
        {result?.multiPayerNeedsAllocation && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Pro přesný výpočet u manžela {letter} chybí rozdělení nezabavitelné částky mezi plátce. Součet přidělených částek má odpovídat {formatKc(result.legalniMinimum)}. Bez rozdělení zůstává výsledek orientační.
          </p>
        )}
      </Section>
    );
  };

  return (
    <div className="space-y-4" data-testid="desktop-spouses-progressive">
      {renderIncome(1, 'A')}
      {income.showSecond && renderIncome(2, 'B')}
      {!income.ready && (
        <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900" role="status">
          {!income.a
            ? 'Zadejte příjem manžela A, nebo potvrďte, že žádný postižitelný příjem nemá.'
            : 'Nyní doplňte příjem manžela B, nebo potvrďte jeho nulový příjem. Potom se zobrazí otázky k rodině, platbám a dluhům.'}
          {' '}Dříve uložené údaje se tím nemažou.
        </p>
      )}

      {income.ready && (
        <>
          <Section title="3. Rodinná situace">
            <p className="text-xs leading-relaxed text-slate-500">Zaškrtněte, co se vás týká. Počty doplníte až u vybraných odpovědí.</p>
            {field({
              field: 'spolecneDeti', question: 'Máte společně vyživované děti?',
              label: 'Počet společných dětí', integer: true,
              hint: 'Společné děti uveďte pouze zde, ne znovu u každého manžela.', legal: familyHelp,
            })}
            {[['A', 1], ['B', 2]].map(([letter, person]) => (
              <div key={person} className="space-y-3 border-t border-slate-100 pt-3">
                {field({
                  field: `vyzivovaneOsoby${person}`,
                  question: `Vyživuje manžel ${letter} ještě další osoby?`,
                  label: `Další vyživované osoby – manžel ${letter}`, integer: true,
                  hint: 'Například děti z předchozího vztahu. Společné děti sem už nepočítejte.', legal: familyHelp,
                })}
                {field({
                  field: `osobySVykonemProVyzivne${person}`,
                  question: `Je proti manželovi ${letter} vymáháno výživné na některou vyživovanou osobu?`,
                  label: `Počet osob s vymáhaným výživným – manžel ${letter}`, integer: true,
                  hint: 'Nejde o částku alimentů. Zde se ptáme na počet osob, na které právě probíhá vymáhání.',
                  legal: enforcementHelp,
                  max: normalizeFormNumber(results[`insM_${letter}`]?.pocetVsechOsob),
                  error: errors[`osobySVykonemProVyzivne${person}`],
                })}
              </div>
            ))}
            {(results.insM_A?.partnerZapocitan || results.insM_B?.partnerZapocitan) && (
              <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                Zadaný druh důchodu ovlivňuje také započtení manžela nebo manželky. Tuto skutečnost již zohledňuje společný výpočet; do počtu dalších vyživovaných osob partnera znovu nepřidávejte.
              </p>
            )}
          </Section>

          <Section title="4. Další příjmy a platby">
            {[['A', 1], ['B', 2]].map(([letter, person]) => (
              <div key={person} className="space-y-3 border-t border-slate-100 pt-3">
                <h4 className="text-sm font-black text-slate-700">Manžel {letter}</h4>
                {field({
                  field: `bezneMesicniVyzivne${person}`,
                  question: `Platí manžel ${letter} pravidelně běžné výživné?`,
                  label: `Měsíční výživné – manžel ${letter}`,
                  hint: 'Například na dítě, které nemá ve své péči.', legal: alimonyHelp,
                })}
                {field({
                  field: `chranenePrijmy${person}`,
                  question: `Má manžel ${letter} jiné příjmy chráněné před srážkami?`,
                  label: `Chráněné příjmy měsíčně – manžel ${letter}`,
                  hint: 'Například příspěvek na péči, dávky pro osoby se zdravotním postižením, náhradní výživné, daňový bonus nebo výživné na dítě.',
                  legal: protectedHelp,
                })}
              </div>
            ))}
          </Section>

          <Section title="5. Společné dluhy a majetek">
            <div>
              <label htmlFor={durationId} className="mb-1 block text-sm font-bold text-slate-600">Délka oddlužení</label>
              <select id={durationId} name="delkaOddluzeni" value={data.delkaOddluzeni} className={inputClass}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setData((previous) => ({ ...previous, delkaOddluzeni: value }));
                }}>
                <option value={36}>3 roky – standardní doba</option>
                <option value={60}>5 let – předchozí osvobození v posledních 20 letech</option>
              </select>
              <Help>Kalkulačka používá 36 měsíců jako standardní dobu oddlužení. Variantu 60 měsíců použijte zejména tehdy, pokud bylo dlužníku v posledních 20 letech před podáním nového návrhu přiznáno osvobození od placení pohledávek zahrnutých do předchozího oddlužení.</Help>
            </div>
            <div>
              <label htmlFor={debtId} className="mb-1 block text-sm font-bold text-indigo-700">Běžné nezajištěné dluhy manželů celkem (Kč)</label>
              <input id={debtId} name="dluhyNezajistene" type="number" min="0" step="any"
                value={dluhyNezajisteneDraft} className={inputClass}
                onFocus={(event) => { selectZero(event); setEditingDluhyNezajistene(true); }}
                onClick={selectZero}
                onChange={(event) => setDluhyNezajisteneDraft(event.target.value)}
                onBlur={commitDluhyNezajistene}
                onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
              />
              <p className="mt-1 text-xs text-slate-500">Společný dluh nezapočítávejte dvakrát. Typicky jde o půjčky, úvěry, kreditní karty nebo nezaplacené faktury.</p>
              <Help>Jde o pohledávky, které nejsou zajištěny konkrétním majetkem. Z této částky kalkulačka počítá modelovou míru uspokojení nezajištěných věřitelů. Rozepsaná částka se do výpočtu promítne až po opuštění pole nebo potvrzení Enterem.</Help>
            </div>
            {field({
              field: 'vytezekZpenezeni', question: 'Počítáte v oddlužení s prodejem majetku?',
              label: 'Odhad peněz z prodeje majetku', hint: 'Například auta nebo jiného majetku.',
              legal: 'Zadejte odhad částky, která po zpeněžení majetku a souvisejících nákladech skutečně připadne nezajištěným věřitelům. Ne každý majetek musí být v oddlužení zpeněžen.',
            })}
            {field({
              field: 'dluhyZajistene', question: 'Máte dluhy zajištěné konkrétním majetkem?',
              label: 'Zajištěné dluhy celkem', hint: 'Například hypotéku zajištěnou domem.',
              legal: 'Zajištěný věřitel se v rozsahu zajištění uspokojuje ze zpeněžení majetku, kterým je jeho pohledávka zajištěna. Pokud hodnota zajištění nestačí, rozdíl se může za zákonných podmínek považovat za nezajištěnou pohledávku. Toto pole je informativní a nevstupuje přímo do modelového procenta nezajištěných věřitelů.',
            })}
            {field({
              field: 'dluhyNeosvoboditelne', question: 'Máte dluhy, které se oddlužením neodpouštějí?',
              label: 'Výše těchto dluhů celkem', hint: 'Například dlužné výživné, náhradu škody na zdraví nebo úmyslně způsobenou škodu.',
              legal: 'Osvobození se nedotýká například zákonného výživného, náhrady škody způsobené na zdraví, škody způsobené úmyslným porušením právní povinnosti, některých peněžitých trestů nebo majetkových sankcí za úmyslný trestný čin a pohledávky insolvenčního správce na odměnu a hotové výdaje. Toto pole je informativní a nevstupuje do modelového procenta nezajištěných věřitelů.',
            })}
          </Section>
        </>
      )}
    </div>
  );
}
