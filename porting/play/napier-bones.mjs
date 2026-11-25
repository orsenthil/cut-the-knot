// Napier's Bones: 187 x 3, then base 16, an invalid number, a new multiplier and base 20.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs napier-bones
const setRange = (page, id, v) => page.locator(id).evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); }, v);
export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  await shot("187 x 3");
  await setRange(page, "#base", 16);
  log("base 16:", await page.locator("#num").inputValue(), "|", await text("#status"));
  await page.locator("#num").fill("BEEF");
  log("BEEF:", await text("#status"));
  await page.locator(".rowlab").nth(4).click();
  log("multiplier 5:", await text("#status"));
  await shot("beef");
  if (!first) return;
  await page.locator("#num").fill("12G");
  log("a bad digit:", await text("#status"));
  await page.locator("#num").blur();
  log("restored on blur:", await page.locator("#num").inputValue());
  await setRange(page, "#base", 3);
  log("base 3:", await page.locator("#num").inputValue(), "|", await text("#status"));
  await setRange(page, "#base", 20);
  await page.locator("#num").fill("JJJJJJJJ");
  log("base 20, eight J's, row 19:", await page.locator(".rowlab").count(), "rows");
  await shot("big");
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
