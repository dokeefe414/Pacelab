import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const fixture=JSON.parse(await readFile(new URL('../fixtures/race-study-synthetic.json',import.meta.url))).map(w=>w.type==='Race'?{...w,raceResult:{name:'Synthetic test meet',eventMeters:Math.round(w.distanceMiles*1609.344),finishSeconds:w.durationSeconds,confirmed:true,sourceUrl:''}}:w);
async function open(page,workouts){
  await page.addInitScript(data=>{
    localStorage.setItem('pacelab.tour.v1','1');
    if(data!==null)localStorage.setItem('pacelab.workouts.v1',JSON.stringify(data));
  },workouts);
  await page.goto('/');await page.locator('[data-view="insights"]').click();
}
test('sample and empty workspaces report insufficient evidence without inventing forecasts',async({page})=>{
  await open(page,null);
  await expect(page.locator('#research-source')).toContainText('SYNTHETIC DEMO');
  await expect(page.locator('#research-summary')).toContainText('0 usable labeled races');
  await expect(page.locator('#research-chart')).toContainText('No forecasts');
  await page.evaluate(()=>localStorage.setItem('pacelab.workouts.v1','[]'));await page.reload();
  await page.locator('[data-view="insights"]').click();
  await expect(page.locator('#research-source')).toContainText('YOUR RECORDS');
  await expect(page.locator('#research-summary')).toContainText('0 records audited');
});
test('private workspace evaluation supports filters, evidence, paired metrics and downloads without API calls',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let requests=0;await page.route('**/api/**',route=>{requests++;return route.abort();});
  await open(page,fixture);
  await expect(page.locator('#research-summary')).toContainText('20 usable labeled races');
  await expect(page.locator('#research-chart svg')).toBeVisible();
  await page.locator('#research-event').selectOption('5000');
  await page.locator('#research-method').selectOption('rolling');
  await expect(page.locator('#research-races details')).toHaveCount(10);
  const last=page.locator('#research-races details').last();await last.locator('summary').click();
  await expect(last).toContainText('Reference races:');await expect(last).toContainText('Training window:');
  await expect(page.locator('#research-metrics')).toContainText('Δ MAE vs frozen');
  const jsonDownload=page.waitForEvent('download');await page.locator('#research-json').click();
  const json=await jsonDownload;const result=JSON.parse(await readFile(await json.path(),'utf8'));
  expect(result.rows).toHaveLength(20); // Full snapshot despite filtered display.
  expect(result.metrics.rolling.n).toBeGreaterThan(0);
  expect(result.protocol.version).toBe('real-races-v2');
  expect(JSON.stringify(result)).not.toContain('synthetic-race-');
  const mdDownload=page.waitForEvent('download');await page.locator('#research-markdown').click();
  const md=await mdDownload;expect(await readFile(await md.path(),'utf8')).toContain('Event-specific comparisons');
  expect(requests).toBe(0);expect(errors).toEqual([]);
});
test('research controls and disclosures work on a narrow mobile viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(data=>{localStorage.setItem('pacelab.tour.v1','1');localStorage.setItem('pacelab.workouts.v1',JSON.stringify(data));},fixture);
  await page.goto('/');await page.locator('#menu-toggle').click();await page.locator('[data-view="insights"]').click();
  await page.locator('#research-method').selectOption('expanding');
  await expect(page.locator('#research-chart svg')).toBeVisible();
  await page.getByText('Inspect data quality and exclusions',{exact:true}).click();
  await expect(page.locator('#research-audit')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('verification preserves device measurements and saved predictions survive reload',async({page})=>{
 await open(page,[{id:'race',date:'2025-01-01',type:'Easy',distanceMiles:5.01,durationSeconds:1700}]);
 await page.getByText('Verify official race results',{exact:true}).click();
 await page.locator('#verify-workout').selectOption('race');
 await page.locator('#official-name').fill('Test official meet');
 await page.locator('#official-time').fill('28:33.6');
 await page.locator('#official-confirmed').check();
 await page.locator('#save-official').click();
 await expect(page.locator('#research-summary')).toContainText('1 usable labeled races');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('pacelab.workouts.v1'))[0]);
 expect(saved.durationSeconds).toBe(1700);expect(saved.raceResult.finishSeconds).toBe(1713.6);
 await page.getByText('Save a prediction before your next race',{exact:true}).click();
 await page.locator('#forecast-name').fill('Future test meet');
 await page.locator('#forecast-date').fill('2099-01-01');await page.locator('#forecast-distance').selectOption('8000');
 await page.locator('#save-forecast').click();await expect(page.locator('#forecast-history')).toContainText('Future test meet');
 await page.locator('#save-forecast').click();await expect(page.locator('#forecast-message')).toContainText('already saved');
 await page.reload();await page.locator('[data-view="insights"]').click();
 await page.getByText('Save a prediction before your next race',{exact:true}).click();
 await expect(page.locator('#forecast-history details')).toHaveCount(1);
 await page.locator('#forecast-history summary').click();await expect(page.locator('#forecast-history')).toContainText('28:33.6');
});
