"""Exercise the shared funding form in the production bundle, offline.
Uses the same isolated storage/share harness as the existing browser checks.
Usage: python scripts/verifyMinimumFunding.py BUILD_ROOT OUTPUT_DIR
"""
import asyncio
import json
import os
import re
from playwright.async_api import async_playwright
from verifyBrowserRepairs import HTML, OUT, TITLES, norm, seed, shim

RESULTS = []

async def main():
    async with async_playwright() as pw:
        options = {'headless': True}
        if os.environ.get('CHROMIUM_EXECUTABLE'):
            options['executable_path'] = os.environ['CHROMIUM_EXECUTABLE']
        browser = await pw.chromium.launch(**options)
        for mode in ['jednotlivec', 'manzele']:
            for mobile in [False, True]:
                suffix = 'M' if mode == 'manzele' else '1'
                need = 3267 if mode == 'manzele' else 2178
                own_key = 'zavaznyPrislib' + suffix
                needs_key = 'zakladniPotreby' + suffix
                third_key = 'pravidelnePlneniTretiOsoby' + suffix
                data = seed(a=16800, b=0, schemaVersion=2, bezPostizitelnehoPrijmu2=True)
                data['spolecneDeti' if mode == 'manzele' else 'vyzivovaneOsoby1'] = 1
                context = await browser.new_context(viewport={'width': 390 if mobile else 1440, 'height': 1000}, locale='cs-CZ', service_workers='block')
                pg = await context.new_page()
                pg.set_default_timeout(7000)
                pg.on('dialog', lambda dialog: dialog.accept())
                runtime_errors = []
                pg.on('pageerror', lambda error: runtime_errors.append(str(error)))
                name = f'Funding workflow: {mode}, mobile={mobile}'
                try:
                    await pg.set_content(HTML.replace('<head>', '<head>' + shim(data)), wait_until='load')
                    scope = pg.locator('.mobile-calculator' if mobile else '.desktop-calculator')
                    await scope.get_by_role('button', name=re.compile('^' + re.escape(TITLES[mode]))).click()
                    for step in (['incomeA', 'incomeB'] if mode == 'manzele' else ['income']) + ['family', 'other', 'debts']:
                        target = scope if mobile else scope.locator(f'[data-step="{step}"]')
                        await target.locator('[data-action="confirm-section"]').click()
                    form = scope.get_by_test_id('minimum-funding')
                    assert f'chybí {need:,}'.replace(',', ' ') in norm(await form.get_by_test_id('funding-need').inner_text())
                    await form.get_by_role('checkbox', name=re.compile('^Chci chybějící částku')).check()
                    await form.locator(f'input[name="{needs_key}"]').fill('12000')
                    own = form.locator(f'input[name="{own_key}"]')
                    await own.fill(str(need))
                    expected_retained = f'{16800 - need:,}'.replace(',', ' ')
                    assert expected_retained in norm(await form.get_by_test_id('own-funding-summary').inner_text())
                    assert await form.get_by_test_id('third-party-funding').count() == 0
                    assert 'nejvýše' not in await form.inner_text()
                    assert await pg.evaluate('document.documentElement.scrollWidth <= innerWidth')
                    await form.screenshot(path=str(OUT / f'full-own-{mode}-{mobile}.png'))

                    # A partial own payment reopens the residual need for other help.
                    await own.fill('1000')
                    other = form.get_by_test_id('third-party-funding')
                    assert f'{need - 1000:,}'.replace(',', ' ') in norm(await other.inner_text())
                    await other.get_by_role('checkbox').check()
                    await other.locator(f'input[name="{third_key}"]').fill(str(need - 1000))
                    assert 'je potřebné měsíční minimum pokryté' in await form.get_by_test_id('funding-status').inner_text()

                    # Raising the own payment must not hide or silently clear existing help.
                    await own.fill(str(need))
                    assert await other.locator(f'input[name="{third_key}"]').input_value() == str(need - 1000)
                    assert 'Minimum je už pokryté bez této pomoci.' in await other.inner_text()
                    # This checkbox is deliberately removed after the click. Verify the
                    # disappearance and stored value instead of waiting for an unchecked DOM node.
                    assert await other.get_by_role('checkbox').is_checked()
                    await other.get_by_role('checkbox').click()
                    assert await form.get_by_test_id('third-party-funding').count() == 0
                    stored = await pg.evaluate("JSON.parse(window.__values.insCalcData2026_v10)")
                    assert stored['povolitPlneniTretiOsoby' + suffix] is False
                    assert stored[third_key] == ''
                    assert stored[own_key] == need

                    # Needs remain a real limit, distinct from the missing installment.
                    await form.locator(f'input[name="{needs_key}"]').fill('16000')
                    assert 'zbývá jen 800 Kč' in norm(await form.inner_text())
                    assert f'{need - 800:,}'.replace(',', ' ') in norm(await form.get_by_test_id('third-party-funding').inner_text())
                    assert await own.input_value() == str(need)
                    await form.locator(f'input[name="{needs_key}"]').fill('')
                    assert 'Nejdřív opravte označené částky.' in await form.get_by_test_id('funding-status').inner_text()
                    target = scope if mobile else scope.locator('[data-step="minimum"]')
                    await target.locator('[data-action="confirm-section"]').click()
                    assert await form.is_visible()
                    assert await scope.get_by_role('button', name='Tisk / PDF', exact=True).count() == 0
                    await form.locator(f'input[name="{needs_key}"]').fill('12000')
                    await target.locator('[data-action="confirm-section"]').click()
                    text = norm(await scope.get_by_test_id('case-results').inner_text())
                    assert 'Váš orientační výsledek' in text
                    assert expected_retained in text
                    assert not runtime_errors, runtime_errors
                    RESULTS.append({'name': name, 'passed': True})
                    print('PASS:', name, flush=True)
                except Exception as error:
                    await pg.screenshot(path=str(OUT / f'failure-{mode}-{mobile}.png'), full_page=True)
                    RESULTS.append({'name': name, 'passed': False, 'error': str(error)})
                    print('FAIL:', name, str(error), flush=True)
                finally:
                    await context.close()
        await browser.close()
    (OUT / 'minimum-funding-results.json').write_text(json.dumps(RESULTS, ensure_ascii=False, indent=2))
    if not all(result['passed'] for result in RESULTS):
        raise SystemExit(1)

if __name__ == '__main__':
    asyncio.run(main())
