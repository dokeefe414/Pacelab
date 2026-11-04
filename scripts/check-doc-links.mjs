/**
 * Offline documentation link integrity check.
 *
 * No external network requests: this validates only local Markdown links.
 * GitHub links / external sources are maintained separately.
 */
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';

const markdown=[
  'README.md','CHANGELOG.md','SECURITY.md','CONTRIBUTING.md',
  'deploy/README.md',
  ...readdirSync('docs').filter(name=>name.endsWith('.md')).map(name=>'docs/'+name),
];
let count=0;
const failures=[];
for(const file of markdown){
  if(!existsSync(file)){failures.push('Missing Markdown file: '+file);continue;}
  const content=readFileSync(file,'utf8');
  for(const match of content.matchAll(/!?\[[^\]]+\]\(([^)]+)\)/g)){
    const target=match[1].trim().split(/\s+"/)[0].split('#')[0];
    if(!target||/^(?:https?:|mailto:|tel:|data:|#)/.test(target))continue;
    const resolved=resolve(dirname(file),decodeURIComponent(target));
    count++;
    if(!existsSync(resolved))failures.push(file+' → '+target);
  }
}
if(failures.length){
  console.error('Broken documentation references:\n'+failures.map(f=>'  '+f).join('\n'));
  process.exitCode=1;
}else{
  console.log('Validated '+count+' local links across '+markdown.length+' Markdown files.');
}
