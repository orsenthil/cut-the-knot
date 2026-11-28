// Lemma: a drawing, not a game. Drag point D to two different configurations
// and read the matching salinon and circle areas off the status line.
// Run with: export NODE_PATH=$(npm root -g); node porting/play.mjs lemma
export default async ({ page, first, log, shot, idle, text }) => {
  const client = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const handlePos = () => page.evaluate(() => {
    const h = document.querySelector("#board .geom-handle");
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  });

  const dragD = async (toX) => {
    const from = await handlePos();
    const a = await client(from.x, from.y);
    const b = await client(toX, from.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 16 });
    await page.mouse.up();
    await idle();
  };

  await shot("start");

  // Configuration 1: D close to O, so DE is tiny and the circle is smallest.
  await dragD(115);
  log("configuration 1 (D near O):", await text("#status"));
  await shot("near-middle");

  // Configuration 2: D near A, so the two small semicircles almost vanish.
  await dragD(30);
  log("configuration 2 (D near A):", await text("#status"));
  await shot("near-A");

  // Press every button and take the option both ways.
  await page.click("#symBtn");
  log("after Symmetric:", await text("#status"));
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await page.uncheck("#shadeChk");
  await page.check("#shadeChk");

  // Two keyboard-only moves, checking that focus stays on the handle.
  const before = await handlePos();
  await page.focus("#board .geom-handle");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowLeft");
  const after = await handlePos();
  await idle();
  log("keyboard moved D:", before.x !== after.x);
  log("focus stays on D:", await page.evaluate(
    () => !!document.activeElement && document.activeElement.classList.contains("geom-handle")));

  if (!first) return;
  await page.click("#symBtn");
  log("final symmetric view:", await text("#status"));
};
