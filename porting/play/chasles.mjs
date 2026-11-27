// Chasles: an illustration, so there is no win or loss. Show two different
// configurations of the six points and the ellipse, with the Pascal crossings.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs chasles
export default async ({ page, log, shot, text }) => {
  const move = async (label, keys) => {
    await page.focus(`#board circle[aria-label^="${label}"]`);
    for (const key of keys) await page.keyboard.press(key);
  };

  // First configuration: drag B and D along the conic with the keyboard,
  // then turn on the crossing names like the applet's "Show names" checkbox.
  await move("Point B.", ["ArrowRight", "ArrowRight", "ArrowDown"]);
  await move("Point D.", ["ArrowLeft", "ArrowUp"]);
  await page.click("#namesBtn");
  log("first configuration:", await text("#status"));
  await shot("first");

  // Second configuration: reshape the bounding box from one of its corners
  // and move two more points; press Reset first, as a player would.
  await page.click("#newBtn");
  await move("Box corner 0.", ["ArrowLeft", "ArrowUp", "ArrowUp"]);
  await move("Point C.", ["ArrowDown", "ArrowDown", "ArrowRight"]);
  await move("Point F.", ["ArrowLeft", "ArrowDown"]);
  log("second configuration:", await text("#status"));
  await shot("second");
};
