// The Collatz trail demo: follow 27 to its loop, then set every option to its
// largest value, try the smallest settings, drive the chart with the keyboard
// alone, press every button and finish with a start that hits the step cap.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs collatz
export default async ({ page, first, log, shot, idle, text }) => {
  const setNumber = (value) => page.locator("#numberInput").evaluate((el, v) => {
    el.value = v;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, String(value));
  const setDigits = (value) => page.locator("#digitsInput").evaluate((el, v) => {
    el.value = v;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, String(value));

  log("initial:", await text("#status"), "| start", await page.inputValue("#numberInput"));
  await shot("initial");

  // A finished trail: divide by 2 from 27 closes on 4, 2, 1 after 112 steps.
  await setNumber(27);
  await page.click("#allBtn");
  log("after a finished trail:", await text("#status"), "| step", await text("#stepReadout"));
  await shot("done");

  if (!first) return; // the dark run only needs the screenshots above

  // Every option at its largest value: 15 digits, stripping, (3n+1)/2 on.
  await setDigits(15);
  await page.check("#stripRadio");
  await page.check("#shortenCheck");
  await page.click("#newBtn");
  log("maximum options:", await text("#status"), "| start", await page.inputValue("#numberInput"));
  await page.click("#allBtn");
  log("maximum trail:", await text("#status"), "| shown", await text("#stepReadout"));
  await shot("max");

  // The other extreme: 1 digit, the number 1, dividing, no shortening.
  await setDigits(1);
  await page.uncheck("#shortenCheck");
  await page.check("#divideRadio");
  await setNumber(1);
  await page.click("#allBtn");
  log("minimum options:", await text("#status"), "| step", await text("#stepReadout"));
  await shot("min");

  // Two keyboard steps with the chart focused, then a check that focus stayed.
  await setNumber(8);
  await page.focus("#plot");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.id);
  log("two arrow keys:", await text("#status"), "| step", await text("#stepReadout"), "| focus", focused);
  await shot("keyboard");

  await page.keyboard.press("ArrowLeft");
  log("back one arrow key:", await text("#status"), "| step", await text("#stepReadout"));

  // Every button, in the order a player would use them.
  await page.click("#resetBtn");
  log("after Reset trail:", await text("#status"), "| step", await text("#stepReadout"));
  await page.click("#stepBtn");
  log("after Next step:", await text("#status"), "| step", await text("#stepReadout"));
  await page.locator("#digitsInput").evaluate((el) => {
    el.value = "3";
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.click("#newBtn");
  log("after New number:", await text("#status"), "| start", await page.inputValue("#numberInput"));

  // A dead end: a 15-digit start that outgrows the numbers the page can hold.
  // Back to the plain rule first, so the message is about the size of the trail.
  await page.check("#divideRadio");
  await page.uncheck("#shortenCheck");
  await setDigits(15);
  await setNumber(999999999999999);
  await page.click("#allBtn");
  log("problematic start:", await text("#status"), "| shown", await text("#stepReadout"));
  await shot("cap");

  // A start that reaches the 150-step limit without closing a loop.
  await setNumber(100000000012345);
  await page.click("#allBtn");
  log("150-step limit:", await text("#status"), "| shown", await text("#stepReadout"));
  await shot("dead-end");
};
