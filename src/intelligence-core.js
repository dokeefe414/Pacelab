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
