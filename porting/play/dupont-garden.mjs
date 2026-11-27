// Dupont Garden: two configurations of the six-schedule water show.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs dupont-garden
export default async ({ page, first, log, shot, idle, text }) => {
  // Configuration 1: a fast pattern with twenty beads on every jet.
  await page.selectOption("#scheduleSel", "fast-lr");
  await page.fill("#dropsInput", "20");
  await page.dispatchEvent("#dropsInput", "change");
  await page.fill("#delayInput", "30");
  await page.dispatchEvent("#delayInput", "change"); // SetInterval resets and runs
  await page.waitForTimeout(320);
  log("fast jets:", await text("#status"));
  log("run button:", await page.textContent("#runBtn"));
  await shot("fast-jets");

  // Stop and run again: the applet's button changes label both ways.
  await page.click("#runBtn");
  log("after Stop:", await text("#status"));
  await page.click("#runBtn");
  log("after Run:", await text("#status"));

  // Configuration 2: one bead, slow jets to the left, read with the keyboard.
  await page.selectOption("#scheduleSel", "slow-rl");
  await page.fill("#dropsInput", "1");
  await page.dispatchEvent("#dropsInput", "change");
  await page.fill("#delayInput", "10");
  await page.dispatchEvent("#delayInput", "change");
  const handle = page.locator("#board .geom-handle").first();
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  log("probes:", await text("#board .flight-note"));
  log("focus after keys:", await page.evaluate(() =>
    document.activeElement && document.activeElement.getAttribute("aria-label")));
  await page.click("#bRight"); // the fingertip-sized button moves probe B too
  await idle(() => document.getElementById("status").classList.contains("done"));
  log("after every jet lands:", await text("#status"));
  await shot("slow-landed");

  await page.click("#replayBtn");
  log("after Replay:", await text("#status"));
};
