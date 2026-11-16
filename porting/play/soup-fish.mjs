/** Playwright scenario: Fish Soup — claim a word, then new game. */
export default async ({ page, first, log, shot, idle, text }) => {
  await page.uncheck("#computerFirst");
  await page.click("#newBtn");
  await idle();
  await page.locator(".card:not(:disabled)").first().click();
  await idle();
  log("after pick:", await text("#status"));
  await shot("mid");
  if (!first) return;
  await page.check("#computerFirst");
  await page.click("#goBtn");
  await idle();
  log("computer opened:", await text("#status"));
  await shot("opened");
};
