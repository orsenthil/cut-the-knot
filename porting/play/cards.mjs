// Number Guessing: a demo, so "explored" is the end. There are no adjustable
// options in the applet (m_Max is fixed at 100); the only thing that changes
// is which of the seven cards is showing, so "maximum" means the seventh card.
// Play with the keyboard and every button, then play honestly to 54 and to the
// all-No quirk. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs cards
export default async ({ page, first, log, shot, text }) => {
  const focus = () => page.evaluate(() => {
    const el = document.activeElement;
    return el ? (el.id || el.className || el.tagName) : "none";
  });
  const cardNumbers = async () => {
    const t = await text("#cardText");
    const list = (t.split("numbers on the card are:")[1] || "").split(",");
    return list.map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
  };
  const statusClass = () => page.locator("#status").getAttribute("class");

  log("initial:", await text("#status"), "|", await text("#cardLabel"), "|", await text("#cardText"));
  await shot("initial");

  // Two moves with the keyboard alone. The applet redraws the card after each
  // answer but keeps the same buttons, so focus must stay on Yes.
  await page.focus("#yesBtn");
  log("focus before keyboard moves:", await focus());
  await page.keyboard.press("Enter");
  const f1 = await focus();
  log("keyboard move 1:", await text("#status"), "| focus:", f1);
  if (f1 !== "yesBtn") throw new Error("focus left the Yes button after move 1: " + f1);
  await page.keyboard.press("Enter");
  const f2 = await focus();
  log("keyboard move 2:", await text("#status"), "| focus:", f2);
  if (f2 !== "yesBtn") throw new Error("focus left the Yes button after move 2: " + f2);
  await shot("keyboard");

  // The maximum card is the seventh one (the sixty-fours place).
  await page.click("#resetBtn");
  for (let i = 0; i < 6; i++) await page.click("#yesBtn");
  log("maximum card:", await text("#cardLabel"), "|", await text("#cardText"), "| focus:", await focus());
  await shot("max-card");
  await page.click("#yesBtn");
  log("after the seventh answer:", await text("#status"), "| class:", await statusClass());
  await shot("guess");

  if (!first) return; // the dark run only needs the screenshots above

  // Press every button in the order a player would: Reset, Yes, No.
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"), "|", await text("#cardLabel"));
  await page.click("#yesBtn");
  log("after Yes:", await text("#status"));
  await page.click("#noBtn");
  log("after No:", await text("#status"));
  await shot("buttons");

  // Both extremes of the card number: the minimum is the first card, the
  // maximum the seventh. The status says in words which digit was recorded.
  await page.click("#resetBtn");
  log("minimum card:", await text("#cardLabel"), "| numbers:", (await cardNumbers()).length);
  await shot("min-card");
  for (let i = 0; i < 6; i++) await page.click("#noBtn");
  log("maximum card again:", await text("#cardLabel"), "| numbers:", (await cardNumbers()).length);
  await shot("max-card-again");

  // An honest play for 54: answering by whether 54 is on each card must make
  // the computer announce 54.
  await page.click("#resetBtn");
  for (let round = 0; round < 7; round++) {
    const nums = await cardNumbers();
    await page.click(nums.indexOf(54) >= 0 ? "#yesBtn" : "#noBtn");
    log("round " + (round + 1) + ":", "54 on card?", nums.indexOf(54) >= 0, "|", await text("#status"));
  }
  const honest = await text("#status");
  if (!honest.includes("54")) throw new Error("honest play did not find 54: " + honest);
  log("honest play:", honest, "| class:", await statusClass());
  await shot("honest-54");

  // The quirk: No to every card announces the opposite of the shown bits, a
  // number that never had to appear on any card (0 only when all bits were 1).
  await page.click("#resetBtn");
  for (let i = 0; i < 7; i++) await page.click("#noBtn");
  log("all No:", await text("#status"), "| class:", await statusClass());
  await shot("all-no");
};
