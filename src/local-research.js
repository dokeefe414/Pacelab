/**
 * Local-only race experiment preparation. No model training, network calls,
 * routes, athlete IDs or unverified accuracy claims. Matches the backend CSV
 * schema and uses workouts strictly BEFORE each race calendar date.
 */
export const RACE_FEATURE_COLUMNS=Object.freeze([
  'date','event_meters','weekly_miles_4w',
  'average_easy_pace_seconds_per_mile','hard_sessions_4w',
  'longest_run_miles','finish_seconds'
]);
export const RACE_EVENT_DISTANCES=Object.freeze([800,1609.344,3000,5000,8000,10000]);
const isoDay=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const dayBefore=(day,offset)=>{
  const date=new Date(day+'T12:00:00Z');
  date.setUTCDate(date.getUTCDate()+offset);
  return date.toISOString().slice(0,10);
};
const round=(x,digits)=>Number(x.toFixed(digits));

export function labeledRaceRows(workouts,today=new Date()){
  const current=isoDay(today);
  const data=[...workouts].filter(w=>w.date<=current).sort((a,b)=>a.date.localeCompare(b.date));
  const rows=[];
  for(const race of data){
    if(race.type!=='Race')continue;
    const meters=race.distanceMiles*1609.344;
    const matches=RACE_EVENT_DISTANCES.filter(d=>Math.abs(d-meters)/d<=.025);
    if(!matches.length)continue;
    const start=dayBefore(race.date,-28);
    const training=data.filter(w=>w.date>=start&&w.date<race.date&&w.type!=='Race');
    const easy=training.filter(w=>['Easy','Recovery'].includes(w.type));
    const easyMiles=easy.reduce((s,w)=>s+w.distanceMiles,0);
    if(training.length<5||easyMiles<=0)continue;
    rows.push({
      date:race.date,
      event_meters:matches.reduce((best,n)=>Math.abs(n-meters)<Math.abs(best-meters)?n:best),
      weekly_miles_4w:round(training.reduce((s,w)=>s+w.distanceMiles,0)/4,3),
      average_easy_pace_seconds_per_mile:round(easy.reduce((s,w)=>s+w.durationSeconds,0)/easyMiles,2),
      hard_sessions_4w:training.filter(w=>['Tempo','Intervals'].includes(w.type)).length,
      longest_run_miles:round(Math.max(...training.map(w=>w.distanceMiles)),3),
      finish_seconds:race.durationSeconds,
    });
  }
  return rows;
}
export function localRaceReadiness(workouts,today=new Date()){
  const rows=labeledRaceRows(workouts,today),dates=new Set(rows.map(r=>r.date));
  const current=isoDay(today);
  const races=workouts.filter(w=>w.type==='Race'&&w.date<=current);
  const byEvent={};
  for(const row of rows){const key=String(Math.round(row.event_meters));byEvent[key]=(byEvent[key]||0)+1;}
  return {
    totalLoggedRaces:races.length,eligibleLabeledRows:rows.length,distinctEligibleRaceDates:dates.size,
    minimumRowsForExperiment:60,minimumDistinctDates:12,
    additionalRowsNeeded:Math.max(0,60-rows.length),
    eligibleByEventMeters:byEvent,
    canStartExperimentalTraining:rows.length>=60&&dates.size>=12,
    warning:'Data completeness and conditions still need review. Eligible rows do not establish prediction accuracy.',
  };
}
export function trainingCSV(rows){
  const text=[RACE_FEATURE_COLUMNS.join(','),...rows.map(row=>
    RACE_FEATURE_COLUMNS.map(field=>{
      const value=row[field];
      if(field==='date'&&!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Invalid race date');
      if(field!=='date'&&!Number.isFinite(value))throw Error('Invalid numeric race feature');
      return value;
    }).join(',')
  )].join('\n')+'\n';
  return text;
}
export function recentRaceBaseline(workouts,targetMeters,today=new Date()){
  const current=isoDay(today);
  const races=workouts.filter(w=>w.type==='Race'&&w.date<=current&&
    w.distanceMiles*1609.344>=800&&w.distanceMiles*1609.344<=10000);
  if(!races.length)return null;
  const latest=[...races].sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id))[0];
  const sourceMeters=latest.distanceMiles*1609.344;
  return {
    estimatedSeconds:latest.durationSeconds*(targetMeters/sourceMeters)**1.06,
    reference:{date:latest.date,seconds:latest.durationSeconds,distanceMeters:sourceMeters},
    warning:'Formula extrapolation from the latest labeled race. This is not trained or validated ML.'
  };
}
