// Blithe 12: two configurations of the numbered and six-colour puzzles.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs blithe-12
export default async ({ page, first, log, shot, idle, text }) => {
  const knob = (counter) => page.locator(`#board [data-counter="${counter}"]`);
  const drag = async (counter, dx, dy) => {
    const box = await knob(counter).boundingBox();
    if (!box) throw new Error(`no knob for counter ${counter + 1}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 8 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // Configuration 1: the 12 Numbers puzzle, shuffled, then two circle turns.
  await page.click("#shuffleBtn");
  await drag(0, 26, -18);
  log("after dragging counter 1:", await text("#status"));
  await knob(3).click();
  await page.click("#cyclesBox");
  log("with cycles:", await text("#status"));
  await shot("numbers");

  // Configuration 2: the six-colour puzzle, shuffled and turned again.
  await page.click("#newBtn");
  await page.selectOption("#modeSelect", "3");
  log("mode:", await text("#status"));
  await page.click("#shuffleBtn");
  await knob(6).click();
  await knob(10).click();
  log("after two turns:", await text("#status"));
  await shot("colours");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard: two turns, then check that the focus is still on the knob.
  await knob(11).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("data-counter") || "");
  log("focused counter after keyboard turns:", focused);
  log("status after keyboard:", await text("#status"));

  await page.click("#cheatBtn");
  log("after Cheat:", await text("#status"));
  await page.selectOption("#modeSelect", "4");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
