// Diameters And Chords: an illustration, so the two configurations show the
// general case and the moment the two pairs of points coincide.  The second
// one is reached with the keyboard alone.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs diameters-and-chords
export default async ({ page, first, log, shot, idle, text }) => {
  const client = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const handlePos = (name) => page.evaluate((id) => {
    const h = document.getElementById(id);
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  }, "handle-" + name);

  const drag = async (name, to) => {
    const from = await handlePos(name);
    const a = await client(from.x, from.y);
    const b = await client(to.x, to.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 16 });
    await page.mouse.up();
    await idle();
  };

  // Configuration 1: move chord point Ab and one end of the third diameter.
  // The opposite end of that diameter must follow, and the status reports the
  // two distances so the change is visible without looking at a colour.
  const mtBefore = await handlePos("mt");
  await drag("ab", { x: 280, y: 140 });
  await drag("mt", { x: 100, y: 300 });
  const mtAfter = await handlePos("mt");
  const ntAfter = await handlePos("nt");
  log("configuration 1:", await text("#status"));
  log("diameter ends stayed opposite:", Math.hypot(
    mtAfter.x + ntAfter.x - 400, mtAfter.y + ntAfter.y - 432) < 1,
  "Mt moved from", `${Math.round(mtBefore.x)},${Math.round(mtBefore.y)}`);
  await shot("moved");

  // Configuration 2: reset, then move Ac onto Ab with the arrow keys only.
  await page.click("#resetBtn");
  await page.focus("#handle-ac");
  let presses = 0;
  for (; presses < 16; presses++) {
    await page.keyboard.press("ArrowLeft");
    await idle();
    if ((await text("#status")).includes("meet")) break;
  }
  log("configuration 2 after", presses + 1, "key presses:", await text("#status"));
  log("focus stayed on the board point:", await page.evaluate(
    () => !!document.activeElement && document.activeElement.id === "handle-ac"));
  await shot("joined");

  if (!first) return;

  // Press both controls in both directions and confirm the status follows.
  await page.click("#hint");
  log("hint off:", await text("#status"));
  await page.click("#hint");
  await page.click("#names");
  await page.click("#names");
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
