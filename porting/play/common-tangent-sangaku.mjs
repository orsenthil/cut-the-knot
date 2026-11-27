// Common Tangent Sangaku: show the opening diagram, then move Q and O into a
// second configuration. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs common-tangent-sangaku
export default async ({ page, first, log, shot, text }) => {
  async function drag(locator, dx, dy) {
    const box = await locator.boundingBox();
    if (!box) throw new Error("handle is not on the board");
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  }

  // Configuration A: the applet's opening diagram, with every option on.
  log("opening:", await text("#status"));
  await shot("config-a");
  for (const id of ["#namesChk", "#statementChk", "#hintChk"]) await page.check(id);
  await shot("config-a-options");

  // Configuration B: slide Q towards C (larger second circle), then drag O
  // to open the angle a different amount.
  await drag(page.locator("#board .geom-handle.handle-q"), 26, 5);
  log("after dragging Q:", await text("#status"));
  await drag(page.locator("#board .geom-handle.handle-o"), 24, -16);
  log("after dragging O:", await text("#status"));
  await shot("config-b");

  if (!first) return; // the dark run only needs the same two configurations

  const oHandle = page.locator("#board .geom-handle.handle-o");
  await oHandle.focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowRight");
  const focused = await page.evaluate(() =>
    (document.activeElement && document.activeElement.getAttribute("aria-label")) || "");
  log("keyboard moved O; focus still on:", focused.slice(0, 45));
  log("after keyboard:", await text("#status"));
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
