// The Simple Automaton demo: toggle cells, try all five rules, step, run,
// clear, randomize and take the grid size to both extremes.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs simple-automaton

export default async ({ page, log, shot, text }) => {
  const count = async () => text("#count");

  log("at the start:", await count(), "|", await text("#status"));
  await shot("start");

  // Two keyboard moves on the grid: focus must survive each one.
  await page.locator('[data-i="4"][data-j="4"]').focus();
  await page.keyboard.press("Enter");
  let focus = await page.evaluate(() => document.activeElement?.dataset?.i + "," + document.activeElement?.dataset?.j);
  log("after toggling a cell, focus:", focus, "|", await count());
  await page.locator('[data-i="4"][data-j="5"]').focus();
  await page.keyboard.press("Enter");
  focus = await page.evaluate(() => document.activeElement?.dataset?.i + "," + document.activeElement?.dataset?.j);
  log("after another toggle, focus:", focus, "| status:", await text("#status"));
  await shot("cells");

  // Press every button and try every rule in a player's order.
  await page.click("#stepBtn");
  log("after Step:", await count(), "|", await text("#status"));
  await page.click("#randomBtn");
  log("after Random:", await count());
  await page.click("#runBtn");
  await page.waitForTimeout(1200);
  await page.click("#runBtn");
  log("after Run and Stop:", await count(), "|", await text("#status"));
  for (const rule of ["3n", "3d", "4n", "4d", "2n"]) {
    await page.click(`label:has(#rule-${rule})`);
    log(`rule ${rule}:`, await text("#ruleHint"), "|", await count());
  }
  await page.click("#clearBtn");
  log("after Clear:", await count(), "|", await text("#status"));
  await shot("buttons");

  // Grid size at both extremes.
  for (const value of ["1", "99"]) {
    await page.fill("#sideInput", value);
    await page.press("#sideInput", "Tab");
    log(`side entered as ${value} follows the applet and shows`, await page.inputValue("#sideInput"),
      "with", await page.locator(".cell").count(), "cells");
  }
  await shot("maximum");

  // A single cell under rule 2n dies in exactly one step.
  await page.fill("#sideInput", "3");
  await page.press("#sideInput", "Tab");
  await page.click("#clearBtn");
  await page.locator('[data-i="0"][data-j="0"]').click();
  await page.click("#stepBtn");
  log("single cell after one step:", await count(), "|", await text("#status"));
  log("final status class:", await page.getAttribute("#status", "class"));
  await shot("final");
};
