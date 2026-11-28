// Max Common Chord: move the four points into two different configurations.
// This illustration has no win or loss; the status reports the chord product
// and whether the tangent points line up with P.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs max-common-chord

async function dragHandle(page, labelStart, dx, dy) {
  const handle = page.locator(`#board circle.geom-handle[aria-label^="Point ${labelStart}"]`);
  const box = await handle.boundingBox();
  if (!box) throw new Error(`no handle found for ${labelStart}`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 10 });
  await page.mouse.up();
}

export default async ({ page, first, log, shot, text }) => {
  log("opening:", await text("#status"));
  await shot("opening");

  // Configuration one: slide A along its circle until the tangent chord
  // lines up with P, and show the tangents and right angles.
  await dragHandle(page, "A", -20, -40);
  await page.click("#hintBtn");
  log("configuration one:", await text("#status"));
  await shot("config-one");
  if (!first) return; // the dark run only needs the screenshots above

  await page.click("#newBtn");

  // Configuration two: keyboard-only nudges with Adjust circles, then a new
  // circle pair from Q and the hint overlays.
  await page.click("#circlesBtn");
  await page.locator('#board circle.geom-handle[aria-label^="Point A"]').focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after arrow keys:", focused);
  await dragHandle(page, "Q", -15, 25);
  await page.click("#namesBtn");
  log("configuration two:", await text("#status"));
  await shot("config-two");

  // Press every button in the order a player would, in both directions.
  await page.click("#namesBtn");
  await page.click("#hintBtn");
  await page.click("#chordBtn");
  await dragHandle(page, "A", -30, 12);
  log("back to chord mode:", await text("#status"));
  await shot("chord-mode");

  await page.click("#newBtn");
  log("after reset:", await text("#status"));
  await shot("reset");
};
