#!/usr/bin/env node
/** Offline CLI. Input is one athlete's PaceLab local/account JSON backup. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {evaluateRaces,reportMarkdown,validDay} from '../src/race-evaluation.js';
const args=process.argv.slice(2);
if(args.length!==8||!['--input','--output-dir','--as-of','--source'].every(k=>args.includes(k))){
  console.error('Usage: node scripts/evaluate-races.mjs --input backup.json --output-dir private-results --as-of YYYY-MM-DD --source real|synthetic');process.exit(1);
}
const opts=Object.fromEntries(Array.from({length:4},(_,i)=>[args[i*2],args[i*2+1]]));
try{
  if(!validDay(opts['--as-of']))throw Error('Invalid cutoff date');
  const input=resolve(opts['--input']),out=resolve(opts['--output-dir']);
  if([join(out,'race-evaluation.json'),join(out,'race-report.md')].includes(input))throw Error('Output must not overwrite input');
  const bytes=await readFile(input),payload=JSON.parse(bytes);
  if(!Array.isArray(payload)&&!['pacelab-account-export-v1','pacelab-local-backup-v1'].includes(payload.format))
    throw Error('Expected a PaceLab backup or a one-athlete workout array');
  const report=evaluateRaces(Array.isArray(payload)?payload:payload.workouts,{asOf:opts['--as-of'],source:opts['--source']});
  report.inputSha256=createHash('sha256').update(bytes).digest('hex');
  await mkdir(out,{recursive:true,mode:0o700});
  await writeFile(join(out,'race-evaluation.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
  await writeFile(join(out,'race-report.md'),reportMarkdown(report)+'\nInput SHA-256: '+report.inputSha256+'\n',{mode:0o600});
  console.log(`Audit: ${report.audit.total} records; ${report.audit.excluded} excluded; ${report.audit.raceCount} labeled races. Status: ${report.status}. Private reports written.`);
}catch(error){console.error(error.message);process.exitCode=1;}
