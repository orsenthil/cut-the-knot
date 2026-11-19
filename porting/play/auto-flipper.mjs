// Auto Flipper: a demo, so "explored" is the end. Set N to its maximum, play
// with the keyboard and every button, then check both option extremes.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs auto-flipper
export default async ({ page, first, log, shot, text }) => {
  const focus = () => page.evaluate(() => {
    const el = document.activeElement;
    return el ? (el.id || el.className || el.tagName) : "none";
  });
  const setN = async (n) => {
    await page.locator("#nInput").fill(String(n));
    await page.locator("#nInput").press("Tab"); // fires change and blur
  };
  const count = () => page.locator(".pancake").count();

  log("initial:", await text("#status"), "| pancakes:", await count());
  await shot("start");

  // The only option, at its maximum: sixteen pancakes.
  await setN(16);
  log("maximum N:", await text("#status"), "| pancakes:", await count(), "| focus:", await focus());
  await shot("max-16");

  // Two keyboard-only moves. Focus a pancake, press Enter, then arrow and
  // Enter again; after each flip the focus must still be on a pancake.
  await page.focus(".pancake:nth-child(3)");
  log("focus before keyboard moves:", await focus());
  await page.keyboard.press("Enter");
  log("keyboard move 1:", await text("#status"), "| focus:", await focus());
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  log("keyboard move 2:", await text("#status"), "| focus:", await focus());
  await shot("after-keyboard");

  if (!first) return; // the dark run only needs the screenshots above

  // Every button in the order a player would press them.
  await page.click("#oneFlip");
  log("after One flip:", await text("#status"));
  await page.click("#oneFlip");
  log("after a second One flip:", await text("#status"));
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await shot("reset");

  // Keyboard shortcuts F and R, with focus out of the number field.
  await page.locator(".stack-heading").click();
  await page.keyboard.press("f");
  log("after F:", await text("#status"));
  await page.keyboard.press("r");
  log("after R:", await text("#status"));

  // Both option extremes, including a Max below Min and a Min above Max.
  await setN(1);
  log("below the minimum:", await text("#status"), "| pancakes:", await count(), "| value:", await page.locator("#nInput").inputValue());
  await setN(99);
  log("above the maximum:", await text("#status"), "| pancakes:", await count(), "| value:", await page.locator("#nInput").inputValue());
  await shot("clamped-16");

  // Flip until the demo is explored, and say in words what changed.
  for (let i = 0; i < 40 && !(await text("#status")).includes("stopped"); i++) {
    await page.click("#oneFlip");
  }
  log("finished:", await text("#status"), "| status class:", await page.locator("#status").getAttribute("class"));
  await shot("finished");
};
