// The Simple Graphs demo: place vertices, drag edges, try a loop, undo,
// toggle every option and press Reset.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs simple-graphs

export default async ({ page, log, shot, text }) => {
  const stats = async () => text("#stats");
  const box = await page.locator("#diagram").boundingBox();
  const at = (x, y) => ({ x: box.x + (x / 600) * box.width, y: box.y + (y / 400) * box.height });

  log("at the start:", await stats(), "|", await text("#status"));
  await shot("start");

  // Click three empty places to add vertices.
  for (const [x, y] of [[100, 100], [300, 100], [200, 260]]) {
    const p = at(x, y);
    await page.mouse.click(p.x, p.y);
  }
  log("after three clicks:", await stats(), "|", await text("#status"));
  await shot("vertices");

  // Drag from the first to the second and third vertices to add edges.
  for (const [from, to] of [[[100, 100], [300, 100]], [[100, 100], [200, 260]]]) {
    const a = at(...from);
    const b = at(...to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 5 });
    await page.mouse.up();
  }
  log("after two dragged edges:", await stats(), "|", await text("#status"));
  await shot("edges");

  // Keyboard move of a focused vertex, then a loop with the option on.
  await page.locator(".vertex").first().focus();
  await page.keyboard.press("ArrowRight");
  let focus = await page.evaluate(() => document.activeElement?.dataset?.id);
  log("after an ArrowRight, focus:", focus, "|", await text("#status"));
  await page.check("#allowLoops");
  const loop = at(100, 100);
  await page.mouse.move(loop.x, loop.y);
  await page.mouse.down();
  await page.mouse.up();
  log("after trying a loop:", await stats(), "|", await text("#status"));
  await shot("loop");

  // Every checkbox both ways, every button.
  await page.uncheck("#showDegrees");
  await page.check("#showDegrees");
  await page.check("#moving");
  await page.uncheck("#moving");
  await page.uncheck("#allowLoops");
  await page.click("#popBtn");
  log("after Pop:", await stats(), "|", await text("#status"));
  await page.click("#popBtn");
  log("after another Pop:", await stats());
  await page.click("#resetBtn");
  log("after Reset:", await stats(), "|", await text("#status"));
  log("final status class:", await page.getAttribute("#status", "class"));
  await shot("final");
};
