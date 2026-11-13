import test from 'node:test';
import assert from 'node:assert/strict';
import {validateWorkout} from '../src/core.js';
import {validateRaceResult,parseOfficialTime,officialTime} from '../src/race-result.js';
import {evaluateRaces} from '../src/race-evaluation.js';
import {createForecast,scoreForecast,forecastStorageKey} from '../src/race-forecast.js';
const result={name:'Test meet',eventMeters:8000,finishSeconds:1713.6,confirmed:true,sourceUrl:'https://example.com/results'};
const race={id:'a',date:'2025-01-01',type:'Race',distanceMiles:5.1,durationSeconds:1700,raceResult:result};
test('official values persist separately and preserve fractional times',()=>{
 const saved=validateWorkout(race);assert.deepEqual(saved.raceResult,result);assert.equal(saved.durationSeconds,1700);
 assert.equal(parseOfficialTime('28:33.6'),1713.6);assert.equal(officialTime(1713.6),'28:33.6');assert.equal(officialTime(1800),'30:00');
 for(const time of ['28:60','NaN','0:00','12:1','-2:00'])assert.throws(()=>parseOfficialTime(time));
 for(const patch of [{confirmed:'true'},{sourceUrl:'javascript:alert(1)'},{sourceUrl:'https://a:b@example.com'},{finishSeconds:NaN},{name:' '},{eventMeters:7999}])assert.throws(()=>validateRaceResult({...result,...patch}));
});
test('real comparisons require confirmation and use official values despite paused watch',()=>{
 const rows=[race,{...race,id:'b',date:'2025-02-01',durationSeconds:1800,elapsedSeconds:1900,raceResult:{...result,finishSeconds:1750.2}}];
 const report=evaluateRaces(rows,{asOf:'2025-03-01'});assert.equal(report.rows.length,2);
 assert.equal(report.rows[1].predictions.riegel.seconds,1713.6);assert.equal(report.rows[1].actualSeconds,1750.2);
 assert.equal(evaluateRaces(rows.map(w=>({...w,raceResult:null})),{asOf:'2025-03-01'}).rows.length,0);
 assert.equal(evaluateRaces([{...race,type:'Easy'}],{asOf:'2025-03-01'}).rows.length,0);
});
test('future forecasts freeze current history and reject past dates',()=>{
 const now=new Date(2025,1,1,12),target={date:'2025-03-01',name:'Future meet',eventMeters:8000};
 const later={...race,id:'later',date:target.date,raceResult:{...result,finishSeconds:1600}};
 const forecast=createForecast([race,later],target,now),snapshot=JSON.stringify(forecast);
 assert.equal(forecast.history.length,1);assert.equal(forecast.predictions.riegel.seconds,1713.6);
 assert.equal(scoreForecast(forecast,[race],'2025-04-01').status,'awaiting-result');
 assert.equal(scoreForecast(forecast,[race,later],'2025-04-01').actualSeconds,1600);
 assert.equal(scoreForecast(forecast,[race,later,{...later,id:'other',durationSeconds:1850,raceResult:{...result,finishSeconds:1650}}],'2025-04-01').status,'ambiguous');
 assert.equal(JSON.stringify(forecast),snapshot);
 for(const date of ['2025-01-31','2025-02-01','2025-02-30'])assert.throws(()=>createForecast([race],{...target,date},now));
 assert.throws(()=>createForecast([{...race,raceResult:null}],target,now));
 assert.notEqual(forecastStorageKey('https://a','1'),forecastStorageKey('https://a','2'));
 assert.notEqual(forecastStorageKey('https://a','1'),forecastStorageKey('https://b','1'));
});

test('result packets suggest unique races without labeling warmups or overwriting originals',async()=>{
 const {previewResults}=await import('../src/race-result-import.js');
 const packet={format:'pacelab-official-results-v1',results:[{date:race.date,raceResult:result}]};
 const match={...race,distanceMiles:8000/1609.344,durationSeconds:1712};
 const warmup={...match,id:'warmup',distanceMiles:1,durationSeconds:500};
 assert.deepEqual(previewResults(packet,[match,warmup],'2025-02-01')[0].candidates,['a']);
 assert.equal(previewResults(packet,[match,{...match,id:'duplicate'}],'2025-02-01')[0].candidates.length,2);
 assert.equal(previewResults(packet,[warmup],'2025-02-01')[0].candidates.length,0);
 assert.throws(()=>previewResults(packet,[match],'2024-01-01'));
});
