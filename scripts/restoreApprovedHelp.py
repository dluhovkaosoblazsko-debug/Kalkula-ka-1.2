# One-time mechanical restoration. Only exact historical wording is imported.
import ast, hashlib, json, os, re, subprocess
from pathlib import Path
ROOT = Path(os.environ.get('RESTORE_ROOT', '.'))
BASE = '685d2400a97a4cb85b246f9f8d1cf6a129f675c9'
SOURCE = '1ad8344381a6373ec2017d90b8b0dc3b901354a7'
PLAIN = '6e95c5ecc03dedbee10b71fb6b050402c2272f61'
OLD_PATH = 'src/kalkulacka/HlavniKalkulackaPage.jsx'
def git_text(ref, path):
    return subprocess.check_output(['git', 'show', f'{ref}:{path}'], cwd=ROOT).decode('utf-8')
local = os.environ.get('HELP_SOURCE_DIR')
source = (Path(local)/'approved-two-layers.jsx').read_text() if local else git_text(SOURCE, OLD_PATH)
plain_source = (Path(local)/'approved-plain.jsx').read_text() if local else git_text(PLAIN, OLD_PATH)
source_lines = source.splitlines()
LINES = {
'incomeSources':103,'incomeType':112,'incomeAmount':120,'payerAllocation':129,
'ownPromise':196,'thirdParty':214,'modelLimit':250,
'commonChildren':724,'dependentsA':763,'dependentsSingle':764,'enforcedAlimonyA':772,
'partnerOwnPension':790,'partnerPension':794,'alimonyA':811,'protectedIncomeA':818,
'dependentsB':847,'enforcedAlimonyB':853,'alimonyB':868,'protectedIncomeB':874,
'executionCount':887,'executionType':896,'payerFee':907,'term':918,
'assetProceeds':927,'unsecuredDebt':935,'securedDebt':953,'nonDischargeable':959,
'baseCoefficient':992,'fullCoefficient':998,'minimumRule':1013,
'retainedExecution':1040,'protectedAmount':1047,'deductionExecution':1069,
'feeResult':1075,'debtAfterFee':1082,'thirdsBase':1111,'oneThird':1117,
'deductionIndividual':1174,'feeIndividual':1180,'alimonyResultIndividual':1187,
'creditorsIndividual':1197,'retainedIndividual':1204,'satisfaction':1245,
'deductionSpouses':1299,'separateSpouseDeduction':1305,'feeSpouses':1311,
'alimonyResultSpouses':1318,'creditorsSpouses':1328,'retainedSpouses':1335,
}
entries = {}
for key, line in LINES.items():
    raw = source_lines[line-1]
    if key == 'incomeType':
        plain = re.search(r'<Tooltip text="([^"]+)"', raw).group(1)
        legal = ''
    elif '<strong' in raw:
        plain = re.search(r'<strong(?: [^>]*)?>Lidsky řečeno:</strong> ([^<]+)<',raw).group(1)
        before = '\n'.join(source_lines[max(0,line-5):line-1])
        legal = re.findall(r'<strong(?: [^>]*)?>Právně přesně:</strong> ([^<]+)<',before)[-1]
    else:
        match = re.search(r'''(["'])(Právně přesně:(?:\\.|(?!\1).)*?Lidsky řečeno:(?:\\.|(?!\1).)*?)\1''',raw)
        text = ast.literal_eval(match.group(0))
        legal, plain = text.removeprefix('Právně přesně: ').split('\n\nLidsky řečeno: ',1)
    assert plain in plain_source, (key, 'Plain wording is not present in the implementation after approval')
    assert not any(c in legal+plain for c in ['${','{params.']), key
    entries[key] = {'plain':plain,'legal':legal,'sourceLine':line,
                    'sha256':hashlib.sha256((plain+'\n'+legal).encode()).hexdigest()}
catalog = {'sourceCommit':SOURCE, 'plainCommit':PLAIN, 'sourcePath':OLD_PATH,
           'sourceSha256':hashlib.sha256(source.encode()).hexdigest(), 'entries':entries}
(ROOT/'src/kalkulacka/approvedHelp.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
writes = {}
def load(path):
    text = (ROOT/path).read_text()
    if not local: assert text == git_text(BASE,path), 'File changed: '+path
    writes[path] = text

def replace(path, before, after):
    text = writes[path]
    assert text.count(before) == 1, (path, before[:160],text.count(before))
    writes[path] = text.replace(before,after)

F = 'src/kalkulacka/CaseFields.jsx'; R = 'src/kalkulacka/CaseResults.jsx'; H = OLD_PATH
for path in [F,R,H]: load(path)
replace(F, "import { groupPayers", "import ApprovedHelp, { optionalHelpKey } from './ApprovedHelp';\nimport { groupPayers")
replace(F, 'money = !integer, disabled = false })', 'money = !integer, disabled = false, helpKey, describedBy })')
replace(F, "aria-describedby={[hint ? `${id}-hint` : '', error ? `${id}-error` : '']", "aria-describedby={[helpKey ? `${id}-help` : hint ? `${id}-hint` : '', describedBy || '', error ? `${id}-error` : '']")
replace(F, '{hint && <p id={`${id}-hint`}', '{helpKey && <ApprovedHelp name={helpKey} id={`${id}-help`} />}\n    {!helpKey && hint && <p id={`${id}-hint`}')
replace(F, 'export function Choice({ checked, onChange, children, hint, controls }) {\n  return <label', 'export function Choice({ checked, onChange, children, hint, controls, helpKey, helpId }) {\n  const id = useId();\n  const description = helpId || `${id}-help`;\n  return <div><label')
replace(F, 'aria-controls={controls} aria-expanded=', 'aria-describedby={helpKey ? description : undefined} aria-controls={controls} aria-expanded=')
replace(F, '{children}{hint && <span', '{children}{!helpKey && hint && <span')
replace(F, '  </label>;\n}', '  </label>{helpKey && <ApprovedHelp name={helpKey} id={description} />}</div>;\n}')
replace(F, 'function SelectField({ field, label, value, onChange, options })', 'function SelectField({ field, label, value, onChange, options, helpKey })')
replace(F, '<select id={id} name={field} className={inputClass}', '<select aria-describedby={helpKey ? `${id}-help` : undefined} id={id} name={field} className={inputClass}')
replace(F, '</select></div>;', '</select>{helpKey && <ApprovedHelp name={helpKey} id={`${id}-help`} />}</div>;')
replace(F, 'function OptionalNumber({ data, setData, field, question, label, hint, legal, errors, integer, max })', 'function OptionalNumber({ data, setData, field, question, label, hint, legal, errors, integer, max, helpKey })')
replace(F, '<Choice checked={open} controls={id}', '<Choice helpKey={helpKey} helpId={`${id}-help`} checked={open} controls={id}')
replace(F, '<NumberField field={field} label={label} integer={integer} max={max}', '<NumberField describedBy={helpKey ? `${id}-help` : undefined} field={field} label={label} integer={integer} max={max}')
replace(F, '{legal && <details className="text-xs leading-relaxed text-slate-500">', '{!helpKey && legal && <details className="text-xs leading-relaxed text-slate-500">')
replace(F, '<p className="text-sm text-slate-600">Začněte částkou, kterou byste dostali, kdyby se z ní nestrhávaly peníze na dluhy. Další příjem přidáte tlačítkem níže.</p>', '<ApprovedHelp name="incomeSources" />')
replace(F, '<SelectField label="Typ příjmu"', '<SelectField helpKey="incomeType" label="Typ příjmu"')
replace(F, '<NumberField label="Čistá měsíční částka"', '<NumberField helpKey="incomeAmount" label="Čistá měsíční částka"')
replace(F, '<NumberField key={g.id} field={`${key}-allocation-${i}`}', '<NumberField helpKey="payerAllocation" key={g.id} field={`${key}-allocation-${i}`}')
replace(F, '<Choice checked={promiseEnabled}', '<Choice helpKey="ownPromise" checked={promiseEnabled}')
replace(F, '<Choice checked={thirdEnabled}', '<Choice helpKey="thirdParty" checked={thirdEnabled}')
replace(F, '<p className="text-sm leading-relaxed text-slate-700">Tyto další platby započítáváme do kontroly měsíčního minima. Do odhadu, kolik dluhů za celé oddlužení splatíte, je tato verze kalkulačky zatím nezahrnuje.</p>\n    <details className="text-xs leading-relaxed text-slate-600"><summary className="cursor-pointer font-bold">Právně přesně</summary><p className="mt-2">{MODEL_NOTE}</p></details>', '<ApprovedHelp name="modelLimit" />')
replace(F, '<h4 className="text-sm font-bold text-slate-800">Náhrada nákladů jednotlivých plátců</h4>', '<h4 className="text-sm font-bold text-slate-800">Náhrada nákladů jednotlivých plátců</h4>\n    <ApprovedHelp name="payerFee" />')
replace(F, '<OptionalNumber {...props} data={data}', '<OptionalNumber {...props} helpKey={optionalHelpKey(props.field, mode)} data={data}')
replace(F, '<Choice checked={data.partnerProNezabavitelnou1}', '<Choice helpKey={results.duchodPovinny1 ? "partnerOwnPension" : "partnerPension"} checked={data.partnerProNezabavitelnou1}')
for field, key in [('pocetExekuci','executionCount'),('typPohledavky','executionType'),('delkaOddluzeni','term')]:
    replace(F, f'<SelectField field="{field}"',f'<SelectField helpKey="{key}" field="{field}"')
replace(F, '<p className="text-xs text-slate-600">Běžná půjčka bývá nepřednostní. Přednostní jsou například výživné, daně či dluhy na sociálním a zdravotním pojištění. U některých důchodců platí výjimka z pravidla 4+.</p>', '')
replace(F, '<NumberField field="dluhyNezajistene"', '<NumberField helpKey="unsecuredDebt" field="dluhyNezajistene"')
replace(R, "import CalculationBreakdown", "import ApprovedHelp from './ApprovedHelp';\nimport CalculationBreakdown")
replace(R, 'function Card({ label, value, hint, testId })', 'function Card({ label, value, hint, testId, helpKey })')
replace(R, '{hint && <p className="mt-2 text-xs leading-relaxed text-slate-600">{hint}</p>}', '{hint && <p className="mt-2 text-xs leading-relaxed text-slate-600">{hint}</p>}\n    {helpKey && <ApprovedHelp name={helpKey} />}')
replace(R, '<Card testId="monthly-deduction"', '<Card helpKey={execution ? "deductionExecution" : spouses ? "deductionSpouses" : "deductionIndividual"} testId="monthly-deduction"')
replace(R, '<Card testId="retained-after-deduction"', '<Card helpKey={execution ? "retainedExecution" : spouses ? "retainedSpouses" : "retainedIndividual"} testId="retained-after-deduction"')
replace(R, '<p>Na dluh po náhradě: {formatKc(results.ex.srazkaCista)}.</p>', '<ApprovedHelp name="feeResult" />\n          <p>Na dluh po náhradě: {formatKc(results.ex.srazkaCista)}.</p>\n          <ApprovedHelp name="debtAfterFee" />')
replace(R, '<h3 className="font-bold">Stačí to na potřebné měsíční minimum?</h3>', '<h3 className="font-bold">Stačí to na potřebné měsíční minimum?</h3>\n          <ApprovedHelp name="minimumRule" />')
replace(R, '<p>Odměna a výdaje insolvenčního správce: {formatKc(spouses ? params.odmenaSpravceManzele : params.odmenaSpravceJednotlivec)}.</p>', '<p>Odměna a výdaje insolvenčního správce: {formatKc(spouses ? params.odmenaSpravceManzele : params.odmenaSpravceJednotlivec)}.</p>\n              <ApprovedHelp name={spouses ? "feeSpouses" : "feeIndividual"} />')
replace(R, '<p className="text-sm leading-relaxed text-slate-700">{SHORT_MODEL_NOTE}</p>', '<ApprovedHelp name="modelLimit" />')
replace(R, '<Card label="Na běžné dluhy ze zákonné srážky měsíčně"', '<Card helpKey={spouses ? "creditorsSpouses" : "creditorsIndividual"} label="Na běžné dluhy ze zákonné srážky měsíčně"')
replace(R, ' hint="Po odečtení odměny a výdajů správce a zadaného výživného."', '')
replace(R, '<Card label="Odhad splacení běžných dluhů"', '<Card helpKey={!data.dluhNeznamy && number(data.dluhyNezajistene) > 0 && sectionReviewed(data, mode, "debts", params) ? "satisfaction" : undefined} label="Odhad splacení běžných dluhů"')
replace(R, '<div className="mt-4 space-y-4">{spouses ?', '<div className="mt-4 space-y-4"><ApprovedHelp name="protectedAmount" />{spouses && <ApprovedHelp name="separateSpouseDeduction" />}{spouses ?')
replace(H, '<NumberField key={key} field={key}', '<NumberField helpKey={key === "koeficientZahladu" ? "baseCoefficient" : key === "koeficientZabavitelnosti" ? "fullCoefficient" : undefined} key={key} field={key}')
T='scripts/verifyClearLanguage.mjs'; load(T)
replace(T, "assert(text.includes('Odhad splacení níže nezahrnuje'));", "assert(text.includes('Do odhadu, kolik celkem zaplatíte věřitelům, je zatím nezapočítává.'));")
replace(T, "assert(text.includes('Výživné, které dostáváte, uvedete zvlášť.'));", "assert(text.includes('Uveďte měsíční výživné, které platíte na děti, které nemáte ve své péči.')); assert(text.includes('výživné na dítě. Důchod, nemocenská'));")
T='scripts/verifyMinimumFunding.mjs'; load(T)
replace(T, "assert(text.includes('tato verze kalkulačky zatím nezahrnuje'));", "assert(text.includes('Do odhadu, kolik celkem zaplatíte věřitelům, je zatím nezapočítává.'));")
W='.github/workflows/progressive-spouses.yml'; load(W)
replace(W, '          persist-credentials: false', '          persist-credentials: false\n          fetch-depth: 0')
replace(W, '          node scripts/verifyMinimumFunding.mjs | tee test-results/minimum-funding.log', '          node scripts/verifyMinimumFunding.mjs | tee test-results/minimum-funding.log\n          node scripts/verifyApprovedHelp.mjs --history | tee test-results/approved-help.log')
for path,text in writes.items(): (ROOT/path).write_text(text)
print('Restored catalogue:',len(entries),'exact entries; files:',list(writes))
