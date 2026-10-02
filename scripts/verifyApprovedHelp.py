"""Check exact original help, keyboard access and unchanged choices in the built UI.
Uses the existing offline test harness; no production navigation or real user data.
Usage: python scripts/verifyApprovedHelp.py BUILD_ROOT OUTPUT_DIR
"""
import asyncio
import json
import os
import re
from playwright.async_api import async_playwright
from verifyBrowserRepairs import HTML, OUT, ROOT, TITLES, norm, seed, shim

CATALOG = json.loads((ROOT / 'src/kalkulacka/approvedHelp.json').read_text())['entries']
INSTRUCTION = 'Pokud je vaše odpověď ANO, políčko zaškrtněte. Pokud je odpověď NE, nechte ho prázdné.'

async def main():
    results = []
    async with async_playwright() as pw:
        options = {'headless': True}
        if os.environ.get('CHROMIUM_EXECUTABLE'):
            options['executable_path'] = os.environ['CHROMIUM_EXECUTABLE']
        browser = await pw.chromium.launch(**options)
        for mode in ['jednotlivec', 'manzele', 'nezabavitelna']:
            for mobile in [False, True]:
                context = await browser.new_context(viewport={'width': 390 if mobile else 1440, 'height': 1000}, locale='cs-CZ', service_workers='block')
                page = await context.new_page()
                page.set_default_timeout(7000)
                runtime_errors = []
                page.on('pageerror', lambda error: runtime_errors.append(str(error)))
                name = f'Original help and checkbox access: {mode}, mobile={mobile}'
                try:
                    await page.set_content(HTML.replace('<head>', '<head>' + shim(seed())), wait_until='load')
                    scope = page.locator('.mobile-calculator' if mobile else '.desktop-calculator')
                    await scope.get_by_role('button', name=re.compile('^' + re.escape(TITLES[mode]))).click()
                    help_block = scope.locator('[data-approved-help="incomeAmount"]').first
                    assert norm(await help_block.locator('[data-help-layer="plain"]').inner_text()) == norm('Lidsky řečeno: ' + CATALOG['incomeAmount']['plain'])
                    assert await help_block.locator('details').get_attribute('open') is None
                    await help_block.locator('summary').click()
                    assert await help_block.locator('[data-help-layer="legal"]').is_visible()
                    for step in ['incomeA', 'incomeB'] if mode == 'manzele' else ['income']:
                        target = scope if mobile else scope.locator(f'[data-step="{step}"]')
                        await target.locator('[data-action="confirm-section"]').click()
                    family = scope if mobile else scope.locator('[data-step="family"]')
                    key = 'dependentsA' if mode == 'manzele' else 'dependentsSingle'
                    help_block = family.locator(f'[data-approved-help="{key}"]')
                    checkbox = family.get_by_role('checkbox', name='Vyživuje manžel A ještě další osoby?' if mode == 'manzele' else 'Vyživujete děti nebo jiné osoby?', exact=True)
                    assert not await checkbox.is_checked()
                    assert await help_block.locator('xpath=ancestor::label').count() == 0
                    instruction = help_block.locator('xpath=preceding-sibling::p[@data-checkbox-answer-hint]')
                    assert await instruction.is_visible()
                    assert await instruction.inner_text() == INSTRUCTION
                    hint_id = await instruction.get_attribute('id')
                    description_ids = (await checkbox.get_attribute('aria-describedby')).split()
                    assert hint_id in description_ids
                    assert await help_block.get_attribute('id') in description_ids
                    before = await page.evaluate('JSON.stringify(window.__values)')
                    await instruction.click()
                    assert not await checkbox.is_checked()
                    assert await page.evaluate('JSON.stringify(window.__values)') == before
                    await help_block.locator('summary').click()
                    assert await help_block.locator('[data-help-layer="legal"]').is_visible()
                    assert not await checkbox.is_checked()
                    assert await page.evaluate('JSON.stringify(window.__values)') == before
                    assert norm(await help_block.locator('[data-help-layer="plain"]').inner_text()) == norm('Lidsky řečeno: ' + CATALOG[key]['plain'])
                    await checkbox.focus()
                    await page.keyboard.press('Space')
                    assert await checkbox.is_checked()
                    assert await instruction.inner_text() == INSTRUCTION
                    field = family.locator('input[name="vyzivovaneOsoby1"]')
                    assert await field.is_visible()
                    await field.fill('1')
                    description_id = await field.get_attribute('aria-describedby')
                    assert description_id and await page.locator('[id="' + description_id + '"]').count() == 1
                    assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                    await page.screenshot(path=str(OUT / f'family-{mode}-{mobile}.png'), full_page=True)
                    for step in ['family'] + (['execution'] if mode == 'nezabavitelna' else ['other', 'debts']):
                        target = scope if mobile else scope.locator(f'[data-step="{step}"]')
                        await target.locator('[data-action="confirm-section"]').click()
                    final = scope.get_by_test_id('case-results')
                    assert await final.get_attribute('data-state') == 'complete'
                    await final.screenshot(path=str(OUT / f'result-{mode}-{mobile}.png'))
                    assert not runtime_errors, runtime_errors
                    results.append({'name': name, 'passed': True})
                    print('PASS:', name, flush=True)
                except Exception as error:
                    await page.screenshot(path=str(OUT / f'failure-{mode}-{mobile}.png'), full_page=True)
                    results.append({'name': name, 'passed': False, 'error': str(error)})
                    print('FAIL:', name, str(error), flush=True)
                finally:
                    await context.close()
        await browser.close()
    (OUT / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
    if not all(result['passed'] for result in results):
        raise SystemExit(1)

if __name__ == '__main__':
    asyncio.run(main())
