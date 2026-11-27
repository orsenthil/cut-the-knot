// EquilocQuad2Tri120: two configurations of the illustration, with screenshots.
// There is no win or loss in the applet, so the scenario takes two pictures.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs equiloc-quad-2-tri-120
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
  const local = async (p) => {
    const box = await page.locator("#board").boundingBox();
    if (!box) throw new Error("no board");
    return {
      x: box.x + (p.x * box.width) / 400,
      y: box.y + (p.y * box.height) / 300,
    };
  };
  const dragTo = async (name, target) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for ${name}`);
    const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const to = await local(target);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 16 });
    await page.mouse.up();
  };
  const angle = (deg, r = 111.1111111111111) => ({
    x: 200 + r * Math.cos((deg * Math.PI) / 180),
    y: 165 + r * Math.sin((deg * Math.PI) / 180),
  });

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: S on the starting arc, C nearer to S, side marks on.
  const s1 = angle(-60);
  await dragTo("S", s1);
  await dragTo("C", { x: (296.225 + s1.x) / 2, y: (109.444 + s1.y) / 2 });
  await page.click("#construction");
  log("first shape:", await text("#status"));
  await shot("first");

  // Second configuration: reset, drag S onto the opposite arc, show the hint.
  await page.click("#resetBtn");
  await dragTo("S", angle(90));
  await dragTo("D", { x: 190, y: 150 });
  await page.click("#construction");
  await page.click("#hint");
  log("second shape:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on S after the redraw.
  await handle("S").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  await page.click("#hint");
  await page.click("#hint");
  await page.click("#names");
  await page.click("#names");
  await page.click("#construction");
  await page.click("#construction");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
