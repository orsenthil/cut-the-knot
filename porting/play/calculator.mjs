// Broken Calculator: explore a generated round, find a number, then press every key.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs calculator
export default async ({ page, first, log, shot, idle, text }) => {
  // A fixed seed makes the broken set reproducible in both colour schemes.
  await page.goto(page.url() + "?seed=3");
  await idle();
  log("initial display:", await text("#display"), "| numbers found:", await text("#progress"));
  log("initial words:", await text("#status"));
  await shot("initial");

  // The only option is the memory checkbox; its maximum is "on".
  await page.check("#useMemory");
  log("memory option on:", await text("#status"), "| M+ disabled:",
    await page.$eval('.calc-key[data-key="M+"]', (e) => e.disabled));
  await shot("max-options");

  // Two keyboard moves, with a focus check after the calculator replies.
  const digits = await page.$$eval(".calc-key", (els) =>
    els.filter((e) => !e.disabled && /^[2-9]$/.test(e.dataset.key)).map((e) => e.dataset.key));
  if (digits.length < 2) throw new Error("this round should offer at least two working digits");
  await page.focus("#stage");
  await page.keyboard.press(digits[0]);
  await page.keyboard.press("Enter"); // equals
  const words = await text("#status");
  const done = await page.evaluate(() => document.getElementById("status").classList.contains("done"));
  log(`typed ${digits[0]} then Enter: display "${await text("#display")}", found "${await text("#progress")}"`);
  log("words:", words, "| marked done:", done);
  if (!done || !/new number to tick off/.test(words)) throw new Error("finding a number did not say what changed");
  await shot("found-number");

  await page.keyboard.press(digits[1]);
  const focus = await page.evaluate(() => {
    const el = document.activeElement;
    return el && (el.id || el.dataset.key || el.tagName);
  });
  log("after a second keyboard move: focus:", focus, "| display:", await text("#display"), "|", await text("#status"));
  if (focus !== "stage") throw new Error("focus left the calculator after the keyboard moves");
  await shot("keyboard");

  if (!first) return; // the dark run only needs the screenshots above

  // Press every key in player order. Crossed-out keys cannot be pressed in the
  // applet either, so they are logged as broken instead of clicked.
  const keys = await page.$$eval(".calc-key", (els) => els.map((e) => ({ key: e.dataset.key, disabled: e.disabled })));
  log("keypad:", keys.map((k) => (k.disabled ? `${k.key}(broken)` : k.key)).join(" "));
  for (const { key, disabled } of keys) {
    if (disabled) continue;
    await page.click(`.calc-key[data-key="${key}"]`);
    log(`pressed ${key}: display "${await text("#display")}" | ${await text("#status")}`);
  }
  await shot("all-keys");

  // Both Reset and New exist; New redraws the broken set.
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"), "| found:", await text("#progress"));
  await page.click("#newBtn");
  log("after New:", await text("#status"), "| found:", await text("#progress"));
  await shot("new-calculator");

  // Both extremes of the option.
  await page.uncheck("#useMemory");
  log("memory off:", await text("#status"), "| M+ disabled:",
    await page.$eval('.calc-key[data-key="M+"]', (e) => e.disabled));
  await page.check("#useMemory");
  log("memory on again:", await text("#status"), "| M+ disabled:",
    await page.$eval('.calc-key[data-key="M+"]', (e) => e.disabled));
  await shot("option-extremes");

  log("final words:", await text("#status"), "| numbers found:", await text("#progress"));
};
