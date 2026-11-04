import test from 'node:test';
import assert from 'node:assert/strict';
import {trainingCalendar,raceProgression,workoutComparison,sensorCoverage} from '../src/performance.js';

const date=(s)=>new Date(s+'T12:00:00');

test('calendar excludes future activity and counts consecutive days',()=>{
  const workouts=[
    {date:'2026-11-01',distanceMiles:4,type:'Easy'},
    {date:'2026-11-02',distanceMiles:5,type:'Tempo'},
    {date:'2026-11-02',distanceMiles:2,type:'Recovery'},
    {date:'2026-11-04',distanceMiles:9,type:'Long'},
    {date:'2026-11-06',distanceMiles:100,type:'Race'},
  ];
  const result=trainingCalendar(workouts,date('2026-11-04'));
  assert.equal(result.activeDays,3);
  assert.equal(result.longestStreak,2);
  assert.equal(result.totalMiles,20);
  assert.equal(result.days.find(d=>d.date==='2026-11-02').count,2);
  assert.equal(result.days.find(d=>d.date==='2026-11-06').future,true);
  assert.equal(result.days.find(d=>d.date==='2026-11-06').miles,0);
});

test('race progression includes only actual recorded races at selected distance',()=>{
  const workouts=[
    {id:'c',date:'2026-10-25',type:'Race',distanceMiles:3.11,durationSeconds:1120},
    {id:'a',date:'2026-09-11',type:'Race',distanceMiles:3.11,durationSeconds:1170},
    {id:'b',date:'2026-09-12',type:'Easy',distanceMiles:3.11,durationSeconds:1050},
    {id:'d',date:'2026-10-25',type:'Race',distanceMiles:5,durationSeconds:1800},
    {id:'future',date:'2026-11-12',type:'Race',distanceMiles:3.11,durationSeconds:1050}
  ];
  assert.deepEqual(raceProgression(workouts,5000,date('2026-11-04')).map(w=>w.id),['a','c']);
});

test('comparison normalizes pace across different distances',()=>{
  const items=[
    {id:'a',date:'2026-10-22',distanceMiles:5,durationSeconds:2400,type:'Easy',avgHeartRate:145},
    {id:'b',date:'2026-10-25',distanceMiles:10,durationSeconds:4500,type:'Long',avgHeartRate:152},
  ];
  const r=workoutComparison(items,'a','b');
  assert.equal(r.mileageDelta,5);
  assert.equal(r.paceDeltaSeconds,-30);
  assert.equal(r.averageHeartRateDelta,7);
  assert.equal(workoutComparison(items,'a','a'),null);
  assert.equal(workoutComparison(items,'a','missing'),null);
});


test('sensor coverage never treats unrecorded fields as measured zero',()=>{
  const data=[
    {date:'2026-11-01',avgHeartRate:145,avgCadenceSpm:165},
    {date:'2026-11-02',avgHeartRate:null,avgPowerWatts:null},
    {date:'2026-11-03',avgHeartRate:150,avgPowerWatts:240},
    {date:'2026-11-10',avgHeartRate:170},
  ];
  const report=sensorCoverage(data,date('2026-11-04'));
  assert.equal(report.total,3);
  const heart=report.rows.find(x=>x.label==='Average heart rate');
  assert.equal(heart.available,2);
  assert.equal(heart.missing,1);
  assert.equal(heart.percent,66.7);
  const power=report.rows.find(x=>x.label==='Running power');
  assert.equal(power.available,1);
  assert.equal(sensorCoverage([],date('2026-11-04')).rows[0].percent,0);
});
