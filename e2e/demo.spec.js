import {test,expect} from '@playwright/test';

test.beforeEach(async ({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('pacelab.tour.v1','1');
    localStorage.removeItem('pacelab.workouts.v1');
  });
  await page.goto('/');
});

test('dashboard runs in clearly labeled sample mode',async({page})=>{
  await expect(page.getByRole('heading',{name:/Run your numbers/i})).toBeVisible();
  await expect(page.locator('#sample-banner')).toBeVisible();
  await expect(page.locator('#metrics .metric')).toHaveCount(4);
  await expect(page.locator('#recent-workouts .workout-row')).toHaveCount(5);
});

test('navigation, local workout logging and basic assistant',async({page})=>{
  await page.getByRole('button',{name:/Workout log/i}).click();
  await expect(page.getByRole('heading',{name:/Workout log/i})).toBeVisible();
  await page.getByRole('button',{name:/Log workout/i}).last().click();
  await page.locator('#w-date').fill('2026-11-04');
  await page.locator('#w-distance').fill('5');
  await page.locator('#w-duration').fill('40:00');
  await page.locator('#w-type').selectOption('Easy');
  await page.getByRole('button',{name:'Save workout'}).click();
  await expect(page.locator('#sample-banner')).toBeHidden();
  await expect(page.locator('#workout-list .workout-row')).toHaveCount(1);
  await page.getByRole('button',{name:/AI assistant/i}).click();
  await page.locator('#assistant-question').fill('What is my average easy pace?');
  await page.locator('#assistant-submit').click();
  await expect(page.locator('#assistant-answer')).toContainText('8:00');
});

test('race equivalence remains labeled as formula-based',async({page})=>{
  await page.getByRole('button',{name:/Race predictor/i}).click();
  await expect(page.locator('#prediction-result')).toContainText('ESTIMATED FINISH TIME');
  await expect(page.locator('#prediction-teaser')).toContainText('FORMULA BASELINE');
  await expect(page.locator('#ml-panel')).toContainText('EXPERIMENTAL');
});

test('first-run tour can be reopened and dismissed',async({page})=>{
  await page.locator('#tour-open').click();
  await expect(page.locator('#tour-dialog')).toBeVisible();
  await expect(page.locator('#tour-title')).toHaveText('Welcome to PaceLab');
  await page.locator('#tour-next').click();
  await expect(page.locator('#tour-title')).toHaveText('Make the data yours');
  await page.locator('#tour-skip').click();
  await expect(page.locator('#tour-dialog')).toBeHidden();
});

test('mobile navigation opens and shows insights',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.locator('#menu-toggle').click();
  await page.locator('[data-view="insights"]').click();
  await expect(page.getByRole('heading',{name:/Training insights/i})).toBeVisible();
});


test('account dialog exposes optional privately hosted API address', async({page})=>{
  await page.getByRole('button',{name:/sign in/i}).first().click();
  await expect(page.locator('#account-dialog')).toBeVisible();
  await expect(page.locator('#api-base')).toBeVisible();
  await page.locator('#close-account').click();
  await expect(page.locator('#account-dialog')).toBeHidden();
});


test('performance center shows consistency tiles and workout comparison',async({page})=>{
  await page.locator('[data-view="insights"]').click();
  await expect(page.locator('#performance-heatmap .heatmap-day')).toHaveCount(84);
  await expect(page.locator('#performance-calendar-summary')).toContainText('active days');
  await page.locator('#workout-compare-a').selectOption({index:1});
  await page.locator('#workout-compare-b').selectOption({index:2});
  await expect(page.locator('#workout-compare-result')).toContainText('seconds/mi');
  await page.locator('#race-event').selectOption('8000');
  await expect(page.locator('#race-progress-chart')).toContainText('Log at least two Race workouts');
});
