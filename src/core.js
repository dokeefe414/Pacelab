export const KEY = 'pacelab.workouts.v1';
export const MILE_TO_KM = 1.609344;
export function parseTime(input) {
  const parts = String(input).trim().split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some(x => !/^\\d+$/.test(x))) throw new Error('Use MM:SS or HH:MM:SS.');
  const nums = parts.map(Number);
  if (nums.slice(1).some(x => x >= 60)) throw new Error('Seconds and minutes must be below 60.');
  const value = nums.reduce((acc, n) => acc * 60 + n, 0);
  if (value <= 0 || !Number.isFinite(value)) throw new Error('Time must be positive.');
  return value;
}
export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const s = Math.round(seconds); const h = Math.floor(s/3600); const m=Math.floor((s%3600)/60); const sec=s%60;
  return h ? [h,m,sec].map((x,i)=> i ? String(x).padStart(2,'0'):String(x)).join(':') : m+':'+String(sec).padStart(2,'0');
}
export function predictRace(referenceSeconds, referenceMeters, targetMeters, exponent=1.06) {
  if (![referenceSeconds,referenceMeters,targetMeters,exponent].every(Number.isFinite) || referenceSeconds<=0 || referenceMeters<=0 || targetMeters<=0 || exponent<1 || exponent>1.3) throw new Error('Enter valid race inputs.');
  return referenceSeconds * Math.pow(targetMeters/referenceMeters, exponent);
}
export function paceSeconds(workout) { return workout.durationSeconds / workout.distanceMiles; }
export function validateWorkout(input) {
  const date=String(input.date||'');
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date) || new Date(date+'T12:00:00').toISOString().slice(0,10)!==date) throw new Error('Enter a valid date.');
  const distanceMiles=Number(input.distanceMiles); const durationSeconds=Number(input.durationSeconds);
  if (!Number.isFinite(distanceMiles) || distanceMiles<=0 || distanceMiles>200) throw new Error('Distance must be between 0 and 200 miles.');
  if (!Number.isFinite(durationSeconds) || durationSeconds<=0 || durationSeconds>86400) throw new Error('Enter a valid workout duration.');
  const types=['Easy','Long','Tempo','Intervals','Race','Recovery']; const type=types.includes(input.type)?input.type:'Easy';
  return {id:String(input.id||crypto.randomUUID()),date,type,distanceMiles,durationSeconds,notes:String(input.notes||'').slice(0,300)};
}
export function weekStart(dateString) {
  const date=new Date(dateString+'T12:00:00Z'); const day=(date.getUTCDay()+6)%7;date.setUTCDate(date.getUTCDate()-day);return date.toISOString().slice(0,10);
}
export function lastWeeks(workouts, count=8, today=new Date()) {
  const anchor=new Date(Date.UTC(today.getFullYear(),today.getMonth(),today.getDate(),12));const todayWeek=weekStart(anchor.toISOString().slice(0,10));
  const weeks=Array.from({length:count},(_,i)=>{const d=new Date(todayWeek+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-7*(count-1-i));return {date:d.toISOString().slice(0,10),miles:0,activities:0};});
  const byWeek=new Map(weeks.map(w=>[w.date,w]));
  workouts.forEach(w=>{const week=byWeek.get(weekStart(w.date));if(week){week.miles+=w.distanceMiles;week.activities++;}});return weeks;
}
export function summarize(workouts) {
  const total=workouts.reduce((s,w)=>s+w.distanceMiles,0); const seconds=workouts.reduce((s,w)=>s+w.durationSeconds,0);
  return {count:workouts.length,miles:total,hours:seconds/3600,averagePace:total?seconds/total:null,longest:Math.max(0,...workouts.map(w=>w.distanceMiles))};
}
export function csvEscape(value) {const s=String(value??'');return /[",\\n\\r]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;}
export function toCSV(workouts){const cols=['date','type','distance_miles','duration','notes'];return [cols.join(','),...workouts.map(w=>[w.date,w.type,w.distanceMiles,formatTime(w.durationSeconds),w.notes].map(csvEscape).join(','))].join('\\r\\n');}
export function parseCSV(text) {
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}else if(c==='"')quoted=true;else if(c===','){row.push(cell);cell='';}else if(c==='\\n'){row.push(cell.replace(/\\r$/,''));rows.push(row);row=[];cell='';}else cell+=c;}
  if(quoted)throw new Error('CSV has an unclosed quote.');
  if(cell||row.length){row.push(cell.replace(/\\r$/,''));rows.push(row);}
  if(!rows.length)throw new Error('CSV is empty.');
  const header=rows.shift().map(x=>x.trim().toLowerCase());const get=(row,...names)=>{const idx=names.map(n=>header.indexOf(n)).find(i=>i>=0);return idx===undefined?'':row[idx]??'';};
  if(!header.includes('date')||!header.some(x=>['distance_miles','distance','miles'].includes(x))||!header.some(x=>['duration','time'].includes(x)))throw new Error('CSV requires date, distance_miles, and duration columns.');
  const out=[];const errors=[];
  rows.forEach((row,i)=>{if(row.every(x=>!x.trim()))return;try{out.push(validateWorkout({date:get(row,'date'),type:get(row,'type')||'Easy',distanceMiles:get(row,'distance_miles','distance','miles'),durationSeconds:parseTime(get(row,'duration','time')),notes:get(row,'notes')}));}catch(e){errors.push('Row '+(i+2)+': '+e.message);}});
  return {workouts:out,errors};
}
export function sampleWorkouts(today=new Date()) {
  const types=['Easy','Intervals','Easy','Tempo','Recovery','Long'];const notes=['Conversational effort','Track session','Relaxed aerobic miles','Controlled threshold','Easy shakeout','Steady long run'];const runs=[];
  for(let w=7;w>=0;w--){for(let j=0;j<5;j++){const d=new Date(today.getFullYear(),today.getMonth(),today.getDate());d.setDate(d.getDate()-(w*7)-(5-j));const miles=[5,4.5,6,5.5,4,9][j];const pace=[480,410,475,425,530,495][j]+Math.max(0,w-3)*5;runs.push({id:'sample-'+w+'-'+j,date:[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'),type:types[j],distanceMiles:miles+(7-w)*.12,durationSeconds:Math.round((miles+(7-w)*.12)*pace),notes:notes[j]});}}
  return runs;
}
