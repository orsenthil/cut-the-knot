// Modular Arithmetic Tables: addition mod 10, the multiplication table mod 7, press a number, division, a composite modulus, the largest table.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs modular-tables
const setRange = (page, id, v) => page.locator(id).evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); }, v);
export default async ({ page, first, log, shot, text }) => {
  log("start:", await page.locator("td button").count(), "entries |", await text("#status"));
  await shot("addition mod 10");
  await setRange(page, "#n", 7);
  await page.locator('input[name="op"]').nth(1).check();
  log("times mod 7:", await page.locator("td button").count(), "entries (6 by 6)");
  await page.locator("td button").nth(7).click();
  log("pressed an entry:", await text("#status"), "| lit:", await page.locator("td button.on").count());
  await shot("rooks");
  await page.locator('input[name="op"]').nth(3).check();
  log("divide mod 7, 6 / 5:", await page.locator("td button").nth(5 * 6 + 4).getAttribute("aria-label"));
  await setRange(page, "#n", 8);
  log("N = 8: divide disabled:", await page.locator('input[name="op"]').nth(3).isDisabled(), "| op fell back to plus:", await page.locator('input[name="op"]').nth(0).isChecked());
  if (!first) return;
  await setRange(page, "#n", 30);
  await page.locator('input[name="op"]').nth(2).check();
  log("minus mod 30:", await page.locator("td button").count(), "entries");
  await shot("big");
  await page.click("#clearBtn");
  log("cleared:", await page.locator("td button.on").count());
};
