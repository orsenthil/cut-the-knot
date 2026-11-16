// Box Labels: win with the classic WB strategy, then a wrong labelling.
export default async ({ page, first, log, shot, idle, text }) => {
  // Find the box whose printed label is WB (two different dots).
  const wbIndex = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll(".box")];
    return boxes.findIndex((b) => {
      const dots = b.querySelectorAll(".printed .dot");
      return dots.length === 2 && dots[0].classList.contains("white") && dots[1].classList.contains("black");
    });
  });
  if (wbIndex < 0) throw new Error("no WB-labelled box");
  await page.locator(".box").nth(wbIndex).click();
  await idle();

  const color = await page.evaluate(() => {
    const pop = document.querySelector(".balls.pop .ball");
    return pop.classList.contains("white") ? "WW" : "BB";
  });
  const other = color === "WW" ? "BB" : "WW";

  // Assign: peeked box → matching colour; box printed other → WB; last → other.
  const place = async (labelName, boxIndex) => {
    await page.locator(".chip", { hasText: labelName }).click();
    await page.locator(".box").nth(boxIndex).click();
  };

  await place(color, wbIndex);
  const otherIdx = await page.evaluate(({ otherName, wb }) => {
    const boxes = [...document.querySelectorAll(".box")];
    return boxes.findIndex((b, i) => {
      if (i === wb) return false;
      const dots = b.querySelectorAll(".printed .dot");
      if (otherName === "BB") return dots[0].classList.contains("black") && dots[1].classList.contains("black");
      return dots[0].classList.contains("white") && dots[1].classList.contains("white");
    });
  }, { otherName: other, wb: wbIndex });
  await place("WB", otherIdx);
  const last = [0, 1, 2].find((i) => i !== wbIndex && i !== otherIdx);
  await place(other, last);
  await page.click("#verifyBtn");
  log("after Verify win:", await text("#status"));
  await shot("win");

  if (!first) return;

  await page.click("#newBtn");
  await page.locator(".box").nth(0).click();
  // Place the printed labels as guesses — always wrong.
  for (const name of ["WW", "WB", "BB"]) {
    const box = await page.evaluate((n) => {
      const map = { WW: (a, b) => a.classList.contains("white") && b.classList.contains("white"),
        BB: (a, b) => a.classList.contains("black") && b.classList.contains("black"),
        WB: (a, b) => a.classList.contains("white") && b.classList.contains("black") };
      return [...document.querySelectorAll(".box")].findIndex((b) => {
        const dots = b.querySelectorAll(".printed .dot");
        return dots.length === 2 && map[n](dots[0], dots[1]);
      });
    }, name);
    await page.locator(".chip", { hasText: name }).click();
    await page.locator(".box").nth(box).click();
  }
  await page.click("#verifyBtn");
  log("after Verify loss:", await text("#status"));
  await shot("loss");
};
