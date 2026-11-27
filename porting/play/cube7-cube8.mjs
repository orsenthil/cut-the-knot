// Cube 7Cube 8: two views of the same pile, one solid and one faded.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs cube7-cube8
export default async ({ page, first, log, shot, idle, text }) => {
  const setRange = (id, value) => page.evaluate(([sel, v]) => {
    const el = document.getElementById(sel);
    el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, [id, value]);

  log("opening view:", await text("#status"));
  await shot("solid-seven");

  // Keyboard only: the angle dot is a Geom handle, so ArrowRight tilts the
  // view one degree at a time and the focus must stay on the dot.
  await page.focus(".view-handle");
  for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowRight");
  const focused = await page.evaluate(() => document.activeElement?.classList.contains("view-handle"));
  log("after 12 arrow presses:", await text("#status"), "| focus kept:", focused);

  await setRange("trans", 90);
  await setRange("size", 4);
  await idle();
  log("second configuration:", await text("#status"));
  await shot("faded-eight");

  if (!first) return; // the dark run only needs the two pictures

  // Every button, in the order a player would meet them, including both ends
  // of each slider's range.
  await page.click("#angleDown");
  await page.click("#angleUp");
  await page.click("#sizeDown");
  await page.click("#sizeUp");
  await page.click("#transDown");
  await page.click("#transUp");
  await setRange("angle", 15);
  await page.click("#angleDown");
  log("angle cannot go below 15:", await text("#angleOut"));
  await setRange("angle", 60);
  await page.click("#angleUp");
  log("angle cannot go above 60:", await text("#angleOut"));
  await setRange("trans", -127);
  await setRange("trans", 127);
  log("fading at its maximum:", await text("#transOut"));
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
