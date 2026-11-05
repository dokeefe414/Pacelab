import test from 'node:test';
import assert from 'node:assert/strict';
import {monthlyTraining,weeklyPerformance,lapDiagnostics,sensorSeries,chartGeometry} from '../src/athlete-studio-core.js';

const today=new Date('2026-11-04T12:00:00');
const w=(date,type,distanceMiles,durationSeconds=2400,extra={})=>({date,type,distanceMiles,durationSeconds,...extra});

test('monthly series excludes future workouts and never fabricates missing HR',()=>{
  const data=[
    w('2026-09-01','Easy',5,2400,{avgHeartRate:140}),
    w('2026-09-03','Race',5,2000),
    w('2026-10-03','Recovery',2,1200),
    w('2026-11-01','Long',10,5000),
    w('2026-11-06','Long',100,100),
  ];
  const months=monthlyTraining(data,today,3);
  assert.deepEqual(months.map(m=>m.key),['2026-09','2026-10','2026-11']);
  assert.equal(months[0].workouts,2);
  assert.equal(months[0].heartRateCoverage,50);
  assert.equal(months[1].easyPaceSecondsPerMile,600);
  assert.equal(months[2].miles,10);
  assert.equal(months[2].isPartial,true);
  assert.throws(()=>monthlyTraining(data,today,30),/1–24/);
});
test('weekly comparison excludes partial week instead of comparing it against a full week',()=>{
  const rows=[];
  for(let i=0;i<9;i++){
    const dt=new Date('2026-11-02T12:00:00Z');dt.setUTCDate(dt.getUTCDate()-i*7);
    rows.push(w(dt.toISOString().slice(0,10),'Easy',i===0?1:5,2400));
  }
  const report=weeklyPerformance(rows,today,9);
  assert.equal(report.weeks.length,9);
  assert.equal(report.weeks.at(-1).partial,true);
  assert.deepEqual(report.comparison,{priorMiles:20,recentMiles:20,differenceMiles:0});
});
test('laps never rank recoveries against comparable distance efforts',()=>{
  const result=lapDiagnostics([
    {distanceMiles:1,durationSeconds:380},{distanceMiles:.12,durationSeconds:39},
    {distanceMiles:1.02,durationSeconds:375},{distanceMiles:.95,durationSeconds:370},
  ]);
  assert.equal(result.fastestComparableLap,3);
  assert.equal(result.comparableCount,3);
  assert.equal(result.laps[1].category,'short / recovery-size');
  assert.ok(result.comparablePaceCVPercent>=0);
  assert.equal(lapDiagnostics([{distanceMiles:1,durationSeconds:390}]).comparablePaceCVPercent,null);
});
test('sensor plots discard missing and invalid data; no fake measurements',()=>{
  const track=[
    {elapsed:0,heartRate:null},
    {elapsed:30,heartRate:142},
    {elapsed:60,heartRate:253},
    {elapsed:90,heartRate:153},
  ];
  const hr=sensorSeries(track,'heartRate');
  assert.equal(hr.coverageSamples,2);
  assert.equal(hr.min,142);assert.equal(hr.max,153);
  const geometry=chartGeometry(hr.points);
  assert.ok(geometry.path.startsWith('M'));
  assert.equal(chartGeometry([{elapsed:0,value:100}]),null);
  assert.equal(sensorSeries([], 'powerWatts').mean,null);
  assert.throws(()=>sensorSeries(track,'latitude'),/Unsupported/);
});
