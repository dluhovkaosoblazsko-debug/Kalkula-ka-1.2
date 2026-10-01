import assert from 'node:assert/strict';
import {DEFAULT_2026_PARAMS as P,calculateWageDeduction as calculate,calculateCreditorSatisfaction,calculateDebtorPromiseLimit} from '../src/lib/calculations2026.js';

// Independent reference: exact eighths of CZK, followed by integer arithmetic.
// Based on NV 595/2006 §§1–4 and OSŘ §279. Inputs here have valid legal flags;
// the separate audit suite verifies recognition of pension/payer types in the app.
function reference(income,n,partner,pension,priority,four,fee){
 const q = n + Number(partner && pension);
 const floor = Math.ceil((112812 + 28203 * q)/8);
 const rem = Math.max(0, income-floor);
 const beyond = Math.max(0,rem-31521);
 const thirds = Math.floor(Math.min(rem,31521)/3);
 const mult = priority || (four && !(pension && thirds<1089)) ? 2 : 1;
 const deduction = beyond + thirds*mult;
 return {legalniMinimum:floor,srazka:deduction,kVyplate:income-deduction,nahradaPlatci:fee?Math.min(50,Math.ceil(deduction/3)):0};
}
let tests=0;const mismatches=[];
for(let n=0;n<=10;n++)for(const partner of [false,true])for(const pension of [false,true])for(const priority of [false,true])for(const four of [false,true])for(const fee of [false,true]){
 const floor=Math.ceil((112812+28203*(n+Number(partner&&pension)))/8);
 const incomes = [...new Set([0,1,10,100,1000,10000,30000,50000,100000,1000000,...[-3,-2,-1,0,1,2,3].flatMap(x=>[floor+x,floor+3267+x,floor+31521+x])])].filter(n=>n>=0);
 for(const income of incomes){
  const inp={prijem:income,pocetVyz:n,maPartnera:partner,duchodPovinny:pension,typ:priority?'prednostni':'neprednostni',pocetExekuci:four?'4+':'1-3',uplatnitPausal:fee};
  const got=calculate(inp),want=reference(income,n,partner,pension,priority,four,fee);
  for(const k of Object.keys(want))if(got[k]!==want[k])mismatches.push({inp,k,got:got[k],want:want[k]});
  assert(got.srazka>=0 && got.srazka<=income); assert.equal(got.srazka+got.kVyplate,income);
  tests++;
 }
}
let invariants=0;
for(let i=0;i<20000;i++){
 const retained=(i*997)%100000,needs=(i*9973)%100000,deficit=(i*661)%8000,requested=(i*331)%20000;
 const r=calculateDebtorPromiseLimit({retainedAfterStatutoryDeduction:retained,basicNeeds:needs,deficitAfterStatutoryDeduction:deficit,requestedPromise:requested});
 assert(r.effectiveDebtorPromise>=0 && r.effectiveDebtorPromise<=requested && r.effectiveDebtorPromise<=deficit);
 assert(r.effectiveDebtorPromise<=Math.max(0,retained-needs));
 const sat=calculateCreditorSatisfaction({availableForCreditors:retained*36,unsecuredDebt:needs*20});
 assert(sat.percentage>=0 && sat.percentage<=100);assert(sat.actualPayment<=sat.unsecuredDebt);
 invariants++;
}
assert.equal(mismatches.length,0,JSON.stringify(mismatches.slice(0,3)));
console.log(JSON.stringify({singlePayerTests:tests,mismatches:mismatches.length,financialInvariants:invariants}));
