// Illusion: two configurations of the Poggendorff picture, in light and dark.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs illusion
export default async ({ page, first, log, shot, idle, text }) => {
  const setRange = (id, value) => page.evaluate(([sel, v]) => {
    const el = document.querySelector(sel);
    el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, [id, value]);

  await idle("#board .transversal");
  log("start:", await text("#status"));
  await shot("start");

  // First configuration: shallow transversals, wide stripes far apart.
  await setRange("#angleRange", 25);
  await setRange("#distRange", 40);
  await setRange("#spaceRange", 80);
  await setRange("#widthRange", 60);
  log("shallow slant:", await text("#status"));
  await shot("shallow");

  // Second configuration: near-vertical lines and thin, closely spaced stripes.
  await setRange("#angleRange", 85);
  await setRange("#distRange", 10);
  await setRange("#spaceRange", 30);
  await setRange("#widthRange", 20);
  log("steep slant:", await text("#status"));
  await shot("steep");

  if (!first) return; // the dark run only needs the two configurations

  await page.click("#revealBtn");
  log("bars lifted:", await text("#status"));
  await shot("revealed");
  await page.click("#revealBtn");
  log("bars back:", await text("#status"));

  // Two keyboard-only moves on the slant point; focus must stay on it.
  const angleDot = page.locator('#board [aria-label^="Slant point"]');
  await angleDot.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("after keyboard:", await text("#status"));

  // Two keyboard-only moves on the line-gap point.
  const gapDot = page.locator('#board [aria-label^="Line-gap point"]');
  await gapDot.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const gapFocused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after gap keys:", gapFocused);
  log("after gap keys:", await text("#status"));

  // Every option in both directions, then the reset button.
  await setRange("#angleRange", 15);
  await setRange("#angleRange", 90);
  await setRange("#distRange", 5);
  await setRange("#distRange", 50);
  await setRange("#spaceRange", 20);
  await setRange("#spaceRange", 100);
  await setRange("#widthRange", 5);
  await setRange("#widthRange", 90);
  log("largest settings:", await text("#status"));
  await shot("largest");

  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
