# Úpravy výpočtů 2026

Tato verze sjednocuje výpočet srážek mezi hlavní kalkulačkou a modulem **Příjmový potenciál**.

Hlavní změny:

- společné výpočtové jádro `src/lib/calculations2026.js`,
- kontrola minimálního plnění podle orientačního pravidla „1 + 1“ včetně zadaného běžného výživného,
- správné zobrazení celkové exekuční srážky a samostatně částky po paušální náhradě plátci,
- přesný mezikrok dělení na třetiny po snížení na násobek tří,
- modul Příjmový potenciál používá stejné jádro srážek jako hlavní kalkulačka,
- mzdový model 2026 zohledňuje 23% sazbu nad měsíční hranicí 146 901 Kč,
- daňové zvýhodnění na děti rozlišuje první / druhé / třetí a další dítě a ZTP/P,
- sleva pracujícího důchodce je uplatněna na sociálním pojistném, nikoli na dani,
- osobní slevy pro invaliditu a ZTP/P jsou zapojeny do orientačního výpočtu,
- sleva na manžela/manželku se nezapočítává do měsíční čisté mzdy, protože jde o roční slevu,
- přidána kontrolní sada `npm run verify`.

## Důležité omezení

Výpočet čisté mzdy zůstává orientační. Neřeší všechny zvláštní režimy zdravotního a sociálního pojištění, souběh více zaměstnavatelů, roční maxima pojistného ani roční daňové zúčtování. U modulu Příjmový potenciál se rovněž automaticky nevyhodnocuje zvláštní započtení manžela/partnera do nezabavitelné částky podle důchodového režimu; vstup počtu vyživovaných osob proto musí odpovídat konkrétnímu případu.

## Oprava procenta uspokojení věřitelů
- Modelové uspokojení je nyní omezeno na právně/logicky smysluplné maximum 100 %.
- Pokud modelované disponibilní plnění převyšuje nezajištěný dluh, jako skutečně uhrazená částka se pro procento použije nejvýše výše dluhu; přebytek se pouze informativně uvede.
- Při editaci pole „Nezajištěné dluhy“ se rozepsaná částka nepromítá do výpočtu po každé číslici. Přepočet proběhne až po opuštění pole nebo potvrzení Enterem, takže při zadávání např. 600 000 Kč nevznikají dočasné hodnoty typu 1400 %.
- Stejný strop 100 % je použit i v modulu Příjmový potenciál.

## Revize UX, pojmosloví a právních vysvětlivek – 30. 9. 2026

- vstupy příjmů v hlavní kalkulačce jsou nově vedeny jako jednotlivé typované zdroje (mzda/plat, konkrétní druhy důchodů, DPP/DPČ, nemocenské/PPM, podpora v nezaměstnanosti a jiný postižitelný příjem),
- starobní důchod, invalidní důchod II./III. stupně a sirotčí důchod se pro související zvláštní pravidla rozpoznávají automaticky z typu příjmu,
- při více samostatných plátcích lze zadat část nezabavitelné částky určenou jednotlivým plátcům podle § 298 o. s. ř.; bez úplného rozdělení je výsledek výslovně označen jako orientační,
- opraveno započtení manžela/partnera ve společném oddlužení manželů: kvalifikovaný důchod jednoho z manželů může založit započtení čtvrtiny i u druhého; společné děti se započítávají každému zvlášť,
- doplněno pole pro jiné příjmy nepodléhající srážkám i u druhého manžela,
- odstraněn zavádějící výstup „maximální přednostní fond“,
- „Zbytek mzdy“ nahrazen přesnějším „Část příjmu nad nezabavitelnou částku“,
- zpřesněno pojmosloví u pohledávek, paušální náhrady plátce, nezabavitelné částky, výživného a modelové míry uspokojení,
- minimum oddlužení a limit důchodové výjimky u 4+ exekucí se v aplikaci odvozují z příslušných položek a nejsou prezentovány jako samostatné ručně nastavované zákonné konstanty,
- v modulu Příjmový potenciál je „požadovaný“ příjem přejmenován na „modelový“ a vysvětlivky zdůrazňují statistický, nikoli právně závazný charakter percentilu,
- zpřesněny vysvětlivky k daňovému zvýhodnění, invaliditě/ZTP/P, závaznému příslibu, plnění třetí osoby, výtěžku zpeněžení a nezajištěným pohledávkám,
- rozšířeny referenční testy o započtení manžela/partnera, více plátců a odvozený limit výjimky 4+.
