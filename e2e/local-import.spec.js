import {test,expect} from '@playwright/test';

const gpx=`<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="synthetic-test">
<trk><trkseg>
<trkpt lat="40.00000" lon="-75.00000"><ele>120</ele><time>2026-10-25T12:00:00Z</time>
<extensions><hr>130</hr></extensions></trkpt>
<trkpt lat="40.00070" lon="-75.00000"><ele>121</ele><time>2026-10-25T12:01:00Z</time>
<extensions><hr>143</hr></extensions></trkpt>
<trkpt lat="40.00140" lon="-75.00000"><ele>124</ele><time>2026-10-25T12:02:00Z</time>
<extensions><hr>151</hr></extensions></trkpt>
</trkseg></trk></gpx>`;

test('public static demo imports GPX locally without calling an API',async({page})=>{
  let networkCalls=0;
  await page.route('**/api/**',route=>{networkCalls++;return route.abort();});
  await page.addInitScript(()=>{
    localStorage.setItem('pacelab.tour.v1','1');
    localStorage.removeItem('pacelab.workouts.v1');
  });
  await page.goto('/');
  await page.locator('[data-view="workouts"]').click();
  const input=page.locator('#activity-files');
  const file={name:'synthetic-run.gpx',mimeType:'application/gpx+xml',buffer:Buffer.from(gpx)};
  await input.setInputFiles(file);
  await expect(page.locator('#activity-import-consent')).toBeVisible();
  await expect(page.locator('#activity-import-privacy')).toContainText('entirely inside your browser');
  await expect(page.locator('#activity-import-accept')).toBeDisabled();
  await page.locator('#activity-import-ack').check();
  await page.locator('#activity-import-accept').click();
  await expect(page.locator('#fit-import-status')).toContainText('1 imported');
  await expect(page.locator('#workout-list .workout-row')).toHaveCount(1);
  const storage=await page.evaluate(()=>JSON.parse(localStorage.getItem('pacelab.workouts.v1')));
  expect(storage).toHaveLength(1);
  expect(storage[0].source).toBe('gpx');
  expect(storage[0].avgHeartRate).toBeGreaterThan(130);
  expect(storage[0].track).toHaveLength(3);
  expect(JSON.stringify(storage[0].track)).not.toContain('lat');
  expect(JSON.stringify(storage[0].track)).not.toContain('lon');
  expect(networkCalls).toBe(0);
  await input.setInputFiles(file);
  await page.locator('#activity-import-ack').check();
  await page.locator('#activity-import-accept').click();
  await expect(page.locator('#fit-import-status')).toContainText('1 duplicates');
  await page.reload();
  await page.locator('[data-view="workouts"]').click();
  await expect(page.locator('#workout-list .workout-row')).toHaveCount(1);
  await page.locator('#workout-list [data-open]').first().click();
  await expect(page.locator('#activity-detail')).toContainText('Heart rate');
  await page.locator('#detail-type').selectOption('Race');
  await page.locator('#save-detail').click();
  await expect(page.locator('#activity-dialog')).toBeHidden();
  await page.reload();
  const savedType=await page.evaluate(()=>JSON.parse(localStorage.getItem('pacelab.workouts.v1'))[0].type);
  expect(savedType).toBe('Race');
  expect(networkCalls).toBe(0);
});

test('local ZIP imports are declined without an untrusted decompressor',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('pacelab.tour.v1','1'));
  await page.goto('/');
  await page.locator('[data-view="workouts"]').click();
  await page.locator('#activity-files').setInputFiles({
    name:'fake.zip',mimeType:'application/zip',buffer:Buffer.from('not an archive')
  });
  await page.locator('#activity-import-ack').check();
  await page.locator('#activity-import-accept').click();
  await expect(page.locator('#fit-import-status')).toContainText('ZIP requires a private server');
});
