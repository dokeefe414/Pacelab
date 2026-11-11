import {initTour} from './tour.js';
import {initPerformance,renderPerformance} from './performance.js';
import {initAthleteStudio,renderAthleteStudio} from './athlete-studio.js';
import {KEY,parseTime,formatTime,predictRace,validateWorkout,paceSeconds,lastWeeks,summarize,toCSV,parseCSV,sampleWorkouts} from './core.js';
import {initIntelligence,renderIntelligence} from './intelligence.js';
import {apiIsConnected,apiUser,authenticate,logout,restoreSession,hasSavedSession,fetchWorkouts,createRemoteWorkout,deleteRemoteWorkout,setApiBase,getApiBase,requestMLPrediction,downloadAccountData,permanentlyDeleteAccount,signOutEverywhere,changeAccountPassword} from './api.js';
const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
let workouts=[];let usingSample=false;let currentView='dashboard';
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>el.classList.remove('show'),3400);}
function load(){try{const raw=localStorage.getItem(KEY);if(raw!==null){const parsed=JSON.parse(raw);if(!Array.isArray(parsed))throw Error('Invalid saved data');workouts=parsed.map(validateWorkout);usingSample=false;return;}}catch(e){console.warn('Could not read saved workouts',e);toast('Saved data could not be read; showing sample workouts.');}workouts=sampleWorkouts();usingSample=true;}
function persist(){if(apiIsConnected()) throw Error('Account workouts must be saved using the API');localStorage.setItem(KEY,JSON.stringify(workouts));usingSample=false;render();}
async function refreshRemote(){workouts=(await fetchWorkouts()).map(w=>({...w,...validateWorkout(w)}));usingSample=false;render();}
function syncMode(){const connected=apiIsConnected();$('#account-button').textContent=connected?'Account: '+apiUser().email:'Sign in / Create account';$('#account-status').textContent=connected?'● Synced to account':'● Local-only workspace';$('#reset-data').hidden=connected;$('#sample-banner').hidden=connected||!usingSample;
  $('#local-backup-panel').hidden=connected;$('#export-local-json').disabled=connected||usingSample;}
function showAccountDialog(){
  if(apiIsConnected()){const dialog=$('#account-settings-dialog');$('#settings-email').textContent=apiUser().email;$('#account-delete-result').textContent='';dialog.showModal();return;}const staticPreview=window.location.hostname.endsWith('.github.io');
  const needsApi=staticPreview && getApiBase()==='/api';
  $('#auth-error').textContent=needsApi?
    'The public demo does not provide accounts. To sign in, enter a separately hosted HTTPS PaceLab API address below.':
    '';
  $('#api-base').value=needsApi?'':getApiBase();
  $('#account-dialog').showModal();}

function realWorkouts(){if(usingSample){workouts=[];usingSample=false;}}
function updateLocalActivity(id,updates){
  if(apiIsConnected())throw Error('Use your authenticated server to edit this workout.');
  const index=workouts.findIndex(w=>w.id===id);
  if(index<0)throw Error('Workout not found');
  const updated=validateWorkout({...workouts[index],...updates});
  const next=[...workouts];next[index]=updated;
  try{localStorage.setItem(KEY,JSON.stringify(next));}
  catch{throw Error('Browser storage is full or unavailable. Export your workout CSV before making more changes.');}
  workouts=next;usingSample=false;render();
}
function addLocalActivity(activity){
  if(apiIsConnected())throw Error('Use your connected private server for imports.');
  const validated=validateWorkout(activity);
  const base=usingSample?[]:workouts;
  if(validated.sourceHash&&base.some(w=>w.sourceHash===validated.sourceHash))return false;
  // Cross-format export of the same run: do not create duplicate workouts.
  if(base.some(w=>w.date===validated.date&&w.source&&
    Math.abs(w.distanceMiles-validated.distanceMiles)<.015&&
    Math.abs(w.durationSeconds-validated.durationSeconds)<=5))return false;
  const next=[...base,validated];
  try{localStorage.setItem(KEY,JSON.stringify(next));}
  catch{throw Error('Browser storage is full or blocked. Export CSV and delete old activities before importing more.');}
  workouts=next;usingSample=false;render();
  return true;
}
function fmtDate(date){return new Date(date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});}
function sorted(){return [...workouts].sort((a,b)=>b.date.localeCompare(a.date));}
function closeMobileNav(){
  $('.sidebar').classList.remove('open');
  $('#nav-backdrop').hidden=true;
  $('#menu-toggle').setAttribute('aria-expanded','false');
}
function nav(view){
  currentView=view;
  document.querySelectorAll('.page').forEach(el=>el.classList.toggle('active',el.id===view+'-page'));
  document.querySelectorAll('.nav-item').forEach(el=>{
    const active=el.dataset.view===view;el.classList.toggle('active',active);
    if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');
  });
  $('#topbar-name').textContent=({dashboard:'Your training workspace',workouts:'Workout history',predictions:'Performance modeling',insights:'Analytics and insights',assistant:'Your grounded training assistant'})[view];
  closeMobileNav();render();
}
function metric(label,value,detail,icon){return '<article class="metric"><div class="metric-top"><span>'+label+'</span><span class="metric-icon">'+icon+'</span></div><div class="metric-value">'+value+'</div><div class="metric-detail">'+detail+'</div></article>';}
function renderMetrics(){const s=summarize(workouts);const w=lastWeeks(workouts);const current=w[w.length-1];$('#metrics').innerHTML=metric('Total mileage',s.miles.toFixed(1)+' <small>mi</small>','Across '+s.count+' activities','↗')+metric('Training time',s.hours.toFixed(1)+' <small>hrs</small>','Total moving time','◷')+metric('Average pace',s.averagePace?formatTime(s.averagePace):'—','Minutes per mile','◉')+metric('This week',current.miles.toFixed(1)+' <small>mi</small>',current.activities+' logged runs','▥');$('#insight-metrics').innerHTML=metric('Longest workout',s.longest.toFixed(1)+' <small>mi</small>','Across logged runs','↗')+metric('Active weeks',w.filter(x=>x.activities).length+'/8','Recent training blocks','◷')+metric('Runs logged',s.count,'Your activity history','◎')+metric('Average distance',s.count?(s.miles/s.count).toFixed(1)+' <small>mi</small>':'—','Per logged workout','▥');}
function renderBars(target,rows,key='miles',unit='mi'){const max=Math.max(1,...rows.map(r=>r[key]));target.innerHTML='<div class="bars">'+rows.map((r,i)=>'<div class="bar-col"><div class="bar-value">'+(r[key]?Number(r[key].toFixed(1)):'')+'</div><div class="bar-track"><div class="bar-fill" style="height:'+Math.max(r[key]?3:0,r[key]/max*100)+'%" title="'+Number(r[key].toFixed(1))+' '+unit+'"></div></div><div class="bar-label">'+new Date(r.date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})+'</div></div>').join('')+'</div>';}
function workoutRow(w,allowDelete=false){return '<div class="workout-row"><div class="type-icon">'+({Easy:'◌',Long:'↗',Tempo:'⚡',Intervals:'▥',Race:'★',Recovery:'♡'}[w.type]||'◌')+'</div><div class="workout-main"><strong>'+escapeHTML(w.type)+' run</strong><span>'+fmtDate(w.date)+(w.notes?' · '+escapeHTML(w.notes):'')+'</span></div><div class="workout-stat"><strong>'+w.distanceMiles.toFixed(2)+' mi</strong><span>'+formatTime(paceSeconds(w))+'/mi</span></div><div class="workout-stat time-stat"><strong>'+formatTime(w.durationSeconds)+'</strong><span>Duration</span></div>'+'<button class="details-btn" data-open="'+escapeHTML(w.id)+'">Details</button>'+(allowDelete?'<button class="delete-btn" data-delete="'+escapeHTML(w.id)+'" aria-label="Delete workout">✕</button>':'')+'</div>';}
function renderLists(){const rows=sorted();$('#recent-workouts').innerHTML=rows.length?rows.slice(0,5).map(w=>workoutRow(w)).join(''):'<div class="empty">No workouts yet. Log your first run to start tracking.</div>';const term=$('#search-workouts').value.toLowerCase();const type=$('#filter-type').value;const filtered=rows.filter(w=>(type==='all'||w.type===type)&&(w.type+' '+w.notes+' '+w.date).toLowerCase().includes(term));$('#workout-list').innerHTML=filtered.length?filtered.map(w=>workoutRow(w,true)).join(''):'<div class="empty">No matching workouts found.</div>';$('#workout-count').textContent=filtered.length+' activities';}
function renderBreakdown(){const counts={};workouts.forEach(w=>counts[w.type]=(counts[w.type]||0)+w.distanceMiles);const total=Object.values(counts).reduce((a,b)=>a+b,0);$('#type-breakdown').innerHTML=total?Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([type,miles])=>'<div class="breakdown-row"><div class="breakdown-label"><strong>'+escapeHTML(type)+'</strong><span>'+miles.toFixed(1)+' mi · '+Math.round(miles/total*100)+'%</span></div><div class="progress"><div style="width:'+(miles/total*100)+'%"></div></div></div>').join(''):'<div class="empty">Log workouts to see training distribution.</div>';}
function renderInsights(){const weeks=lastWeeks(workouts);renderBars($('#consistency-chart'),weeks,'activities','activities');const active=weeks.filter(w=>w.activities);const avg=active.length?active.reduce((s,w)=>s+w.miles,0)/active.length:0;const latest=weeks[weeks.length-1].miles;$('#insight-text').innerHTML='<p><strong>'+active.length+' of 8</strong> weeks include logged workouts.</p><p>Average mileage in active weeks: <strong>'+avg.toFixed(1)+' miles</strong>.</p><p>This week so far: <strong>'+latest.toFixed(1)+' miles</strong>.</p><p class="muted">Partial weeks and missing workouts affect trends. These are descriptive statistics, not training or medical advice.</p>';}
function renderPrediction(){try{const t=parseTime($('#reference-time').value);const d=Number($('#reference-distance').value);const target=Number($('#target-distance').value);const exponent=Number($('#riegel-exponent').value);const result=predictRace(t,d,target,exponent);$('#prediction-result').innerHTML='<div class="prediction-output"><span>ESTIMATED FINISH TIME</span><strong>'+formatTime(result)+'</strong><small>Formula baseline based on '+formatTime(t)+' reference performance. Not personalized to your training.</small></div>';$('#prediction-teaser').innerHTML='<div class="teaser-time">'+formatTime(predictRace(t,d,5000,exponent))+'</div><p>5K equivalent · based on a manually entered reference performance</p><span class="teaser-tag">FORMULA BASELINE</span>';}catch(e){$('#prediction-result').innerHTML='<p class="error">'+escapeHTML(e.message)+'</p>';$('#prediction-teaser').innerHTML='<div class="empty">Enter a valid reference race to estimate a 5K equivalent.</div>';}}
function render(){renderMetrics();renderBars($('#mileage-chart'),lastWeeks(workouts));renderLists();renderBreakdown();renderInsights();renderPrediction();$('#sample-banner').hidden=apiIsConnected()||!usingSample;$('#portfolio-ribbon').hidden=apiIsConnected()||!usingSample;syncMode();renderIntelligence();renderPerformance();renderAthleteStudio();}
function openDialog(){const d=new Date();$('#w-date').value=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');$('#form-error').textContent='';$('#workout-form').reset();$('#w-date').value=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');$('#workout-dialog').showModal();}
$$('[data-view]').forEach(el=>el.addEventListener('click',()=>nav(el.dataset.view)));$$('[data-nav]').forEach(el=>el.addEventListener('click',()=>nav(el.dataset.nav)));$$('[data-add]').forEach(el=>el.addEventListener('click',openDialog));$('#add-workout').addEventListener('click',openDialog);$('#close-dialog').addEventListener('click',()=>$('#workout-dialog').close());$('#menu-toggle').addEventListener('click',()=>{
  const opened=$('.sidebar').classList.toggle('open');
  $('#nav-backdrop').hidden=!opened;
  $('#menu-toggle').setAttribute('aria-expanded',String(opened));
  if(opened)$('.sidebar .nav-item.active')?.focus();
});
$('#nav-backdrop').addEventListener('click',()=>{closeMobileNav();$('#menu-toggle').focus();});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&$('.sidebar').classList.contains('open')){
    closeMobileNav();$('#menu-toggle').focus();
  }
});
window.addEventListener('resize',()=>{if(window.innerWidth>780)closeMobileNav();});$('#search-workouts').addEventListener('input',renderLists);$('#filter-type').addEventListener('change',renderLists);
$('#workout-form').addEventListener('submit',async e=>{e.preventDefault();try{const run=validateWorkout({date:$('#w-date').value,type:$('#w-type').value,distanceMiles:$('#w-distance').value,durationSeconds:parseTime($('#w-duration').value),notes:$('#w-notes').value});if(apiIsConnected()){await createRemoteWorkout(run);await refreshRemote();}else{realWorkouts();workouts.push(run);persist();}$('#workout-dialog').close();toast('Workout saved!');}catch(err){$('#form-error').textContent=err.message;}});
$('#workout-list').addEventListener('click',async e=>{const btn=e.target.closest('[data-delete]');if(!btn)return;if(!confirm('Delete this workout?'))return;try{if(apiIsConnected()){await deleteRemoteWorkout(btn.dataset.delete);await refreshRemote();}else{workouts=workouts.filter(w=>w.id!==btn.dataset.delete);persist();}toast('Workout deleted');}catch(err){toast('Delete failed: '+err.message);}});
$('#ml-form').addEventListener('submit',async event=>{event.preventDefault();const output=$('#ml-result');output.textContent='Checking configured model…';try{const data=await requestMLPrediction({eventMeters:Number($('#ml-event').value),weeklyMiles4w:Number($('#ml-mileage').value),averageEasyPaceSecondsPerMile:parseTime($('#ml-pace').value),hardSessions4w:Number($('#ml-hard').value),longestRunMiles:Number($('#ml-long').value)});output.innerHTML='<div class="prediction-output"><span>EXPERIMENTAL MODEL ESTIMATE</span><strong>'+formatTime(data.estimatedSeconds)+'</strong><small>Indicative interval: '+formatTime(data.lowerSeconds)+' – '+formatTime(data.upperSeconds)+'. '+(data.trainedOnSyntheticData?'WARNING: Synthetic demonstration data. ':'')+'Method: '+escapeHTML(data.method)+'. This is not a guaranteed calibrated forecast.</small></div>';}catch(err){output.innerHTML='<p class="error">'+escapeHTML(err.message)+'. The ML model must be trained and configured on your backend first.</p>';}});
$('#calculate-prediction').addEventListener('click',renderPrediction);['reference-time','reference-distance','target-distance','riegel-exponent'].forEach(id=>$('#'+id).addEventListener('change',renderPrediction));
$('#csv-input').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2*1024*1024)throw Error('CSV must be smaller than 2 MB.');const {workouts:incoming,errors}=parseCSV(await file.text());if(!incoming.length)throw Error('No valid workouts found. '+(errors[0]||''));if(!apiIsConnected()) realWorkouts();const keys=new Set(workouts.map(w=>w.date+'|'+w.type+'|'+w.distanceMiles+'|'+w.durationSeconds));let added=0;let failed=0;for(const w of incoming){const k=w.date+'|'+w.type+'|'+w.distanceMiles+'|'+w.durationSeconds;if(keys.has(k))continue;try{if(apiIsConnected()){await createRemoteWorkout(w);}else{workouts.push(w);}keys.add(k);added++;}catch(err){failed++;console.warn('Unable to import workout',err);}}if(apiIsConnected()){await refreshRemote();}else{persist();}toast('Imported '+added+' workouts.'+(errors.length+failed?' '+(errors.length+failed)+' rows skipped or failed.':''));if(errors.length)console.warn('CSV import issues:',errors);nav('workouts');}catch(err){toast('Import failed: '+err.message);}finally{e.target.value='';}});
$('#export-csv').addEventListener('click',()=>{const blob=new Blob([toCSV(workouts)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='pacelab-workouts.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);});
$('#export-local-json').addEventListener('click',()=>{
  if(apiIsConnected()||usingSample){toast('Create or import private local workouts before exporting a backup.');return;}
  const data={format:'pacelab-local-backup-v1',createdAt:new Date().toISOString(),workouts,
    containsSensorSamples:true,gpsCoordinatesStored:false};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='pacelab-private-local-backup.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
  toast('Full local backup exported. Store it privately: sensor and training records are sensitive.');
});
$('#restore-local-json').addEventListener('change',async event=>{
  const input=event.target,file=input.files?.[0];
  if(!file)return;
  try{
    if(apiIsConnected())throw Error('Sign out to restore a browser-only backup.');
    if(file.size>5*1024*1024)throw Error('Backup must be 5 MB or smaller.');
    const value=JSON.parse(await file.text());
    if(value?.format!=='pacelab-local-backup-v1'||!Array.isArray(value.workouts)||
      value.workouts.length>2000||!value.workouts.length)
      throw Error('Not a supported PaceLab local backup.');
    const safe=value.workouts.map(validateWorkout);
    if(!confirm('Replace all workouts stored in this browser with '+safe.length+' backup entries? Export your current data first.'))return;
    try{localStorage.setItem(KEY,JSON.stringify(safe));}
    catch{throw Error('Your browser does not have enough storage for this backup.');}
    workouts=safe;usingSample=false;render();toast('Restored '+safe.length+' local workouts.');
  }catch(err){toast('Restore failed: '+err.message);}
  finally{input.value='';}
});
$('#reset-data').addEventListener('click',()=>{if(apiIsConnected()){toast('Sign out before resetting local demo data.');return;}if(!confirm('Replace saved workouts with demo data? Export a backup first if needed.'))return;localStorage.removeItem(KEY);load();render();toast('Sample data restored');});
$('#dismiss-banner').addEventListener('click',()=>$('#sample-banner').hidden=true);
$('#account-button').addEventListener('click',showAccountDialog);
$('#close-account').addEventListener('click',()=>$('#account-dialog').close());
$('#close-settings').addEventListener('click',()=>$('#account-settings-dialog').close());
$('#download-account').addEventListener('click',async ()=>{
  try{await downloadAccountData();toast('Private account export downloaded. Store it securely.');}
  catch(err){toast('Export failed: '+err.message);}
});
$('#signout-account').addEventListener('click',async ()=>{
  const button=$('#signout-account');button.disabled=true;
  let revoked=true;
  try{await signOutEverywhere();}
  catch(err){revoked=false;logout();}
  finally{
    button.disabled=false;
    $('#account-settings-dialog').close();load();render();
    toast(revoked?'Signed out across all devices.':
      'Signed out in this browser; server revocation could not be verified. Other tokens expire within 60 minutes.');
  }
});
$('#change-password-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const button=$('#change-password-submit');
  const result=$('#change-password-result');
  const oldPassword=$('#change-current-password').value;
  const newPassword=$('#change-new-password').value;
  result.textContent='';
  button.disabled=true;
  try{
    if(newPassword.length<12)throw Error('New password must contain at least 12 characters.');
    await changeAccountPassword(oldPassword,newPassword);
    $('#change-password-form').reset();
    $('#account-settings-dialog').close();
    load();render();
    toast('Password changed. All devices have been signed out. Sign in again.');
  }catch(err){result.textContent=err.message;}finally{button.disabled=false;}
});
$('#delete-account-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const btn=$('#delete-account-submit');btn.disabled=true;
  $('#account-delete-result').textContent='';
  try{
    if(!confirm('Permanently delete this account, all workouts, GPS tracks and laps? This cannot be undone.'))return;
    await permanentlyDeleteAccount($('#delete-password').value);
    logout();$('#account-settings-dialog').close();load();render();
    toast('Account and server workout data permanently deleted.');
    $('#delete-password').value='';
  }catch(err){$('#account-delete-result').textContent=err.message;}finally{btn.disabled=false;}
});
$('#account-form').addEventListener('submit',async e=>{e.preventDefault();const btn=$('#account-submit');btn.disabled=true;$('#auth-error').textContent='';try{setApiBase($('#api-base').value);const action=$('input[name="auth-action"]:checked').value;await authenticate(action,$('#auth-email').value,$('#auth-password').value);try{await refreshRemote();}catch(err){logout();throw err;}$('#account-dialog').close();$('#auth-password').value='';toast('Connected to your private workout account.');}catch(err){$('#auth-error').textContent=err.message;}finally{btn.disabled=false;}});
initIntelligence({getWorkouts:()=>workouts,refreshRemote,toast,getUsingSample:()=>usingSample,addLocalActivity,updateLocalActivity});
initTour(nav);
initPerformance({getWorkouts:()=>workouts});
initAthleteStudio({getWorkouts:()=>workouts,getUsingSample:()=>usingSample,updateLocalActivity,refreshRemote,toast});
$('#demo-tour').addEventListener('click',()=>$('#tour-open').click());
load();render();
if(hasSavedSession())restoreSession().then(async user=>{if(user){try{await refreshRemote();toast('Account session restored.');}catch(err){logout();load();render();toast('Could not restore account data: '+err.message);}}}).catch(console.error);
