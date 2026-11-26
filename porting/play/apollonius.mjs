// Apollonius: drag the three given circles into two configurations and look at
// the tangent circles in each. There is no win or loss in this illustration.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs apollonius

async function dragHandle(page, labelStart, dx, dy) {
  const handle = page.locator(`#board circle.geom-handle[aria-label^="${labelStart}"]`);
  const box = await handle.boundingBox();
  if (!box) throw new Error(`no handle found for ${labelStart}`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  await page.mouse.up();
}

export default async ({ page, log, shot, text }) => {
  log("opening:", await text("#status"));
  await shot("opening");

  // First configuration: move the first circle and resize the second.
  await dragHandle(page, "Centre of circle 1", 46, 24);
  await dragHandle(page, "Rim of circle 2", -4, -30);
  log("configuration one:", await text("#status"));
  await shot("config-one");

  // Second configuration: keyboard-only nudge, then another resize.
  await page.locator('#board circle.geom-handle[aria-label^="Centre of circle 3"]').focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after arrow keys:", focused);
  await dragHandle(page, "Rim of circle 1", 24, 12);
  log("configuration two:", await text("#status"));
  await shot("config-two");

  await page.click("#newBtn");
  log("after reset:", await text("#status"));
  await shot("reset");
};
