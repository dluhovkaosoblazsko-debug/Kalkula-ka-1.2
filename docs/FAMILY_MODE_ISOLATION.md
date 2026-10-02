# Rodinné údaje oddělené podle typu výpočtu

Základ úpravy: `0d0377df614b1ccfdec145b53d57f2237eef7f67`.
Objednatel schválil tři nálezy závěrečné kontroly: nezaměňovat rodinné údaje při přepínání režimů, vysvětlit návaznost obou počtů u vymáhaného výživného a vymezit právní význam partnerství.

## Rozsah a uložené údaje

Nový adaptér `familyState.js` uchovává samostatnou rodinnou variantu pro oddlužení jednotlivce, společné oddlužení manželů a exekuční srážku. Oddělené jsou společné děti, další/celkové vyživované osoby, počty osob s vymáhaným výživným, související checkboxy a ruční započtení partnera u jednotlivce/exekuce. Samotné přepnutí nic nepřebírá; návrat obnoví příslušnou variantu.

Nejde o tři nezávislé klientské spisy. Příjmy, dluhy, běžné výživné, chráněné příjmy a ostatní dosavadní společné údaje zůstávají sdílené. Toto rozhodnutí nezasahuje do výpočetního pravidla ani do rozsahu předchozího zadání.

Finanční model stále přijímá původní ploché schéma verze 2, bez cache ostatních rodin. Adaptér zapisuje do stejného úložištního klíče navíc `_familyWorkspace` s vlastní verzí 1. Do výpočtu, potvrzovacích signatur a exportů vstupují jen údaje aktivní rodiny. Uložený poslední typ výpočtu se zachová při obnovení.

## Výslovné převzetí

V rodinné situaci lze rozbalit převzetí z jiného již otevřeného výpočtu, vybrat zdroj a prohlédnout nové počty. Náhled nemění uložená data. Změna nastane až tlačítkem Převzít a zkontrolovat rodinné údaje. Poté se zneplatní pouze potvrzení cílové rodiny a případného doplnění minima.

- Z manželů do jednotlivce/exekuce se přebírá rodina manžela A, protože jednoosobní režimy používají příjem osoby 1. Společné děti a další osoby A se sečtou právě jednou. Rodina B se nepřiřazuje k příjmu A.
- Z jednotlivce/exekuce do manželů se musí výslovně určit, kolik z převzatého celkového počtu tvoří společné děti. Rozdělení se neodhaduje. Ostatní osoby se přiřadí jako další osoby A. Další osoby a vymáhání B se nepřepisují.
- Mezi jednotlivcem a exekucí mají pole shodný význam a převzetí je přímé, ale stále výslovné.
- Opakované převzetí nahrazuje cílové údaje; nikdy je znovu nepřičítá.

## Migrace starších výpočtů

Starší verze neukládala aktivní režim. Nenulové rodinné údaje proto nelze spolehlivě automaticky přiřadit jednotlivci nebo manželům. Při prvním výběru režimu se zobrazí souhrn původních hodnot a žádost o jejich přiřazení ke zvolenému režimu. Zrušení potvrzení neotevře výpočet ani nevydá hotový report. Původní hodnoty se neodhadují a nepřevádějí na jiný význam.

Celý původní rodinný záznam zůstává v archivu a je čitelný pod Původní uložené rodinné údaje, i pokud obsahuje pole nepoužitelná ve vybraném režimu. Rodinu je nutné zkontrolovat; staré potvrzení rodiny a minima se nepřenáší jako již platné. Nové uložené varianty tuto otázku při každém načtení neopakují. Výpočet bez rodinných údajů zvláštní přiřazení nepotřebuje.

Reset odstraní všechny varianty i archiv rodiny. Poškozené schéma spustí existující ochranu úložiště a původní uložená kopie se automaticky nepřepíše.

## Texty

`approvedHelp.json` a původní Lidsky řečeno / Právně přesně jsou beze změny. Připojeny jsou doslova tyto dvě schválené návazné věty:

> Do počtu vyživovaných osob nejprve zahrňte i děti, na které je proti vám vymáháno výživné. V následující otázce je označíte zvlášť a kalkulačka je při výpočtu nezabavitelné částky odečte.

> Partnerem se zde rozumí partner v právně uzavřeném partnerství. Samotné soužití s přítelem nebo přítelkyní pro toto započtení nestačí.

Nové ovládání rodinných variant má vlastní popisky převzetí, náhledu a zařazení původních údajů. Nejde o další přepis odborných či laických vysvětlivek. Posloupnost, instrukce ANO/NE a původní bezpečnostní upozornění jsou zachované.

## Ověření

`verifyFamilyIsolation.mjs --render`: 42 kontrol včetně všech směrů přepínání, kopírování/splittingu, zachování B, persistence, migrace, resetu, potvrzování minima a doslovnosti obou připojených vět. Otisky původních vysvětlivek a výpočetních souborů se ověřují proti základní verzi.

`verifyFamilyIsolation.py`: čtyři složené scénáře na desktopu a mobilu. Reprodukují srážku manželů 8462 Kč, převzetí rodiny A do jednotlivce se srážkou 5898 Kč a návrat bez zdvojení dětí. Zahrnují explicitní převzetí zpět, exekuční variantu 2949 Kč, tisk/sdílení, obnovení všech variant, reset a zrušení i potvrzení zařazení starších údajů.

Dosavadní referenční, numerické, auditní, textové a prohlížečové kontroly zůstávají. Původní fixture v testu doplnění minima nyní výslovně přijímá otázku na typ svého staršího zadání. Žádné numerické ani ochranné aserce nebyly odstraněny.

Tato změna není novou právní revizí, ověřením fyzického telefonu ani potvrzením nasazení na živém Renderu.
