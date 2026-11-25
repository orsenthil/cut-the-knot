// Magic in a Square: think of a number, answer twice, and see it named; then the largest size.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs magic-in-square
export default async ({ page, first, log, shot, text }) => {
  const read = () => page.evaluate(() => Array.from(document.querySelectorAll(".cell")).map((c) => Number(c.textContent)));
  const cols = (n) => page.evaluate((n) => Array.from(document.querySelectorAll(".cell")).map((c) => Number(c.textContent)).map((v, i) => [v, i % n]), n);
  const n = Number(await page.locator("#n").inputValue());
  const thought = (await read())[7]; // the number in a fixed place
  const where = async () => (await cols(n)).find(([v]) => v === thought)[1];
  await page.locator(".pick").nth(await where()).click();
  log("after the first answer:", await text("#prompt"));
  await shot("second question");
  await page.locator(".pick").nth(await where()).click();
  log("revealed:", (await text("#prompt")).replace(/\s+/g, " "), "| thought of", thought);
  await shot("revealed");
  if (!first) return;
  await page.locator("#n").evaluate((el) => { el.value = 6; el.dispatchEvent(new Event("input", { bubbles: true })); });
  log("size 6:", (await read()).length, "cells");
  await shot("six");
  await page.keyboard.press("Tab");
  await page.click("#resetBtn");
  log("after reset:", (await text("#prompt")).replace(/\s+/g, " "));
};
