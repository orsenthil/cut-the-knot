// Affirmative Action demo: flip nodes, show degrees, add an edge and a node,
// remove the last action, clear, reset and find an integrated colouring.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs affirmative-action

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  await shot("start");

  await page.click('.node-group[data-index="0"]');
  log("after flipping a node:", await text("#status"));
  await shot("flip");

  if (first) {
    await page.check("#degreesCheck");
    log("with degrees:", await text("#status"), "| labels:", await page.locator(".degree-text").count());
    await shot("degrees");

    // Keyboard activation of a node.
    await page.focus('.node-group[data-index="1"]');
    await page.keyboard.press("Enter");
    log("after a keyboard flip:", await text("#status"));
    await shot("keyboard");

    await page.click("#popBtn");
    log("after Remove last:", await text("#status"));
    await shot("pop");
  }

  await page.click("#maxBtn");
  log("after Find colouring:", await text("#status"));
  await shot("integrated");

  if (first) {
    await page.click("#clearBtn");
    log("after Clear:", await text("#status"));
    await page.check("#addCheck");
    const box = await page.locator("#board").boundingBox();
    await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.4);
    log("after adding a node:", await text("#status"));
    await shot("added");
  }

  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await shot("reset");
};
