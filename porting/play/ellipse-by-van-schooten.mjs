// Van Schooten's locus: a demo with two configurations, no win or loss.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs ellipse-by-van-schooten
export default async ({ page, first, log, shot, idle, text }) => {
  const client = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const handlePoint = (name) => page.evaluate((n) => {
    const h = [...document.querySelectorAll("#board .geom-handle")]
      .find((el) => new RegExp("^Point " + n + "\\b").test(el.getAttribute("aria-label") || ""));
    return h ? { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) } : null;
  }, name);

  const drag = async (name, to) => {
    const from = await handlePoint(name);
    if (!from) throw new Error("no handle for " + name);
    const a = await client(from.x, from.y);
    const b = await client(to.x, to.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 14 });
    await page.mouse.up();
    await idle();
  };

  // First configuration: AB keeps its length (Define triangle is off).
  // Dragging A along the horizontal arm makes B slide up the vertical arm.
  await drag("A", { x: 238, y: 142.86 });
  log("rigid A drag:", await text("#status"));
  await page.click("#hintBox");
  log("with the helper lines:", await text("#status"));
  await shot("rigid-ab-hint");

  // Two keyboard-only moves: focus must stay on A after each redraw.
  await page.evaluate(() => {
    const h = [...document.querySelectorAll("#board .geom-handle")]
      .find((el) => /^Point A\b/.test(el.getAttribute("aria-label") || ""));
    h.focus();
  });
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  log("after two arrow keys:", await text("#status"), "| focus:", await page.evaluate(
    () => document.activeElement && document.activeElement.getAttribute("aria-label")));

  if (!first) return; // the dark run only needs the screenshot above

  // Second configuration: define a new triangle, trace C, then slide B.
  await page.click("#newBtn");
  await page.click("#rigidBox");
  await page.click("#traceBox");
  log("Define triangle on:", await text("#status"));
  await drag("C", { x: 212, y: 190 });
  log("after reshaping C:", await text("#status"));
  await drag("B", { x: 171.43, y: 74 });
  log("after sliding B:", await text("#status"));
  await shot("free-triangle-trace");
};
