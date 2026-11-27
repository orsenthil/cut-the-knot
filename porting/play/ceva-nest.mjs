// Ceva Nest: build two different nested configurations and check the claim.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs ceva-nest
export default async ({ page, first, log, shot, idle, text }) => {
  const at = (name) => page.locator(`#board [aria-label^="${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await at(name).boundingBox();
    if (!box) throw new Error(`no handle for ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: pull a corner and the first inner point.
  await drag("Vertex P1", 46, 22);
  await drag("Point P.", -28, 18);
  log("first shape:", await text("#status"));
  await shot("first-shape");

  // Second configuration: reset, then move a corner and the second inner point.
  await page.click("#newBtn");
  await drag("Vertex P3", -6, 30);
  await drag("Point Q.", 34, -20);
  log("second shape:", await text("#status"));
  await shot("second-shape");

  if (!first) return; // the dark run only needs the two screenshots

  // The proof points and the labels, then the claim check.
  await page.click("#namesBtn");
  await page.click("#proofBtn");
  log("with proof points:", await text("#status"));
  await shot("proof-points");

  await page.click("#checkBtn");
  log("after checking:", await text("#status"));
  const cls = await page.locator("#status").getAttribute("class");
  log("status class:", cls || "(none)");

  // Keyboard movement keeps focus on the handle; the picture follows.
  await at("Vertex P2").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  log("focus after two arrow keys:", await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""));
  log("status after keyboard:", await text("#status"));

  // Press every button once more, in both directions.
  await page.click("#proofBtn");
  await page.click("#namesBtn");
  await page.click("#checkBtn");
  await page.click("#newBtn");
  log("after reset:", await text("#status"));
};
