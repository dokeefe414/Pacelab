import {test,expect} from '@playwright/test';

const activity={
  id:'synthetic-activity-1',date:'2026-11-03',type:'Easy',
  distanceMiles:4,durationSeconds:1800,elapsedSeconds:1950,
  notes:'Browser test run',source:'fit',avgHeartRate:150,
  maxHeartRate:174,avgCadenceSpm:164,avgPowerWatts:240,
  elevationGainMeters:32,elevationLossMeters:25,
  laps:[{number:1,distanceMiles:1,durationSeconds:440,source:'device_lap'},
        {number:2,distanceMiles:.5,durationSeconds:230,source:'device_lap'}],
  track:[
    {elapsed:0,distanceMiles:0,heartRate:135,cadenceSpm:160,powerWatts:230,elevationMeters:120,lat:0,lon:0},
    {elapsed:3,distanceMiles:.006,heartRate:145,cadenceSpm:164,powerWatts:250,elevationMeters:121,lat:.0001,lon:0},
    {elapsed:6,distanceMiles:.012,heartRate:165,cadenceSpm:170,powerWatts:255,elevationMeters:122,lat:.0002,lon:0}
  ]
};

test('signed-in activity details and assistant evidence use actual response fields',async({page})=>{
  await page.addInitScript(()=>{
    sessionStorage.setItem('pacelab.sessionToken.v1','synthetic-test-token');
    localStorage.setItem('pacelab.tour.v1','1');
  });
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url());
    const path=url.pathname;
    const json=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    if(path==='/api/auth/me')return json({id:'synthetic-user',email:'runner@example.test'});
    if(path==='/api/workouts'&&route.request().method()==='GET')return json([activity]);
    if(path==='/api/workouts/'+activity.id)return json(activity);
    if(path==='/api/assistant/ask')return json({
      answer:'You logged 4 miles. This is based on your recorded activity.',
      engine:'verified-statistics',asOf:'2026-11-04',
      supportingWorkouts:[{id:activity.id,date:activity.date,type:activity.type,
        distanceMiles:4,durationSeconds:1800}],
      disclaimer:'Based on logged workouts, not medical advice'
    });
    return route.fulfill({status:404,body:'Not mocked'});
  });
  await page.goto('/');
  await expect(page.locator('#account-button')).toContainText('runner@example.test');
  await page.locator('[data-view="workouts"]').click();
  await page.locator('[data-open="'+activity.id+'"]').first().click();
  await expect(page.locator('#activity-dialog')).toBeVisible();
  await expect(page.locator('#activity-detail')).toContainText('Timer');
  await expect(page.locator('#activity-detail')).toContainText('Elapsed');
  await expect(page.locator('#activity-detail')).toContainText('Cadence');
  await expect(page.locator('#activity-detail')).toContainText('Heart-rate distribution');
  await expect(page.locator('#activity-detail')).toContainText('Normalized split pace');
  await page.locator('#close-activity').click();
  await page.locator('[data-view="assistant"]').click();
  await page.locator('#assistant-question').fill('How many miles have I logged?');
  await page.locator('#assistant-submit').click();
  await expect(page.locator('#assistant-answer')).toContainText('You logged 4 miles');
  await expect(page.locator('.evidence-run')).toHaveCount(1);
  await expect(page.locator('.evidence-run')).toContainText('4.00 mi');
});
