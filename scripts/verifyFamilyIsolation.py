"""Mode-switching, explicit family transfer and old-storage regression tests.
Run against the actual production bundle with the existing offline harness.
"""
import asyncio
import json
import os
import re
from playwright.async_api import async_playwright
from verifyBrowserRepairs import HTML, OUT, TITLES, norm, seed, shim

async def main():
    checks = []
    async with async_playwright() as pw:
        args = {'headless': True}
        if os.environ.get('CHROMIUM_EXECUTABLE'):
            args['executable_path'] = os.environ['CHROMIUM_EXECUTABLE']
        browser = await pw.chromium.launch(**args)
        for mobile in [False, True]:
            context = await browser.new_context(viewport={'width': 390 if mobile else 1440, 'height': 1000}, locale='cs-CZ', service_workers='block')
            pg = await context.new_page()
            pg.set_default_timeout(7000)
            dialogs = []
            decisions = {'accept': True}
            async def dialog_handler(dialog):
                dialogs.append(dialog.message)
                if decisions['accept']:
                    await dialog.accept()
                else:
                    await dialog.dismiss()
            pg.on('dialog', dialog_handler)
            errors = []
            pg.on('pageerror', lambda error: errors.append(str(error)))
            async def load(raw):
                await pg.set_content(HTML.replace('<head>', '<head>' + shim(raw)), wait_until='load')
                await pg.locator('.desktop-calculator').wait_for(state='attached')
                return pg.locator('.mobile-calculator' if mobile else '.desktop-calculator')
            async def choose(scope, mode, switching=False):
                if switching and mobile:
                    await scope.get_by_role('button', name='Změnit výpočet', exact=True).click()
                await scope.get_by_role('button', name=re.compile('^' + re.escape(TITLES[mode]))).click()
            async def confirm(scope, step):
                target = scope if mobile else scope.locator(f'[data-step="{step}"]')
                if not mobile and await target.locator(':scope > details').get_attribute('open') is None:
                    await target.locator(':scope > details > summary').click()
                await target.locator('[data-action="confirm-section"]').click()
            async def finish(scope, mode, skip_income=False):
                steps = [] if skip_income else (['incomeA', 'incomeB'] if mode == 'manzele' else ['income'])
                for step in steps + ['family'] + (['execution'] if mode == 'nezabavitelna' else ['other', 'debts']):
                    await confirm(scope, step)
            async def stored():
                return await pg.evaluate('JSON.parse(window.__values.insCalcData2026_v10)')
            async def family(scope):
                return scope if mobile else scope.locator('[data-step="family"]')
            async def copy(scope, source, common=None):
                target = await family(scope)
                transfer = target.get_by_test_id('family-transfer')
                details = transfer.locator(':scope > details').first
                if await details.get_attribute('open') is None:
                    await details.locator(':scope > summary').click()
                await transfer.get_by_test_id('family-copy-source').select_option(source)
                before = await stored()
                if common is not None:
                    assert await transfer.get_by_test_id('apply-family-copy').count() == 0
                    await transfer.get_by_test_id('family-copy-common').fill(str(common))
                assert await stored() == before, 'Preview changed saved answers'
                await transfer.get_by_test_id('apply-family-copy').click()
            name = f'Independent families, conscious copies, reload/reset; mobile={mobile}'
            try:
                scope = await load(seed(spolecneDeti=2))
                await choose(scope, 'manzele')
                assert len(dialogs) == 1 and 'Starší uložené rodinné údaje' in dialogs[0]
                await finish(scope, 'manzele')
                assert '8 462' in norm(await scope.get_by_test_id('monthly-deduction').inner_text())
                original = (await stored())['_familyWorkspace']['byMode']['manzele']
                await choose(scope, 'jednotlivec', True)
                await confirm(scope, 'income')
                target = await family(scope)
                assert await target.locator('input[name="vyzivovaneOsoby1"]').count() == 0
                assert await target.get_by_test_id('enforced-alimony-guidance').is_visible()
                assert await target.get_by_test_id('legal-partner-guidance').is_visible()
                await copy(scope, 'manzele')
                assert await target.locator('input[name="vyzivovaneOsoby1"]').input_value() == '2'
                await finish(scope, 'jednotlivec', True)
                assert '5 898' in norm(await scope.get_by_test_id('monthly-deduction').inner_text())
                await choose(scope, 'manzele', True)
                if mobile:
                    await finish(scope, 'manzele')
                assert (await stored())['_familyWorkspace']['byMode']['manzele'] == original
                assert '8 462' in norm(await scope.get_by_test_id('monthly-deduction').inner_text())
                if mobile:
                    await scope.get_by_role('button', name=re.compile('^Upravit: Rodinná situace')).click()
                else:
                    target = await family(scope)
                    await target.locator(':scope > details > summary').click()
                await copy(scope, 'jednotlivec', 2)
                await confirm(scope, 'family')
                if not mobile:
                    assert '8 462' in norm(await scope.get_by_test_id('monthly-deduction').inner_text())
                else:
                    assert await scope.get_by_test_id('case-results').get_attribute('data-state') == 'complete'
                original = (await stored())['_familyWorkspace']['byMode']['manzele']
                await choose(scope, 'nezabavitelna', True)
                await confirm(scope, 'income')
                target = await family(scope)
                assert await target.locator('input[name="vyzivovaneOsoby1"]').count() == 0
                await copy(scope, 'manzele')
                await finish(scope, 'nezabavitelna', True)
                assert '2 949' in norm(await scope.get_by_test_id('monthly-deduction').inner_text())
                saved = await stored()
                assert saved['_familyWorkspace']['byMode']['manzele'] == original
                assert saved['_familyWorkspace']['byMode']['jednotlivec']['vyzivovaneOsoby1'] == 2
                if mobile:
                    await scope.get_by_role('button', name='Sdílet', exact=True).click()
                    assert '2 949' in norm((await pg.evaluate('window.__shared'))['text'])
                await pg.emulate_media(media='print')
                assert '2 949' in norm(await pg.locator('.calculation-print-report').inner_text())
                await pg.emulate_media(media='screen')
                await pg.screenshot(path=str(OUT / f'execution-{mobile}.png'), full_page=True)
                scope = await load(saved)
                await choose(scope, 'manzele')
                await finish(scope, 'manzele')
                assert '8 462' in norm(await scope.get_by_test_id('monthly-deduction').inner_text())
                assert len(dialogs) == 1, 'New storage required legacy migration again'
                if mobile:
                    await scope.get_by_role('button', name='Změnit výpočet', exact=True).click()
                    await scope.get_by_role('button', name='Nový výpočet / vymazat údaje', exact=True).click()
                else:
                    await scope.get_by_role('button', name='Nový výpočet', exact=True).click()
                cleared = await stored()
                assert cleared['_familyWorkspace']['legacy'] is None
                assert all(f['vyzivovaneOsoby1'] == 0 for f in cleared['_familyWorkspace']['byMode'].values())
                assert not errors, errors
                checks.append({'name': name, 'passed': True})
                print('PASS:', name, flush=True)
            except Exception as error:
                await pg.screenshot(path=str(OUT / f'failure-{mobile}.png'), full_page=True)
                checks.append({'name': name, 'passed': False, 'error': str(error)})
                print('FAIL:', name, error, flush=True)
            name = f'Legacy cancel, explicit assignment and source preservation; mobile={mobile}'
            try:
                original = seed(spolecneDeti=2, vyzivovaneOsoby1=3, vyzivovaneOsoby2=1)
                scope = await load(original)
                decisions['accept'] = False
                await choose(scope, 'jednotlivec')
                assert await scope.get_by_role('heading', name='Co chcete spočítat?', exact=True).is_visible()
                saved = await stored()
                assert saved['_familyWorkspace']['legacyResolvedTo'] is None
                assert saved['_familyWorkspace']['legacy']['spolecneDeti'] == 2
                await pg.emulate_media(media='print')
                assert 'Výpočet nelze vydat' in await pg.locator('.calculation-print-report').inner_text()
                await pg.emulate_media(media='screen')
                decisions['accept'] = True
                await choose(scope, 'manzele')
                saved = await stored()
                assert saved['vyzivovaneOsoby1'] == 3 and saved['spolecneDeti'] == 2
                assert saved['_familyWorkspace']['legacy']['vyzivovaneOsoby2'] == 1
                assert not saved['_confirmed'].get('manzele', {}).get('family')
                checks.append({'name': name, 'passed': True})
                print('PASS:', name, flush=True)
            except Exception as error:
                checks.append({'name': name, 'passed': False, 'error': str(error)})
                print('FAIL:', name, error, flush=True)
            await context.close()
        await browser.close()
    (OUT / 'results.json').write_text(json.dumps(checks, ensure_ascii=False, indent=2))
    if not all(c['passed'] for c in checks):
        raise SystemExit(1)

if __name__ == '__main__':
    asyncio.run(main())
