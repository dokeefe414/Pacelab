/** Official results are separate from immutable device measurements. */
export const OFFICIAL_EVENTS=[800,1609.344,3000,5000,8000,10000];
export function validateRaceResult(value){
  if(value==null)return null;
  const {name,eventMeters,finishSeconds,confirmed,sourceUrl=''}=value;
  if(typeof name!=='string'||!name.trim()||name.trim().length>160)throw Error('Enter a race name (up to 160 characters).');
  if(!OFFICIAL_EVENTS.includes(eventMeters))throw Error('Choose a supported official distance.');
  if(typeof finishSeconds!=='number'||!Number.isFinite(finishSeconds)||finishSeconds<=0||finishSeconds>86400)throw Error('Enter a valid official finish time.');
  if(typeof confirmed!=='boolean')throw Error('Race confirmation must be true or false.');
  if(typeof sourceUrl!=='string'||sourceUrl.length>2000)throw Error('Invalid results URL.');
  if(sourceUrl){let url;try{url=new URL(sourceUrl);}catch{throw Error('Enter an HTTP(S) results URL.');}
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Enter an HTTP(S) results URL without credentials.');}
  return {name:name.trim(),eventMeters,finishSeconds,confirmed,sourceUrl};
}
export function parseOfficialTime(text){
  if(!/^\d+:\d{2}(?:\.\d{1,3})?$/.test(text))throw Error('Use minutes:seconds, optionally with decimals (28:33.6).');
  const [m,s]=text.split(':').map(Number);
  if(s>=60||m*60+s<=0||m*60+s>86400)throw Error('Enter a valid finish time.');
  return m*60+s;
}
export function officialTime(seconds){
  const ms=Math.round(seconds*1000);return Math.floor(ms/60000)+':'+(ms%60000/1000).toFixed(3).padStart(6,'0').replace(/0+$/,'').replace(/\.$/,'');
}
