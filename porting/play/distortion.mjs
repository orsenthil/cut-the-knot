// Distortion: a drawing, not a game. Show the two configurations of the
// applet — triangles on wide-spaced circles, then circles on tightly nested
// triangles — and check the slider, the mode buttons, Reset and arrow keys.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs distortion
export default async ({ page, first, log, shot, idle, text }) => {
  const spacing = async (value) => {
    await page.evaluate((v) => {
      const el = document.getElementById("spread");
      el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
    await idle();
  };

  // Configuration 1: the applet's first checkbox, spacing 36 (fewest rings).
  await spacing(36);
  log("configuration 1:", await text("#status"));
  await shot("triangles-on-circles");

  // Configuration 2: the other checkbox, spacing 2 (most triangles).
  await spacing(2);
  await page.click("#circlesOnTriangles");
  log("configuration 2:", await text("#status"));
  await shot("circles-on-triangles");

  if (first) {
    const finished = await page.evaluate(() => document.getElementById("status").classList.contains("done"));
    log("exploration marked done:", finished);

    // Move the spacing dot with the keyboard alone, in both directions, and
    // check that focus survives the redraw after each press.  Start away from
    // the ends of the slider so both arrows can actually change the value.
    await spacing(10);
    await page.focus("#board .geom-handle");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    const afterLeft = await page.evaluate(() => ({
      focus: document.activeElement === document.querySelector("#board .geom-handle"),
      spacing: document.getElementById("spread").value,
    }));
    log("after two ArrowLeft presses:", JSON.stringify(afterLeft));
    await page.keyboard.press("ArrowRight");
    const afterRight = await page.evaluate(() => ({
      focus: document.activeElement === document.querySelector("#board .geom-handle"),
      spacing: document.getElementById("spread").value,
    }));
    log("after one ArrowRight press:", JSON.stringify(afterRight));
  }

  // Press the other mode button and Reset in the order a player would.
  await page.click("#triOnCircles");
  await spacing(36);
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
