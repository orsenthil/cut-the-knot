// Rectangle in Arbelos: drag C and D to two configurations and look at both.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs arbelos-rect
export default async ({ page, log, shot, text }) => {
  const board = page.locator("#board");
  const handles = page.locator('#board [role="button"]');

  /** Drag a handle to a point given in the SVG's 400 x 250 viewBox. */
  async function drag(index, x, y) {
    const box = await board.boundingBox();
    const hb = await handles.nth(index).boundingBox();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + (x / 400) * box.width,
      box.y + (y / 250) * box.height, { steps: 10 });
    await page.mouse.up();
  }

  // C at 72% of AB: the rectangle tilts the other way, with CB short.
  await drag(0, 30 + 340 * 0.72, 220);
  log("after dragging C:", await text("#status"));
  await shot("c-near-b");

  // Now drag D on the big arc to about a quarter of the way from A.
  const x = 30 + 340 * 0.25;
  const y = 220 - Math.sqrt((x - 30) * (370 - x));
  await drag(1, x, y);
  log("after dragging D:", await text("#status"));
  await shot("d-on-arc");

  await page.click("#middleBtn");
  await page.click("#hint1Chk");
  await page.click("#hint2Chk");
  await page.click("#namesChk");
  log("middle with both hints:", await text("#status"));
  await shot("middle-hints");
};
