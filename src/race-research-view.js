import {evaluateRaces,reportMarkdown,METHODS} from './race-evaluation.js';
import {formatTime} from './core.js';
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>n===null?'—':n.toFixed(1);
let context,report;
function download(name,data,type){
  const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function initRaceResearch(ctx){
  context=ctx;
  $('#research-method').innerHTML=Object.entries(METHODS).map(([key,label])=>'<option value="'+key+'">'+label+'</option>').join('');
  $('#research-method').value='riegel';
  for(const id of ['research-method','research-event'])$('#'+id).addEventListener('change',renderResults);
  $('#research-json').addEventListener('click',()=>download('pacelab-private-race-evaluation.json',JSON.stringify(report,null,2),'application/json'));
  $('#research-markdown').addEventListener('click',()=>download('pacelab-private-race-report.md',reportMarkdown(report),'text/markdown'));
}
export function renderRaceResearch(){
  if(!context)return;
  report=evaluateRaces(context.getWorkouts(),{source:context.getUsingSample()?'synthetic':'real'});
  $('#research-source').textContent=report.source==='synthetic'?'SYNTHETIC DEMO · NO ATHLETE EVIDENCE':'YOUR RECORDS · RETROSPECTIVE RESEARCH';
  $('#research-summary').textContent=report.audit.total+' records audited · '+report.audit.excluded+
    ' excluded · '+report.audit.raceCount+' usable labeled races. '+
    (report.status==='insufficient-history'?'At least two races on different dates are needed for a baseline comparison. ':'Forecasts use strictly earlier dates. ')+
    'Ridge methods require 12 earlier race dates with usable training history. Small samples do not establish accuracy.';
  const current=$('#research-event').value;
  $('#research-event').innerHTML='<option value="all">All distances</option>'+Object.keys(report.byEvent).map(e=>'<option value="'+e+'">'+e+' m</option>').join('');
  $('#research-event').value=Object.hasOwn(report.byEvent,current)?current:'all';
  $('#research-audit').innerHTML=report.audit.records.length?
    '<div class="research-scroll"><table class="studio-lap-table"><caption>Audit findings; originals are never modified</caption><thead><tr><th>Row / date</th><th>Label</th><th>Eligibility and review</th></tr></thead><tbody>'+
    report.audit.records.map(r=>'<tr><td>'+r.row+' / '+esc(r.date??'Invalid date')+'</td><td>'+esc(r.type)+'</td><td>'+
      esc((r.reasons.length?'Excluded: '+r.reasons.join('; '):'Usable')+(r.warnings.length?' · '+r.warnings.join('; '):''))+'</td></tr>').join('')+'</tbody></table></div>':
    '<p>No records to audit. Import activities or log a workout first.</p>';
  renderResults();
}
function renderResults(){
  if(!report)return;
  const event=$('#research-event').value,method=$('#research-method').value;
  const rows=report.rows.filter(r=>event==='all'||String(r.eventMeters)===event);
  const metrics=event==='all'?report.metrics:report.byEvent[event];
  $('#research-metrics').innerHTML='<div class="research-scroll"><table class="studio-lap-table"><caption>Error by method · seconds</caption><thead><tr><th>Method</th><th>Scored races</th><th>MAE</th><th>RMSE</th><th>Paired n</th><th>Δ MAE vs Riegel</th><th>Paired n vs frozen</th><th>Δ MAE vs frozen</th></tr></thead><tbody>'+
    Object.entries(metrics??{}).map(([key,m])=>'<tr><td>'+METHODS[key]+'</td><td>'+m.n+'</td><td>'+num(m.maeSeconds)+'</td><td>'+num(m.rmseSeconds)+'</td><td>'+m.pairedWithRiegel+'</td><td>'+num(m.pairedMaeDifferenceSeconds)+'</td><td>'+m.pairedComparisons.frozen.n+'</td><td>'+num(m.pairedComparisons.frozen.maeDifferenceSeconds)+'</td></tr>').join('')+'</tbody></table></div>';
  $('#research-chart').innerHTML=plot(rows,method);
  $('#research-races').innerHTML=rows.length?rows.map(r=>{
    const p=r.predictions[method];
    return '<details class="research-race"><summary>'+r.date+' · '+r.eventMeters+' m · actual '+formatTime(r.actualSeconds)+' · '+
      (p.seconds===null?'forecast unavailable':'forecast '+formatTime(p.seconds)+' · error '+num(p.seconds-r.actualSeconds)+' s')+'</summary>'+
      '<p>'+esc(p.reason??'Prediction generated using earlier results only. Positive signed error means the prediction was slower than the result.')+'</p>'+
      '<p>Reference races: '+esc(p.history?.map(h=>h.date+' ('+h.eventMeters+' m, '+formatTime(h.seconds)+')').join('; ')||'None')+'</p>'+
      '<p>Training window: '+r.training.start+' through '+r.training.end+' · '+r.training.sessionCount+' logged sessions.</p>'+
      '<p>Feature values (weekly miles, easy seconds/mi, hard sessions, longest miles): '+esc(r.training.values?.map(num).join(', ')??'Insufficient recorded training')+'</p>'+
      '<ul>'+r.training.sessions.map(w=>'<li>'+w.date+' · '+esc(w.type)+' · '+w.distanceMiles.toFixed(2)+' mi · '+formatTime(w.durationSeconds)+'</li>').join('')+'</ul></details>';
  }).join(''):'<p class="body-copy">No usable races. Review the audit, then mark genuine races in Workout details and verify their distance and finish time. Fast workouts are not automatically labeled as races.</p>';
}
function plot(rows,method){
  const valid=rows.filter(r=>r.predictions[method].seconds!==null);
  if(!valid.length)return '<p class="body-copy">No forecasts available for this method and distance. Missing predictions are not treated as zero.</p>';
  const values=valid.flatMap(r=>[r.actualSeconds,r.predictions[method].seconds]);
  const lo=Math.max(0,Math.min(...values)-15),hi=Math.max(...values)+15;
  const y=v=>180-(v-lo)/(hi-lo)*140;
  const marks=valid.map((r,i)=>{const x=65+(valid.length===1?.5:i/(valid.length-1))*560;
    return '<circle cx="'+x+'" cy="'+y(r.actualSeconds)+'" r="5" fill="#b5f36c"><title>'+r.date+' actual '+formatTime(r.actualSeconds)+'</title></circle>'+
      '<path d="M '+(x-5)+' '+(y(r.predictions[method].seconds)-5)+' l 10 10 m -10 0 l 10 -10" stroke="#67d7ee" stroke-width="2"><title>'+r.date+' predicted '+formatTime(r.predictions[method].seconds)+'</title></path>';}).join('');
  return '<svg viewBox="0 0 680 230" role="img" aria-label="Actual times as green circles; predicted times as blue crosses. Races in chronological order. Exact values in the expandable results below.">'+
    '<text x="4" y="43" fill="#bdcbd5" font-size="12">'+formatTime(hi)+'</text><text x="4" y="183" fill="#bdcbd5" font-size="12">'+formatTime(lo)+'</text>'+
    '<line x1="60" y1="180" x2="640" y2="180" stroke="#506271"/>'+marks+
    '<text x="60" y="215" fill="#bdcbd5" font-size="12">'+valid[0].date+'</text><text x="640" y="215" text-anchor="end" fill="#bdcbd5" font-size="12">'+valid.at(-1).date+'</text></svg>'+
    '<p class="body-copy">● Actual · × Predicted · ordered races (not evenly spaced calendar days). Filter to one distance for a meaningful time comparison.</p>';
}
