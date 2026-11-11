import {previewResults} from './race-result-import.js';
import {apiIsConnected,apiUser,getApiBase,updateRemoteWorkout} from './api.js';
import {OFFICIAL_EVENTS,validateRaceResult,parseOfficialTime,officialTime} from './race-result.js';
import {createForecast,scoreForecast,forecastStorageKey} from './race-forecast.js';
import {localDay} from './race-evaluation.js';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let context,imported=[],activeScope;
const key=()=>forecastStorageKey(getApiBase(),apiIsConnected()?apiUser().id:null);
function history(){const value=JSON.parse(localStorage.getItem(key())??'[]');if(!Array.isArray(value))throw Error('Prediction history is unreadable. Export browser storage before resetting it.');return value;}
function download(name,value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function initRaceVerification(ctx){
  context=ctx;
  for(const id of ['official-distance','forecast-distance'])$('#'+id).innerHTML=OFFICIAL_EVENTS.map(n=>'<option value="'+n+'">'+(n===1609.344?'Mile':n+' m')+'</option>').join('');
  $('#official-import').addEventListener('change',async event=>{
    try{
      const file=event.target.files[0];if(!file)return;
      if(file.size>1024*1024)throw Error('Results packet must be smaller than 1 MB.');
      imported=previewResults(JSON.parse(await file.text()),context.getUsingSample()?[]:context.getWorkouts());
      $('#official-suggestions').innerHTML='<option value="">Choose a reviewed result to match</option>'+imported.map((r,i)=>'<option value="'+i+'">'+esc(r.date)+' · '+esc(r.raceResult.name)+' · '+r.candidates.length+' activity matches</option>').join('');
      $('#verification-message').textContent='Packet loaded. Review each suggested match and confirm before saving. No activities have been changed.';
    }catch(e){$('#verification-message').textContent=e.message;}finally{event.target.value='';}
  });
  $('#official-suggestions').addEventListener('change',()=>{
    if($('#official-suggestions').value==='')return;
    const row=imported[Number($('#official-suggestions').value)];
    // Re-match current data rather than trusting IDs from the packet or stale state.
    const match=previewResults({format:'pacelab-official-results-v1',results:[row]},context.getUsingSample()?[]:context.getWorkouts())[0];
    if(match.candidates.length===1)$('#verify-workout').value=match.candidates[0];
    else if(!context.getWorkouts().some(w=>String(w.id)===$('#verify-workout').value&&w.date===row.date))$('#verify-workout').value='';
    fillResult();
    $('#official-name').value=row.raceResult.name;$('#official-distance').value=row.raceResult.eventMeters;
    $('#official-time').value=officialTime(row.raceResult.finishSeconds);$('#official-url').value=row.raceResult.sourceUrl;$('#official-confirmed').checked=false;
    $('#verification-message').textContent=match.candidates.length===1?'Check the suggested activity and official result, then confirm.':'No unique activity match. Select the correct existing activity first, then select this result again.';
  });
  $('#verify-workout').addEventListener('change',fillResult);
  $('#verify-form').addEventListener('submit',async event=>{
    event.preventDefault();const button=$('#save-official');button.disabled=true;
    try{
      if(context.getUsingSample())throw Error('Import your own workouts first.');
      const w=context.getWorkouts().find(w=>String(w.id)===$('#verify-workout').value);
      if(!w||w.date>localDay())throw Error('Select an existing past activity.');
      const raceResult=validateRaceResult({name:$('#official-name').value,eventMeters:Number($('#official-distance').value),finishSeconds:parseOfficialTime($('#official-time').value),sourceUrl:$('#official-url').value.trim(),confirmed:$('#official-confirmed').checked});
      if(apiIsConnected()){await updateRemoteWorkout(w.id,{...w,type:'Race',raceResult});await context.refreshRemote();}
      else context.updateLocalActivity(w.id,{type:'Race',raceResult});
      $('#verification-message').textContent=raceResult.confirmed?'Official result saved and included in the race lab.':'Draft saved; excluded until confirmed.';
    }catch(error){$('#verification-message').textContent=error.message;}finally{button.disabled=context.getUsingSample();}
  });
  $('#forecast-form').addEventListener('submit',event=>{
    event.preventDefault();try{
      if(context.getUsingSample())throw Error('Use your own verified race history first.');
      const saved=history();if(saved.length>=500)throw Error('History limit reached. Export your predictions.');
      const forecast=createForecast(context.getWorkouts(),{name:$('#forecast-name').value,date:$('#forecast-date').value,eventMeters:Number($('#forecast-distance').value)});
      if(saved.some(f=>f.date===forecast.date&&f.eventMeters===forecast.eventMeters))throw Error('A prediction for this date and distance is already saved.');
      localStorage.setItem(key(),JSON.stringify([...saved,forecast]));renderHistory();
      $('#forecast-message').textContent='Prediction saved. Its original values will not be recalculated.';
    }catch(error){$('#forecast-message').textContent=error.message;}
  });
  $('#forecast-export').addEventListener('click',()=>{try{download('pacelab-private-predictions.json',{format:'pacelab-forecast-archive-v1',forecasts:history()});}catch(e){$('#forecast-message').textContent=e.message;}});
}
function fillResult(){
  const w=context.getWorkouts().find(w=>String(w.id)===$('#verify-workout').value),r=w?.raceResult;
  $('#official-watch').textContent=w?'Recorded: '+w.date+' · '+w.distanceMiles.toFixed(3)+' mi · '+officialTime(w.durationSeconds)+'. These measurements are preserved.':'';
  $('#official-name').value=r?.name??'';$('#official-distance').value=r?.eventMeters??8000;
  $('#official-time').value=r?officialTime(r.finishSeconds):'';$('#official-url').value=r?.sourceUrl??'';$('#official-confirmed').checked=r?.confirmed??false;
}
function renderHistory(){
  const container=$('#forecast-history');
  if(context.getUsingSample()){container.textContent='Saved private predictions are hidden in demo mode.';return;}
  try{
    const saved=history();container.innerHTML=saved.length?saved.map(f=>{
      const outcome=scoreForecast(f,context.getWorkouts());
      return '<details class="research-race"><summary>'+esc(f.date)+' · '+esc(f.name)+' · '+esc(f.eventMeters)+' m</summary><p>Saved '+esc(f.createdAt)+' · browser clock, not an independently certified timestamp.</p>'+
        Object.entries(f.predictions).map(([method,p])=>'<p>'+esc(method==='riegel'?'Riegel':'Previous same-distance')+': '+(p.seconds===null?'Unavailable':esc(officialTime(p.seconds)))+(p.reference?' · reference '+esc(p.reference.date)+' / '+esc(p.reference.eventMeters)+' m':'')+(outcome.status==='matched'&&p.seconds!==null?' · error '+outcome.errors[method].toFixed(1)+' s':'')+'</p>').join('')+
        '<p>'+esc(outcome.status==='matched'?'Current confirmed result: '+officialTime(outcome.actualSeconds)+'. Positive error means predicted slower.':outcome.status==='ambiguous'?'Multiple confirmed races match. Resolve duplicates before scoring.':'Awaiting one confirmed result on this date and distance.')+'</p></details>';
    }).join(''):'<p>No saved predictions yet.</p>';
  }catch{container.textContent='Prediction history could not be read. Existing storage has not been overwritten.';}
}
export function renderRaceVerification(){
  if(!context)return;
  const scope=context.getUsingSample()?'demo':key();
  if(scope!==activeScope){imported=[];$('#official-suggestions').innerHTML='<option value="">No packet loaded</option>';$('#verification-message').textContent='';$('#forecast-message').textContent='';activeScope=scope;}
  const selected=$('#verify-workout').value;
  const records=context.getUsingSample()?[]:context.getWorkouts().filter(w=>w.date<=localDay()).slice().sort((a,b)=>b.date.localeCompare(a.date));
  $('#verify-workout').innerHTML='<option value="">Choose an activity</option>'+records.map(w=>'<option value="'+esc(w.id)+'">'+esc(w.date)+' · '+esc(w.type)+' · '+w.distanceMiles.toFixed(2)+' mi · '+esc(officialTime(w.durationSeconds))+(w.raceResult?.confirmed?' · confirmed':'')+'</option>').join('');
  $('#verify-workout').value=records.some(w=>String(w.id)===selected)?selected:'';fillResult();
  $('#save-official').disabled=context.getUsingSample();$('#save-forecast').disabled=context.getUsingSample();$('#forecast-export').disabled=context.getUsingSample();
  renderHistory();
}
