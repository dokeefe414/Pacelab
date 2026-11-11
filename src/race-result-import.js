import {validateRaceResult} from './race-result.js';
import {validDay,localDay} from './race-evaluation.js';
/** Suggestions only: no automatic race labeling or overwrite. */
export function previewResults(packet,workouts,asOf=localDay()){
  if(packet?.format!=='pacelab-official-results-v1'||!Array.isArray(packet.results)||packet.results.length>200)throw Error('Expected a PaceLab official results packet (up to 200 results).');
  return packet.results.map(row=>{
    if(!validDay(row.date)||row.date>asOf)throw Error('Results must have valid past dates.');
    const raceResult=validateRaceResult(row.raceResult);if(!raceResult)throw Error('Missing official result.');
    const candidates=workouts.filter(w=>w.date===row.date&&Math.abs(w.distanceMiles*1609.344-raceResult.eventMeters)/raceResult.eventMeters<=.025&&Math.abs(w.durationSeconds-raceResult.finishSeconds)<=10);
    return {date:row.date,raceResult,candidates:candidates.map(w=>String(w.id))};
  });
}
