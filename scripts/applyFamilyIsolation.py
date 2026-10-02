# One-time integration patch. Reject any drift from the reviewed base commit.
from pathlib import Path
import subprocess
ROOT = Path('.')
BASE = '0d0377df614b1ccfdec145b53d57f2237eef7f67'
def patch(path, pairs):
 p=ROOT/path
 t=p.read_text()
 expected=subprocess.check_output(['git','show',f'{BASE}:{path}']).decode()
 assert t==expected, f'Changed source: {path}'
 for a,b in pairs:
  assert t.count(a)==1,(path,a[:100],t.count(a))
  t=t.replace(a,b)
 p.write_text(t)
patch('src/kalkulacka/HlavniKalkulackaPage.jsx',[
 ("useEffect, useMemo, useState", "useCallback, useEffect, useMemo, useState"),
 ("const DATA_KEY =", "import { restoreFamilyWorkspace, activeFamilyData, serializeFamilyWorkspace, updateFamilyCase, switchFamilyMode, legacyReviewPending, assignLegacyFamily, applyFamilyCopy } from './familyState.js';\nimport { FamilyWorkspaceContext, legacyFamilyQuestion } from './FamilyControls';\n\nconst DATA_KEY ="),
 ("let data = createDefaultData(), params = { ...DEFAULT_2026_PARAMS }, error = null;", "let data = createDefaultData(), params = { ...DEFAULT_2026_PARAMS }, error = null, workspace;"),
 ("      params = { ...params, ...storedParams.value };\n    }", "      params = { ...params, ...storedParams.value };\n    }\n    workspace = restoreFamilyWorkspace(data);"),
 ("  return {data,params,error};", "  return {workspace: workspace || restoreFamilyWorkspace(createDefaultData()),params,error};"),
 ("  const [data,setData] = useState(initial.data);", "  const [workspace,setWorkspace] = useState(initial.workspace);\n  const data = useMemo(() => activeFamilyData(workspace), [workspace]);\n  const mode = workspace.mode;\n  const setData = useCallback(update => setWorkspace(previous => updateFamilyCase(previous, update)), []);\n  const setMode = nextMode => {\n    if (legacyReviewPending(workspace)) {\n      if (!window.confirm(legacyFamilyQuestion(workspace, nextMode))) return false;\n      setWorkspace(previous => legacyReviewPending(previous) ? assignLegacyFamily(previous, nextMode) : switchFamilyMode(previous, nextMode));\n    } else setWorkspace(previous => switchFamilyMode(previous, nextMode));\n    return true;\n  };\n  const familyContext = { workspace, onCopy: (source, common) => setWorkspace(previous => applyFamilyCopy(previous, source, common)) };"),
 ("  const [mode,setMode] = useState('jednotlivec');\n", ""),
 ("writeStored(window.localStorage,DATA_KEY,data)", "writeStored(window.localStorage,DATA_KEY,serializeFamilyWorkspace(workspace))"),
 ("  },[data,params,saveAllowed]);", "  },[workspace,params,saveAllowed]);"),
 ("setData(createDefaultData());setMode('jednotlivec');setStarted(false);", "setWorkspace(restoreFamilyWorkspace(createDefaultData()));setStarted(false);"),
 ("if (!caseStatus(data,mode,results,params).canExport)", "if (legacyReviewPending(workspace) || !caseStatus(data,mode,results,params).canExport)"),
 ("  return <div className=\"calculator-page", "  return <FamilyWorkspaceContext.Provider value={familyContext}><div className=\"calculator-page"),
 ("onClick={()=>{setMode(key);setStarted(true);}}", "onClick={()=>{if(setMode(key)!==false) setStarted(true);}}"),
 ("  </div>;\n}", "  </div></FamilyWorkspaceContext.Provider>;\n}"),
])
patch('src/kalkulacka/WorkflowForms.jsx',[
 ("if(key!==mode) {setMode(key);} go(key==='manzele'?'incomeA':'income');", "if(setMode(key)===false) return; go(key==='manzele'?'incomeA':'income');"),
])
patch('src/kalkulacka/CaseFields.jsx',[
 ("import ApprovedHelp,", "import FamilyTransfer, { ENFORCED_ALIMONY_NOTE, LEGAL_PARTNER_NOTE } from './FamilyControls';\nimport ApprovedHelp,"),
 ("  if (step === 'family') return <div className=\"space-y-4\">", "  if (step === 'family') return <div className=\"space-y-4\">\n    <FamilyTransfer key={mode} />"),
 ("        {field({field:`osobySVykonemProVyzivne${p}`", "        <p data-testid=\"enforced-alimony-guidance\" className=\"text-xs leading-relaxed text-slate-600\">{ENFORCED_ALIMONY_NOTE}</p>\n        {field({field:`osobySVykonemProVyzivne${p}`"),
 ("    {mode === 'manzele' && (results.insM_A.partnerZapocitan", "    {mode !== 'manzele' && <p data-testid=\"legal-partner-guidance\" className=\"text-xs leading-relaxed text-slate-600\">{LEGAL_PARTNER_NOTE}</p>}\n    {mode === 'manzele' && (results.insM_A.partnerZapocitan"),
])
# Explicitly accept the new legacy-mode confirmation for the old stored fixtures.
# All existing numerical, browser and safety assertions stay unchanged.
patch('scripts/verifyMinimumFunding.py',[("                pg.set_default_timeout(7000)","                pg.set_default_timeout(7000)\n                pg.on('dialog', lambda dialog: dialog.accept())")])
print('Integrated independent families and approved notes; rules/text catalogue unchanged.')
