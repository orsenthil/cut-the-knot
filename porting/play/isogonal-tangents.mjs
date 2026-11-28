// Isogonal Tangents is an illustration, so there is no win or loss: show two
// different ray configurations and the three second tangents meeting at X.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs isogonal-tangents
export default async ({ page, first, log, shot, text }) => {
  const move = async (label, keys) => {
    await page.focus(`#board circle[aria-label^="Point ${label}."]`);
    for (const key of keys) await page.keyboard.press(key);
  };

  // First configuration: swing two rays with the keyboard alone, then hide
  // the labels so the three tangents and their common point stand out.
  await move("U", ["ArrowRight", "ArrowDown", "ArrowDown"]);
  await move("V", ["ArrowLeft", "ArrowDown"]);
  await page.click("#namesBtn");
  log("first configuration:", await text("#status"));
  await shot("first");
  if (!first) return; // the dark run only needs this screenshot

  // Second configuration: reset, move the common origin and the upper ray,
  // and bring the names back. The status still reports one meeting point.
  await page.click("#newBtn");
  await move("O", ["ArrowRight", "ArrowDown"]);
  await move("W", ["ArrowRight", "ArrowUp", "ArrowUp"]);
  await page.click("#namesBtn");
  log("second configuration:", await text("#status"));
  await shot("second");
};
