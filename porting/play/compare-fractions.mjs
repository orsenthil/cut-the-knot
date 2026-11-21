// Compare Fractions: open the picture, push every option to its largest value
// (the 99s), compare, press both buttons in a player's order, try both ends of
// the digit range, and drive the digits with the keyboard alone.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs compare-fractions
export default async ({ page, first, log, shot, text }) => {
  const nums = () => page.evaluate(() => [...document.querySelectorAll(".fraction")].map((f) => [...f.querySelectorAll(".num")].map((n) => n.textContent).join("/")).join("  vs  "));
  const isDone = () => page.evaluate(() => document.getElementById("status").classList.contains("done"));
  const press = (field, k, dir) => page.evaluate(([f, kk, d]) => {
    const b = document.querySelector(`.digit[data-field="${f}"][data-k="${kk}"]`);
    const r = b.getBoundingClientRect();
    b.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: r.left + 2, clientY: d > 0 ? r.top + 2 : r.bottom - 2 }));
  }, [field, k, dir]);

  log("initial:", await nums(), "|", await text("#status"));
  await shot("initial");

  // Everything at its largest: raise each number until it sticks at 99.
  for (const f of ["n1", "d1", "n2", "d2"]) {
    for (let i = 0; i < 12; i++) await press(f, f.length ? (await page.locator(`.digit[data-field="${f}"]`).count()) - 1 : 0, 1);
  }
  log("all at maximum:", await nums(), "|", await text("#status"));
  await shot("max-options");

  // 97 / 89 make the common denominator too big to draw.
  await page.click("#commonBtn");
  log("after Common denominator:", await nums(), "|", await text("#status"), "| common disabled =", await page.locator("#commonBtn").isDisabled());
  await shot("explored");
  await page.click("#simplifyBtn");
  log("after Simplify:", await nums(), "| done =", await isDone());

  if (!first) return; // the dark run only needs the screenshots above

  // Both ends of the digit range.
  for (let i = 0; i < 12; i++) await press("n1", 0, -1);
  log("lowered past 1:", await nums());
  for (let i = 0; i < 12; i++) await press("n2", 0, 1);
  log("raised:", await nums());

  // Keyboard alone: focus a digit and press Up twice; focus must stay on a digit.
  await page.focus('.digit[data-field="d1"]');
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  log("keyboard:", await nums(), "| focus is a digit =", await page.evaluate(() => document.activeElement.classList.contains("digit")));
  await shot("keyboard");

  await page.click("#newBtn");
  log("after New fractions:", await nums(), "| done =", await isDone());
  await shot("reset");
};
