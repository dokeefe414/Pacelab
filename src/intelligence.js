/** PaceLab v0.3 activity detail, bulk imports, analytics and grounded assistant. */
import {formatTime} from './core.js';
import {advancedStats,routePath,linePath} from './intelligence-core.js';
import {apiIsConnected,uploadActivity,fetchWorkoutDetail,updateRemoteWorkout,askAssistant,recordedRacePrediction,fetchRaceFeatures,downloadRaceTrainingCSV} from './api.js';

const $=s=>document.querySelector(s);
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let context;
export function initIntelligence(options){
  context=options;
  $('#activity-files').addEventListener('change',handleFiles);
  $('#close-activity').addEventListener('click',()=>$('#activity-dialog').close());
  $('#load-race-baseline').addEventListener('click',loadRaceBaseline);
  $('#fill-ml-features').addEventListener('click',fillTrainingFeatures);
  $('#download-race-data').addEventListener('click',async ()=>{
    const output=$('#training-feature-status');
    try{
      const count=await downloadRaceTrainingCSV();
      output.textContent='Exported '+count+' labeled race rows. The ML experiment currently requires at least 60 real labeled race results for training.';
    }catch(err){output.textContent=err.message;}
  });
  $('#assistant-form').addEventListener('submit',askTrainingAssistant);
  document.querySelectorAll('[data-ask]').forEach(b=>b.addEventListener('click',()=>{
    $('#assistant-question').value=b.dataset.ask;
    $('#assistant-form').requestSubmit();
  }));
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-open]');
    if(b)openWorkout(b.dataset.open);
  });
}
function metric(label,value,note){
  return '<div class="intelligence-metric"><span>'+label+'</span><strong>'+value+'</strong><small>'+note+'</small></div>';
}
function bars(weeks,key,unit){
  const max=Math.max(1,...weeks.map(w=>w[key]));
  return '<div class="mini-bars">'+weeks.map(w=>
    '<div class="mini-column" title="'+w.date+': '+w[key].toFixed(1)+' '+unit+'"><div style="height:'+Math.max(0,w[key]/max*100)+'%"></div><span>'+w.date.slice(5)+'</span></div>'
  ).join('')+'</div>';
}
export function renderIntelligence(){
  if(!context)return;
  const stats=advancedStats(context.getWorkouts());
  const delta=stats.last7.miles-stats.prior7.miles;
  $('#expanded-metrics').innerHTML=
    metric('Last 7 days',stats.last7.miles.toFixed(1)+' mi','Previous 7 days: '+stats.prior7.miles.toFixed(1)+' mi')+
    metric('Mileage change',(delta>=0?'+':'')+delta.toFixed(1)+' mi','Equal-length 7-day periods')+
    metric('Hard sessions',String(stats.hardSessions),'Last 28 days · tempo / intervals / race')+
    metric('Weighted minutes',stats.weightedMinutes.toFixed(0),'Illustrative effort proxy, not medical load');
  $('#load-chart').innerHTML=bars(stats.weeks,'weightedMinutes','weighted min');
  $('#pace-trend-chart').innerHTML=paceTrend(context.getWorkouts(),stats.weeks);
  $('#pace-summary').textContent=stats.easyPace?
    'Easy / recovery pace across the last 28 days: '+formatTime(stats.easyPace)+' per mile (distance weighted).':
    'No easy / recovery pace data in the last 28 days.';
  $('#heart-rate-summary').textContent=stats.avgHR?
    'Mean of recorded workout-average heart rates in the last 28 days: '+Math.round(stats.avgHR)+' bpm.':
    'No heart-rate readings in your recent workouts. FIT files typically contain heart-rate data when recorded.';
  $('#race-prs').innerHTML=stats.personalBests.length?
    stats.personalBests.map(r=>'<div class="pr-row"><span>'+escapeHTML(r.event)+'</span><strong>'+formatTime(r.seconds)+'</strong><small>'+escapeHTML(r.date)+'</small></div>').join(''):
    '<p class="body-copy">No races at standard event distances logged yet. Record a workout as Race to track best efforts.</p>';
  $('#assistant-connection').textContent=apiIsConnected()?
    'Ready to analyze your private account data. Responses use only workout aggregates.':
    'Sign in to ask about your actual training. Demo workouts are not uploaded automatically.';
  $('#fit-import-hint').textContent=apiIsConnected()?
    'Choose .fit, .gpx or .tcx exports — up to 10 MB each; your route samples stay inside your account.':
    'Sign in to import activity files. Local CSV import remains available without an account.';
}
function chart(title,path,width,height){
  return path?'<div class="detail-chart"><strong>'+title+'</strong><svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+title+'"><path d="'+path+'" fill="none" stroke="#b5f36c" stroke-width="2.7" stroke-linejoin="round" stroke-linecap="round"/></svg></div>':'';
}
function paceTrend(workouts,weeks){
  const series=weeks.map(week=>{
    const start=new Date(week.date+'T12:00:00Z');
    const end=new Date(start);end.setUTCDate(end.getUTCDate()+6);
    const upper=end.toISOString().slice(0,10);
    const runs=workouts.filter(w=>w.date>=week.date&&w.date<=upper&&['Easy','Recovery'].includes(w.type));
    const miles=runs.reduce((s,w)=>s+w.distanceMiles,0);
    return {elapsed:weeks.indexOf(week),pace:miles?runs.reduce((s,w)=>s+w.durationSeconds,0)/miles:null};
  });
  const valid=series.filter(x=>Number.isFinite(x.pace));
  if(valid.length<2)return '<p class="body-copy">At least two weeks with Easy / Recovery runs are required to plot pace trends.</p>';
  const path=linePath(valid,'pace',440,150);
  return '<div class="trend-svg"><svg viewBox="0 0 440 150" role="img" aria-label="Easy and recovery pace by week; lower is faster">'+
    '<path d="'+path+'" fill="none" stroke="#b5f36c" stroke-width="3" stroke-linecap="round"/></svg></div>'+
    '<p class="body-copy">Easy / Recovery pace by week (higher line = slower pace on this plot). Not a race-fitness trend.</p>';
}
async function openWorkout(id){
  const local=context.getWorkouts().find(x=>x.id===id);
  if(!local)return;
  const target=$('#activity-detail');
  target.textContent='Loading workout details…';
  $('#activity-dialog').showModal();
  try{
    const w=apiIsConnected()?await fetchWorkoutDetail(id):local;
    const track=Array.isArray(w.track)?w.track:[];
    const laps=Array.isArray(w.laps)?w.laps:[];
    const distance=Number(w.distanceMiles);
    const avgHeartRate=Number(w.avgHeartRate);
    const ascent=Number(w.elevationGainMeters);
    target.innerHTML='<div class="detail-meta">'+
      metric('Distance',distance.toFixed(2)+' mi','Recorded activity')+
      metric('Duration',formatTime(w.durationSeconds),'Elapsed or timer time')+
      metric('Average pace',formatTime(w.durationSeconds/distance)+'/mi','Elapsed or timer pace')+
      metric('Heart rate',Number.isFinite(avgHeartRate)&&avgHeartRate>0?Math.round(avgHeartRate)+' bpm':'—','Imported, when available')+
      metric('Elevation gain',Number.isFinite(ascent)&&w.elevationGainMeters!==null?ascent.toFixed(0)+' m':'—','Imported, when available')+
      metric('Source',escapeHTML(w.source||'Manual'),escapeHTML(w.date))+'</div>'+
      '<p class="body-copy">'+escapeHTML(w.notes||'No notes')+'</p>'+
      '<div class="detail-charts">'+
        chart('Route trace (schematic; not a map)',routePath(track),320,150)+
        chart('Heart-rate samples',linePath(track,'heartRate'),320,120)+
        chart('Elevation samples',linePath(track,'elevationMeters'),320,120)+'</div>'+
      (laps.length?'<h3>Splits / laps</h3><div class="split-table">'+laps.map(l=>
        '<div><span>Lap '+Number(l.number||1)+' · '+Number(l.distanceMiles||0).toFixed(2)+' mi</span><strong>'+
        formatTime(Number(l.durationSeconds||0))+'</strong><small>'+escapeHTML(l.source==='approx_mile'?'Approx. mile':'Device lap')+'</small></div>').join('')+'</div>':
        '<p class="body-copy">No lap splits available for this workout.</p>')+
      (apiIsConnected()?'<div class="detail-change"><label>Workout type <select id="detail-type">'+
        ['Easy','Long','Tempo','Intervals','Race','Recovery'].map(type=>'<option'+(type===w.type?' selected':'')+'>'+type+'</option>').join('')+
        '</select></label><label>Notes <textarea id="detail-notes" maxlength="300" rows="2">'+escapeHTML(w.notes)+'</textarea></label>'+
        '<button type="button" class="primary" id="save-detail">Save changes</button></div>':'');
    if(apiIsConnected()){
      $('#save-detail').addEventListener('click',async()=>{
        const button=$('#save-detail');button.disabled=true;
        try{await updateRemoteWorkout(w.id,{date:w.date,type:$('#detail-type').value,distanceMiles:w.distanceMiles,durationSeconds:w.durationSeconds,notes:$('#detail-notes').value});
          await context.refreshRemote();$('#activity-dialog').close();context.toast('Workout updated. Race classifications count toward your recorded PRs.');}
        catch(err){context.toast('Update failed: '+err.message);}finally{button.disabled=false;}
      });
    }
  }catch(err){target.textContent='Could not fetch workout: '+err.message;}
}
async function handleFiles(event){
  const input=event.target;
  const chosen=[...input.files].slice(0,50);
  if(!chosen.length)return;
  if(!apiIsConnected()){context.toast('Sign in to import activity files.');input.value='';return;}
  const status=$('#fit-import-status');let added=0,duplicates=0,failed=[];
  status.textContent='Importing '+chosen.length+' files…';
  for(let i=0;i<chosen.length;i++){
    const file=chosen[i];
    status.textContent='Processing '+(i+1)+' / '+chosen.length+': '+file.name;
    try{
      const result=await uploadActivity(file);
      if(result.imported)added++;else duplicates++;
    }catch(err){failed.push(file.name+': '+err.message);}
  }
  input.value='';
  try{await context.refreshRemote();}catch(err){failed.push('Refresh failed: '+err.message);}
  status.textContent=added+' imported · '+duplicates+' duplicates · '+failed.length+' failed.'+
    (failed.length?' Problems: '+failed.slice(0,4).join(' | '):'');
  context.toast('Activity import complete. '+added+' added.');
  renderIntelligence();
}
async function loadRaceBaseline(){
  const box=$('#historical-race-result');
  if(!apiIsConnected()){box.textContent='Sign in and log a Race workout to use your recorded race history.';return;}
  box.textContent='Analyzing your recorded race history…';
  try{
    const dist=Number($('#target-distance').value);
    const r=await recordedRacePrediction(dist);
    box.innerHTML='<div class="prediction-output"><span>RECENT RACE · FORMULA BASELINE</span><strong>'+formatTime(r.estimatedSeconds)+'</strong>'+
      '<small>Based on your '+formatTime(r.reference.seconds)+' result from '+escapeHTML(r.reference.date)+
      ', over '+(r.reference.distanceMeters/1000).toFixed(2)+' km. '+escapeHTML(r.warning)+'</small></div>';
  }catch(err){box.textContent=err.message;}
}
async function fillTrainingFeatures(){
  const box=$('#training-feature-status');
  if(!apiIsConnected()){box.textContent='Sign in to derive training features from your logged runs.';return;}
  try{
    const r=await fetchRaceFeatures(Number($('#ml-event').value));
    if(!r.complete){box.textContent='Not enough Easy / Recovery training data in the last 28 days to calculate easy pace.';return;}
    const f=r.features;
    $('#ml-mileage').value=f.weeklyMiles4w;
    $('#ml-pace').value=formatTime(f.averageEasyPaceSecondsPerMile);
    $('#ml-hard').value=f.hardSessions4w;
    $('#ml-long').value=f.longestRunMiles;
    box.textContent='Filled using '+r.activityCount+' logged workouts in the last 28 days. Review before predicting.';
  }catch(err){box.textContent=err.message;}
}
async function askTrainingAssistant(event){
  event.preventDefault();
  const input=$('#assistant-question'),button=$('#assistant-submit'),answer=$('#assistant-answer');
  if(!apiIsConnected()){answer.textContent='Sign in to use the grounded training assistant.';return;}
  button.disabled=true;answer.textContent='Checking your actual training statistics…';
  try{
    const result=await askAssistant(input.value.trim());
    answer.textContent=result.answer;
    $('#assistant-footnote').textContent='Engine: '+result.engine+' · As of '+result.asOf+' · '+result.disclaimer;
  }catch(err){answer.textContent='Unable to analyze workouts: '+err.message;}finally{button.disabled=false;}
}
