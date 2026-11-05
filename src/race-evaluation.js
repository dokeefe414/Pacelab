/** Private, deterministic one-athlete retrospective evaluation. No network or storage. */
import {RACE_EVENT_DISTANCES} from './local-research.js';
export const PROTOCOL = Object.freeze({version:'real-races-v1',exponent:1.06,
  lookbackDays:28,minimumSessions:5,minimumRaceDates:12,rollingDates:12,ridgeAlpha:10});
export const METHODS = Object.freeze({previous_event:'Previous same-distance race',
  riegel:'Latest race · Riegel',frozen:'Frozen ridge',expanding:'Expanding ridge',rolling:'Rolling 12-date ridge'});
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const mean=a=>a.reduce((s,n)=>s+n,0)/a.length;
const round=n=>Number(n.toFixed(4));
export function validDay(s){
  if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
  const d=new Date(s+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===s;
}
const shift=(day,n)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
export const localDay=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
const TYPES=['Easy','Recovery','Long','Tempo','Intervals','Race'];
const eventFor=w=>RACE_EVENT_DISTANCES.find(d=>Math.abs(w.distanceMiles*1609.344-d)/d<=.025)??null;
const ref=r=>({date:r.date,eventMeters:r.eventMeters,seconds:r.durationSeconds});

export function auditWorkouts(workouts,asOf=localDay()){
  if(!Array.isArray(workouts)||!validDay(asOf))throw Error('Expected a workout array and valid YYYY-MM-DD cutoff.');
  const records=workouts.map((raw,index)=>{
    const w=raw&&typeof raw==='object'?raw:{};
    const reasons=[];const warnings=[];
    if(!validDay(w.date))reasons.push('Invalid calendar date');
    else if(w.date>asOf)reasons.push('After evaluation cutoff');
    if(!finite(w.distanceMiles)||w.distanceMiles<=0||w.distanceMiles>200)reasons.push('Invalid distance');
    if(!finite(w.durationSeconds)||w.durationSeconds<=0||w.durationSeconds>86400)reasons.push('Invalid duration');
    if(!TYPES.includes(w.type))warnings.push('Workout type needs review');
    if(!finite(w.avgHeartRate)||w.avgHeartRate<30||w.avgHeartRate>230)warnings.push('No usable average heart rate');
    if(w.type==='Race'&&!eventFor(w))reasons.push('Race distance outside supported event tolerance');
    if(w.type==='Race')warnings.push('Verify official distance and finish time; watch distance is matched within 2.5%');
    if(w.type==='Race'&&finite(w.elapsedSeconds)&&Math.abs(w.elapsedSeconds-w.durationSeconds)>5)
      reasons.push('Race timer and elapsed time disagree; verify official result');
    // Only this allowlist leaves the audit: never notes, GPS, IDs, or source hashes.
    return {row:index+1,date:validDay(w.date)?w.date:null,type:TYPES.includes(w.type)?w.type:'Unreviewed',
      distanceMiles:finite(w.distanceMiles)?w.distanceMiles:null,durationSeconds:finite(w.durationSeconds)?w.durationSeconds:null,
      eventMeters:w.type==='Race'?eventFor(w):null,reasons,warnings};
  });
  const groups=new Map();
  // Exact IDs / file hashes and near-identical same-day summaries are suspect.
  // Exclude ALL involved rows; never silently pick a winner or delete originals.
  for(let i=0;i<workouts.length;i++){
    const w=workouts[i]??{};
    if(!records[i].date||records[i].date>asOf)continue;
    for(const key of [w.id?'id:'+w.id:null,w.sourceHash?'hash:'+w.sourceHash:null].filter(Boolean)){
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);
    }
  }
  const duplicates=new Set();
  for(const indices of groups.values())if(indices.length>1){
    const firstDate=indices.map(i=>records[i].date).sort()[0];
    const first=indices.filter(i=>records[i].date===firstDate);
    if(first.length>1)first.forEach(i=>duplicates.add(i));
    // A later reused identity cannot invalidate an earlier forecast's history.
    indices.filter(i=>records[i].date!==firstDate).forEach(i=>duplicates.add(i));
  }
  const dates=new Map();
  records.forEach((r,i)=>{if(r.date&&r.date<=asOf){if(!dates.has(r.date))dates.set(r.date,[]);dates.get(r.date).push(i);}});
  for(const indices of dates.values())for(let a=0;a<indices.length;a++)for(let b=a+1;b<indices.length;b++){
    const i=indices[a],j=indices[b],x=records[i],y=records[j];
    if(x.distanceMiles!==null&&y.distanceMiles!==null&&x.durationSeconds!==null&&y.durationSeconds!==null&&
      Math.abs(x.distanceMiles-y.distanceMiles)<.015&&Math.abs(x.durationSeconds-y.durationSeconds)<=5){duplicates.add(i);duplicates.add(j);}
  }
  duplicates.forEach(i=>records[i].reasons.push('Possible duplicate; resolve before evaluation'));
  const accepted=records.filter(r=>!r.reasons.length).sort((a,b)=>a.date.localeCompare(b.date)||a.eventMeters-b.eventMeters||a.durationSeconds-b.durationSeconds);
  return {asOf,total:records.length,accepted:accepted.length,excluded:records.length-accepted.length,
    raceCount:accepted.filter(r=>r.type==='Race').length,records,usable:accepted};
}
function features(race,usable){
  const start=shift(race.date,-PROTOCOL.lookbackDays);
  const sessions=usable.filter(w=>w.date>=start&&w.date<race.date&&TYPES.includes(w.type)&&w.type!=='Race');
  const easy=sessions.filter(w=>['Easy','Recovery'].includes(w.type));
  const miles=easy.reduce((s,w)=>s+w.distanceMiles,0);
  return {start,end:shift(race.date,-1),sessionCount:sessions.length,
    sessions:sessions.map(w=>({date:w.date,type:w.type,distanceMiles:w.distanceMiles,durationSeconds:w.durationSeconds})),
    values:sessions.length>=PROTOCOL.minimumSessions&&miles>0?[
      sessions.reduce((s,w)=>s+w.distanceMiles,0)/4,
      easy.reduce((s,w)=>s+w.durationSeconds,0)/miles,
      sessions.filter(w=>['Tempo','Intervals'].includes(w.type)).length,
      Math.max(...sessions.map(w=>w.distanceMiles))]:null};
}
// Small standardized ridge fit: all scaling statistics and coefficients use history only.
function ridgePredict(history,target){
  const x=history.map(r=>r.training.values),p=x[0].length;
  const centers=Array.from({length:p},(_,j)=>mean(x.map(row=>row[j])));
  const scales=centers.map((c,j)=>Math.sqrt(mean(x.map(row=>(row[j]-c)**2)))||1);
  const y=history.map(r=>r.durationSeconds*(5000/r.eventMeters)**PROTOCOL.exponent),ym=mean(y);
  const z=x.map(row=>row.map((v,j)=>(v-centers[j])/scales[j]));
  const matrix=Array.from({length:p},(_,j)=>Array.from({length:p+1},(_,k)=>k===p?
    z.reduce((s,row,i)=>s+row[j]*(y[i]-ym),0):z.reduce((s,row)=>s+row[j]*row[k],0)+(j===k?PROTOCOL.ridgeAlpha:0)));
  for(let j=0;j<p;j++){
    const divisor=matrix[j][j];for(let k=j;k<=p;k++)matrix[j][k]/=divisor;
    for(let i=0;i<p;i++)if(i!==j){const factor=matrix[i][j];for(let k=j;k<=p;k++)matrix[i][k]-=factor*matrix[j][k];}
  }
  const normalized=ym+target.training.values.reduce((s,v,j)=>s+(v-centers[j])/scales[j]*matrix[j][p],0);
  const value=normalized*(target.eventMeters/5000)**PROTOCOL.exponent;
  return finite(value)&&value>0?value:null;
}
function metric(rows,method){
  const pairs=rows.filter(r=>finite(r.predictions[method]?.seconds));
  if(!pairs.length)return {n:0,maeSeconds:null,rmseSeconds:null,biasSeconds:null};
  const errors=pairs.map(r=>r.predictions[method].seconds-r.actualSeconds);
  return {n:pairs.length,maeSeconds:round(mean(errors.map(Math.abs))),
    rmseSeconds:round(Math.sqrt(mean(errors.map(e=>e*e)))),biasSeconds:round(mean(errors))};
}
function summaries(rows){
  return Object.fromEntries(Object.keys(METHODS).map(method=>{
    const matched=rows.filter(r=>finite(r.predictions[method]?.seconds)&&finite(r.predictions.riegel?.seconds));
    const pairedComparisons=Object.fromEntries(Object.keys(METHODS).map(reference=>{
      const pairs=rows.filter(r=>finite(r.predictions[method]?.seconds)&&finite(r.predictions[reference]?.seconds));
      return [reference,{n:pairs.length,maeDifferenceSeconds:pairs.length?round(mean(pairs.map(r=>
        Math.abs(r.predictions[method].seconds-r.actualSeconds)-Math.abs(r.predictions[reference].seconds-r.actualSeconds)))):null}];
    }));
    return [method,{...metric(rows,method),pairedComparisons,pairedWithRiegel:matched.length,
      pairedMaeDifferenceSeconds:matched.length?round(mean(matched.map(r=>
        Math.abs(r.predictions[method].seconds-r.actualSeconds)-Math.abs(r.predictions.riegel.seconds-r.actualSeconds)))):null}];
  }));
}
export function evaluateRaces(workouts,{asOf=localDay(),source='real'}={}){
  if(!['real','synthetic'].includes(source))throw Error('Source must be real or synthetic.');
  const audit=auditWorkouts(workouts,asOf);
  const races=audit.usable.filter(w=>w.type==='Race').map(r=>({...r,training:features(r,audit.usable)}));
  const rows=[];
  for(const race of races){
    const past=races.filter(r=>r.date<race.date);
    const eligible=past.filter(r=>r.training.values);
    const dates=[...new Set(eligible.map(r=>r.date))];
    const predictions={};
    // Deterministic same-day reference tie: event distance then duration, never input order.
    for(const [method,history] of [['previous_event',past.filter(r=>r.eventMeters===race.eventMeters)],['riegel',past]]){
      const last=history.at(-1);
      predictions[method]=last?{seconds:last.durationSeconds*(race.eventMeters/last.eventMeters)**PROTOCOL.exponent,
        history:[ref(last)]}:{seconds:null,reason:'No strictly earlier eligible reference race'};
    }
    for(const method of ['frozen','expanding','rolling']){
      if(!race.training.values||dates.length<PROTOCOL.minimumRaceDates){
        predictions[method]={seconds:null,reason:!race.training.values?
          'Need five prior 28-day sessions and recorded Easy/Recovery pace':
          'Need 12 strictly earlier feature-eligible race dates'};continue;
      }
      const selected=method==='frozen'?dates.slice(0,PROTOCOL.minimumRaceDates):method==='rolling'?dates.slice(-PROTOCOL.rollingDates):dates;
      const history=eligible.filter(r=>selected.includes(r.date));
      const seconds=ridgePredict(history,race);
      predictions[method]={seconds,history:history.map(ref),trainingRows:history.length,
        trainingStart:history[0].date,trainingEnd:history.at(-1).date,
        ...(seconds===null?{reason:'Model produced an invalid forecast'}:{})};
    }
    rows.push({date:race.date,eventMeters:race.eventMeters,actualSeconds:race.durationSeconds,
      training:race.training,predictions});
  }
  const byEvent=Object.fromEntries([...new Set(rows.map(r=>r.eventMeters))].map(event=>[event,summaries(rows.filter(r=>r.eventMeters===event))]));
  const {usable,...publicAudit}=audit;
  return {protocol:PROTOCOL,source,asOf,audit:publicAudit,rows,metrics:summaries(rows),byEvent,
    status:rows.some(r=>finite(r.predictions.riegel.seconds))?'exploratory':'insufficient-history',
    limitations:[source==='synthetic'?'Synthetic demonstration only; not real-athlete evidence.':'Real-input retrospective analysis; race labels and official results require human verification.',
      'No prospective validation, causal training-effect claim, confidence interval, or automatic model selection.',
      'Terrain, weather, effort, illness and incomplete logging are not adjusted for. Riegel exponent is fixed at 1.06.',
      'Missing sensor values are not imputed. Heart rate is not a model feature.',
      'Features: 28-day miles / 4, distance-weighted Easy/Recovery pace, hard-session count, longest run. Same-day workouts are excluded.',
      'Compare methods on matched races and per event; pooled errors depend on event mix. Repeated races are not independent samples.',
      'Input labels and exclusions are audited retrospectively; this is a replay of the current data snapshot, not archived forecasts issued before races.',
      'Twelve earlier race dates permit an exploratory fit, not a claim of adequate validation. No test-outcome tuning.',
      'Reports omit notes, GPS, emails and activity IDs but contain private dates and performance history.']};
}
export function reportMarkdown(report){
  const f=n=>n===null?'—':n.toFixed(2);
  const lines=['# PaceLab race evaluation','',`Evidence: **${report.source}** · cutoff ${report.asOf} · protocol ${report.protocol.version}`,'',
    `Audit: ${report.audit.total} records, ${report.audit.accepted} accepted, ${report.audit.excluded} excluded; ${report.audit.raceCount} usable labeled races.`,
    '', '## Retrospective errors','', '| Method | Races | MAE (s) | RMSE (s) | Paired races vs Riegel | Paired MAE difference (s) |',
    '|---|---:|---:|---:|---:|---:|',...Object.entries(report.metrics).map(([k,m])=>`| ${METHODS[k]} | ${m.n} | ${f(m.maeSeconds)} | ${f(m.rmseSeconds)} | ${m.pairedWithRiegel} | ${f(m.pairedMaeDifferenceSeconds)} |`),
    '', 'Negative paired difference favors the method on the same races. Missing predictions are not scored as zero.',
    '', '## Event-specific comparisons','',
    ...Object.entries(report.byEvent).flatMap(([event,metrics])=>[
      `### ${event} meters`,'', '| Method | n | MAE (s) | Paired n vs frozen | Paired MAE difference vs frozen (s) |',
      '|---|---:|---:|---:|---:|',...Object.entries(metrics).map(([k,m])=>
        `| ${METHODS[k]} | ${m.n} | ${f(m.maeSeconds)} | ${m.pairedComparisons.frozen.n} | ${f(m.pairedComparisons.frozen.maeDifferenceSeconds)} |`),'']),
    '', '## Audit findings','',
    `Rows needing label review: ${report.audit.records.filter(r=>r.type==='Unreviewed').length}. Rows without usable average heart rate: ${report.audit.records.filter(r=>r.warnings.includes('No usable average heart rate')).length}.`,
    'Missing heart rate is non-blocking. Unknown workout types are excluded from model features. Accepted means basic checks passed, not verified race ground truth.',
    '',...report.audit.records.filter(r=>r.reasons.length).map(r=>`- Row ${r.row} (${r.date??'invalid date'}): ${r.reasons.join('; ')}`),
    '', '## Scope and limitations','',...report.limitations.map(s=>'- '+s),
    '', 'Per-race forecasts, reference history, feature values, prior training sessions, and event-stratified metrics are in the accompanying JSON.',
    '', 'Protocol: '+JSON.stringify(report.protocol), ''];
  return lines.join('\n');
}
