# Opravy hloubkového auditu — 1. 10. 2026

Výchozí revize: `1bb921da98837942de44262a62cc479dbcd2a7be`.
Rozsah: tři veřejné režimy, společný stav vstupů, mobilní a desktopové rozhraní, výpočet, tisk a sdílení.

## Nálezy a opravy

| ID | Provedená změna |
|---|---|
| F01 | Obrazovka i report používají stejné skutečné kroky za každého plátce a nakonec jejich součet. Pro příjmy 20 000 + 30 000 Kč, alokace 7 051 + 7 051 Kč, je 8 632 + 15 298 = 23 930 Kč. Při nízkém příjmu se nevytváří záporná rovnice zakončená nulou. |
| F02 | Prázdná alokace není nula. Úplnost se ověřuje před převodem na číslo; tolerance jedné koruny byla odstraněna. Neúplné rozdělení zůstává výslovně souhrnným orientačním modelem také v tisku a sdílení. Více druhů příjmů stejného plátce lze spojit do skupiny s jednou alokací a jednou případnou náhradou. |
| F03 | `caseStatus` poskytuje společnou validaci všem režimům, oběma rozhraním a exportům. Neplatné počty, záporné/nečíselné částky a nedokončené aktivní odpovědi blokují vydání výsledku. |
| F04 | Nenulová nebo neplatná uložená hodnota zůstává viditelná nezávisle na starém příznaku. Vymáhání výživného není schované pod jinou otázkou. Snížení počtu osob nesmaže jinou skutečnost; nesoulad se musí opravit. Příslib a třetí osoba zůstávají dostupné i po zvýšení příjmu. Vypnutí odpovědi maže jen její vlastní hodnotu. |
| F05 | Společný persistentní stav `bezPostizitelnehoPrijmu1/2`. Vymazání částky není potvrzení nuly. Výslovně nulový příjem jednotlivce ani obou manželů neblokuje chráněné příjmy nebo doplňkovou pomoc. |
| F06 | Platnost a potvrzení zadání jsou podmínkou výstupu i přes Ctrl+P a sdílení. Nepotvrzený/neplatný tisk obsahuje pouze upozornění bez výsledkových částek. Print CSS výslovně skryje rozhraní a přepne barevné schéma papíru na světlé, včetně okrajů PDF. |
| F07 | Náhrada se nepoužije u důchodu, nemocenského/PPM ani podpory. U jiného příjmu se způsobilost nepředpokládá. Uplatnění náhrady se potvrzuje za každého plátce při splnění časových a dalších podmínek; v jedné skupině se nezdvojuje. |
| F08 | Zákonný limit důchodové výjimky 4+ je 1 089 Kč včetně DPH, nezávisle na editaci odměny správce. Vlastní parametry jsou vypsány ve výsledku i exportech a vyžadují novou kontrolu zadání. |
| F09 | Metodika dlouhodobé prognózy nebyla rozšířena: nezahrnuje příslib ani třetí osobu. Toto omezení je přímo ve výsledku, reportu a sdílení. Zadaná pomoc je odlišena od částky potřebné k doplnění minima; minimum není rozhodnutím soudu. |
| F10 | Tematické oddíly se potvrzují a postupně odkrývají; živý náhled je označen jako průběžný. Neznámý dluh má samostatnou odpověď bez procenta splacení. Mobilní editace vrací přímo na výsledek, není-li nutná kontrola změněných návazných údajů. |
| F11 | Peněžní vstupy na nejvýše dvě desetinná místa, zachované haléře v zobrazení a centové porovnání krytí minima. Chybějících 0,40 Kč se nevydává za nulu. |
| F12 | Výjimky při čtení, zápisu nebo smazání localStorage neukončí aplikaci. Výpočet pokračuje v paměti s upozorněním. Poškozená uložená kopie se bez rozhodnutí uživatele nepřepisuje. |

## Společná implementace

Veřejné formuláře sdílejí `CaseFields` a `caseState`. Samostatné neprovázané mobilní a manželské kopie byly odstraněny. Výpočetní orchestrace byla oddělena do `calculateCase`; původní model rodiny, třetin a baseline věřitelů je zachován. Zásahy do `calculations2026.js` jsou cílené: pevný zákonný limit, způsobilost plátce k náhradě a centové porovnání minima.

Skupiny plátců zachovávají rozdělení a náhradu při odebrání nebo přesunutí prvního příjmu. Nevyužitá část přidělené nezabavitelné částky se nepřesouvá automaticky; výsledek upozorní na potřebu ověření rozdělení.

## Uložená data

Původní klíče úložiště zůstávají; migrace má `schemaVersion: 2`. Nenulové údaje se zachovají. Staré implicitní nuly nejsou vědomým potvrzením, a proto se vyžádá kontrola. Dříve výslovně potvrzený nulový příjem manžela lze převzít. Po prvním načtení staré verze je třeba potvrdit tematické oddíly. Migrace není právním potvrzením starých odpovědí.

## Reprodukovatelné kontroly

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run verify
node scripts/verifyNumericalModel.mjs
node scripts/verifyAuditRepairs.mjs --render
npm run build
python3 -m venv /tmp/calculator-browser-tests
/tmp/calculator-browser-tests/bin/pip install playwright==1.57.0
/tmp/calculator-browser-tests/bin/python -m playwright install --with-deps chromium
/tmp/calculator-browser-tests/bin/python scripts/verifyBrowserRepairs.py . test-results/browser
```

`verifyProgressiveSpouses.mjs` zůstává kompatibilním vstupem do aktuálních společných kontrol, nikoli testem odstraněné kopie formuláře.

Při integračním CI prošly dosavadní referenční výpočty, 10 912 porovnání s nezávislým modelem bez rozdílu, 20 000 scénářů finančních invariantů a 57 kontrol stavů/serverového vykreslení. Nezávislý model používá přesné osminy koruny a celočíselné operace. Nejde o 10 912 právních posudků.

Při následné místní kontrole zkompilovaného artefaktu prošlo 20 okruhů prohlížečových scénářů: celé průchody tří režimů na obou rozhraních, shoda výsledků a sdílení, skutečné vytvoření PDF, prázdné alokace, explicitní nuly, návrat z editace, migrace, haléře, selhání ukládání a šířky 360/768/899/900/1024/1920 px. Při vizuální kontrole PDF byl navíc opraven tmavý okraj stránky. Trvalý CI nyní opakuje 13 prohlížečových kontrol včetně PDF a světlého tiskového schématu; konkrétní výsledek je v příslušném běhu Actions a artefaktu `calculator-checks`.

## Podklady cílených právních změn

- Ministerstvo spravedlnosti, výpočet srážek pro rok 2026: https://exekuce.justice.cz/vypocet-srazek-ze-mzdy/
- Ministerstvo spravedlnosti, srážky ze mzdy a jiných příjmů: https://exekuce.justice.cz/srazky-ze-mzdy-a-jinych-prijmu/
- OSŘ, zejména § 279, § 299 a § 301 odst. 2: https://www.e-sbirka.cz/sb/1963/99

## Hranice ověření

Prohlížečové testy vykreslují skutečný zkompilovaný JavaScript a CSS v izolovaném dokumentu. localStorage a nativní sdílení jsou simulovány. Test vytváří skutečné PDF pomocí Chromium, neověřuje ale dialog tiskárny, fyzický telefon, produkční Render, service worker, PWA aktualizace ani Windows/Electron. Nový dlouhodobý model příslibu/daru nebyl zaveden. Neaktivní modul příjmového potenciálu není předmětem nového úplného právního auditu.

Úplnost zadaného rozdělení mezi plátce neznamená ověření podkladového rozhodnutí. Kalkulačka nerozhoduje o oddlužení, sama právně neklasifikuje jiný příjem a nezná konkrétní pořadí, příslušenství ani výši všech vymáhaných pohledávek. Zelené testy nenahrazují individuální právní posouzení.
