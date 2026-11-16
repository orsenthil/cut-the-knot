// Parrondo: run the default mixes, then a larger board with AB only.
export default async ({ page, first, log, shot, idle, text }) => {
  // Defaults are already set; shorten the run so the scenario finishes quickly.
  await page.locator("#trials").evaluate((el) => {
    el.value = "1"; // 100 trials
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator("#games").evaluate((el) => {
    el.value = "5"; // 50 games
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.click("#goBtn");
  await page.waitForFunction(() => {
    const s = document.getElementById("status");
    return s && /Done|Stopped/.test(s.textContent || "");
  }, null, { timeout: 60000 });
  log("after Go:", await text("#status"));
  await idle();
  await shot("run");

  if (!first) return;

  // Largest options the applet allows, plus a second mix set.
  await page.locator("#games").evaluate((el) => {
    el.value = "100";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator("#trials").evaluate((el) => {
    el.value = "2"; // 200 trials — enough to draw, not a full 10 000
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator("#modulus").evaluate((el) => {
    el.value = "9";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.fill("#codes", "AB ABBAB .4 .5 AABB");
  await page.click("#goBtn");
  await page.waitForFunction(() => {
    const s = document.getElementById("status");
    return s && /Done|Stopped/.test(s.textContent || "");
  }, null, { timeout: 90000 });
  log("large options:", await text("#status"));
  await idle();
  await shot("large");

  // Keyboard: Enter starts another short run.
  await page.locator("#trials").evaluate((el) => {
    el.value = "1";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator("#games").evaluate((el) => {
    el.value = "3";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator("#codes").blur();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => {
    const s = document.getElementById("status");
    return s && /Done|Stopped/.test(s.textContent || "");
  }, null, { timeout: 60000 });
  log("keyboard Go:", await text("#status"));

  await page.click("#repeatBtn");
  await page.waitForFunction(() => {
    const s = document.getElementById("status");
    return s && /Done|Stopped/.test(s.textContent || "");
  }, null, { timeout: 60000 });
  log("after Repeat:", await text("#status"));
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
