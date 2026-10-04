import { capture } from './capture-lib.mjs';
await capture({
  url: "https://bryanzane.com/easyagent/",
  async shots(page, shoot) {
    if (await page.locator('html').getAttribute('data-theme') === 'dark') await page.locator('#theme-toggle').click();
    await page.locator('#message-input').scrollIntoViewIfNeeded();
    await shoot('workstation');
  }
});
