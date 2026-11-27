// Coaxal Circles: a drawing, not a game. Show the two configurations the
// applet opens between: first the Apollonian pencil, then both pencils with a
// larger N. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs coaxal-circles
export default async ({ page, first, log, shot, idle, text }) => {
  const client = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const handlePos = (i) => page.evaluate((idx) => {
    const h = [...document.querySelectorAll("#board .geom-handle")][idx];
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  }, i);

  const drag = async (i, to) => {
    const from = await handlePos(i);
    const a = await client(from.x, from.y);
    const b = await client(to.x, to.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 14 });
    await page.mouse.up();
    await idle();
  };

  if (first) {
    // Configuration 1: the default Apollonian pencil, with A and B pulled apart.
    await drag(0, { x: 150, y: 220 });
    await drag(1, { x: 450, y: 220 });
    await page.locator("#board .geom-handle").first().focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
    log("focus after two arrow keys:", focused);
    log("configuration 1:", await text("#status"));
    await shot("family-one");
    return;
  }

  // Configuration 2: the circle on AB plus both conjugate pencils, N = 12.
  await page.click("#resetBtn");
  await page.click("#familyTwo");
  await page.click("#names"); // the applet starts with names off; show them here
  await page.fill("#n", "12");
  await page.locator("#n").dispatchEvent("change");
  await drag(0, { x: 200, y: 220 });
  await drag(1, { x: 400, y: 220 });
  log("configuration 2:", await text("#status"));
  await shot("family-two");

  // The Reset button works after every option has been changed.
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
