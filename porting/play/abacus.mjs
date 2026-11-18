// The Abacus demo: build a number on one abacus, then switch to base 2 with
// two abaci and Sync, and move counters to see the other abacus respond.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs abacus

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text(".readout"));
  await shot("start");

  // Push seven counters onto the units wire by clicking the upper counter
  // three down from the bar (10 - 0 - 3 = 7).
  await page.click('.counter[data-abacus="0"][data-wire="6"][data-part="upper"][data-index="3"]');
  log("after adding seven:", await text(".readout"), "|", await text("#status"));
  await shot("number");

  if (first) {
    // Keyboard: focus a counter and activate it with Enter.
    await page.focus('.counter[data-abacus="0"][data-wire="6"][data-part="lower"][data-index="6"]');
    await page.keyboard.press("Enter");
    log("after a keyboard click:", await text(".readout"));
    await shot("keyboard");

    // Every option in both directions: radix, wires, abacus count, Sync.
    await page.selectOption("#radixInput", "16");
    await page.selectOption("#radixInput", "8");
    await page.selectOption("#wiresInput", "3");
    await page.selectOption("#wiresInput", "7");
    await page.selectOption("#countInput", "2");
    log("two abaci:", await page.locator(".abacus").count(), "readouts");
    await page.uncheck("#syncCheck");
    await page.check("#syncCheck");
    await page.click("#resetBtn");
    log("after reset:", await text("#status"));
  }

  // Base 2, four wires, two abaci in Sync: one goes down as the other goes up.
  await page.selectOption("#countInput", "2");
  await page.selectOption("#radixInput", "2");
  await page.selectOption("#wiresInput", "4");
  await page.uncheck("#syncCheck");
  // Put one counter on abacus 1 with Sync off, so the other stays at zero.
  await page.click('.counter[data-abacus="0"][data-wire="3"][data-part="upper"][data-index="1"]');
  await page.check("#syncCheck");
  const before = await page.locator(".readout").allTextContents();
  await page.click('.counter[data-abacus="0"][data-wire="3"][data-part="lower"][data-index="0"]');
  const after = await page.locator(".readout").allTextContents();
  log("before Sync:", before.join(" / "));
  log("after Sync:", after.join(" / "), "|", await text("#status"));
  await shot("sync");
};
