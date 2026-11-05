import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('pacelab.tour.v1','1'));
  await page.goto('/');
});

test('studio monthly/weekly charts work with sample workouts and metric filters',async({page})=>{
  await page.locator('[data-view="insights"]').click();
  await expect(page.locator('#athlete-studio')).toBeVisible();
  await expect(page.locator('#studio-month-chart .studio-month')).toHaveCount(6);
  await expect(page.locator('#studio-month-summary')).toContainText('incomplete');
  await expect(page.locator('#studio-week-summary')).toContainText('Completed four-week blocks');
  await page.locator('#studio-months').selectOption('12');
  await expect(page.locator('#studio-month-chart .studio-month')).toHaveCount(12);
  await page.locator('#studio-chart-metric').selectOption('easy');
  await expect(page.locator('#studio-coverage')).toContainText('Easy/Recovery');
  await expect(page.locator('#studio-week-chart svg')).toBeVisible();
  await page.locator('#studio-chart-metric').selectOption('miles');
  await expect(page.locator('#studio-coverage')).toContainText('logged miles');
});

test('responsive navigation exposes proper state and supports Escape/backdrop',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const toggle=page.locator('#menu-toggle');
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('#nav-backdrop')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('#nav-backdrop')).toBeHidden();
  await toggle.click();
  await page.locator('[data-view="insights"]').click();
  await expect(page.getByRole('heading',{name:/Training insights/i})).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('#nav-backdrop')).toBeHidden();
});
