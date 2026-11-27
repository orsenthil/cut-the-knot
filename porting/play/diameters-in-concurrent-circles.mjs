// Diameters In Concurrent Circles: two arrangements of the same four dots.
// There is no win or loss in this illustration; the third diameter is the
// surprise. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs diameters-in-concurrent-circles

async function dragTo(page, name, target) {
  const handle = page.locator(`#board circle.geom-handle[aria-label^="Point ${name}"]`);
  const box = await handle.boundingBox();
  const board = await page.locator("#board").boundingBox();
  if (!box || !board) throw new Error(`no box for handle ${name}`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const tx = board.x + (target[0] / 400) * board.width;
  const ty = board.y + (target[1] / 300) * board.height;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(tx, ty, { steps: 10 });
  await page.mouse.up();
}

export default async ({ page, log, shot, text }) => {
  log("opening:", await text("#status"));
  await shot("opening");

  // Configuration one: the three centres at 120 degrees, so every chord
  // through O is a diameter. The eyes open and the hint triangle can be seen.
  await dragTo(page, "P", [140, 150]);
  await dragTo(page, "Q", [230, 202]);
  await dragTo(page, "R", [230, 98]);
  await page.click("#names");
  await page.click("#extra");
  log("configuration one:", await text("#status"));
  await shot("config-one");

  await page.click("#newBtn");
  log("after reset:", await text("#status"));

  // Configuration two: two arrow-key moves first (focus must survive), then
  // an arrangement with just one diameter, labels and hint hidden again.
  const p = page.locator('#board circle.geom-handle[aria-label^="Point P"]');
  await p.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after arrow keys:", focused);
  await dragTo(page, "P", [140, 150]);
  await dragTo(page, "Q", [250, 120]);
  await dragTo(page, "R", [250, 220]);
  await page.click("#names");
  await page.click("#extra");
  log("configuration two:", await text("#status"));
  await shot("config-two");
};
