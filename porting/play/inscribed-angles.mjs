// Inscribed Angles: a drawing, so the scenario shows two configurations instead
// of a win and a loss. First B is pulled off the circle (Hint disabled); then
// it is brought back to A's arc and Hint shows the two matching angles.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs inscribed-angles
export default async ({ page, first, log, shot, idle, text }) => {
  const client = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const handle = (name) => page.evaluate((label) => {
    const h = [...document.querySelectorAll("#board .geom-handle")]
      .find((n) => n.getAttribute("aria-label").startsWith(label));
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  }, `Point ${name}`);

  const drag = async (name, to) => {
    const from = await handle(name);
    const a = await client(from.x, from.y);
    const b = await client(to.x, to.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 18 });
    await page.mouse.up();
    await idle();
  };

  // Configuration 1: B off the circle, so the Hint box is disabled.
  await drag("B", { x: 170, y: 270 });
  log("off circle:", await text("#status"));
  await shot("off-circle");

  // Configuration 2: B back on the circle on A's arc (well away from A), so
  // the two matching angle marks can be seen; mark them with Hint.
  await drag("B", { x: 299, y: 167 });
  await page.check("#hint");
  await page.check("#names");
  log("same arc:", await text("#status"));
  await shot("same-arc-hint");

  const hintState = () => page.evaluate(() => ({
    disabled: document.getElementById("hint").disabled,
    checked: document.getElementById("hint").checked,
    focusOnB: !!document.activeElement &&
      document.activeElement.getAttribute("aria-label").startsWith("Point B"),
  }));
  if (first) {
    log("hint enabled, focus kept:", JSON.stringify(await hintState()));
    await page.uncheck("#names");
    await page.check("#names");
    await drag("B", { x: 170, y: 270 });
    log("hint after leaving circle:", JSON.stringify(await hintState()));
    await drag("B", { x: 299, y: 167 });

    // Two moves with the keyboard only; focus must stay on the same handle.
    await page.focus('[aria-label^="Point B"]');
    const before = await handle("B");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Shift+ArrowDown");
    const after = await handle("B");
    await idle();
    log("keyboard moved B:", before.x !== after.x || before.y !== after.y);
    log("focus stays on B:", (await hintState()).focusOnB);
    await page.click("#resetBtn");
    log("after reset:", await text("#status"));
  }
};
