/** Accessible, self-contained athlete studio visualizations. */
import {formatTime} from './core.js';
import {monthlyTraining,weeklyPerformance,lapDiagnostics,sensorSeries,
  chartGeometry,SENSOR_OPTIONS} from './athlete-studio-core.js';

const $=selector=>document.querySelector(selector);
const fmt=(n,d=1)=>Number(n).toFixed(d);
let getWorkouts=()=>[];
let visibleMonths=6;
let chartMode='miles';
let activeDetailTrack=[];

function monthlyBars(rows){
  const max=Math.max(1,...rows.map(r=>r.miles));
  return '<div class="studio-month-bars" role="img" aria-label="Monthly logged mileage; current month is incomplete">'+
    rows.map(row=>'<div class="studio-month">'+
      '<div class="studio-month-figure">'+fmt(row.miles)+'<span>mi</span></div>'+
      '<div class="studio-month-rail"><div class="studio-month-bar" style="height:'+
      Math.max(row.miles?3:0,row.miles/max*100).toFixed(1)+'%"></div></div>'+
      '<span class="studio-month-label">'+row.label.split(' ')[0]+'</span>'+
      (row.isPartial?'<small>Partial</small>':'<small>'+row.workouts+' runs</small>')+'</div>').join('')+
    '</div>';
}
function weekPlot(series,key){
  const points=series.weeks.map((w,i)=>({
    x:i,y:key==='miles'?w.miles:w.easyPaceSecondsPerMile,
    date:w.start,partial:w.partial
  }));
  const valid=points.filter(p=>p.y!==null&&Number.isFinite(p.y));
  if(valid.length<2)return '<p class="body-copy">At least two weeks with recorded '+
    (key==='miles'?'activities':'Easy or Recovery workouts')+' are needed for this chart.</p>';
  const width=680,height=214,pad=40;
  const min=Math.min(...valid.map(p=>p.y)),max=Math.max(...valid.map(p=>p.y));
  const span=Math.max(max-min,1),total=points.length-1;
  const plot=valid.map(p=>({
    x:pad+p.x/total*(width-pad*2),
    y:height-pad-(p.y-min)/span*(height-pad*2),
    ...p
  }));
  const path=plot.map((p,i)=>(i?'L':'M')+p.x.toFixed(2)+','+p.y.toFixed(2)).join(' ');
  const label=key==='miles'?'Weekly running miles':'Distance-weighted easy/recovery pace';
  const marks=plot.map(point=>'<circle cx="'+point.x.toFixed(1)+'" cy="'+point.y.toFixed(1)+
    '" r="4" fill="'+(point.partial?'#8c9ba6':'#b5f36c')+'"><title>'+point.date+
    ': '+(key==='miles'?fmt(point.y)+' miles':formatTime(point.y)+'/mi')+
    (point.partial?' (partial week)':'')+'</title></circle>').join('');
  return '<div class="studio-line-wrap"><svg viewBox="0 0 '+width+' '+height+
    '" role="img" aria-label="'+label+' by week, ordered chronologically; latest week is partial">'+
    [0,1,2,3].map(i=>'<line x1="'+pad+'" y1="'+(pad+i*(height-2*pad)/3).toFixed(1)+
      '" x2="'+(width-pad)+'" y2="'+(pad+i*(height-2*pad)/3).toFixed(1)+
      '" stroke="#2a4250" stroke-dasharray="4 7"/>').join('')+
    '<path d="'+path+'" fill="none" stroke="#b5f36c" stroke-width="3" stroke-linecap="round"/>'+
    marks+'</svg></div>'+
    '<div class="studio-chart-legend"><span>'+points[0].date+'</span>'+
    '<span>Latest: '+points.at(-1).date+' (in progress)</span></div>';
}
export function initAthleteStudio(context){
  getWorkouts=context.getWorkouts;
  $('#studio-months').addEventListener('change',event=>{
    visibleMonths=Number(event.target.value);renderAthleteStudio();
  });
  $('#studio-chart-metric').addEventListener('change',event=>{
    chartMode=event.target.value;renderAthleteStudio();
  });
}
export function renderAthleteStudio(){
  const all=getWorkouts();
  const monthly=monthlyTraining(all,new Date(),visibleMonths);
  const weekly=weeklyPerformance(all);
  $('#studio-month-chart').innerHTML=monthlyBars(monthly);
  const completed=monthly.filter(row=>!row.isPartial);
  const last=completed.at(-1),prior=completed.at(-2);
  const total=monthly.reduce((a,row)=>a+row.miles,0);
  const difference=last&&prior?last.miles-prior.miles:null;
  const comparison=difference===null?'At least two completed months are needed for a fair comparison.':
    last.label+' versus '+prior.label+': '+(difference>=0?'+':'')+fmt(difference)+' miles. '+
    'This describes logged volume, not changes in fitness.';
  $('#studio-month-summary').textContent=visibleMonths+' calendar months • '+fmt(total)+
    ' logged miles. '+monthly.at(-1).label+' is incomplete. '+comparison;
  $('#studio-week-chart').innerHTML=weekPlot(weekly,chartMode);
  const delta=weekly.comparison;
  $('#studio-week-summary').textContent=delta?
    'Completed four-week blocks only: '+fmt(delta.priorMiles)+' mi → '+
    fmt(delta.recentMiles)+' mi ('+(delta.differenceMiles>=0?'+':'')+
    fmt(delta.differenceMiles)+' mi). The current partial week is excluded.':
    'Eight completed weeks are needed to compare equal-length four-week training blocks.';
  $('#studio-coverage').textContent=chartMode==='easy'?
    'Only actual Easy/Recovery workouts with recorded durations are plotted. Lower seconds per mile means faster, but this does not prove improved fitness.':
    'Bars and trend lines represent logged miles; unrecorded runs and incomplete weeks can change the interpretation.';
}
function sensorPlot(track,selection){
  const stats=sensorSeries(track,selection);
  if(stats.points.length<2)return '<p class="body-copy">No sufficient '+stats.label.toLowerCase()+
    ' samples were recorded for this activity. Missing values are not estimated.</p>';
  const geometry=chartGeometry(stats.points);
  if(!geometry)return '<p class="body-copy">Not enough observations for a sensor plot.</p>';
  const {width,height,pad,path,yMin,yMax,xMax}=geometry;
  const axis=(v)=>selection==='paceSeconds'?formatTime(v):fmt(v,0);
  const title=stats.label+' vs elapsed time';
  const circles=geometry.coords.filter((_,i)=>i%Math.max(1,Math.ceil(geometry.coords.length/30))===0)
    .map(p=>'<circle cx="'+p.x+'" cy="'+p.y+'" r="3.2" fill="#d9f9a9"/>').join('');
  return '<div class="studio-detail-chart"><div class="studio-detail-stats">'+
    '<span>Recorded samples <strong>'+stats.coverageSamples+'</strong></span>'+
    '<span>Lowest <strong>'+axis(stats.min)+' '+stats.unit+'</strong></span>'+
    '<span>Highest <strong>'+axis(stats.max)+' '+stats.unit+'</strong></span>'+
    '<span>Sample mean <strong>'+axis(stats.mean)+' '+stats.unit+'</strong></span></div>'+
    '<svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+title+
    '; horizontal axis elapsed time, vertical axis '+stats.unit+'">'+
    [0,1,2,3,4].map(i=>'<line x1="'+pad+'" x2="'+(width-pad)+
      '" y1="'+(pad+i*(height-2*pad)/4)+'" y2="'+(pad+i*(height-2*pad)/4)+
      '" stroke="#2a4350" stroke-dasharray="4 7"/>').join('')+
    '<path d="'+path+'" fill="none" stroke="#a9ed78" stroke-width="3" stroke-linejoin="round"/>'+
    circles+'</svg><div class="studio-chart-legend"><span>0:00 elapsed</span><span>'+
    formatTime(xMax)+' elapsed</span></div></div>'+
    '<p class="body-copy">Individual samples only; gaps or paused intervals are not interpolated. '+
    'Sample mean is not a time-weighted session mean.</p>';
}
export function sensorExplorerMarkup(track){
  const keys=Object.keys(SENSOR_OPTIONS);
  const available=keys.filter(key=>sensorSeries(track,key).points.length>=2);
  if(!available.length)return '<div class="studio-explorer"><h3>Workout telemetry</h3>'+
    '<p class="body-copy">No detailed sensor timeline is available for this workout. '+
    'Import a compatible FIT/GPX/TCX export to explore recorded sensor values.</p></div>';
  const choice=available[0];
  return '<div class="studio-explorer"><div class="studio-explorer-heading"><div>'+
    '<div class="eyebrow">ATHLETE STUDIO · RECORDED SENSOR DATA</div><h3>Workout telemetry</h3></div>'+
    '<label for="studio-sensor-select">Metric <select id="studio-sensor-select">'+
    available.map(key=>'<option value="'+key+'">'+SENSOR_OPTIONS[key].label+'</option>').join('')+
    '</select></label></div><div id="studio-sensor-chart">'+sensorPlot(track,choice)+'</div></div>';
}
export function attachSensorExplorer(track){
  activeDetailTrack=track;
  const select=$('#studio-sensor-select');
  if(!select)return;
  select.addEventListener('change',()=>{
    $('#studio-sensor-chart').innerHTML=sensorPlot(activeDetailTrack,select.value);
  });
}
export function lapStudioMarkup(laps){
  const result=lapDiagnostics(laps);
  if(!result.laps.length)return '<div class="studio-lap-panel"><h3>Lap analysis</h3>'+
    '<p class="body-copy">No usable device laps. Do not infer mile splits from an unrecorded lap.</p></div>';
  return '<div class="studio-lap-panel"><div class="eyebrow">RECORDED, NOT SIMULATED</div>'+
    '<h3>Lap lab</h3><div class="studio-lap-facts">'+
    '<span><strong>'+result.laps.length+'</strong> device laps</span>'+
    '<span><strong>'+result.comparableCount+'</strong> comparable distance laps</span>'+
    '<span><strong>'+(result.fastestComparableLap??'—')+'</strong> fastest comparable lap #</span>'+
    '<span><strong>'+(result.comparablePaceCVPercent===null?'—':fmt(result.comparablePaceCVPercent)+'%')+
    '</strong> pace variation</span></div>'+
    '<div class="studio-lap-table-wrap"><table class="studio-lap-table"><thead><tr>'+
    '<th scope="col">Lap</th><th scope="col">Distance</th>'+
    '<th scope="col">Time</th><th scope="col">Pace / mi</th><th scope="col">Comparison group</th>'+
    '</tr></thead><tbody>'+result.laps.map(l=>'<tr>'+
    '<td>'+l.number+'</td><td>'+fmt(l.distanceMiles,2)+' mi</td>'+
    '<td>'+formatTime(l.durationSeconds)+'</td><td>'+formatTime(l.paceSecondsPerMile)+'</td>'+
    '<td>'+l.category+'</td></tr>').join('')+'</tbody></table></div>'+
    '<p class="body-copy">Comparable laps are within ±15% of the median distance among laps ≥0.25 mi. Short recovery-size laps are never ranked against long efforts. Pace variation is descriptive, not an effort score.</p></div>';
}
