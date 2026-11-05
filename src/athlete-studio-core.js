/**
 * PaceLab v0.9: deterministic athlete analytics.
 *
 * No external services, no health diagnoses, and no inferred missing samples.
 * All dates are calendar-local ISO dates. Only activity dates <= 'today' count.
 */
import {weekStart} from './core.js';
import {paceTrace} from './intelligence-core.js';

const pad=n=>String(n).padStart(2,'0');
const iso=date=>date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate());
const shift=(start,days)=>{
  const d=new Date(start+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);
  return d.toISOString().slice(0,10);
};
const finite=(value)=>typeof value==='number'&&Number.isFinite(value);
const round=(x,places=1)=>Number(x.toFixed(places));
const valid=(workouts,today)=>workouts.filter(w=>w.date<=iso(today));

/** Six complete/calendar-partial months, no extrapolated mileage. */
export function monthlyTraining(workouts,today=new Date(),months=6){
  if(!Number.isInteger(months)||months<1||months>24)throw Error('Choose 1–24 months');
  const dataset=valid(workouts,today),result=[];
  for(let offset=months-1;offset>=0;offset--){
    const d=new Date(today.getFullYear(),today.getMonth()-offset,1);
    const key=d.getFullYear()+'-'+pad(d.getMonth()+1);
    const items=dataset.filter(w=>w.date.startsWith(key));
    const miles=items.reduce((s,w)=>s+w.distanceMiles,0);
    const easy=items.filter(w=>w.type==='Easy'||w.type==='Recovery');
    const easyMiles=easy.reduce((s,w)=>s+w.distanceMiles,0);
    const hr=items.filter(w=>finite(w.avgHeartRate)&&w.avgHeartRate>0);
    result.push({
      key,label:d.toLocaleDateString('en-US',{month:'short',year:'numeric'}),
      isPartial:offset===0,
      miles:round(miles),minutes:round(items.reduce((s,w)=>s+w.durationSeconds,0)/60),
      workouts:items.length,races:items.filter(w=>w.type==='Race').length,
      easyPaceSecondsPerMile:easyMiles?round(easy.reduce((s,w)=>s+w.durationSeconds,0)/easyMiles):null,
      heartRateCoverage:items.length?round(100*hr.length/items.length):0,
    });
  }
  return result;
}

/** Weekly mileage + distance-weighted easy pace. Latest week is explicitly partial. */
export function weeklyPerformance(workouts,today=new Date(),weeks=12){
  if(!Number.isInteger(weeks)||weeks<2||weeks>52)throw Error('Choose 2–52 weeks');
  const dataset=valid(workouts,today);
  const monday=weekStart(iso(today)),series=[];
  for(let ago=weeks-1;ago>=0;ago--){
    const start=shift(monday,-ago*7),end=shift(start,6);
    const runs=dataset.filter(w=>w.date>=start&&w.date<=end);
    const easy=runs.filter(w=>w.type==='Easy'||w.type==='Recovery');
    const easyMiles=easy.reduce((sum,w)=>sum+w.distanceMiles,0);
    series.push({
      start,end,partial:ago===0,
      miles:round(runs.reduce((s,w)=>s+w.distanceMiles,0)),
      count:runs.length,
      easyPaceSecondsPerMile:easyMiles?
        round(easy.reduce((s,w)=>s+w.durationSeconds,0)/easyMiles):null,
    });
  }
  // Compare completed 4-week blocks ONLY; the current partial week biases comparisons.
  const completed=series.slice(0,-1);
  const recent=completed.slice(-4),prior=completed.slice(-8,-4);
  const sum=block=>round(block.reduce((a,w)=>a+w.miles,0));
  const comparison=prior.length===4&&recent.length===4?
    {priorMiles:sum(prior),recentMiles:sum(recent),differenceMiles:round(sum(recent)-sum(prior))}:null;
  return {weeks:series,comparison};
}

/** Canonical intervals from device-defined laps; short recoveries are not ranked with efforts. */
export function lapDiagnostics(laps){
  const data=(laps||[]).map((l,i)=>({
    number:i+1,distanceMiles:Number(l.distanceMiles),durationSeconds:Number(l.durationSeconds),
  })).filter(l=>finite(l.distanceMiles)&&finite(l.durationSeconds)&&l.distanceMiles>0&&
    l.distanceMiles<=200&&l.durationSeconds>0&&l.durationSeconds<=86400)
    .map(l=>({...l,paceSecondsPerMile:l.durationSeconds/l.distanceMiles,
      category:l.distanceMiles<.25?'short / recovery-size':'distance lap'}));
  const distanceLaps=data.filter(l=>l.distanceMiles>=.25);
  // Avoid ranking a fast 200 m lap against a slow full mile as comparable.
  const pivot=distanceLaps.length?distanceLaps.map(l=>l.distanceMiles).sort((a,b)=>a-b)
    [Math.floor(distanceLaps.length/2)]:null;
  const comparable=pivot==null?[]:distanceLaps.filter(l=>
    Math.abs(l.distanceMiles-pivot)/pivot<=.15);
  const fastest=comparable.length?comparable.reduce((best,l)=>
    l.paceSecondsPerMile<best.paceSecondsPerMile?l:best):null;
  const paceAvg=comparable.length?
    comparable.reduce((sum,l)=>sum+l.durationSeconds,0)/
      comparable.reduce((sum,l)=>sum+l.distanceMiles,0):null;
  const variation=comparable.length>=2&&paceAvg?
    round(Math.sqrt(comparable.reduce((s,l)=>s+
      Math.pow(l.paceSecondsPerMile-paceAvg,2),0)/comparable.length)/paceAvg*100):null;
  return {laps:data,comparableCount:comparable.length,
    fastestComparableLap:fastest?.number??null,
    comparablePaceSecondsPerMile:paceAvg==null?null:round(paceAvg),
    comparablePaceCVPercent:variation};
}

export const SENSOR_OPTIONS=Object.freeze({
  heartRate:{label:'Heart rate',unit:'bpm',min:30,max:230},
  cadenceSpm:{label:'Cadence',unit:'spm',min:0,max:260},
  powerWatts:{label:'Running power',unit:'W',min:0,max:2500},
  elevationMeters:{label:'Elevation',unit:'m',min:-500,max:9000},
  paceSeconds:{label:'Segment pace',unit:'sec/mi',min:180,max:1800},
});

export function sensorSeries(track,key){
  if(!Object.hasOwn(SENSOR_OPTIONS,key))throw Error('Unsupported sensor type');
  const rule=SENSOR_OPTIONS[key];
  const source=key==='paceSeconds'?paceTrace(track):track||[];
  const data=source.filter(p=>finite(p.elapsed)&&p.elapsed>=0&&p.elapsed<=86400&&
    finite(p[key])&&p[key]>=rule.min&&p[key]<=rule.max)
    .sort((a,b)=>a.elapsed-b.elapsed)
    .map(p=>({elapsed:p.elapsed,value:p[key]}));
  const avg=data.length?data.reduce((s,p)=>s+p.value,0)/data.length:null;
  return {
    key,label:rule.label,unit:rule.unit,points:data,
    min:data.length?Math.min(...data.map(p=>p.value)):null,
    max:data.length?Math.max(...data.map(p=>p.value)):null,
    mean:avg==null?null:round(avg),
    coverageSamples:data.length,
    warning:'Recorded samples only. Sparse observations, paused intervals and missing sensors are not interpolated.',
  };
}

/** SVG chart geometry, with a numeric, fixed viewport. Caller owns any text labels. */
export function chartGeometry(points,{width=640,height=210,pad=36}={}){
  if(points.length<2)return null;
  const xs=points.map(p=>p.elapsed),ys=points.map(p=>p.value);
  const xMin=Math.min(...xs),xMax=Math.max(...xs);
  const yMin=Math.min(...ys),yMax=Math.max(...ys);
  const dx=Math.max(xMax-xMin,1),dy=Math.max(yMax-yMin,1);
  const coords=points.map(p=>({
    x:round(pad+(p.elapsed-xMin)/dx*(width-pad*2),2),
    y:round(height-pad-(p.value-yMin)/dy*(height-pad*2),2),
  }));
  return {
    width,height,pad,xMin,xMax,yMin,yMax,coords,
    path:coords.map((p,i)=>(i?'L':'M')+p.x+','+p.y).join(' '),
  };
}
