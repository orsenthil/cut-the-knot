// Conjugality: two configurations — a collinear triple with its isotomic
// partners, then the three medians (concurrent cevians) with isogonal partners.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs conjugality
export default async ({ page, first, log, shot, idle, text }) => {
  await idle("#board .geom-handle");

  const handle = (name) => page.locator(`#board .geom-handle[aria-label^="${name}"]`);
  const targetFor = (ts, k) => page.evaluate(({ ts, k }) => {
    const start = ConjugalityCore.start({ width: 400, height: 400 });
    const s = ConjugalityCore.withParameters(start, ts);
    const p = s.P[k];
    const q = new DOMPoint(p.x, p.y).matrixTransform(
      document.getElementById("board").getScreenCTM());
    return { x: q.x, y: q.y };
  }, { ts, k });
  const dragTo = async (label, target) => {
    const box = await handle(label).boundingBox();
    if (!box) throw new Error(`no handle for ${label}`);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 14 });
    await page.mouse.up();
    await idle();
  };
  const lineUp = async (ts) => {
    for (let k = 0; k < 3; k++) await dragTo(`Point P${["a", "b", "c"][k]}`, await targetFor(ts, k));
  };

  await lineUp([0.3, 0.3, 1.225]); // Menelaus product -1
  const collinearStatus = await text("#status");
  const collinearDone = await page.evaluate(() =>
    document.querySelector("#status").classList.contains("done"));
  log("collinear isotomic:", collinearStatus);
  if (first && (!collinearDone || !/lie on one line/.test(collinearStatus))) {
    throw new Error("the three points and their isotomic partners should line up");
  }
  await shot("collinear-isotomic");

  // Configuration 2: reset, choose isogonal partners, show the construction,
  // and put the points at the side midpoints so the cevians are the medians.
  await page.click("#newBtn");
  await page.check('input[name="mode"][value="isogonal"]');
  await page.check("#namesBox");
  await page.check("#hintBox");
  await lineUp([0.5, 0.5, 0.5]); // Ceva product 1
  const concurrentStatus = await text("#status");
  const concurrentDone = await page.evaluate(() =>
    document.querySelector("#status").classList.contains("done"));
  log("concurrent isogonal:", concurrentStatus);
  if (first && (!concurrentDone || !/cevians meet/.test(concurrentStatus))) {
    throw new Error("the reflected medians should meet too");
  }
  await shot("concurrent-isogonal");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard alone: arrows slide a side point and focus stays on that handle
  // after the geometry is recomputed.
  await handle("Point Pa").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  if (!/^Point Pa/.test(focused)) throw new Error("focus left the Pa handle");
  log("status after keyboard:", await text("#status"));

  // Press every control in both directions, including Reset at the end.
  await page.check('input[name="mode"][value="isotomic"]');
  await page.check('input[name="mode"][value="isogonal"]');
  await page.uncheck("#namesBox");
  await page.check("#namesBox");
  await page.uncheck("#hintBox");
  await page.check("#hintBox");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
