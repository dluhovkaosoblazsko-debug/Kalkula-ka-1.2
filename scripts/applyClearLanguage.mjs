// Jednorázová, verzí jištěná změna textů. Odstranit před sloučením.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const blob = text => createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
function edit(path, expected, replacements) {
  let text = fs.readFileSync(path, 'utf8');
  assert.equal(blob(text), expected, `Jiná výchozí verze: ${path}`);
  for (const [before, after] of replacements) {
    assert(text.includes(before), `Chybí kotva v ${path}: ${before}`);
    text = text.split(before).join(after);
  }
  fs.writeFileSync(path, text);
}
edit('src/kalkulacka/CaseFields.jsx', '24fea774920d4d09c3d2676bdeff5eaf2a9264cd', [
  ['Každý druh příjmu uveďte samostatně. Zadejte čistou částku před srážkami kvůli dluhům.', 'Začněte částkou, kterou byste dostali, kdyby se z ní nestrhávaly peníze na dluhy. Další příjem přidáte tlačítkem níže.'],
  ['Částka, kterou byste dostali, kdyby z ní nebyly prováděny exekuční nebo insolvenční srážky.', 'U mzdy jde o částku po dani a pojištění, ale ještě před srážkou na dluhy.'],
  ['Příjmy od stejného plátce přiřaďte ke stejné skupině. Jejich srážka a případná náhrada se počítají jen jednou.', 'Například mzdu od zaměstnavatele a důchod od ČSSZ. Když dva příjmy vyplácí stejný zaměstnavatel nebo instituce, vyberte u nich stejného plátce.'],
  ['>Příjmy vyplácí více plátců</Choice>', '>Dostáváte příjmy od více zaměstnavatelů nebo institucí?</Choice>'],
  ['Rozdělení nezabavitelné částky vyplňte podle rozhodnutí nebo pokynu plátci. Prázdné pole znamená neznámý údaj, nikoli nulu. Bez úplného rozdělení jde pouze o souhrnný orientační model.', 'Uveďte podle rozhodnutí nebo pokynu, kolik má každý plátce ponechat bez srážky. Nevíte částku? Nechte pole prázdné. Bez úplného rozdělení bude výsledek jen souhrnným odhadem; nulu vyplňte pouze tehdy, byla-li skutečně určena.'],
  ['Potvrzením označíte všechny postižitelné příjmy této osoby jako nulové. Chráněné příjmy můžete zadat v dalším kroku.', 'Nemáte mzdu, důchod ani jiný příjem pro výpočet srážky? Zaškrtněte tuto možnost. Například příspěvek na péči nebo přijaté výživné můžete uvést později.'],
  ['Zaškrtněte, co se vás týká. Při změně počtu osob se záznam o vymáhaném výživném nesmaže; případný nesoulad je třeba opravit.', 'Uveďte, koho vyživujete. Tyto údaje pomáhají určit část příjmu, která se nesráží. Zaškrtněte jen to, co se vás týká.'],
  ['Společné děti uvádějte jen zde; u každého manžela se započtou samostatně.', 'Společné děti napište jen sem. K dalším osobám jednotlivých manželů je už nepřidávejte.'],
  ['question:`Je proti vám vymáháno výživné na vyživovanou osobu${suffix}?`', "question:mode === 'manzele' ? `Vymáhá někdo po manželovi ${letter} dlužné výživné přes soud nebo exekutora?` : 'Vymáhá po vás někdo dlužné výživné přes soud nebo exekutora?'"],
  ['Nejde o částku běžného výživného. Zde se ptáme na počet osob, v jejichž prospěch právě probíhá vymáhání.', 'Tady uveďte počet osob, na které se výživné právě vymáhá. Pravidelnou měsíční platbu výživného zadáte zvlášť.'],
  ['Rozhodným důchodem je starobní, invalidní II./III. stupně nebo sirotčí. Partner se do vyživovaných osob výše znovu neuvádí.', 'Jde o starobní důchod, invalidní důchod II. nebo III. stupně nebo sirotčí důchod. Manžela či partnera nepřidávejte znovu mezi osoby výše.'],
  ["'Manžel/partner pobírá důchod rozhodný pro zvýšení nezabavitelné částky'", "'Manžel nebo partner pobírá některý z uvedených důchodů'"],
  ['Zadaný rozhodný důchod již ovlivnil započtení manžela/partnera. Do dalších vyživovaných osob jej znovu nepřidávejte.', 'Kalkulačka už zohlednila zadaný důchod při započtení manžela nebo partnera. Mezi další osoby jej znovu nepřidávejte.'],
  ["question:'Platíte pravidelně běžné výživné?',label:'Měsíční výživné',hint:'Například na dítě, které nemáte ve své péči.'", "question:'Platíte někomu pravidelně výživné?',label:'Kolik měsíčně platíte?',hint:'Sem patří výživné, které platíte vy. Výživné, které dostáváte, uvedete zvlášť.'"],
  ["question:'Máte jiné příjmy chráněné před srážkami?',label:'Chráněné příjmy měsíčně'", "question:'Dostáváte ještě peníze, ze kterých se srážky neprovádějí?',label:'Kolik takto měsíčně dostáváte?'"],
  ["hint:'Například příspěvek na péči, daňový bonus nebo výživné na dítě.'", "hint:'Například příspěvek na péči, daňový bonus nebo výživné na dítě. Mzdu a důchod sem neuvádějte.'"],
  ["hint:'Například příspěvek na péči nebo výživné na dítě.'", "hint:'Například příspěvek na péči nebo výživné na dítě. Mzdu a důchod sem neuvádějte.'"],
  ['Zákonná srážka již minimum pokrývá. Dříve zadané doplňkové zdroje zůstávají níže viditelné ke kontrole.', 'Samotná srážka už na potřebné minimum stačí. Zkontrolujte, zda chcete dál použít níže zadanou pomoc.'],
  ['Ze zákonné srážky chybí do měsíčního minima', 'K potřebnému měsíčnímu minimu ještě chybí'],
  ['Nejprve uveďte, kolik domácnosti musí zůstat na základní potřeby.', 'Nejdřív ověříme, kolik vám musí zůstat na bydlení, jídlo a další základní potřeby.'],
  ['Chci chybějící částku doplnit ze svých peněz', 'Chci přidávat něco z peněz, které mi po srážce zůstanou'],
  ['Uložený příslib není aktivní a nepoužívá se. Pro jeho použití volbu zapněte, nebo částku vymažte.', 'Tuto dříve zadanou platbu teď nepočítáme. Zapněte možnost výše, nebo částku vymažte.'],
  ['label="Základní měsíční potřeby domácnosti"', 'label="Kolik vám musí měsíčně zůstat na základní potřeby domácnosti?"'],
  ['Přiměřenost zadané částky kalkulačka sama neposuzuje.', 'Počítejte bydlení, jídlo a další nutné výdaje domácnosti. Kalkulačka sama neposoudí, zda vám zadaná částka opravdu stačí.'],
  ['Po zákonné srážce zbývá {formatKc(c.retainedAfterStatutoryDeduction)}. Pro minimum lze z příslibu použít nejvýše {formatKc(c.maxDebtorPromise)}; nyní se započítává {formatKc(c.debtorPromise)}.', 'Po srážce vám zůstává {formatKc(c.retainedAfterStatutoryDeduction)}. Na doplnění minima můžete podle zadaných potřeb použít nejvýše {formatKc(c.maxDebtorPromise)}. Nyní počítáme s další platbou {formatKc(c.debtorPromise)}.'],
  ['Zadaný příslib je vyšší než použitelný limit. Původní částka nebyla smazána; výsledek používá pouze uvedenou omezenou částku.', 'Zadali jste více, než lze podle tohoto výpočtu použít. Zadanou částku jsme nesmazali, ale počítáme jen s výše uvedenou částí.'],
  ['Chci využít pravidelný příspěvek třetí osoby', 'Bude vám někdo pravidelně přispívat na splátky?'],
  ['Uložený příspěvek není aktivní. Zapněte jeho použití nebo částku vymažte.', 'Tuto dříve zadanou pomoc teď nepočítáme. Zapněte možnost výše, nebo částku vymažte.'],
  ['label="Měsíční příspěvek třetí osoby"', 'label="Kolik vám bude tato osoba měsíčně přispívat?"'],
  ['Kalkulačka neposuzuje platnost závazku ani schopnost třetí osoby platit.', 'Počítejte jen s pravidelnou pomocí. Zda je dohoda platná a druhá osoba bude schopná platit, kalkulačka neověřuje.'],
  ['Modelové měsíční minimum je pokryto.', 'Podle zadaných údajů je potřebné měsíční minimum pokryté.'],
  ['    <p className="text-xs leading-relaxed text-slate-600">{MODEL_NOTE}</p>', '    <p className="text-sm leading-relaxed text-slate-700">Další platby z vašich peněz a pomoc jiné osoby ověří měsíční minimum. Odhad dlouhodobého splacení dluhů je ale nezahrnuje.</p>\n    <details className="text-xs leading-relaxed text-slate-600"><summary className="cursor-pointer font-bold">Právně přesně</summary><p className="mt-2">{MODEL_NOTE}</p></details>'],
  ['label="Druh pohledávky"', 'label="O jaký dluh jde?"'],
  ['["neprednostni","Nepřednostní pohledávka"],["prednostni","Přednostní pohledávka"]', '["neprednostni","Běžný nepřednostní dluh"],["prednostni","Přednostní dluh"]'],
  ['Prognóza je určena pro řízení podle současné úpravy. Historická řízení, prodloužení nebo přerušení se musí posoudit podle konkrétního rozhodnutí.', 'Odhad počítá s novým oddlužením podle současných pravidel. U staršího, prodlouženého nebo přerušeného řízení záleží na konkrétním rozhodnutí.'],
  ['>Výši nezajištěných dluhů zatím neznám</Choice>', '>Výši běžných dluhů zatím neznám</Choice>'],
  ['Půjčky, úvěry, kreditní karty nebo nezaplacené faktury. Společný dluh nezapočítávejte dvakrát. Procento se zobrazí až po potvrzení tohoto oddílu.', 'Patří sem půjčky, úvěry, kreditní karty nebo nezaplacené faktury. Společný dluh manželů započítejte jen jednou. Po kontrole této části ukážeme odhad splacení.'],
  ["label:'Odhad výtěžku pro nezajištěné věřitele'", "label:'Kolik z prodeje půjde na běžné dluhy?'"],
  ['Pouze částka, která po souvisejících nákladech skutečně půjde na nezajištěné dluhy.', 'Uveďte jen peníze, které po odečtení nákladů prodeje skutečně půjdou na běžné nezajištěné dluhy.'],
  ['Například hypotéku zajištěnou domem. Toto pole je informativní a nevstupuje do procenta nezajištěných dluhů.', 'Například hypotéku zajištěnou domem. Tyto dluhy uvedeme v přehledu, ale nepočítáme je do procenta splacení běžných dluhů.'],
  ['Například dlužné výživné, škoda na zdraví nebo úmyslně způsobená škoda. Toto pole je informativní; konkrétní právní režim je třeba posoudit.', 'Například dlužné výživné, škoda na zdraví nebo úmyslně způsobená škoda. Uvedeme je zvlášť v přehledu. Zda se konkrétní dluh neodpouští, je potřeba ověřit.'],
]);
edit('src/kalkulacka/WorkflowForms.jsx', '0a22b57eb2f77f5a1db3eb783c03a5e57925797d', [
  ['caseStatus, confirmSection, sectionReviewed, sectionTitle, sectionHasData', 'caseStatus, confirmSection, sectionReviewed, sectionHasData'],
  ["import { buildCalculationShareText }", "import { sectionTitle } from './uiCopy.js';\nimport { buildCalculationShareText }"],
  ['Zkontrolováno. Změna údaje vyžaduje nové potvrzení.', 'Vyplněno. Údaje můžete znovu otevřít a upravit.'],
  ['Nejprve opravte údaje tohoto oddílu.', 'Ještě opravte označené údaje v této části.'],
  ['<button type="button" className={buttonClass} onClick={()=>{setAttempted(step);', '<button type="button" data-action="confirm-section" className={buttonClass} onClick={()=>{setAttempted(step);'],
  ["Potvrdit {sectionTitle(step).toLocaleLowerCase('cs-CZ')}{index < status.flow.length-1 ? ' a pokračovat' : ''}", "{index < status.flow.length-1 ? 'Pokračovat' : 'Zobrazit výsledek'}"],
  ['Otevře se po potvrzení předchozích oddílů. Dříve zadané hodnoty zůstávají zachované.', 'Tady už máte zadané údaje. Můžete je zkontrolovat hned, nebo pokračovat od předchozího kroku.'],
  ['Otevřít pro kontrolu', 'Zkontrolovat údaje'],
  ["setMessage('Změna vyžaduje kontrolu navazujícího oddílu.');", "setMessage(`Po této změně ještě zkontrolujte část „${sectionTitle(pending)}“. Ostatní údaje zůstaly zachované.`);"],
  ["setMessage('Před dokončením opravte uvedené údaje.');", "setMessage(`Ještě zkontrolujte část „${sectionTitle(invalid)}“.`);"],
  ['<button type="button" className={buttonClass+\' flex-[1.5]\'} onClick={confirm}', '<button type="button" data-action="confirm-section" className={buttonClass+\' flex-[1.5]\'} onClick={confirm}'],
  ["{editing ? 'Potvrdit a zpět na výsledek' : 'Potvrdit a pokračovat'}", "{editing ? 'Použít změny a zpět' : step === status.flow.at(-1) ? 'Zobrazit výsledek' : 'Pokračovat'}"],
]);
edit('src/kalkulacka/HlavniKalkulackaPage.jsx', 'cf69f507585052598897ec81341b99c41961ce44', [
  ['Měsíční srážka, peníze na živobytí a modelové minimum.', 'Kolik se vám bude srážet, kolik vám zůstane a zda to stačí na potřebné minimum.'],
  ['Příjmy a srážky obou manželů samostatně, společný výsledek.', 'Kolik se bude srážet každému z vás a kolik vám dohromady zůstane.'],
  ['Modelové maximum srážky pro vaši situaci.', 'Kolik vám mohou měsíčně srazit a kolik vám po srážce zůstane.'],
  ['Vyberte svou situaci. Formulář se otevře po tematických oddílech.', 'Vyberte svou situaci. Provedeme vás několika otázkami, krok za krokem.'],
]);
// Testy mění pouze selektory/textová očekávání. Číselné a bezpečnostní aserce zůstávají.
edit('scripts/verifyBrowserRepairs.py', 'dee0bacef8a0638404b1c376887f25613f266483', [
  ["await scope.get_by_role('button', name='Potvrdit a pokračovat', exact=True).click()", "await scope.locator('[data-action=\"confirm-section\"]').click()"],
  ["await section.get_by_role('button', name=re.compile('^Potvrdit ')).click()", "await section.locator('[data-action=\"confirm-section\"]').click()"],
  ["'Výsledek podle potvrzeného zadání'", "'Váš orientační výsledek'"],
  ["name='Potvrdit a zpět na výsledek'", "name='Použít změny a zpět'"],
]);
edit('scripts/verifyAuditRepairs.mjs', '848c5d3c1cb7f6b590ef48c718efe46b2bc1a7d5', [
  ["assert(text.includes('Neurčeno'))", "assert(text.includes('Odhad zatím nelze určit'))"],
]);
console.log('Texty změněny; výpočty, stav odpovědí a ochrana reportu nebyly upraveny.');
