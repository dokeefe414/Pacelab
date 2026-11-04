/**
 * Accessible, dismissible first-run tour. Uses localStorage only.
 * This is a static-demo guide: backend-dependent features are labeled.
 */
const KEY = 'pacelab.tour.v1';
const STEPS = [
  {title:'Welcome to PaceLab',eyebrow:'01 / 04 · THE DASHBOARD',
   message:'Explore a realistic sample training log, weekly mileage and pace patterns. Demo workouts are synthetic; no athlete data is being represented as real.',
   action:'Next: workout data'},
  {title:'Make the data yours',eyebrow:'02 / 04 · YOUR TRAINING',
   message:'Log a workout or import CSV directly in your browser. Sign in to your own PaceLab API to upload exported COROS FIT/GPX/TCX data and save rich activity history.',
   action:'Next: predictions'},
  {title:'Understand, then predict',eyebrow:'03 / 04 · THE MODELS',
   message:'Riegel race equivalents work without a model. The real-data machine-learning lab remains experimental until an independently evaluated model is supplied.',
   action:'Next: the assistant'},
  {title:'Ask questions of your workouts',eyebrow:'04 / 04 · INSIGHTS',
   message:'The assistant can explain data-backed mileage, training mix and trends locally. Signed-in mode can use your private account; optional external AI must be configured on the server.',
   action:'Explore PaceLab'},
];
let index=0;
const $=selector=>document.querySelector(selector);
export function initTour(navigate){
  const dialog=$('#tour-dialog'),next=$('#tour-next'),previous=$('#tour-back');
  const render=()=>{
    const step=STEPS[index];
    $('#tour-eyebrow').textContent=step.eyebrow;
    $('#tour-title').textContent=step.title;
    $('#tour-message').textContent=step.message;
    $('#tour-progress').textContent=(index+1)+' / '+STEPS.length;
    next.textContent=step.action;
    previous.disabled=index===0;
  };
  const close=()=>{localStorage.setItem(KEY,'1');dialog.close();};
  $('#tour-open').addEventListener('click',()=>{index=0;render();dialog.showModal();});
  $('#tour-skip').addEventListener('click',close);
  $('#tour-close').addEventListener('click',close);
  previous.addEventListener('click',()=>{index=Math.max(0,index-1);render();});
  next.addEventListener('click',()=>{
    if(index<STEPS.length-1){index++;render();return;}
    close();navigate('dashboard');
  });
  dialog.addEventListener('cancel',()=>localStorage.setItem(KEY,'1'));
  if(!localStorage.getItem(KEY)){
    index=0;render();dialog.showModal();
  }
}
