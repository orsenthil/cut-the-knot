// The distributive law: cut the block all the way down, then try the options.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs distributive-law
export default async ({ page, first, log, shot, text }) => {
  const isDone = () => page.evaluate(() => document.getElementById("status").classList.contains("done"));
  const focus = () => page.evaluate(() => document.activeElement && document.activeElement.id);
  const hist = () => page.locator("#history li").count();
  const press = async (cx, cy) => { // a click at a gap position in cell units
    await page.evaluate(() => document.getElementById("board").scrollIntoView({ block: "center" }));
    const b = await page.locator("#board").boundingBox();
    const [nx, ny] = await page.evaluate(() => [Number(document.getElementById("nxIn").value), Number(document.getElementById("nyIn").value)]);
    const cell = Math.min((420 - 28) / nx, (340 - 28) / ny), x0 = (420 - cell * nx) / 2, y0 = (340 - cell * ny) / 2;
    await page.mouse.click(b.x + ((x0 + cx * cell) / 420) * b.width, b.y + ((y0 + cy * cell) / 340) * b.height);
  };
  log("initial:", await text("#expr"));
  await shot("initial");
  await page.fill("#nxIn", "12"); await page.fill("#nyIn", "12"); await page.press("#nyIn", "Tab"); await page.check("#parBox");
  log("largest board:", (await text("#expr")).slice(0, 40));
  await shot("max-options");
  await page.fill("#nxIn", "5"); await page.fill("#nyIn", "4"); await page.press("#nyIn", "Tab");
  await press(2, 2.5); // between column 2 and 3
  log("one cut:", await text("#expr"), "|", await hist(), "written");
  await press(1, 2); await press(3.5, 1); // a row cut in the left piece, and one in the right
  log("three cuts:", await text("#expr"));
  await shot("explored");
  if (!first) return;
  // finish with the keyboard: C and R everywhere
  await page.focus("#board");
  for (let k = 0; k < 4; k++) { await page.keyboard.press("ArrowLeft"); await page.keyboard.press("ArrowUp"); }
  let dx = "ArrowRight", dy = "ArrowDown";
  for (let pass = 0; pass < 4 && !(await isDone()); pass++) {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 5; c++) { await page.keyboard.press("c"); await page.keyboard.press("r"); if (c < 4) await page.keyboard.press(dx); }
      dx = dx === "ArrowRight" ? "ArrowLeft" : "ArrowRight";
      if (r < 3) await page.keyboard.press(dy);
    }
    dy = dy === "ArrowDown" ? "ArrowUp" : "ArrowDown";
  }
  log("keyboard cuts, focus =", await focus(), "| done =", await isDone(), "|", await text("#status"), "|", (await text("#expr")).slice(0, 120));
  await shot("finished");
  await page.fill("#nxIn", "13"); await page.press("#nxIn", "Tab");
  log("width typed 13:", await text("#status"), "|", await page.inputValue("#nxIn"));
  await page.click("#resetBtn");
  log("after Reset:", await text("#expr"), "| done =", await isDone());
  await shot("reset");
};
