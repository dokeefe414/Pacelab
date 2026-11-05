import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseFit} from '../src/local-import.js';
import {validateWorkout} from '../src/core.js';

const FIT_EPOCH=Date.UTC(1989,11,31)/1000;

function crc(bytes){
  let n=0;for(const b of bytes){n^=b;for(let i=0;i<8;i++)n=(n>>1)^((n&1)?0xa001:0);}
  return n&65535;
}
function definition(local,global,fields){
  const value=Buffer.alloc(6+fields.length*3);
  value[0]=0x40|local;value[1]=0;value[2]=0;
  value.writeUInt16LE(global,3);value[5]=fields.length;
  fields.forEach(([number,size,base],i)=>{value[6+i*3]=number;value[7+i*3]=size;value[8+i*3]=base;});
  return value;
}
function data(local,fields,values){
  const byteLength=fields.reduce((sum,[,size])=>sum+size,0);
  const b=Buffer.alloc(1+byteLength);b[0]=local;let offset=1;
  fields.forEach(([,size,base],i)=>{
    if(size===1)b.writeUInt8(values[i],offset);
    else if(size===2)b.writeUInt16LE(values[i],offset);
    else if(size===4)b.writeUInt32LE(values[i],offset);
    else throw Error('test only supports scalar integer fields');
    offset+=size;
  });
  return b;
}
function fixture(){
  const start=Math.round(Date.parse('2025-06-01T12:00:00Z')/1000-FIT_EPOCH);
  const record=[[253,4,0x86],[5,4,0x86],[3,1,0x02],[4,1,0x02],[7,2,0x84],[2,2,0x84]];
  const lap=[[9,4,0x86],[8,4,0x86]];
  const session=[[2,4,0x86],[7,4,0x86],[8,4,0x86],[9,4,0x86],
    [5,1,0x00],[16,1,0x02],[17,1,0x02],[18,1,0x02],
    [20,2,0x84],[22,2,0x84],[23,2,0x84]];
  const body=Buffer.concat([
    definition(0,20,record),definition(1,19,lap),definition(2,18,session),
    data(0,record,[start,0,255,80,190,3000]),
    data(0,record,[start+300,100000,150,82,250,3010]),
    data(0,record,[start+720,200000,160,85,270,3020]),
    data(1,lap,[100000,300000]),data(1,lap,[100000,300000]),
    data(2,session,[start,720000,600000,200000,1,155,171,82,255,15,10]),
  ]);
  const header=Buffer.alloc(14);header[0]=14;header[1]=0x20;header.writeUInt16LE(2100,2);
  header.writeUInt32LE(body.length,4);header.write('.FIT',8,4);
  header.writeUInt16LE(crc(header.subarray(0,12)),12);
  const prefix=Buffer.concat([header,body]);
  const footer=Buffer.alloc(2);footer.writeUInt16LE(crc(prefix));
  return Buffer.concat([prefix,footer]);
}
test('browser FIT parser preserves session timer, elapsed time, laps and sensors',()=>{
  const parsed=parseFit(fixture());
  assert.equal(parsed.source,'fit');
  assert.equal(parsed.durationSeconds,600);
  assert.equal(parsed.elapsedSeconds,720);
  assert.ok(Math.abs(parsed.distanceMiles-1.24274)<.001);
  assert.equal(parsed.avgHeartRate,155);
  assert.equal(parsed.maxHeartRate,171);
  assert.equal(parsed.avgCadenceSpm,164);
  assert.equal(parsed.avgPowerWatts,255);
  assert.equal(parsed.elevationGainMeters,15);
  assert.equal(parsed.laps.length,2);
  assert.equal(parsed.track[0].heartRate,null);
  assert.equal(parsed.track[1].cadenceSpm,164);
  assert.equal(parsed.track[2].powerWatts,270);
  assert.ok(!Object.hasOwn(parsed.track[0],'lat'));
  assert.ok(!Object.hasOwn(parsed.track[0],'lon'));
});
test('FIT rejects corrupted checksum and truncated data',()=>{
  const bad=fixture();bad[28]^=7;
  assert.throws(()=>parseFit(bad),/checksum/);
  assert.throws(()=>parseFit(Buffer.from('.FIT')),/too large|missing|header/);
  assert.throws(()=>parseFit(fixture().subarray(0,40)),/Truncated FIT/);
});
test('local persistence strips latitude and longitude, bounds sensor points',()=>{
  const parsed=parseFit(fixture());
  parsed.sourceHash='a'.repeat(64);
  parsed.track=[...Array(200)].map((_,i)=>({...parsed.track[0],lat:41,lon:-75,elapsed:i}));
  const saved=validateWorkout(parsed);
  assert.equal(saved.track.length,120);
  assert.ok(saved.track.every(p=>!('lat' in p)&&!('lon' in p)));
  assert.equal(saved.sourceHash,'a'.repeat(64));
  assert.equal(saved.elapsedSeconds,720);
});
