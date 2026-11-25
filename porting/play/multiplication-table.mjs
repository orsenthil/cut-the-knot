// The Multiplication Table: press 3 x 4; its row, column and the 12s light up; press a square; arrow keys.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs multiplication-table
export default async ({ page, first, log, shot, text }) => {
  log("start:", await page.locator("td button").count(), "entries");
  await shot("start");
  await page.locator('td button[data-a="3"][data-b="4"]').click();
  log("pressed 3 x 4:", await text("#status"), "| same:", await page.locator("td button.same").count());
  await shot("twelve");
  await page.locator('td button[data-a="6"][data-b="6"]').click();
  log("pressed 6 x 6:", await text("#status"));
  if (!first) return;
  await page.locator('td button[data-a="1"][data-b="1"]').focus();
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowDown");
  log("focus after arrow keys:", await page.evaluate(() => document.activeElement.getAttribute("aria-label")));
  await page.locator('td button[data-a="20"][data-b="20"]').click();
  log("20 x 20:", await text("#status"));
  await shot("end");
  await page.click("#clearBtn");
  log("cleared:", await page.locator("td button.same, td button.row").count());
};
