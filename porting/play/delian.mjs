// The Delian construction: open on N = 2, push N to both ends (2 and 20) and
// past them, look at N = 3 (the "cube root") and N = 12 (the reader's case),
// toggle the compass arc, step with the buttons and the keyboard (the focus must
// stay on the number box), and Reset. No winning or losing: looking at N = 3 or 12
// is its "done"; "Reset" is the second scene.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs delian
export default async ({ page, first, log, shot, text }) => {
  const isDone = () => page.evaluate(() => document.getElementById("status").classList.contains("done"));
  const focus = () => page.evaluate(() => document.activeElement && document.activeElement.id);
  const rows = () => page.locator("#rows tr").count();
  const set = async (v) => { await page.fill("#nIn", String(v)); await page.press("#nIn", "Tab"); };

  log("initial:", await text("#summary"), "|", await rows(), "rows");
  await shot("initial");

  // Largest N.
  await set(20);
  log("N = 20:", await text("#summary"), "|", await rows(), "rows | more enabled =", await page.locator("#nMore").isEnabled());
  await shot("max-options");

  // The cube-root case and the reader's case.
  await set(3);
  log("N = 3:", await text("#summary"), "| done =", await isDone());
  await shot("explored");
  if (!first) return; // the dark run only needs the screenshots above

  await set(12);
  log("N = 12:", await text("#summary"), "| done =", await isDone());
  await shot("twelve");

  // Both ends and past them.
  await set(2); log("N = 2:", await text("#summary"), "| less enabled =", await page.locator("#nLess").isEnabled());
  await set(1); log("N typed 1:", await text("#status"), "|", await page.inputValue("#nIn"));
  await set(21); log("N typed 21:", await text("#status"), "|", await page.inputValue("#nIn"));
  await set(0); log("N typed 0:", await page.inputValue("#nIn"));

  // The buttons and the compass arc.
  await page.click("#nMore"); await page.click("#nMore");
  log("two plus presses:", await page.inputValue("#nIn"));
  await page.click("#nLess");
  log("one minus press:", await page.inputValue("#nIn"));
  await page.uncheck("#arcBox"); log("arc hidden:", await text("#status"));
  await page.check("#arcBox");

  // Keyboard alone: focus the number box and use the arrow keys.
  await page.focus("#nIn");
  await page.keyboard.press("ArrowUp"); await page.keyboard.press("ArrowUp");
  log("after keyboard:", await page.inputValue("#nIn"), "| focus =", await focus());
  await shot("keyboard");

  await page.click("#resetBtn");
  log("after Reset:", await text("#summary"), "| done =", await isDone());
  await shot("reset");
};
