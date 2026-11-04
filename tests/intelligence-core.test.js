import test from 'node:test';
import assert from 'node:assert/strict';
import {advancedStats,linePath,routePath,localTrainingAnswer} from '../src/intelligence-core.js';

test('last 7 days exclude older runs and calculate weighted load',()=>{
  const data=[
    {date:'2026-11-04',distanceMiles:5,durationSeconds:2400,type:'Easy',avgHeartRate:140},
    {date:'2026-11-03',distanceMiles:4,durationSeconds:1800,type:'Tempo',avgHeartRate:160},
    {date:'2026-10-28',distanceMiles:8,durationSeconds:4000,type:'Long'}
  ];
  const s=advancedStats(data,new Date(2026,10,4));
  assert.equal(s.last7.miles,9);
  assert.equal(s.prior7.miles,8);
  assert.equal(s.hardSessions,1);
  assert.equal(s.avgHR,150);
  assert.equal(s.weeks.length,12);
  assert.ok(s.weightedMinutes>0);
});
test('recorded PRs only accept matching race distances',()=>{
  const data=[
    {id:'a',date:'2026-11-03',distanceMiles:3.10686,durationSeconds:1230,type:'Race'},
    {id:'b',date:'2026-11-02',distanceMiles:3.10686,durationSeconds:1200,type:'Race'},
    {id:'c',date:'2026-11-01',distanceMiles:2.9,durationSeconds:900,type:'Race'}
  ];
  const s=advancedStats(data,new Date(2026,10,4));
  assert.equal(s.personalBests.length,1);
  assert.equal(s.personalBests[0].seconds,1200);
});
test('route and time series chart builders handle missing values',()=>{
  assert.equal(routePath([]),'');
  assert.equal(linePath([{elapsed:0,heartRate:120}],'heartRate'),'');
  const path=routePath([{lat:41,lon:-75},{lat:41.01,lon:-75.02}]);
  assert.match(path,/M.*L/);
  const hr=linePath([{elapsed:0,heartRate:120},{elapsed:30,heartRate:140}],'heartRate');
  assert.match(hr,/M.*L/);
});

test('browser-only assistant uses recorded stats',()=>{
  const stats=advancedStats([{date:'2026-11-04',distanceMiles:5,durationSeconds:2400,type:'Easy'}],new Date(2026,10,4));
  assert.match(localTrainingAnswer('How many miles this week?',stats),/5.0 miles/);
  assert.match(localTrainingAnswer('Do I have heart rate data?',stats),/No recent heart-rate/);
});
