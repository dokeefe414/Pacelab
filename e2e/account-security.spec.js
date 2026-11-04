import {test,expect} from '@playwright/test';

async function authenticatedPage(page){
  await page.addInitScript(()=>{
    localStorage.setItem('pacelab.tour.v1','1');
    sessionStorage.setItem('pacelab.sessionToken.v1','test-session-token');
    sessionStorage.setItem('pacelab.sessionApiBase.v1','/api');
  });
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/auth/me'){
      return route.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify({id:'fake-user',email:'test-runner@example.test'})});
    }
    if(path==='/api/workouts'&&route.request().method()==='GET'){
      return route.fulfill({status:200,contentType:'application/json',body:'[]'});
    }
    if(path==='/api/auth/logout'||path==='/api/account/password'){
      return route.fulfill({status:204,body:''});
    }
    return route.fulfill({status:404,body:'Unmocked API path'});
  });
  await page.goto('/');
  await expect(page.locator('#account-button')).toContainText('test-runner@example.test');
}

test('changing account password revokes browser session on success',async({page})=>{
  await authenticatedPage(page);
  await page.locator('#account-button').click();
  await expect(page.locator('#account-settings-dialog')).toBeVisible();
  await page.locator('#change-current-password').fill('old-but-secret-password');
  await page.locator('#change-new-password').fill('new-very-strong-password-abc');
  await page.locator('#change-password-submit').click();
  await expect(page.locator('#account-settings-dialog')).toBeHidden();
  const token=await page.evaluate(()=>sessionStorage.getItem('pacelab.sessionToken.v1'));
  expect(token).toBeNull();
  await expect(page.locator('#account-button')).toContainText('Sign in');
});

test('sign out invalidates browser session after server logout',async({page})=>{
  await authenticatedPage(page);
  await page.locator('#account-button').click();
  await page.locator('#signout-account').click();
  await expect(page.locator('#account-settings-dialog')).toBeHidden();
  expect(await page.evaluate(()=>sessionStorage.getItem('pacelab.sessionToken.v1'))).toBeNull();
  await expect(page.locator('#account-button')).toContainText('Sign in');
});
