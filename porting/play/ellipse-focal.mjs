// Ellipse Focal: two configurations of the same focal illustration.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs ellipse-focal
export default async ({ page, first, log, shot, idle, text }) => {
  const client = (x, y) => page.evaluate(([px, py]) => {
    const svg = document.getElementById("board");
    const m = svg.getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const drag = async (selector, index, from, to) => {
    const a = await client(from.x, from.y);
    const b = await client(to.x, to.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 12 });
    await page.mouse.up();
    await idle();
    const dot = await page.locator(selector).nth(index).evaluate((h) => ({
      x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")),
    }));
    log(`dragged ${selector}[${index}] to:`, `${dot.x}, ${dot.y}`);
  };

  // First configuration: pull the bottom-right corner in. The sum drops from
  // 200 to 100 because both focus distances shrink with the ellipse.
  await drag("#board .corner-handle", 1, { x: 300, y: 225 }, { x: 250, y: 190 });
  log("narrow ellipse:", await text("#status"));
  await shot("narrow");

  // Second configuration: stretch the bottom-left corner out, then move P
  // with the keyboard alone and check that focus stays on the dot.
  await drag("#board .corner-handle", 0, { x: 150, y: 190 }, { x: 60, y: 240 });
  await page.locator("#board .point-handle").focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowRight");
  const focus = await page.evaluate(() => document.activeElement?.getAttribute("class") || "");
  log("focus after two arrow keys:", focus);
  log("wide ellipse:", await text("#status"));
  await shot("wide");

  if (!first) return;
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
