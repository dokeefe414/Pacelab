/**
 * PaceLab athlete performance center.
 *
 * Pure functions below are independently tested. The UI deliberately avoids
 * inventing race PRs or converting training volume into physiological advice.
 * Sample activities and personally recorded data are never mixed.
 */
import {formatTime,weekStart} from './core.js';

const $=selector=>document.querySelector(selector);
const escapeHTML=value=>String(value).replace(/[&<>"']/g,character=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[character]));
export const RACE_EVENTS=Object.freeze({
  '800m':800,'Mile':1609.344,'3K':3000,'5K':5000,'8K':8000,'10K':10000,
});

const localDate=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const nextUTC=(iso,days)=>{
  const date=new Date(iso+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+days);
  return date.toISOString().slice(0,10);
};

export function trainingCalendar(workouts,today=new Date(),weeks=12){
  const todayISO=localDate(today);
  const monday=weekStart(todayISO);
  const start=nextUTC(monday,-7*(weeks-1));
  const byDate=new Map();
  for(const workout of workouts){
    if(workout.date>todayISO || workout.date<start)continue;
    const existing=byDate.get(workout.date)||{miles:0,count:0};
    existing.miles+=workout.distanceMiles;existing.count++;
    byDate.set(workout.date,existing);
  }
  const days=Array.from({length:weeks*7},(_,i)=>{
    const date=nextUTC(start,i);
    const data=byDate.get(date)||{miles:0,count:0};
    const miles=Number(data.miles.toFixed(2));
    return {date,miles,count:data.count,future:date>todayISO,
      level:data.count===0?0:miles<3?1:miles<6?2:miles<10?3:4};
  });
  let run=0,longest=0;
  for(const day of days){
    if(day.future)break;
    run=day.count?run+1:0;
    longest=Math.max(longest,run);
  }
  return {days,activeDays:days.filter(d=>!d.future&&d.count>0).length,
    totalMiles:Number(days.reduce((a,d)=>a+d.miles,0).toFixed(1)),
    longestStreak:longest,firstDate:start,lastDate:todayISO};
}

export function raceProgression(workouts,eventMeters,today=new Date()){
  const event=Number(eventMeters),todayISO=localDate(today);
  if(!Number.isFinite(event)||event<800||event>10000)return [];
  return workouts.filter(w=>w.type==='Race'&&w.date<=todayISO&&
    Math.abs(w.distanceMiles*1609.344-event)/event<=.025)
    .sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))
    .map(w=>({id:w.id,date:w.date,seconds:w.durationSeconds,
      distanceMiles:w.distanceMiles}));
}

export function workoutComparison(workouts,idA,idB){
  const a=workouts.find(w=>w.id===idA),b=workouts.find(w=>w.id===idB);
  if(!a||!b||a.id===b.id)return null;
  const aPace=a.durationSeconds/a.distanceMiles,bPace=b.durationSeconds/b.distanceMiles;
  return {
    a:{...a,paceSeconds:aPace},b:{...b,paceSeconds:bPace},
    mileageDelta:Number((b.distanceMiles-a.distanceMiles).toFixed(2)),
    paceDeltaSeconds:Number((bPace-aPace).toFixed(1)),
    durationDeltaSeconds:b.durationSeconds-a.durationSeconds,
    averageHeartRateDelta:Number.isFinite(a.avgHeartRate)&&Number.isFinite(b.avgHeartRate)?
      b.avgHeartRate-a.avgHeartRate:null,
  };
}

function raceChart(points){
  if(points.length<2)return '<p class="body-copy">Log at least two Race workouts at this distance to see race progression.</p>';
  const width=540,height=155,pad=26;
  const lower=Math.min(...points.map(p=>p.seconds)),upper=Math.max(...points.map(p=>p.seconds));
  const span=Math.max(upper-lower,1);
  const coords=points.map((point,i)=>({
    x:pad+i*(width-2*pad)/(points.length-1),
    y:height-pad-(point.seconds-lower)/span*(height-2*pad),
  }));
  const line=coords.map((p,i)=>(i?'L':'M')+p.x.toFixed(2)+','+p.y.toFixed(2)).join(' ');
  const circles=coords.map(p=>'<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="4.5" fill="#b5f36c"/>').join('');
  return '<div class="performance-chart"><svg viewBox="0 0 540 155" role="img" aria-label="Recorded race finishing times in chronological order; lower means faster">'+
    '<path d="'+line+'" stroke="#b5f36c" stroke-width="3" fill="none" stroke-linejoin="round"/>'+circles+'</svg></div>'+
    '<div class="race-progress-entries">'+points.map(p=>'<div><span>'+escapeHTML(p.date)+'</span><strong>'+formatTime(p.seconds)+'</strong></div>').join('')+'</div>'+
    '<p class="body-copy">Actual logged race results only. Distance tolerance ±2.5%; differing courses, weather and effort are not controlled for.</p>';
}
let getWorkouts=()=>[];

export function initPerformance(context){
  getWorkouts=context.getWorkouts;
  $('#race-event').addEventListener('change',renderPerformance);
  $('#workout-compare-a').addEventListener('change',renderComparison);
  $('#workout-compare-b').addEventListener('change',renderComparison);
}

function renderComparison(){
  const data=workoutComparison(getWorkouts(),$('#workout-compare-a').value,$('#workout-compare-b').value);
  const target=$('#workout-compare-result');
  if(!data){target.textContent='Select two different workouts to compare pace, distance, time and recorded heart rate.';return;}
  const sign=num=>num>0?'+':'';
  target.innerHTML='<div class="performance-compare-cards">'+
    [data.a,data.b].map(w=>'<div><strong>'+escapeHTML(w.type)+' · '+escapeHTML(w.date)+'</strong>'+
      '<span>'+w.distanceMiles.toFixed(2)+' mi</span>'+
      '<span>'+formatTime(w.durationSeconds)+' moving time</span>'+
      '<span>'+formatTime(w.paceSeconds)+'/mi</span>'+
      (Number.isFinite(w.avgHeartRate)?'<span>'+w.avgHeartRate+' bpm average</span>':'<span>No recorded average HR</span>')+
      '</div>').join('')+'</div>'+
    '<p class="body-copy">Second minus first: <strong>'+sign(data.mileageDelta)+data.mileageDelta.toFixed(2)+' miles</strong>, '+
    '<strong>'+sign(data.paceDeltaSeconds)+data.paceDeltaSeconds.toFixed(1)+' seconds/mi</strong>. '+
    (data.averageHeartRateDelta==null?'HR difference unavailable.':
      'Average HR difference: '+sign(data.averageHeartRateDelta)+data.averageHeartRateDelta+' bpm.')+
    ' Terrain, weather, heart-rate coverage and workout purpose can change the comparison.</p>';
}

export function renderPerformance(){
  const workouts=getWorkouts();
  const calendar=trainingCalendar(workouts);
  $('#performance-heatmap').innerHTML=calendar.days.map(d=>
    '<span class="heatmap-day heatmap-level-'+d.level+(d.future?' future':'')+'"'+
    ' role="img" aria-label="'+escapeHTML(d.date)+': '+d.miles.toFixed(1)+' miles across '+d.count+' runs"'+
    ' title="'+escapeHTML(d.date)+': '+d.miles.toFixed(1)+' mi"></span>').join('');
  $('#performance-calendar-summary').textContent=calendar.activeDays+' active days · '+
    calendar.totalMiles.toFixed(1)+' miles logged · Longest consecutive-day streak: '+calendar.longestStreak;
  const race=$('#race-event');
  $('#race-progress-chart').innerHTML=raceChart(raceProgression(workouts,race.value));
  const rows=[...workouts].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,120);
  for(const id of ['#workout-compare-a','#workout-compare-b']){
    const select=$(id),current=select.value;
    select.innerHTML='<option value="">Choose workout</option>'+rows.map(w=>
      '<option value="'+escapeHTML(w.id)+'">'+escapeHTML(w.date)+' · '+escapeHTML(w.type)+
      ' · '+w.distanceMiles.toFixed(1)+' mi</option>').join('');
    if(rows.some(w=>w.id===current))select.value=current;
  }
  renderComparison();
}
