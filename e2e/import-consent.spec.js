import {test,expect} from '@playwright/test';

test('COROS import requires positive GPS disclosure acknowledgement',async({page})=>{
  let posts=0;
  await page.addInitScript(()=>{
    localStorage.setItem('pacelab.tour.v1','1');
    sessionStorage.setItem('pacelab.sessionToken.v1','synthetic-token');
  });
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url());
    const path=url.pathname;
    const json=obj=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(obj)});
    if(path==='/api/auth/me')return json({id:'fake-user',email:'runner@example.test'});
    if(path==='/api/workouts'&&route.request().method()==='GET')return json([]);
    if(path==='/api/activities/import'){
      posts++;
      return json({imported:true,workout:{id:'new',date:'2026-11-04',type:'Easy',
        distanceMiles:1,durationSeconds:500,notes:''}});
    }
    return route.fulfill({status:404,body:'Test API path was not mocked'});
  });
  await page.goto('/');
  await expect(page.locator('#account-button')).toContainText('runner@example.test');
  await page.locator('[data-view="workouts"]').click();
  const file={name:'synthetic.gpx',mimeType:'application/gpx+xml',
    buffer:Buffer.from('<gpx version="1.1"><trk></trk></gpx>')};
  await page.locator('#activity-files').setInputFiles(file);
  await expect(page.locator('#activity-import-consent')).toBeVisible();
  await expect(page.locator('#activity-import-accept')).toBeDisabled();
  await page.locator('#activity-import-cancel').click();
  await expect(page.locator('#activity-import-consent')).toBeHidden();
  expect(posts).toBe(0);
  await page.locator('#activity-files').setInputFiles(file);
  await page.locator('#activity-import-ack').check();
  await expect(page.locator('#activity-import-accept')).toBeEnabled();
  await page.locator('#activity-import-accept').click();
  await expect(page.locator('#fit-import-status')).toContainText('1 imported');
  expect(posts).toBe(1);
});
