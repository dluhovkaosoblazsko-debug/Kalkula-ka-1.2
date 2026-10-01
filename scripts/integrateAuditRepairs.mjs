// Temporary integration helper. Runs only on audit-repairs-2026-10-01 and is removed before merge.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const base = '1bb921da98837942de44262a62cc479dbcd2a7be';
const sha = text => { const b = Buffer.from(text); return createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex'); };
assert.equal(execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),'audit-repairs-2026-10-01');
const changes = JSON.parse(fs.readFileSync('scripts/audit-integration.json','utf8'));
const prepared = [];
for (const [path,patch] of Object.entries(changes)) {
  assert(path.startsWith('src/') || path.startsWith('scripts/'));
  assert(!path.includes('..'));
  const original = fs.readFileSync(path,'utf8');
  assert.equal(sha(original),patch.old,`Source changed: ${path}`);
  if (patch.delete) {prepared.push([path,null]);continue;}
  const lines = original.match(/[^\n]*\n|[^\n]+$/g) || [];
  for (const [start,end,replacement] of [...patch.edits].reverse()) lines.splice(start,end-start,replacement);
  const updated = lines.join('');
  assert.equal(sha(updated),patch.new,`Patch did not reproduce tested source: ${path}`);
  prepared.push([path,updated]);
}
const originalMain = execFileSync('git',['show',`${base}:src/kalkulacka/HlavniKalkulackaPage.jsx`],{encoding:'utf8'});
assert.equal(sha(originalMain),'faf1a0a2df6ae6051dc791c68d168a69cd3138ac');
const start = '  const results = useMemo(() => {\n';
const end = '  }, [data, params, activeTab]);';
assert.equal(originalMain.split(start).length,2);
assert.equal(originalMain.split(end).length,2);
const body = originalMain.slice(originalMain.indexOf(start)+start.length,originalMain.indexOf(end));
const casePath = 'src/kalkulacka/calculateCase.js';
const currentCase = fs.readFileSync(casePath,'utf8');
const marker = '  // @INTEGRATE_ORIGINAL_CASE_BODY\n';
assert.equal(currentCase.split(marker).length,2);
const caseSource = currentCase.replace(marker,'\n'+body+'\n');
assert.equal(sha(caseSource),'ea7949e62867978d18832f26eb8c0871976d634c');
prepared.push([casePath,caseSource]);
for(const [path,text] of prepared) { if(text===null) fs.unlinkSync(path);else fs.writeFileSync(path,text); }
console.log('Verified integration completed. Original case arithmetic copied without changes; targeted core and export patches matched expected hashes.');
