// Chvatal: triangulate a polygon (a demo's "done"), hit the finished dead end,
// then exercise both options and the keyboard.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs chvatal
export default async ({ page, first, log, shot, idle, text }) => {
  const setN = async (n) => {
    await page.locator("#nSpin").evaluate((el, v) => {
      el.value = v;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, String(n));
  };

  log("initial status:", await text("#status"));
  await shot("initial");

  // Every option at its largest: 40 corners, and rearrange-vertices mode.
  await setN(40);
  await page.click("#modeMove");
  log("maximum options:", await text("#status"));
  log("corner buttons at N=40:", await page.locator(".vertex").count());
  await shot("max");
  if (!first) return; // the dark run only needs the two screenshots above

  await page.click("#modeDraw");
  await setN(5);

  // A fan triangulation of a pentagon: diagonals (0,2) then (0,3).
  await page.click("#v0");
  await page.click("#v2");
  log("after one diagonal:", await text("#status"));
  await page.click("#v0");
  await page.click("#v3");
  log("after a full triangulation:", await text("#status"));
  log("status class:", await page.locator("#status").getAttribute("class"));
  await idle();
  await shot("win");

  // Dead end: with the polygon finished, one more diagonal is refused.
  await page.click("#v1");
  await page.click("#v3");
  log("after a rejected diagonal:", await text("#status"));
  await shot("loss");

  // Pop the last diagonal, then press New polygon.
  await page.click("#popBtn");
  log("after Pop diagonal:", await text("#status"));
  await page.click("#newBtn");
  log("after New polygon:", await text("#status"));

  // Both directions of the option, including past its bounds.
  await setN(99);
  log("N spinner above max clamps to:", await page.locator("#nSpin").inputValue());
  await setN(2);
  log("N spinner below min clamps to:", await page.locator("#nSpin").inputValue());
  await page.click("#modeMove");
  log("rearrange mode:", await text("#status"));
  await page.click("#modeDraw");
  log("draw mode:", await text("#status"));

  // Keyboard only: focus a corner, choose it, walk two corners right, choose.
  await setN(5);
  await page.locator("#v0").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  const focused1 = await page.evaluate(() => (document.activeElement && document.activeElement.id) || "");
  log("focus after the first keyboard diagonal:", focused1);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  const focused2 = await page.evaluate(() => (document.activeElement && document.activeElement.id) || "");
  log("focus after the second keyboard diagonal:", focused2);
  log("after keyboard play:", await text("#status"));
  if (!/^v\d+$/.test(focused1) || !/^v\d+$/.test(focused2)) {
    throw new Error("keyboard play took focus off the board");
  }
  await shot("keyboard");
};
