// One-time, guarded integration correction. Removed before merge.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const path = 'src/kalkulacka/HlavniKalkulackaPage.jsx';
const source = fs.readFileSync(path, 'utf8');
const bytes = Buffer.from(source);
const sha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
assert.equal(sha, 'e290641397b8013f981672cd89788ee59cb3f7b5');
const before = `      {(activeTab !== 'manzele' || hasActiveIncome) && (
        <PrintableCalculationReport
          mode={activeTab}
          data={data}
          results={results}
          params={params}
        />
      )}`;
const after = `      <PrintableCalculationReport
        mode={activeTab}
        data={data}
        results={results}
        params={params}
      />`;
assert.equal(source.split(before).length, 2);
const next = source.replace(before, after);
fs.writeFileSync(path, next);
console.log('Shared print report preserved for desktop and mobile; no calculation changes.');
