// Barygon: two configurations — a one-round paragon and a long convergence.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs barygon
export default async ({ page, first, log, shot, idle, text }) => {
  const setNumber = async (id, value) => {
    const el = page.locator(`#${id}`);
    await el.fill(String(value));
    await el.press("Tab"); // the applet's number canvases notify on a change
  };
  const corner = (n) => page.locator(`#board [aria-label^="Vertex ${n}."]`);
  const drag = async (n, dx, dy) => {
    const box = await corner(n).boundingBox();
    if (!box) throw new Error(`no handle for vertex ${n}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 8 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // 1. Six corners, average over 9 = 3*(N/2): a paragon in one round.
  await setNumber("naInput", 9);
  await page.click("#checkBtn");
  log("K=9, one round:", await text("#status"));
  await shot("paragon");

  // 2. Average over 8, twelve rounds, and a dragged corner: approaches a
  //    paragon but never matches exactly.
  await setNumber("naInput", 8);
  await setNumber("niInput", 12);
  await drag(2, 48, -30);
  await page.click("#checkBtn");
  log("K=8, twelve rounds:", await text("#status"));
  await shot("converging");

  if (!first) return; // the dark run only needs both screenshots

  // Two moves with the keyboard alone; focus must stay on the board.
  await corner(3).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Every button, and every option in both directions.
  await page.click("#centreBtn");
  log("centre shown:", await text("#status"));
  await page.click("#centreBtn");
  await page.click("#newBtn");
  log("after New polygon:", await text("#status"));

  await setNumber("nInput", 20);
  await setNumber("nInput", 7);
  await setNumber("nInput", 6);
  log("six corners again:", await text("#status"));
  await setNumber("naInput", 2);
  await setNumber("naInput", 20);
  await setNumber("naInput", 9);
  await setNumber("niInput", 20);
  await setNumber("niInput", 1);
  await setNumber("niInput", 12);
  await page.click("#checkBtn");
  log("after all options:", await text("#status"));
  await shot("options");
};
