# Původní vysvětlivky – doslovné obnovení

## Pokyn objednatele

Vrátit původní vysvětlivky, které objednatel jednotlivě odsouhlasil. Neparafrázovat, nezkracovat ani automaticky doplňovat nové návazné věty. Každou potřebnou novou větu nejprve předložit objednateli ke schválení. To se týká také instrukce, že zaškrtnutí políčka znamená ANO.

Současný postup, výpočty, validace, uložená data, podmínky tisku a sdílení zůstávají zachované.

## Původ textů

- Implementace původní laické vrstvy: `6e95c5ecc03dedbee10b71fb6b050402c2272f61`.
- Verze se zachovanou právní i laickou vrstvou: `1ad8344381a6373ec2017d90b8b0dc3b901354a7`.
- Původní soubor: `src/kalkulacka/HlavniKalkulackaPage.jsx`.
- Základ této úpravy: `685d2400a97a4cb85b246f9f8d1cf6a129f675c9`.

`approvedHelp.json` obsahuje původní texty a jejich zdrojové řádky i kontrolní otisky. Každý laický text se současně ověřuje proti původní implementaci `6e95c5e…`. Dekódování textových literálů není jazyková úprava. Pracovní tabulky k externí revizi nejsou považovány za náhradu následné schválené implementace.

## Zobrazení

Původní nadpis `Lidsky řečeno:` a text jsou viditelné. `Právně přesně` se otevírá samostatně. Odborný text je doslovně převzatý, nikoli odstraněný. Jednoduchý původní tooltip typu příjmu neměl právní protějšek a žádný nový se nevytváří.

Nápověda je mimo HTML label checkboxu. Otevření odborných podrobností proto nesmí změnit odpověď uživatele. Vstupy jsou s příslušnou nápovědou propojené pomocí `aria-describedby`.

## Pokrytí

Katalog obsahuje 49 historických záznamů včetně kontextových variant. Ze současných komponent je zapojeno 45 klíčů: příjmy a plátci, rodina, vyživované osoby, výživné, chráněné příjmy, dluhy a majetek, vlastní příslib, pomoc jiné osoby, omezení prognózy, vysvětlení výsledků jednotlivce/manželů/exekuce a dva odborné koeficienty.

Čtyři texty jsou zachované jen v katalogu: `thirdsBase`, `oneThird`, `alimonyResultIndividual`, `alimonyResultSpouses`. Odpovídaly samostatným dřívějším prvkům; tato změna takové prvky do formuláře nevrací. Nejde o tvrzení, že byly znovu vytvořeny všechny dřívější pozice vysvětlivek.

Původní vysvětlení editovatelného limitu důchodové výjimky se nevrací, protože popisovalo vazbu na uživatelskou odměnu správce odstraněnou opravou F08. Současné vysvětlení této věcně změněné položky zůstává. Jeho případná nová laická formulace vyžaduje zvláštní odsouhlasení.

Dříve schválený nový postup doplnění chybějící splátky (PR #19), rozpočet na živobytí a bezpečnostní upozornění se nemění. Původní obecné vysvětlení příslibu a pomoci je k němu připojeno bez přepsání čísel či navazujících podmínek. Nové instrukce k checkboxům nejsou součástí této implementace.

## Ověření

- `verifyApprovedHelp.mjs --history`: doslovná shoda katalogu s Git historií, otisky, vykreslení jednotlivých záznamů a jejich připojení ke správnému režimu. Celkem 165 kontrol.
- `verifyApprovedHelp.py`: šest prohlížečových scénářů pro tři režimy na desktopu i mobilu. Otevření právní vrstvy nesmí zaškrtnout políčko ani měnit uložená data; klávesnice a odkazy vstupů na nápovědu zůstávají funkční.
- Zůstávají původní referenční, numerické, auditní, jazykové a prohlížečové kontroly i testy doplnění splátky. U dvou testů se mění pouze očekávaná doslovná věta nápovědy, nikoli matematické nebo ochranné podmínky.
- Soubory `caseState.js`, `calculateCase.js`, `calculations2026.js`, `CalculationBreakdown.jsx` a `PrintableCalculationReport.jsx` jsou beze změny a jejich otisky hlídá existující kontrola.

Testy nejsou potvrzením nasazení na živém Renderu, ověřením fyzického telefonu ani novou právní revizí původních vět. Nová uživatelsky viditelná znění vyžadují další výslovné schválení.
