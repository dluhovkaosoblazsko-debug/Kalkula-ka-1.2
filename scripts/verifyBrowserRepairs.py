"""Offline browser regression checks on the actual Vite production bundle.
Storage and native share/print are explicitly stubbed. No production navigation.
Usage: python scripts/verifyBrowserRepairs.py [BUILD_ROOT] [OUTPUT_DIR]
Requires playwright==1.57.0 and its Chromium, or CHROMIUM_EXECUTABLE.
"""
from __future__ import annotations
import asyncio
import json
import os
import re
import sys
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else 'test-results/browser')
OUT.mkdir(parents=True, exist_ok=True)
HTML = (ROOT / 'dist/index.html').read_text()
js = re.search(r'<script[^>]*src="([^"]+)"[^>]*></script>', HTML)
css = re.search(r'<link[^>]*href="([^"]+\.css)"[^>]*>', HTML)
assert js and css, 'Missing Vite bundle'
HTML = HTML.replace(js[0], '<script type="module">' + (ROOT / 'dist' / js[1].lstrip('/')).read_text() + '</script>')
HTML = HTML.replace(css[0], '<style>' + (ROOT / 'dist' / css[1].lstrip('/')).read_text() + '</style>')
HTML = re.sub(r'<link[^>]*(?:manifest|icon)[^>]*>', '', HTML)
RESULTS = []
TITLES = {'jednotlivec': 'Oddlužení jednotlivce', 'manzele': 'Společné oddlužení manželů', 'nezabavitelna': 'Exekuční srážka'}

def norm(text):
    return ' '.join(text.split())

def seed(a=30000, b=25000, **extra):
    return dict(prijmy1=[dict(id='a', typ='mzda', castka=a, pridelenaNezabavitelna='')],
                prijmy2=[dict(id='b', typ='mzda', castka=b, pridelenaNezabavitelna='')], dluhyNezajistene=600000, **extra)

def shim(data=None, fail=False):
    values = {} if data is None else {'insCalcData2026_v10': json.dumps(data)}
    return '''<script>
window.__values=%s;
Object.defineProperty(window,'localStorage',{configurable:true,value:{
 getItem(k){return Object.hasOwn(window.__values,k)?window.__values[k]:null;},
 setItem(k,v){%s window.__values[k]=String(v);},removeItem(k){delete window.__values[k];}
}});
Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.__shared=data;}});
window.print=()=>{window.__printed=true;};
</script>''' % (json.dumps(values), "throw new DOMException('Quota','QuotaExceededError');" if fail else '')

async def run():
    async with async_playwright() as pw:
        options = {'headless': True}
        if os.environ.get('CHROMIUM_EXECUTABLE'):
            options['executable_path'] = os.environ['CHROMIUM_EXECUTABLE']
        browser = await pw.chromium.launch(**options)
        context = await browser.new_context(viewport={'width': 1440, 'height': 1000}, locale='cs-CZ', service_workers='block')

        async def page(data=None, mobile=False, fail=False):
            pg = await context.new_page()
            pg.set_default_timeout(7000)
            await pg.set_viewport_size({'width': 390 if mobile else 1440, 'height': 1000})
            pg.runtime_errors = []
            pg.on('pageerror', lambda error: pg.runtime_errors.append(str(error)))
            pg.on('dialog', lambda dialog: dialog.accept())
            await pg.set_content(HTML.replace('<head>', '<head>' + shim(data, fail)), wait_until='load')
            await pg.locator('.desktop-calculator').wait_for(state='attached')
            return pg

        async def choose(pg, mode='jednotlivec', mobile=False):
            scope = pg.locator('.mobile-calculator' if mobile else '.desktop-calculator')
            await scope.get_by_role('button', name=re.compile('^' + re.escape(TITLES[mode]))).click()
            return scope

        async def confirm(scope, step=None, mobile=False):
            if mobile:
                await scope.locator('[data-action="confirm-section"]').click()
                return
            section = scope.locator(f'[data-step="{step}"]')
            if await section.locator(':scope > details').get_attribute('open') is None:
                await section.locator(':scope > details > summary').click()
            await section.locator('[data-action="confirm-section"]').click()

        async def finish(scope, mode='jednotlivec', mobile=False, minimum=False):
            steps = (['incomeA', 'incomeB'] if mode == 'manzele' else ['income']) + ['family']
            steps += ['execution'] if mode == 'nezabavitelna' else ['other', 'debts']
            if minimum:
                steps.append('minimum')
            for step in steps:
                await confirm(scope, step, mobile)

        async def check(name, fn):
            try:
                await fn()
                RESULTS.append({'name': name, 'passed': True})
                print('PASS:', name, flush=True)
            except Exception as error:
                RESULTS.append({'name': name, 'passed': False, 'error': str(error)})
                for i, pg in enumerate(context.pages):
                    try:
                        await pg.screenshot(path=str(OUT / f'failure-{len(RESULTS)}-{i}.png'), full_page=True)
                    except Exception:
                        pass
                print('FAIL:', name, str(error), flush=True)
            finally:
                for pg in context.pages:
                    await pg.close()

        async def standard(mode, mobile):
            data = seed()
            if mode == 'manzele':
                data['spolecneDeti'] = 2
            pg = await page(data, mobile)
            scope = await choose(pg, mode, mobile)
            await finish(scope, mode, mobile)
            text = norm(await scope.locator('[data-testid="case-results"]').inner_text())
            expected = {'jednotlivec': ['10 598', '19 402'], 'manzele': ['8 462', '46 538'], 'nezabavitelna': ['5 299', '24 701']}[mode]
            assert 'Váš orientační výsledek' in text
            assert all(value in text for value in expected), text
            if mobile:
                await scope.get_by_role('button', name='Sdílet', exact=True).click()
                shared = norm((await pg.evaluate('window.__shared'))['text'])
                assert all(value in shared for value in expected), shared
                if mode != 'nezabavitelna':
                    assert 'nezahrnuje závazný příslib' in shared
            else:
                await scope.get_by_role('button', name='Tisk / PDF', exact=True).click()
                assert await pg.evaluate('window.__printed === true')
            assert await pg.evaluate('document.documentElement.scrollWidth <= innerWidth')
            await pg.emulate_media(media='print')
            assert not await pg.locator('.desktop-calculator').is_visible()
            assert not await pg.locator('.mobile-calculator').is_visible()
            assert await pg.evaluate('getComputedStyle(document.documentElement).colorScheme') == 'light'
            report = norm(await pg.locator('.calculation-print-report').inner_text())
            assert all(value in report for value in expected), report
            await pg.pdf(path=str(OUT / f'{mode}-{"mobile" if mobile else "desktop"}.pdf'), format='A4', print_background=True, prefer_css_page_size=True)
            assert not pg.runtime_errors, pg.runtime_errors

        for mobile in [False, True]:
            for mode in TITLES:
                await check(f'Baseline, export and print: {mode}, mobile={mobile}', lambda mode=mode, mobile=mobile: standard(mode, mobile))

        async def progressive():
            pg = await page()
            scope = await choose(pg)
            assert await scope.locator('[data-step="family"]').count() == 0
            await scope.get_by_label('Čistá měsíční částka (Kč)', exact=True).fill('30000')
            assert await scope.locator('[data-step="family"]').count() == 0
            await confirm(scope, 'income')
            assert await scope.locator('[data-step="family"]').count() == 1
            assert await scope.locator('[data-step="other"]').count() == 0
        await check('F10: real progressive desktop sections', progressive)

        async def zero():
            pg = await page(mobile=True)
            scope = await choose(pg, mobile=True)
            field = scope.get_by_label('Čistá měsíční částka (Kč)', exact=True)
            await field.fill('20000')
            await field.fill('')
            checkbox = scope.get_by_role('checkbox', name='Nemám žádný postižitelný příjem')
            assert not await checkbox.is_checked()
            await confirm(scope, mobile=True)
            assert await scope.get_by_role('heading', name='Vaše příjmy', exact=True).count() == 1
            await checkbox.check()
            await confirm(scope, mobile=True)
            await pg.set_viewport_size({'width': 1440, 'height': 1000})
            desktop = await choose(pg)
            await desktop.locator('[data-step="income"] > details > summary').click()
            assert await desktop.get_by_role('checkbox', name='Nemám žádný postižitelný příjem').is_checked()
        await check('F05: clearing is not zero, explicit zero is shared', zero)

        async def edit():
            pg = await page(seed(), mobile=True)
            scope = await choose(pg, mobile=True)
            await finish(scope, mobile=True)
            await scope.get_by_role('button', name=re.compile('^Upravit: Rodinná situace')).click()
            await scope.get_by_role('checkbox', name='Vyživujete děti nebo jiné osoby?').check()
            await scope.get_by_label('Počet vyživovaných osob', exact=True).fill('1')
            await scope.get_by_role('button', name='Použít změny a zpět', exact=True).click()
            assert await scope.get_by_role('heading', name='Výsledek a kontrola zadání').count() == 1
            assert 'Váš orientační výsledek' in await scope.inner_text()
        await check('F10: direct result edit returns without repeating later sections', edit)

        async def invalid():
            for mode in TITLES:
                pg = await page(seed(vyzivovaneOsoby1=1, osobySVykonemProVyzivne1=5))
                scope = await choose(pg, mode)
                assert await scope.get_by_role('button', name='Tisk / PDF', exact=True).count() == 0
                await pg.emulate_media(media='print')
                report = norm(await pg.locator('.calculation-print-report').inner_text())
                assert 'Výpočet nelze vydat' in report and '10 598' not in report
                assert not pg.runtime_errors
        await check('F03/F06: invalid inputs cannot bypass print gate in any mode', invalid)

        async def payers():
            data = seed(vicePlatcu1=True)
            data['prijmy1'] = [dict(id='p0', typ='mzda', castka=20000, pridelenaNezabavitelna=7051), dict(id='p1', typ='mzda', castka=30000, pridelenaNezabavitelna=7051)]
            pg = await page(data)
            scope = await choose(pg)
            await finish(scope)
            await scope.get_by_text('Jak jsme k výsledku došli?', exact=True).click()
            text = norm(await scope.locator('[data-testid="case-results"]').inner_text())
            assert '23 930' in text and 'Plátce 1' in text and 'Plátce 2' in text and '10 507' not in text
            await pg.emulate_media(media='print')
            report = norm(await pg.locator('.calculation-print-report').inner_text())
            assert '23 930' in report and '10 507' not in report
            await pg.pdf(path=str(OUT / 'multipayer.pdf'), format='A4', print_background=True, prefer_css_page_size=True)
        await check('F01: actual payer terms in both UI and PDF', payers)

        async def fee_mobile():
            pg = await page(seed(), mobile=True)
            scope = await choose(pg, 'nezabavitelna', True)
            await confirm(scope, mobile=True)
            await confirm(scope, mobile=True)
            await scope.get_by_role('checkbox', name='Plátce 1 uplatňuje náhradu a podmínky byly ověřeny').check()
            await confirm(scope, mobile=True)
            assert 'Váš orientační výsledek' in await scope.inner_text()
            assert 'Náhrada plátci: 50 Kč' in await scope.inner_text()
        await check('F07/F10: fee confirmation does not cause a navigation loop', fee_mobile)

        async def storage():
            pg = await page(fail=True)
            scope = await choose(pg)
            assert 'nepodařilo uložit' in await scope.inner_text()
            await scope.get_by_label('Čistá měsíční částka (Kč)', exact=True).fill('30000')
            await confirm(scope, 'income')
            assert await scope.locator('[data-step="family"]').count() == 1
            assert not pg.runtime_errors
        await check('F12: failed storage does not crash calculation', storage)
        await browser.close()
    (OUT / 'results.json').write_text(json.dumps(RESULTS, ensure_ascii=False, indent=2))
    if not all(result['passed'] for result in RESULTS):
        raise SystemExit(1)

if __name__ == '__main__':
    asyncio.run(run())
