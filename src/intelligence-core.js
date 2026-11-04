/** Deterministic training summaries for local demo and browser presentation. */
import {weekStart} from './core.js';

export const WEIGHTS = Object.freeze({Recovery:.7,Easy:1,Long:1.1,Tempo:1.35,Intervals:1.5,Race:1.7});
export const EVENTS = Object.freeze({ "800m":800,"Mile":1609.344,"3K":3000,"5K":5000,"8K":8000,"10K":10000 });

function isoDay(date) {
  return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
function daysBefore(today,n) {
  const result = new Date(today.getFullYear(),today.getMonth(),today.getDate());
  result.setDate(result.getDate()-n);
  return isoDay(result);
}
function within(records,a,b){return records.filter(w=>w.date>=a&&w.date<=b);}
function totals(records){
  return {miles:records.reduce((s,w)=>s+w.distanceMiles,0),minutes:records.reduce((s,w)=>s+w.durationSeconds/60,0),count:records.length};
}
export function advancedStats(workouts,today=new Date()){
  const todayString=isoDay(today);const data=workouts.filter(w=>w.date<=todayString);
  const last7=totals(within(data,daysBefore(today,6),todayString));
  const prior7=totals(within(data,daysBefore(today,13),daysBefore(today,7)));
  const recent=within(data,daysBefore(today,27),todayString);
  const last28=totals(recent);
  const weightedMinutes=recent.reduce((s,w)=>s+w.durationSeconds/60*(WEIGHTS[w.type]||1),0);
  const hardSessions=recent.filter(w=>['Intervals','Tempo','Race'].includes(w.type)).length;
  const hr=recent.map(w=>w.avgHeartRate).filter(x=>typeof x==='number'&&Number.isFinite(x));
  const easy=recent.filter(w=>['Easy','Recovery'].includes(w.type));
  const easyMiles=easy.reduce((s,w)=>s+w.distanceMiles,0);
  const easyPace=easyMiles?easy.reduce((s,w)=>s+w.durationSeconds,0)/easyMiles:null;
  const weeks=[];
  const monday=weekStart(todayString);
  for(let ago=11;ago>=0;ago--){
    const d=new Date(monday+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-7*ago);
    const start=d.toISOString().slice(0,10),next=new Date(d);next.setUTCDate(next.getUTCDate()+6);
    const end=next.toISOString().slice(0,10);
    const group=within(data,start,end);
    weeks.push({date:start,miles:totals(group).miles,activities:group.length,weightedMinutes:group.reduce((s,w)=>s+w.durationSeconds/60*(WEIGHTS[w.type]||1),0)});
  }
  const personalBests=Object.entries(EVENTS).flatMap(([event,meters])=>{
    const candidates=data.filter(w=>w.type==='Race'&&Math.abs(w.distanceMiles*1609.344-meters)/meters<=.025);
    if(!candidates.length)return [];
    const fastest=candidates.reduce((best,w)=>w.durationSeconds<best.durationSeconds?w:best);
    return [{event,date:fastest.date,seconds:fastest.durationSeconds,id:fastest.id}];
  });
  return {last7,prior7,last28,weightedMinutes,hardSessions,avgHR:hr.length?hr.reduce((a,b)=>a+b,0)/hr.length:null,easyPace,weeks,personalBests};
}
export function routePath(points,width=320,height=150) {
  const records=points.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));
  if(records.length<2)return '';
  const center=records.reduce((s,p)=>s+p.lat,0)/records.length;
  const project=p=>({x:p.lon*Math.cos(center*Math.PI/180),y:p.lat});
  const coords=records.map(project);
  const xs=coords.map(p=>p.x),ys=coords.map(p=>p.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const spanX=Math.max(maxX-minX,1e-9),spanY=Math.max(maxY-minY,1e-9);
  const scale=Math.min((width-30)/spanX,(height-30)/spanY);
  return coords.map((p,i)=>(i?'L':'M')+(15+(p.x-minX)*scale).toFixed(1)+','+(height-15-(p.y-minY)*scale).toFixed(1)).join(' ');
}
export function linePath(points,key,width=320,height=120) {
  const values=points.filter(p=>Number.isFinite(p[key])&&Number.isFinite(p.elapsed));
  if(values.length<2)return '';
  const times=values.map(v=>v.elapsed),minT=Math.min(...times),maxT=Math.max(...times);
  const nums=values.map(v=>v[key]),minV=Math.min(...nums),maxV=Math.max(...nums);
  return values.map((p,i)=>(i?'L':'M')+
    (12+(p.elapsed-minT)/(maxT-minT||1)*(width-24)).toFixed(1)+','+
    (height-12-(p[key]-minV)/(maxV-minV||1)*(height-24)).toFixed(1)).join(' ');
}

/** Browser-only factual Q&A, suitable for synthetic demo data. */
export function localTrainingAnswer(question, s) {
  const q=String(question).toLowerCase();
  if(!s.last28.count && !s.prior7.count)return 'No workouts have been logged in this browser yet.';
  if(/race|best|pr\b/.test(q)){
    if(!s.personalBests.length)return 'No races at standard event distances are logged in this browser.';
    return 'Recorded bests: '+s.personalBests.map(r=>r.event+' '+Math.floor(r.seconds/60)+':'+String(Math.round(r.seconds)%60).padStart(2,'0')).join('; ')+'.';
  }
  if(/heart|pulse|\bhr\b/.test(q)){
    return s.avgHR?'Mean of recorded workout-average heart rates (last 28 days): '+Math.round(s.avgHR)+' bpm.':
      'No recent heart-rate readings are available.';
  }
  if(/pace|speed|faster|slower/.test(q)){
    if(!s.easyPace)return 'No Easy or Recovery workouts were logged in the last 28 days.';
    return 'Distance-weighted Easy/Recovery pace over 28 days: '+Math.floor(s.easyPace/60)+':'+String(Math.round(s.easyPace)%60).padStart(2,'0')+' per mile. This does not prove a change in race fitness.';
  }
  if(/hard|interval|tempo|load|recovery|fatigue/.test(q)){
    return 'Last 28 days: '+s.hardSessions+' Tempo/Intervals/Race sessions and '+s.weightedMinutes.toFixed(0)+' illustrative weighted minutes. These are not validated fatigue or injury-risk estimates.';
  }
  return 'Last 7 days: '+s.last7.miles.toFixed(1)+' miles; prior 7 days: '+s.prior7.miles.toFixed(1)+' miles. Last 28 days: '+s.last28.miles.toFixed(1)+' miles across '+s.last28.count+' workouts.';
}

/**
 * Pace trace derived from consecutive distance and elapsed observations.
 * Skips GPS jumps and pauses; the result is a visualization aid, not a
 * validated running dynamics measure. Up to 500 source samples are stored.
 */
export function paceTrace(points) {
  const valid=(points||[]).filter(p=>Number.isFinite(p.elapsed)&&Number.isFinite(p.distanceMiles))
    .sort((a,b)=>a.elapsed-b.elapsed);
  const output=[];
  for(let i=1;i<valid.length;i++){
    const prev=valid[i-1],next=valid[i];
    const minutes=(next.elapsed-prev.elapsed)/60;
    const miles=next.distanceMiles-prev.distanceMiles;
    if(minutes<=0 || miles<=.002)continue;
    const paceSeconds=minutes*60/miles;
    if(!Number.isFinite(paceSeconds)||paceSeconds<180||paceSeconds>1800)continue;
    output.push({elapsed:next.elapsed,paceSeconds:Math.round(paceSeconds)});
  }
  return output;
}

/** Equal-duration comparisons that account for incomplete current weeks. */
export function compareDateWindows(workouts,startA,endA,startB,endB) {
  const valid=(start,end)=>workouts.filter(w=>w.date>=start&&w.date<=end);
  const summarize=items=>{
    const miles=items.reduce((s,w)=>s+w.distanceMiles,0);
    const seconds=items.reduce((s,w)=>s+w.durationSeconds,0);
    return {count:items.length,miles:Number(miles.toFixed(2)),
      seconds,averagePaceSecondsPerMile:miles?Number((seconds/miles).toFixed(1)):null,
      hardSessions:items.filter(w=>['Race','Tempo','Intervals'].includes(w.type)).length};
  };
  if(startA>endA || startB>endB)throw Error('Start dates must be on or before end dates');
  return {first:summarize(valid(startA,endA)),second:summarize(valid(startB,endB))};
}


/**
 * Fixed absolute heart-rate bands, NOT athlete-specific physiological zones.
 * Weighted by adjacent sample intervals, capped at five seconds so sensor
 * gaps, pauses and sparse imports are not counted as observed training time.
 */
export const HEART_RATE_BANDS = ["<120", "120–139", "140–159", "160–179", "180+"];
export function heartRateBands(points){
  const samples=(points||[]).filter(p=>Number.isFinite(p.elapsed)).sort((a,b)=>a.elapsed-b.elapsed);
  const seconds=[0,0,0,0,0];
  let validSamples=0;
  for(let i=0;i<samples.length-1;i++){
    const current=samples[i],next=samples[i+1];
    const hr=current.heartRate;
    if(!Number.isFinite(hr) || hr<30 || hr>230)continue;
    const delta=next.elapsed-current.elapsed;
    if(!Number.isFinite(delta)||delta<=0)continue;
    const band=hr<120?0:hr<140?1:hr<160?2:hr<180?3:4;
    seconds[band]+=Math.min(delta,5);
    validSamples++;
  }
  const total=seconds.reduce((a,b)=>a+b,0);
  return {labels:HEART_RATE_BANDS,seconds,measuredSeconds:total,validSamples};
}

/**
 * Normalize irregular interval/device laps to pace per mile for comparison.
 * Short recoveries are shown separately, not confused with full mile splits.
 */
export function lapPaces(laps){
  return (laps||[]).filter(l=>Number.isFinite(Number(l.distanceMiles))&&
    Number(l.distanceMiles)>0&&Number(l.durationSeconds)>0).map(l=>({
    number:Number(l.number),distanceMiles:Number(l.distanceMiles),
    durationSeconds:Number(l.durationSeconds),
    paceSecondsPerMile:Number(l.durationSeconds)/Number(l.distanceMiles),
    source:l.source,
  }));
}
