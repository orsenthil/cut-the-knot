// Ceva Cradle: two configurations of the same cradle, with screenshots.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs ceva-cradle
export default async ({ page, first, log, shot, idle, text }) => {
  await idle();

  // Configuration 1: the applet's own start, X at 0.6 along BC (not concurrent).
  log("start:", await text("#status"));
  const startDone = await page.evaluate(() => document.querySelector("#status").classList.contains("done"));
  if (first && startDone) throw new Error("the starting cradle should not be finished");
  await shot("nonconcurrent");

  // Configuration 2: put X at the midpoint of BC, as in the medians of a
  // triangle. Then AX, BY and CZ meet, and so must XD, YE and ZF.
  const target = await page.evaluate(() => {
    const s = CevaCradleCore.start({ width: 400, height: 300 });
    const p = { x: (s.B.x + s.C.x) / 2, y: (s.B.y + s.C.y) / 2 };
    const svg = document.getElementById("board");
    const q = new DOMPoint(p.x, p.y).matrixTransform(svg.getScreenCTM());
    return { x: q.x, y: q.y };
  });
  const box = await page.locator('#board .geom-handle[aria-label^="X on the side"]').boundingBox();
  if (!box) throw new Error("the X handle is missing");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 12 });
  await page.mouse.up();
  await idle();
  await page.click("#ceviansBox");
  await page.click("#hintBox");
  await idle();

  const status = await text("#status");
  const done = await page.evaluate(() => document.querySelector("#status").classList.contains("done"));
  log("after moving X to the midpoint:", status);
  if (first && (!done || !/Both products are 1/.test(status))) {
    throw new Error("the two sets of cevians should be concurrent here");
  }
  await shot("concurrent");
};
