/**
 * Privacy-first static-site FIT/GPX/TCX importer.
 * No network calls. Original file bytes and GPS coordinates are discarded.
 * Only capped workout/sensor summaries are returned for browser-local storage.
 */
const MAX_BYTES=10*1024*1024;
const MAX_RECORDS=60000;
const TRACK_CAP=120;
const FIT_EPOCH=Date.UTC(1989,11,31)/1000;
const METERS_PER_MILE=1609.344;
function crc16(bytes,start,end){
  let crc=0;
  for(let i=start;i<end;i++){
    crc^=bytes[i];
    for(let bit=0;bit<8;bit++)crc=(crc>>1)^((crc&1)?0xa001:0);
  }
  return crc&65535;
}
function valueAt(view,offset,size,type,little){
  const base=type&31;
  const needed=([0,1,2,10,13].includes(base)?1:[3,4,11].includes(base)?2:[5,6,8,12].includes(base)?4:[9,14,15,16].includes(base)?8:0);
  if(!needed||size!==needed)return null;
  const uint=n=>n===1?view.getUint8(offset):n===2?view.getUint16(offset,little):view.getUint32(offset,little);
  const sint=n=>n===1?view.getInt8(offset):n===2?view.getInt16(offset,little):view.getInt32(offset,little);
  let result;
  if([0,2,4,6,10,11,12,13].includes(base))result=uint(needed);
  else if([1,3,5].includes(base))result=sint(needed);
  else if(base===8)result=view.getFloat32(offset,little);
  else if(base===9)result=view.getFloat64(offset,little);
  else return null;
  const invalid=base===0?255:[2,4,6].includes(base)?Math.pow(2,8*needed)-1:[1,3,5].includes(base)?Math.pow(2,8*needed-1)-1:null;
  if(result===invalid||([10,11,12,13].includes(base)&&result===0)||!Number.isFinite(result))return null;
  return result;
}
const finite=(n,min=-Infinity,max=Infinity)=>Number.isFinite(n)&&n>=min&&n<=max?n:null;
const meters=n=>finite(n,0,321868.8);
const bpm=n=>finite(n,30,230);
const elevation=n=>finite(n,-500,9000);
const timeStamp=secs=>finite(secs,0,4000000000);
const dayFromEpoch=secs=>{
  const d=new Date((FIT_EPOCH+secs)*1000);
  if(!Number.isFinite(d.getTime()))throw new Error('Invalid FIT timestamp');
  return d;
};
const localDate=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const downsample=(arr,cap=TRACK_CAP)=>{
  if(arr.length<=cap)return arr;
  const out=[];
  for(let i=0;i<cap;i++)out.push(arr[Math.round(i*(arr.length-1)/(cap-1))]);
  return out;
};
function normalize(session,records,laps,source){
  const valid=records.filter(p=>Number.isFinite(p.timestamp));
  const start=timeStamp(session.startTimestamp)??valid[0]?.timestamp;
  if(start===null||start===undefined)throw new Error('Activity has no usable start time');
  const last=valid.at(-1)?.timestamp;
  const elapsed=finite(session.elapsedSeconds,1,86400)??(last===undefined?null:finite(last-start,1,86400));
  const duration=finite(session.durationSeconds,1,86400)??elapsed;
  let distance=meters(session.distanceMeters);
  if(distance===null){
    const readings=valid.map(p=>p.distanceMeters).filter(x=>x!==null&&Number.isFinite(x));
    if(readings.length>=2)distance=meters(Math.max(...readings)-Math.min(...readings));
  }
  if(duration===null||distance===null||distance<10)throw new Error('Missing valid time or distance in activity');
  const distMiles=distance/METERS_PER_MILE;
  if(distMiles<=0||distMiles>200)throw new Error('Workout distance outside supported range');
  const heartRates=valid.map(p=>p.heartRate).filter(x=>x!==null&&Number.isFinite(x));
  const cadences=valid.map(p=>p.cadenceSpm).filter(x=>x!==null&&Number.isFinite(x));
  const powers=valid.map(p=>p.powerWatts).filter(x=>x!==null&&Number.isFinite(x));
  const avg=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
  const altitude=valid.map(p=>p.elevationMeters).filter(x=>x!==null&&Number.isFinite(x));
  let ascent=0,descent=0;
  for(let i=1;i<altitude.length;i++){
    const diff=altitude[i]-altitude[i-1];
    if(Math.abs(diff)<60){if(diff>0)ascent+=diff;else descent-=diff;}
  }
  const cleanLaps=laps.filter(l=>finite(l.distanceMeters,1,321868.8)!==null&&
    finite(l.durationSeconds,1,86400)!==null).slice(0,300).map((l,i)=>({
      number:i+1,distanceMiles:Number((l.distanceMeters/METERS_PER_MILE).toFixed(4)),
      durationSeconds:Math.round(l.durationSeconds),source:'device_lap'
    }));
  // No latitude/longitude is ever placed in a saved browser-local track.
  const trace=downsample(valid.map(p=>({
    elapsed:Math.max(0,Math.round(p.timestamp-start)),
    distanceMiles:p.distanceMeters===null?null:Number((p.distanceMeters/METERS_PER_MILE).toFixed(5)),
    heartRate:p.heartRate,cadenceSpm:p.cadenceSpm,powerWatts:p.powerWatts,
    elevationMeters:p.elevationMeters
  })).filter(p=>p.elapsed>=0&&p.elapsed<=86400));
  const startDate=dayFromEpoch(start);
  return {
    date:localDate(startDate),type:'Easy',
    distanceMiles:Number(distMiles.toFixed(5)),durationSeconds:Math.round(duration),
    elapsedSeconds:Math.round(Math.max(elapsed??duration,duration)),
    startTime:startDate.toISOString(),source,
    avgHeartRate:bpm(session.avgHeartRate)??(avg(heartRates)===null?null:Math.round(avg(heartRates))),
    maxHeartRate:bpm(session.maxHeartRate)??(heartRates.length?Math.max(...heartRates):null),
    avgCadenceSpm:finite(session.avgCadenceSpm,0,260)??(avg(cadences)===null?null:Math.round(avg(cadences))),
    avgPowerWatts:finite(session.avgPowerWatts,0,2500)??(avg(powers)===null?null:Math.round(avg(powers))),
    elevationGainMeters:finite(session.ascentMeters,0,9000)??(altitude.length?Number(ascent.toFixed(1)):null),
    elevationLossMeters:finite(session.descentMeters,0,9000)??(altitude.length?Number(descent.toFixed(1)):null),
    laps:cleanLaps,track:trace,
    notes:'Imported locally from '+source.toUpperCase()+' (no GPS coordinates stored)',
  };
}
export function parseFit(buffer){
  const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);
  if(bytes.length<14||bytes.length>MAX_BYTES)throw new Error('FIT file is missing or too large');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const header=bytes[0];
  if(header<12||header>64||header>bytes.length)throw new Error('Unsupported FIT header');
  if(String.fromCharCode(...bytes.slice(8,12))!=='.FIT')throw new Error('Not a FIT activity');
  const length=view.getUint32(4,true),end=header+length;
  if(end+2>bytes.length)throw new Error('Truncated FIT data');
  if(header>12){
    const given=view.getUint16(header-2,true);
    if(given!==0&&crc16(bytes,0,header-2)!==given)throw new Error('FIT header checksum failed');
  }
  const given=view.getUint16(end,true);
  if(given!==0&&crc16(bytes,0,end)!==given)throw new Error('FIT checksum failed');
  const definitions=Array(16).fill(null);
  let offset=header,lastTimestamp=null;
  let session=null;const records=[],laps=[];
  while(offset<end){
    const marker=bytes[offset++];
    let local,compressed=null;
    if(marker&128){local=(marker>>5)&3;compressed=marker&31;}
    else local=marker&15;
    if(compressed===null&&(marker&64)){
      if(offset+5>end)throw new Error('Truncated FIT definition');
      const little=bytes[offset+1]===0;
      const number=view.getUint16(offset+2,little);
      const count=bytes[offset+4];offset+=5;
      if(offset+count*3>end)throw new Error('Truncated FIT definition fields');
      const fields=[];
      for(let i=0;i<count;i++){
        fields.push({num:bytes[offset],size:bytes[offset+1],type:bytes[offset+2]});offset+=3;
      }
      if(marker&32){
        if(offset>=end)throw new Error('Truncated developer definition');
        const developers=bytes[offset++];
        if(offset+developers*3>end)throw new Error('Truncated developer fields');
        for(let i=0;i<developers;i++)fields.push({num:null,size:bytes[offset+1],type:null}),offset+=3;
      }
      definitions[local]={little,number,fields};
      continue;
    }
    const def=definitions[local];
    if(!def)throw new Error('FIT data refers to missing message definition');
    const fields={};
    for(const f of def.fields){
      if(offset+f.size>end)throw new Error('Truncated FIT data record');
      if(f.num!==null)fields[f.num]=valueAt(view,offset,f.size,f.type,def.little);
      offset+=f.size;
    }
    if(fields[253]!==null&&Number.isFinite(fields[253]))lastTimestamp=fields[253];
    else if(compressed!==null&&lastTimestamp!==null){
      const candidate=(lastTimestamp&~31)|compressed;
      lastTimestamp=candidate<lastTimestamp?candidate+32:candidate;
      fields[253]=lastTimestamp;
    }
    if(def.number===20){
      if(records.length>=MAX_RECORDS)throw new Error('FIT file contains too many records');
      records.push({
        timestamp:timeStamp(fields[253]),
        distanceMeters:meters(fields[5]===null?null:fields[5]/100),
        heartRate:bpm(fields[3]),
        cadenceSpm:fields[4]===null?null:finite(fields[4]*2,0,260),
        powerWatts:finite(fields[7],0,2500),
        elevationMeters:elevation(fields[73]==null?
          fields[2]==null?null:fields[2]/5-500:fields[73]/5-500),
      });
    }else if(def.number===19){
      laps.push({distanceMeters:fields[9]===null?null:fields[9]/100,
        durationSeconds:fields[8]===null?fields[7]===null?null:fields[7]/1000:fields[8]/1000});
    }else if(def.number===18){
      session={
        startTimestamp:timeStamp(fields[2]),sport:fields[5],
        elapsedSeconds:fields[7]===null?null:fields[7]/1000,
        durationSeconds:fields[8]===null?null:fields[8]/1000,
        distanceMeters:fields[9]===null?null:fields[9]/100,
        avgHeartRate:bpm(fields[16]),maxHeartRate:bpm(fields[17]),
        avgCadenceSpm:fields[18]===null?null:fields[18]*2,
        avgPowerWatts:fields[20],ascentMeters:fields[22],descentMeters:fields[23],
      };
    }
  }
  if(!session)throw new Error('FIT file has no session summary');
  if(session.sport!==null&&session.sport!==undefined&&session.sport!==1)throw new Error('Only running FIT activities are supported');
  return normalize(session,records,laps,'fit');
}
function xmlNodes(parent,name){
  return [...parent.getElementsByTagName('*')].filter(el=>el.localName===name);
}
function xmlText(parent,name){
  return xmlNodes(parent,name).find(el=>el.textContent?.trim())?.textContent?.trim()??null;
}
function parseXML(input){
  if(/<!\s*(DOCTYPE|ENTITY)/i.test(input))throw new Error('XML document type or entity not allowed');
  if(typeof DOMParser==='undefined')throw new Error('XML parsing requires a browser');
  const doc=new DOMParser().parseFromString(input,'application/xml');
  if(xmlNodes(doc,'parsererror').length||doc.documentElement?.localName==='parsererror')throw new Error('Invalid XML activity');
  return doc;
}
function haversine(lat1,lon1,lat2,lon2){
  const rad=Math.PI/180,dLat=(lat2-lat1)*rad,dLon=(lon2-lon1)*rad;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dLon/2)**2;
  return 6371000*2*Math.asin(Math.min(1,Math.sqrt(a)));
}
function xmlPoints(items,kind){
  let traveled=0,previous=null;
  return items.map(el=>{
    const time=Date.parse(xmlText(el,kind==='gpx'?'time':'Time')??'');
    if(!Number.isFinite(time))return null;
    let lat,lon;
    if(kind==='gpx'){lat=Number(el.getAttribute('lat'));lon=Number(el.getAttribute('lon'));}
    else{lat=Number(xmlText(el,'LatitudeDegrees'));lon=Number(xmlText(el,'LongitudeDegrees'));}
    const validGPS=Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180&&
      (kind==='gpx'||xmlText(el,'LatitudeDegrees')!==null);
    if(validGPS){
      if(previous){
        const gap=(time-previous.time)/1000;
        if(gap>0&&gap<=600){
          const jump=haversine(previous.lat,previous.lon,lat,lon);
          if(jump/gap<=11)traveled+=jump;
        }
      }
      previous={lat,lon,time};
    }
    const rawDistance=xmlText(el,'DistanceMeters');
    const distance=rawDistance===null?traveled:meters(Number(rawDistance));
    const rawHR=xmlText(el,kind==='gpx'?'hr':'Value');
    const hr=rawHR===null?null:bpm(Number(rawHR));
    const altitude=xmlText(el,kind==='gpx'?'ele':'AltitudeMeters');
    return {timestamp:time/1000-FIT_EPOCH,distanceMeters:distance,
      heartRate:hr,cadenceSpm:null,powerWatts:null,
      elevationMeters:altitude===null?null:elevation(Number(altitude))};
  }).filter(Boolean);
}
export function parseGpx(text){
  const doc=parseXML(text);
  if(doc.documentElement?.localName?.toLowerCase()!=='gpx')throw new Error('Not a GPX file');
  const items=xmlNodes(doc,'trkpt');
  if(items.length>MAX_RECORDS)throw new Error('Too many GPX trackpoints');
  const points=xmlPoints(items,'gpx');
  return normalize({startTimestamp:points[0]?.timestamp,
    distanceMeters:points.at(-1)?.distanceMeters},points,[],'gpx');
}
export function parseTcx(text){
  const doc=parseXML(text);
  if(doc.documentElement?.localName!=='TrainingCenterDatabase')throw new Error('Not a TCX activity');
  const activities=xmlNodes(doc,'Activity');
  if(!activities.length)throw new Error('TCX contains no activities');
  const activity=activities[0];
  const sport=activity.getAttribute('Sport');
  if(sport&&sport.toLowerCase()!=='running')throw new Error('Only running TCX activities are supported');
  const items=xmlNodes(activity,'Trackpoint');
  if(items.length>MAX_RECORDS)throw new Error('Too many TCX trackpoints');
  const points=xmlPoints(items,'tcx');
  const laps=xmlNodes(activity,'Lap').map(el=>({
    durationSeconds:Number(xmlText(el,'TotalTimeSeconds')),
    distanceMeters:Number(xmlText(el,'DistanceMeters')),
  }));
  const duration=laps.reduce((s,l)=>s+(finite(l.durationSeconds,1,86400)??0),0);
  const distance=laps.reduce((s,l)=>s+(finite(l.distanceMeters,1,321868.8)??0),0);
  return normalize({startTimestamp:points[0]?.timestamp,
    durationSeconds:duration||null,
    distanceMeters:distance||points.at(-1)?.distanceMeters},points,laps,'tcx');
}
export async function parseLocalActivity(file){
  if(!file||!Number.isFinite(file.size)||file.size<1||file.size>MAX_BYTES)
    throw new Error('Activity must be nonempty and at most 10 MB');
  const ext=(file.name.toLowerCase().match(/\.(fit|gpx|tcx)$/)||[])[1];
  if(!ext)throw new Error('Select one .fit, .gpx or .tcx file (ZIP requires a private server)');
  const buffer=await file.arrayBuffer();
  const activity=ext==='fit'?parseFit(buffer):
    ext==='gpx'?parseGpx(new TextDecoder().decode(buffer)):parseTcx(new TextDecoder().decode(buffer));
  if(typeof crypto==='undefined'||!crypto.subtle)
    throw new Error('Secure browser context required to calculate file fingerprint');
  const digest=await crypto.subtle.digest('SHA-256',buffer);
  activity.sourceHash=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
  return activity;
}
