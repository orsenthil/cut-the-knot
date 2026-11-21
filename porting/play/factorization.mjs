// GCD and LCM by plain factorization: compute, switch the format, add factors, try bad texts.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs factorization
export default async ({ page, first, log, shot, text }) => {
  const isDone = () => page.evaluate(() => document.getElementById("status").classList.contains("done"));
  const focus = () => page.evaluate(() => document.activeElement && document.activeElement.id);
  const go = async (a, b) => { await page.fill("#n1", a); await page.fill("#n2", b); await page.press("#n2", "Enter"); };
  const result = () => page.evaluate(() => [...document.querySelectorAll("#out .line, #out .result")].map((p) => p.textContent).join(" | "));
  log("initial:", await text("#out"), "| done =", await isDone());
  await shot("initial");
  await go("6999999999", "7000000000");
  log("the largest numbers:", await result());
  await shot("max-options");
  await go("360", "84");
  log("360 and 84:", await result(), "| done =", await isDone());
  await shot("explored");
  if (!first) return;
  await page.check("#long"); log("long form:", await result());
  await go("360*7", "84*5");
  log("after adding factors:", await result(), "|", await text(".check"));
  await go("12x5", "-4");
  log("bad texts:", await text("#status"), "|", await page.inputValue("#n1"), await page.inputValue("#n2"));
  await go("70001*100000", "12");
  log("too big:", await page.inputValue("#n1"), "|", await text("#status"));
  await page.focus("#n1"); await page.keyboard.press("Tab");
  log("keyboard: focus after Tab =", await focus());
  await page.check("#short");
  await go("1", "97");
  log("1 and 97:", await result());
  await shot("reset");
};
