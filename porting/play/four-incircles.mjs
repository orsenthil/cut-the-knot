// Four Incircles: look at the theorem's matching picture, then a scattered one.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs four-incircles
export default async ({ page, first, log, shot, text }) => {
  // Configuration 1: the geometric-progression fan, where the outer circles
  // match and the two wider circles appear, as in the Java applet.
  await page.click("#equalBtn");
  const matched = await text("#status");
  log("matching configuration:", matched);
  log("status class:", await page.getAttribute("#status", "class"));
  await shot("matched");
  if (!first) return; // the dark run only needs the screenshot above

  // Configuration 2: a scattered diagram, where only level 1 is drawn. A new
  // diagram is often within the applet's one-pixel tolerance, so move B well
  // away to make the mismatch unmistakable.
  await page.click("#resetBtn");
  await page.focus('[role="button"][aria-label^="Point B on the base line"]');
  for (let i = 0; i < 4; i++) await page.keyboard.press("Shift+ArrowLeft");
  const scattered = await text("#status");
  log("scattered configuration:", scattered);
  log("status class:", await page.getAttribute("#status", "class"));
  await shot("scattered");

  // Keyboard play: two arrow nudges on C, with focus kept on the handle.
  const selector = '[role="button"][aria-label^="Point C on the base line"]';
  await page.focus(selector);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const afterKeys = await text("#status");
  const focus = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  log("after two keyboard nudges:", afterKeys);
  log("focus kept:", focus);
  await shot("keyboard");
};
