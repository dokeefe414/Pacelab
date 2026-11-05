import test from 'node:test';
import assert from 'node:assert/strict';
import {labeledRaceRows,localRaceReadiness,trainingCSV,recentRaceBaseline} from '../src/local-research.js';

const today=new Date('2026-11-04T12:00:00');
const workout=(date,type,distanceMiles,durationSeconds=2400,id='x')=>({date,type,distanceMiles,durationSeconds,id});
test('local race export uses only prior dates and excludes same-day/future workouts',()=>{
  const history=[
    workout('2026-10-01','Easy',5,2400),
    workout('2026-10-04','Easy',6,2900),
    workout('2026-10-08','Tempo',4,1600),
    workout('2026-10-10','Easy',5,2500),
    workout('2026-10-14','Intervals',4,1600),
    workout('2026-10-20','Race',3.10686,1080,'race'),
    workout('2026-10-20','Easy',300,1000,'same-day'),
    workout('2026-10-21','Easy',500,1000,'future-after-race'),
    workout('2026-11-05','Race',3.10686,960,'future'),
  ];
  const rows=labeledRaceRows(history,today);
  assert.equal(rows.length,1);
  assert.equal(rows[0].date,'2026-10-20');
  assert.equal(rows[0].event_meters,5000);
  assert.equal(rows[0].hard_sessions_4w,2);
  assert.equal(rows[0].weekly_miles_4w,6);
  assert.equal(rows[0].longest_run_miles,6);
  assert.ok(rows[0].average_easy_pace_seconds_per_mile>475);
  assert.equal(rows[0].finish_seconds,1080);
  assert.equal(trainingCSV(rows).split('\n').length,3);
  const ready=localRaceReadiness(history,today);
  assert.equal(ready.totalLoggedRaces,1);
  assert.equal(ready.eligibleLabeledRows,1);
  assert.equal(ready.canStartExperimentalTraining,false);
});
test('race equivalence uses most recent genuine Race, not a synthetic trained model',()=>{
  const races=[
    workout('2026-10-01','Race',3.10686,1200,'old'),
    workout('2026-10-29','Race',4.971,1800,'recent'),
  ];
  const output=recentRaceBaseline(races,5000,today);
  assert.equal(output.reference.date,'2026-10-29');
  assert.ok(output.estimatedSeconds>0);
  assert.equal(recentRaceBaseline([workout('2026-10-01','Easy',5)],5000,today),null);
});
test('one race without pre-race training is excluded from ML export',()=>{
  const rows=labeledRaceRows([workout('2026-10-25','Race',3.1,1250)],today);
  assert.equal(rows.length,0);
});
