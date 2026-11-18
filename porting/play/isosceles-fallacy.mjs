// The isosceles fallacy demo: drag a vertex, toggle the honest drawing and
// the hints, then reset. Check the status message describes the cheat.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs isosceles-fallacy

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  await shot("faulty");

  // Drag vertex C with the pointer.
  const box = await page.locator("#board").boundingBox();
  const handle = await page.locator('.handle[data-name="C"]').boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.2, { steps: 8 });
  await page.mouse.up();
  log("after dragging C:", await text("#status"));
  await shot("dragged");

  if (first) {
    // Keyboard focus on a vertex handle.
    await page.focus('.handle[data-name="A"]');
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    log("focused handle:", focused);
    await page.click("#hintCheck");
    log("with more info:", await page.locator(".hint").textContent());
    await shot("hint");
    await page.click("#namesCheck");
  }

  await page.click("#modeCheck");
  log("honest drawing:", await text("#status"));
  await shot("honest");

  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
  await shot("reset");
};
