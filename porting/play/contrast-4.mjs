// Contrast 4: show the opening illusion, then the widest bands and tallest
// patches; step through the patches with the keyboard alone.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs contrast-4
export default async ({ page, first, log, shot, idle, text }) => {
  const setRange = async (selector, value) => {
    await page.$eval(selector, (el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
    await idle();
  };

  // Configuration 1: the applet's opening picture, with a darker patch grey.
  await setRange("#grayInput", 35);
  await setRange("#minInput", 15);
  log("opening bands, grey 35:", await text("#status"));
  await shot("opening");

  // Configuration 2: every slider at its largest value.
  await page.click("#resetBtn");
  for (const id of ["wInput", "hInput", "grayInput", "minInput", "maxInput"]) {
    await setRange(`#${id}`, 105);
  }
  log("all sliders at 105:", await text("#status"));
  await shot("largest");

  if (!first) return; // the dark run has both screenshots already

  // Two keyboard-only moves; the handle must keep focus after each redraw.
  await page.locator("#board .patch-handle").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const focus = await page.evaluate(() => {
    const a = document.activeElement;
    return a ? `${a.tagName.toLowerCase()}.${a.getAttribute("class")}` : "none";
  });
  log("after two arrow keys:", await text("#status"), "| focus:", focus);

  // Each button in both directions, as a player would try them.
  await page.click('button[data-step="w:-5"]');
  await page.click('button[data-step="w:5"]');
  await page.click('button[data-step="h:-5"]');
  await page.click('button[data-step="h:5"]');
  await page.click('button[data-step="gray:-5"]');
  await page.click('button[data-step="gray:5"]');
  await page.click('button[data-step="min:-5"]');
  await page.click('button[data-step="min:5"]');
  await page.click('button[data-step="max:-5"]');
  await page.click('button[data-step="max:5"]');
  log("after all step buttons:", await text("#status"));
  await shot("buttons");
};
