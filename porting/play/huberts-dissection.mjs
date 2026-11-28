// Huberts Dissection: show the half-turn rhombus, then a triangle where the
// circle misses AB so the cut cannot be made. Run with:
//   NODE_PATH=$(npm root -g) node porting/play.mjs huberts-dissection
export default async ({ page, first, log, shot, text }) => {
  const setRange = (selector, value) => page.$eval(
    selector,
    (el, v) => {
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    },
    String(value),
  );
  const corner = (name) => page.locator(`#board [aria-label^="Corner ${name}."]`);
  const dragTo = async (name, x, y) => {
    const dot = await corner(name).boundingBox();
    const board = await page.locator("#board").boundingBox();
    if (!dot || !board) throw new Error(`cannot find corner ${name} or the board`);
    await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
    await page.mouse.down();
    await page.mouse.move(board.x + (x / 480) * board.width,
      board.y + (y / 320) * board.height, { steps: 10 });
    await page.mouse.up();
  };

  log("opening:", await text("#status"));

  // Configuration 1: the applet's starting triangle, swivelled all the way.
  await page.click("#namesBox");
  await setRange("#angle", 180);
  log("half-turn:", await text("#status"), "| angle:", await page.locator("#angle").inputValue());
  await shot("rhombus");

  if (first) {
    // The range input is keyboard operated; the slider follows arrow keys.
    await page.locator("#angle").focus();
    await page.keyboard.press("ArrowLeft");
    const before = await page.locator("#angle").inputValue();
    await page.keyboard.press("ArrowRight");
    log("slider by keyboard:", before, "->", await page.locator("#angle").inputValue());
    await setRange("#angle", 180);
  }

  // Configuration 2: a tall, thin acute triangle with AM > AB but BM > AB.
  await dragTo("B", 260, 280);
  await dragTo("C", 240, 60);
  await page.click("#hintBox");
  log("no cut:", await text("#status"));
  await shot("no-cut");

  if (first) {
    // Arrow keys must move a corner and leave focus on that same handle.
    await corner("A").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
    log("after two arrow keys, focus:", focused);
    if (!focused.startsWith("Corner A.")) throw new Error("keyboard focus left corner A");
  }

  // Both ends of the applet's scrollbar, then Reset.
  await setRange("#angle", 0);
  log("angle 0:", await text("#status"));
  await setRange("#angle", 185);
  log("angle 185:", await text("#status"));
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
