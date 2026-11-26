// Bui Quang Tuan 2: set up two different six-circle diagrams and check the claims.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs bui-quang-tuan-2
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: slide P so the even triple passes through Ge.
  // The t that puts Ge on C2 is found by the logic test for this triangle;
  // convert it to a client point through the SVG's own transform.
  await page.click("#gergonneBtn");
  await page.click("#namesBtn");
  await page.click("#evenBtn");
  const target = await page.evaluate(() => {
    const core = BuiQuangTuan2Core;
    const at = (prefix) => {
      const n = document.querySelector(`#board [aria-label^="${prefix}"]`);
      return { x: +n.getAttribute("cx"), y: +n.getAttribute("cy") };
    };
    const V = [at("Vertex A1"), at("Vertex A2"), at("Vertex A3")];
    const t = 0.0471581243; // C2,C4,C6 pass through Ge at this weight of A1
    const L0 = core.figure(V, t).L0;
    const p = { x: V[0].x * t + L0.x * (1 - t), y: V[0].y * t + L0.y * (1 - t) };
    const q = new DOMPoint(p.x, p.y).matrixTransform(document.getElementById("board").getScreenCTM());
    return { x: q.x, y: q.y };
  });
  const pBox = await handle("P,").boundingBox();
  await page.mouse.move(pBox.x + pBox.width / 2, pBox.y + pBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 12 });
  await page.mouse.up();
  await page.click("#checkBtn");
  log("after sliding P:", await text("#status"));
  await shot("even-triple");

  // Second configuration: a different triangle, other triple highlighted.
  await page.click("#newBtn");
  await drag("Vertex A2", 28, -18);
  await drag("Vertex A3", -26, 22);
  await page.click("#oddBtn");
  await drag("P,", 4, 26);
  await page.click("#checkBtn");
  log("after moving the triangle:", await text("#status"));
  await shot("odd-triple");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard moves leave focus on the point that was moved.
  await handle("Vertex A1").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every button in the order a player would, both ways.
  await page.click("#allBtn");
  await page.click("#evenBtn");
  await page.click("#oddBtn");
  await page.click("#namesBtn");
  await page.click("#gergonneBtn");
  await page.click("#checkBtn");
  log("after Check the claim:", await text("#status"));
  await shot("checked");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
