// Common Multiples: open the picture, push both options to their maximum,
// explore a pair with a first blue dot, try the clamped ends of both controls,
// drive the canvas with the keyboard alone (focus must stay on it), and press
// the only button. There is no winning or losing in this demo, so the "loss"
// side is the reset back to the untouched opening picture.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs common-multiples
export default async ({ page, first, log, shot, text }) => {
  const focus = () => page.evaluate(() => document.activeElement && document.activeElement.id);
  const isDone = () => page.evaluate(() => document.getElementById("status").classList.contains("done"));
  const set = async (selector, value) => {
    await page.locator(selector).evaluate((el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
  };
  const values = async () => [await page.locator("#pInput").inputValue(), await page.locator("#qInput").inputValue()];

  log("initial:", await text("#status"), "| P,Q =", (await values()).join(","));
  await shot("initial");

  // Every option at its largest value.
  await set("#pInput", 50);
  await set("#qInput", 50);
  log("all options at maximum:", await text("#status"), "| P,Q =", (await values()).join(","));
  await shot("max-options");

  // A clear exploration: the first blue dot is 12 for P = 4, Q = 6.
  await set("#pInput", 4);
  await set("#qInput", 6);
  log("explored:", await text("#status"), "| done =", await isDone());
  await shot("explored");

  if (!first) return; // the dark run only needs the screenshots above

  // Both ends of every control: below minimum, above maximum, then back.
  await set("#pInput", 0);
  await set("#qInput", 999);
  log("clamped low and high:", await text("#status"), "| P,Q =", (await values()).join(","));
  await shot("clamped");
  await set("#pInput", 1);
  log("P at the minimum:", await text("#status"), "| P,Q =", (await values()).join(","));
  await set("#qInput", 1);
  log("both at the minimum:", await text("#status"));

  // Two keyboard moves per dot, with the focus left on the canvas.
  await set("#pInput", 5);
  await set("#qInput", 8);
  await page.focus("#board");
  await page.keyboard.press("p");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("q");
  await page.keyboard.press("ArrowLeft");
  log("after keyboard moves:", await text("#status"), "| P,Q =", (await values()).join(","), "| focus =", await focus());
  await shot("keyboard");

  // The only button: reset to the untouched opening picture.
  await page.click("#newBtn");
  log("after Reset:", await text("#status"), "| P,Q =", (await values()).join(","), "| done =", await isDone());
  await shot("reset");
};
