import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {auditWorkouts,evaluateRaces,reportMarkdown} from '../src/race-evaluation.js';
const data=JSON.parse(readFileSync(new URL('../fixtures/race-study-synthetic.json',import.meta.url)));
const options={asOf:'2025-12-31',source:'synthetic'};
const report=()=>evaluateRaces(data,options);

test('audit rejects invalid dates, future records, impossible values and all duplicate candidates',()=>{
  const base={date:'2025-01-01',type:'Easy',distanceMiles:5,durationSeconds:2400};
  const a=auditWorkouts([base,{...base}, {...base,date:'2025-02-30'}, {...base,date:'2026-01-01'},
    {...base,date:'2025-01-03',distanceMiles:NaN},null],options.asOf);
  assert.equal(a.excluded,6);assert.equal(a.records[0].reasons[0],'Possible duplicate; resolve before evaluation');
  assert.equal(auditWorkouts([{...base,avgHeartRate:null}],options.asOf).accepted,1);
});
test('race label is explicit, supported distances required and paused race timers require review',()=>{
  const race={date:'2025-01-01',type:'Race',distanceMiles:5000/1609.344,durationSeconds:1200};
  const a=auditWorkouts([race,{...race,date:'2025-01-02',type:'Easy'},
    {...race,date:'2025-01-03',elapsedSeconds:1300},{...race,date:'2025-01-04',distanceMiles:2.2}],options.asOf);
  assert.equal(a.raceCount,1);assert.equal(a.excluded,2);
});
test('forecast histories and all feature windows strictly precede their target date',()=>{
  const r=report();assert.equal(r.audit.raceCount,20);assert.ok(r.metrics.rolling.n>0);
  for(const row of r.rows){
    assert.ok(row.training.sessions.every(s=>s.date<row.date));
    for(const p of Object.values(row.predictions))assert.ok((p.history??[]).every(h=>h.date<row.date));
  }
  assert.equal(r.rows[0].predictions.riegel.seconds,null);
  assert.equal(r.rows[1].predictions.previous_event.seconds,null);
  assert.equal(r.rows[2].predictions.previous_event.seconds,r.rows[0].actualSeconds);
  assert.ok(Math.abs(r.rows[1].predictions.riegel.seconds-r.rows[0].actualSeconds*(8000/5000)**1.06)<1e-8);
});
test('changing a target outcome or later outcomes cannot change its forecast',()=>{
  const before=report(),target=before.rows[15];
  const changed=data.map(w=>w.type==='Race'&&w.date>=target.date?{...w,durationSeconds:w.durationSeconds+250}:w);
  const after=evaluateRaces(changed,options);
  assert.deepEqual(after.rows[15].predictions,target.predictions);
  assert.deepEqual(after.rows.slice(0,15),before.rows.slice(0,15));
});
test('same-day training is excluded and same-day races never teach each other',()=>{
  const before=report(),target=before.rows[15];
  const changed=[...data,{id:'same-day-training',date:target.date,type:'Easy',distanceMiles:80,durationSeconds:5000},
    {id:'same-day-race',date:target.date,type:'Race',distanceMiles:3000/1609.344,durationSeconds:600}];
  const after=evaluateRaces(changed,options).rows.find(r=>r.date===target.date&&r.eventMeters===target.eventMeters);
  assert.deepEqual(after.predictions,target.predictions);assert.deepEqual(after.training,target.training);
});
test('frozen history stays fixed while expanding and rolling policies update causally',()=>{
  const rows=report().rows.filter(r=>r.predictions.rolling.seconds!==null);
  assert.ok(rows.length>2);
  assert.deepEqual(rows[0].predictions.frozen.history,rows.at(-1).predictions.frozen.history);
  assert.equal(new Set(rows.at(-1).predictions.rolling.history.map(r=>r.date)).size,12);
  assert.ok(rows.at(-1).predictions.expanding.trainingRows>rows[0].predictions.expanding.trainingRows);
  assert.notEqual(rows.at(-1).predictions.rolling.seconds,rows.at(-1).predictions.frozen.seconds);
});
test('metrics use matched cohorts and no unavailable prediction is scored as zero',()=>{
  const r=report();const paired=r.rows.filter(row=>row.predictions.rolling.seconds!==null);
  const delta=paired.reduce((s,row)=>s+Math.abs(row.predictions.rolling.seconds-row.actualSeconds)-Math.abs(row.predictions.riegel.seconds-row.actualSeconds),0)/paired.length;
  assert.ok(Math.abs(r.metrics.rolling.pairedMaeDifferenceSeconds-delta)<.0001);
  assert.equal(r.metrics.riegel.n,19);assert.equal(r.metrics.previous_event.n,18);
  assert.equal(r.metrics.rolling.n,paired.length);assert.ok(r.byEvent['5000'].riegel.n>0);
  assert.equal(evaluateRaces([],options).metrics.riegel.maeSeconds,null);
});
test('deterministic reports omit personal identifiers, notes and coordinates',()=>{
  const r=evaluateRaces(data.map(w=>({...w,notes:'PRIVATE_NOTE',email:'SECRET_EMAIL',track:[{latitude:40,longitude:-75}]})),options);
  assert.equal(JSON.stringify(r).includes('PRIVATE_NOTE'),false);
  assert.equal(JSON.stringify(r).includes('SECRET_EMAIL'),false);
  assert.equal(JSON.stringify(r).includes('latitude'),false);
  assert.equal(JSON.stringify(r).includes('synthetic-race'),false);
  assert.deepEqual(r,report());assert.match(reportMarkdown(r),/Synthetic demonstration/);
  // Input row numbers are audit provenance; predictions do not depend on input order.
  assert.deepEqual(evaluateRaces([...data].reverse(),options).rows,r.rows);
});
test('standardized ridge preserves a constant normalized target',()=>{
  const constant=data.map(w=>w.type==='Race'?{...w,durationSeconds:1200*(w.distanceMiles*1609.344/5000)**1.06}:w);
  for(const row of evaluateRaces(constant,options).rows)for(const method of ['frozen','expanding','rolling']){
    const p=row.predictions[method].seconds;if(p!==null)assert.ok(Math.abs(p-row.actualSeconds)<1e-7);
  }
});
test('CLI supports existing local/account backup formats, deterministic output and explicit source',()=>{
  const dir=mkdtempSync(join(tmpdir(),'pacelab-research-'));
  for(const format of ['pacelab-local-backup-v1','pacelab-account-export-v1']){
    const input=join(dir,'input.json');writeFileSync(input,JSON.stringify({format,workouts:data,email:'not-in-report'}));
    const args=['scripts/evaluate-races.mjs','--input',input,'--output-dir',dir,'--as-of',options.asOf,'--source','synthetic'];
    let run=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(run.status,0,run.stderr);
    const first=readFileSync(join(dir,'race-evaluation.json'),'utf8');
    run=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(run.status,0,run.stderr);
    assert.equal(readFileSync(join(dir,'race-evaluation.json'),'utf8'),first);
    assert.match(JSON.parse(first).inputSha256,/^[a-f0-9]{64}$/);assert.ok(!first.includes('not-in-report'));
  }
});

test('future reused identifiers cannot exclude earlier observations',()=>{
  const baseline=report();
  const later={...data[0],date:'2027-01-01'};
  const withFuture=evaluateRaces([...data,later],options);
  assert.deepEqual(withFuture.rows,baseline.rows);
  const laterWithinCutoff={...data[0],date:'2025-12-01'};
  assert.deepEqual(evaluateRaces([...data,laterWithinCutoff],options).rows,baseline.rows);
});
test('unknown labels are counted for review but never silently treated as easy training',()=>{
  const unknown=data.map(w=>({...w,type:'<img src=x onerror=alert(1)>'}));
  const r=evaluateRaces(unknown,options);
  assert.equal(r.rows.length,0);assert.equal(r.audit.raceCount,0);
  assert.equal(r.audit.records[0].type,'Unreviewed');
  assert.match(reportMarkdown(r),/Rows needing label review: 120/);
});
test('adaptation comparisons against frozen use exactly the paired observations',()=>{
  const r=report(),m=r.metrics.rolling;
  const rows=r.rows.filter(row=>row.predictions.rolling.seconds!==null&&row.predictions.frozen.seconds!==null);
  const expected=rows.reduce((s,row)=>s+Math.abs(row.predictions.rolling.seconds-row.actualSeconds)-Math.abs(row.predictions.frozen.seconds-row.actualSeconds),0)/rows.length;
  assert.equal(m.pairedComparisons.frozen.n,rows.length);
  assert.ok(Math.abs(m.pairedComparisons.frozen.maeDifferenceSeconds-expected)<.0001);
});
