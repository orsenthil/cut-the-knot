// Fuss: a drawing, not a game. Show two configurations of the two circles,
// exercise the slider, the tickboxes, dragging, the arrow keys and Start/Stop.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs fuss
export default async ({ page, first, log, shot, idle, text }) => {
  const setSlider = (v) => page.evaluate((value) => {
    const el = document.getElementById("distance");
    el.value = String(value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, v);

  const client = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const handleAt = () => page.evaluate(() => {
    const h = document.querySelector("#board .geom-handle");
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  });

  const dragA = async (x, y) => {
    const from = await handleAt();
    const a = await client(from.x, from.y);
    const b = await client(x, y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 12 });
    await page.mouse.up();
    await idle();
  };

  // Configuration 1: the centres apart, names and diagonals shown.
  await setSlider(10);
  await page.click("#names");
  await page.click("#diagonals");
  await dragA(220, 125);
  log("configuration 1:", await text("#status"));
  await shot("apart");

  // Keyboard: two arrow presses must move A and leave focus on the point.
  await page.focus("#board .geom-handle");
  const before = await handleAt();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const after = await handleAt();
  const focused = await page.evaluate(() =>
    document.activeElement && document.activeElement.classList.contains("geom-handle"));
  log("keyboard:", `A moved from ${before.x.toFixed(1)},${before.y.toFixed(1)} to ` +
      `${after.x.toFixed(1)},${after.y.toFixed(1)}; focus on A: ${focused}`);

  if (!first) return; // the dark run only needs the two screenshots

  // Configuration 2: concentric circles make a square; Start/Stop runs.
  await page.click("#resetBtn");
  await setSlider(0);
  await page.click("#diagonals"); // hide the diagonals
  await dragA(260, 150);
  await page.click("#startBtn");
  await page.waitForTimeout(180);
  await page.click("#startBtn"); // the button now reads Stop
  log("configuration 2:", await text("#status"));
  await shot("concentric");

  // Range edges: a Max below Min and a Min above Max must be clamped.
  await setSlider(-12);
  log("slider clamped low:", await text("#dValue"));
  await setSlider(999);
  log("slider clamped high:", await text("#dValue"));
};
