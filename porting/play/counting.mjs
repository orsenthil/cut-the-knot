// Counting: open the board, push every option to its largest value, count
// every dot to a finished tally, then try both ends of each control and count
// from the keyboard alone (the focus must stay on a dot). "Count again" and
// "New dots" are the other scenes.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs counting
export default async ({ page, first, log, shot, text }) => {
  const isDone = () => page.evaluate(() => document.getElementById("status").classList.contains("done"));
  const opts = () => page.evaluate(() => ["countIn", "groupIn", "maxIn"].map((i) => document.getElementById(i).value).join(", "));
  const dots = () => page.locator("#dots .dot").count();
  const focusIsDot = () => page.evaluate(() => document.activeElement && document.activeElement.classList.contains("dot"));
  const set = async (id, v) => { await page.fill("#" + id, String(v)); await page.press("#" + id, "Tab"); };

  log("initial:", await dots(), "dots |", await opts());
  await shot("initial");

  // Everything at its largest: maximum 100, count 100, a big group, numbers on.
  await set("maxIn", 100);
  await set("countIn", 100);
  await set("groupIn", 7);
  await page.check("#numbersBox");
  log("all options at maximum:", await dots(), "dots |", await opts());
  await shot("max-options");

  // Count every dot, to a finished equation.
  await set("countIn", 14);
  await set("groupIn", 3);
  const n = await dots();
  for (let i = 0; i < n; i++) await page.locator("#dots .dot").nth(i).click();
  log("counted everything:", await text("#status"), "| done =", await isDone());
  await shot("explored");
  if (!first) return; // the dark run only needs the screenshots above

  // Count again, and a fresh set.
  await page.click("#againBtn");
  log("after Count again:", await text("#status"), "| done =", await isDone());
  await page.click("#newBtn");
  log("after New dots:", await text("#status"), "|", await opts());

  // Both ends of every control.
  await set("groupIn", 0);
  log("group typed 0:", await text("#status"), "|", await opts());
  await set("maxIn", 3);
  log("max typed 3:", await text("#status"), "|", await opts());
  await set("maxIn", 1000);
  log("max typed 1000:", await text("#status"), "|", await opts());
  await set("countIn", 0);
  log("count typed 0:", await text("#status"), "|", await opts());
  for (let i = 0; i < 12; i++) if (await page.locator("#maxLess").isEnabled()) await page.click("#maxLess");
  log("maximum stepped all the way down:", await opts());
  for (let i = 0; i < 12; i++) if (await page.locator("#maxMore").isEnabled()) await page.click("#maxMore");
  log("maximum stepped all the way up:", await opts());
  await set("countIn", 12); await set("groupIn", 5);

  // Keyboard alone: focus the first dot, press it twice, move on.
  await page.locator("#dots .dot").first().focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  log("after keyboard:", await text("#status"), "| focus on a dot =", await focusIsDot());
  await shot("keyboard");
};
