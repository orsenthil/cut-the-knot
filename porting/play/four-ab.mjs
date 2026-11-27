// Four AB: an illustration, not a game. Show two configurations — the
// circle large enough for the puzzle's condition, and one too small — and
// exercise every control, including two keyboard-only moves of the centre.
// Run with: export NODE_PATH=$(npm root -g); node porting/play.mjs four-ab
export default async ({ page, first, log, shot, idle, text }) => {
  const client = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const handlePos = () => page.evaluate(() => {
    const h = document.querySelector("#board .geom-handle");
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  });

  const setSlider = (value) => page.evaluate((v) => {
    const el = document.getElementById("radiusSlider");
    el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);

  const dragP = async (x, y) => {
    const from = await handlePos();
    const a = await client(from.x, from.y);
    const b = await client(x, y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 14 });
    await page.mouse.up();
    await idle();
  };

  await shot("start");
  log("start:", await text("#status"));

  // Configuration 1: full radius, helper lines on, P dragged right and up.
  await setSlider(100);
  await page.check("#extraChk");
  await dragP(500, 110);
  log("configuration 1 (large circle):", await text("#status"));
  await shot("large-circle");

  // Configuration 2: small radius, no helpers, P back near its start.
  await page.uncheck("#extraChk");
  await setSlider(24);
  await dragP(426, 155);
  log("configuration 2 (small circle):", await text("#status"));
  await shot("small-circle");

  if (!first) return;

  // Press every button and take every option both ways.
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await setSlider(0);
  log("slider at 0:", await text("#status"));
  await setSlider(100);
  log("slider at 100:", await text("#status"));
  await page.check("#extraChk");
  await page.uncheck("#extraChk");

  // Two keyboard-only moves; the centre must keep focus after each redraw.
  const before = await handlePos();
  await page.focus("#board .geom-handle");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowUp");
  const after = await handlePos();
  await idle();
  log("keyboard moved the circle:", before.x !== after.x || before.y !== after.y,
    JSON.stringify(before), "->", JSON.stringify(after));
  log("focus stays on the centre:", await page.evaluate(
    () => !!document.activeElement && document.activeElement.classList.contains("geom-handle")));
  log("after keyboard:", await text("#status"));
};
