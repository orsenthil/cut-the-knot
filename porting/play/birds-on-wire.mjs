// Birds on a Wire is a demo: log the opening state, set all three options to
// their maximum, make two keyboard trials with a focus check, press Go / Stop /
// Repeat in player order, then drive both bird limits past each other and every
// slider to both extremes. The status says in words what changed.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs birds-on-wire
export default async ({ page, first, log, shot, text }) => {
  const focus = () => page.evaluate(() => document.activeElement && document.activeElement.id);

  log("initial:", await text("#status"));
  await shot("start");

  // Every option at its maximum: 110 scrollbar units = 1100 trials, 202 birds.
  await page.locator("#trials").fill("110");
  log("trials at maximum:", await text("#status"));
  await page.locator("#minBirds").fill("202");
  log("minimum birds at maximum:", await text("#status"));
  await page.locator("#maxBirds").fill("202");
  log("all options at maximum:", await text("#status"));
  await shot("max-options");

  // Two keyboard trials on the wire; focus must stay on the canvas.
  await page.focus("#wire");
  await page.keyboard.press("Enter");
  log("first keyboard trial:", await text("#status"), "| focus:", await focus());
  await page.keyboard.press("Enter");
  log("second keyboard trial:", await text("#status"), "| focus:", await focus());
  await shot("keyboard");

  // A long run so Stop and Repeat are both observable: Go, Stop, then Repeat.
  await page.locator("#trials").fill("110");
  await page.locator("#minBirds").fill("2");
  await page.locator("#maxBirds").fill("4");
  await page.click("#goBtn");
  log("after Go (button now says", await page.locator("#goBtn").textContent() + "):", await text("#status"));
  await shot("running");
  await page.click("#goBtn");
  log("after Stop:", await text("#status"));
  await page.click("#repeatBtn");
  log("after Repeat adds 1100 more trials per bird count:", await text("#status"));
  await shot("buttons");

  // Both bird extremes: a Min above Max drags Max up, a Max below Min drags
  // Min down. The status explains what the applet did.
  await page.locator("#maxBirds").fill("4");
  await page.locator("#minBirds").fill("202");
  log("Min pushed above Max:", await text("#status"));
  await shot("min-above-max");
  await page.locator("#minBirds").fill("2");
  await page.locator("#maxBirds").fill("2");
  log("Max pushed below Min:", await text("#status"));
  await shot("max-below-min");

  // And values outside each range, which the sliders clamp.
  await page.locator("#trials").fill("999");
  log("trials above range (clamped to 1100):", await text("#status"));
  await page.locator("#trials").fill("-5");
  log("trials below range (clamped to 0):", await text("#status"));
  await page.locator("#minBirds").fill("0");
  log("Min below range (clamped to 2):", await text("#status"));
  await page.locator("#maxBirds").fill("999");
  log("Max above range (clamped to 202):", await text("#status"));
  await shot("extremes");

  if (!first) return; // the dark run only needs the screenshots above
};
