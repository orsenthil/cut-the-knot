// Concurrency: one family with a moved corner, then the equal-parts (trisected)
// picture with a different family selected. Neither illustration has a win.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs concurrency
export default async ({ page, first, log, shot, idle, text }) => {
  const handleCenter = (index) => page.evaluate((i) => {
    const h = [...document.querySelectorAll("#board .geom-handle")][i];
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  }, index);

  const client = (p) => page.evaluate(([x, y]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
  }, [p.x, p.y]);

  const drag = async (index, dx, dy) => {
    const at = await handleCenter(index);
    const from = await client(at);
    const to = await client({ x: at.x + dx, y: at.y + dy });
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();
    await idle();
  };

  // First configuration: move corner B and one line point, keep family 2.
  await drag(1, 22, -18);
  await drag(4, -16, 12);
  log("family 2 after dragging:", await text("#status"));
  await shot("family-2-dragged");

  if (!first) return; // the dark run only needs the picture above

  // Second configuration: equal parts and family 1, then another drag.
  await page.click("#trisectBtn");
  await page.click('[data-mode="2"]');
  await drag(5, 14, -10);
  log("equal parts, family 1:", await text("#status"));
  log("family button pressed:", await page.getAttribute('[data-mode="2"]', "aria-pressed"));
  await shot("equal-parts-family-1");

  // Walk every remaining button and family, as a player would.
  await page.click("#newBtn");
  await page.click('[data-mode="1"]');
  log("family 3 after reset:", await text("#status"));
  await page.click('[data-mode="0"]');
  log("family 2 again:", await text("#status"));
};
