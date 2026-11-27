// Chasles Tangents: an illustration, so there is no win or loss. Show two
// different configurations of the circle, its tangents and the point K.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs chasles-tangents
export default async ({ page, first, log, shot, text }) => {
  const move = async (label, keys) => {
    await page.focus(`#board circle[aria-label^="${label}"]`);
    for (const key of keys) await page.keyboard.press(key);
  };

  // First configuration: move two points with the keyboard alone, then turn
  // on the angle hint and the names as a player would.
  await move("Point B.", ["ArrowRight", "ArrowDown"]);
  // Walk K past the centre line to the other arc: the angle hint now shows
  // the supplement, while the number under the picture does not change.
  await move("Point K.", Array(42).fill("ArrowRight"));
  await page.click("#hintBtn");
  await page.click("#namesBtn");
  log("first configuration:", await text("#status"));
  await shot("first");
  if (!first) return; // the dark run only needs the first screenshot

  // Second configuration: reset, resize the circle from its radius handle,
  // then move the tangent point and one of the four points.
  await page.click("#newBtn");
  await move("Circle radius.", ["ArrowRight", "ArrowRight"]);
  await move("Point T.", ["ArrowRight", "ArrowUp"]);
  await move("Point D.", ["ArrowDown", "ArrowLeft"]);
  log("second configuration:", await text("#status"));
  await shot("second");
};
