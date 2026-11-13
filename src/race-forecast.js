import {auditWorkouts,localDay,validDay,PROTOCOL} from './race-evaluation.js';
import {OFFICIAL_EVENTS} from './race-result.js';
/** Snapshot only information available today. No future training or outcomes. */
export function createForecast(workouts,{name,date,eventMeters},now=new Date()){
  const asOf=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  if(!validDay(date)||date<=asOf)throw Error('Choose a future race date (after today).');
  if(typeof name!=='string'||!name.trim()||name.trim().length>160)throw Error('Enter a race name (up to 160 characters).');
  if(!OFFICIAL_EVENTS.includes(eventMeters))throw Error('Choose a supported distance.');
  const history=auditWorkouts(workouts,asOf,{requireConfirmed:true}).usable.filter(w=>w.type==='Race')
    .map(w=>({date:w.date,eventMeters:w.eventMeters,seconds:w.durationSeconds}));
  if(!history.length)throw Error('Confirm at least one official past race first.');
  const predictions={};
  for(const [method,rows] of [['previous_event',history.filter(w=>w.eventMeters===eventMeters)],['riegel',history]]){
    const ref=rows.at(-1);predictions[method]=ref?{seconds:ref.seconds*(eventMeters/ref.eventMeters)**PROTOCOL.exponent,reference:{...ref}}:{seconds:null};
  }
  return {id:crypto.randomUUID(),createdAt:now.toISOString(),asOf,name:name.trim(),date,eventMeters,
    protocol:PROTOCOL.version,exponent:PROTOCOL.exponent,provenance:'browser-clock',history,predictions};
}
export function scoreForecast(forecast,workouts,asOf=localDay()){
  const matches=auditWorkouts(workouts,asOf,{requireConfirmed:true}).usable.filter(w=>w.type==='Race'&&w.date===forecast.date&&w.eventMeters===forecast.eventMeters);
  if(matches.length!==1)return {status:matches.length?'ambiguous':'awaiting-result'};
  const actualSeconds=matches[0].durationSeconds;
  return {status:'matched',actualSeconds,errors:Object.fromEntries(Object.entries(forecast.predictions).map(([method,p])=>[method,p.seconds===null?null:p.seconds-actualSeconds]))};
}
export function forecastStorageKey(apiBase,userId){return 'pacelab.forecasts.v1:'+JSON.stringify(userId?[apiBase,userId]:['local']);}
