// Critical Path: open on the page's project, tick the critical path, schedule
// with a good list (finishing at the critical path) and a bad one, push every
// option to its extreme (5 processors, a 12-letter name, tasks added up to a long
// chain), try bad tables and bad lists, look at a moment in the timeline, and
// use the keyboard alone (the focus must stay on the graph node). "New project"
// is the second scene.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs critical-path
export default async ({ page, first, log, shot, text }) => {
  const isDone = () => page.evaluate(() => document.getElementById("status").classList.contains("done"));
  const focus = () => page.evaluate(() => { const e = document.activeElement; return e && (e.getAttribute("data-node") || e.id); });
  const schedule = async (list) => { await page.fill("#listIn", list); await page.click("#scheduleBtn"); };

  log("initial:", await text("#critText"), "|", await page.locator("#rows tr").count(), "tasks");
  await shot("initial");

  // The critical path, then a good list on two processors.
  await page.check("#critBox");
  log("critical path:", await text("#critText"));
  await schedule("B E A D F I H C G");
  log("good list:", await text("#status"), "| done =", await isDone());
  await shot("explored");

  // Everything at its largest: 5 processors.
  while (await page.locator("#procsMore").isEnabled()) await page.click("#procsMore");
  await schedule("A B C D E F G H I");
  log("five processors:", await text("#status"));
  await shot("max-options");
  if (!first) return; // the dark run only needs the screenshots above

  // A bad list on two processors, and a click on the timeline.
  while (await page.locator("#procsLess").isEnabled()) await page.click("#procsLess");
  await schedule("A B C D F E G H I");
  log("a careless list (41 instead of 38):", await text("#status"));
  await page.fill("#timeIn", "9"); await page.press("#timeIn", "Tab");
  log("at time 9:", await text("#status"));
  await page.fill("#timeIn", "999"); await page.press("#timeIn", "Tab");
  log("at time 999 (clamped):", await text("#status"));
  const box = await page.locator("#timeline").boundingBox();
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.3);
  log("after clicking the timeline:", await text("#status"));
  await shot("clicked");

  // Bad input: an incomplete list, a bad table.
  await schedule("A B");
  log("incomplete list:", await text("#status"));
  await page.locator("#rows tr").first().locator("input.duration").fill("0");
  await page.click("#applyBtn");
  log("duration 0:", await text("#status"));
  await page.locator("#rows tr").first().locator("input.duration").fill("3");
  await page.locator("#rows tr").nth(1).locator("input.after").fill("Z");
  await page.click("#applyBtn");
  log("unknown predecessor:", await text("#status"));
  await page.locator("#rows tr").nth(1).locator("input.after").fill("");
  await page.locator("#rows tr").nth(0).locator("input.after").fill("I");
  await page.locator("#rows tr").nth(5).locator("input.after").fill("A"); // A after I, I after F, F after A
  await page.click("#applyBtn");
  log("a cycle:", await text("#status"));
  await shot("problems");
  await page.click("#exampleBtn");

  // Keyboard alone: focus a node and move it with the arrow keys.
  await page.focus('[data-node="E"]');
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  log("after keyboard, focus =", await focus());
  await shot("keyboard");

  // A new project of one long chain.
  await page.click("#newBtn");
  for (let i = 0; i < 3; i++) await page.click("#addBtn");
  const names = ["P", "Q", "R"];
  for (let i = 0; i < 3; i++) {
    const row = page.locator("#rows tr").nth(i);
    await row.locator("input.name").fill(names[i]);
    await row.locator("input.duration").fill(String(i + 2));
    await row.locator("input.after").fill(i ? names[i - 1] : "");
  }
  await page.click("#applyBtn");
  log("new chain project:", await text("#status"));
  await schedule("P Q R");
  log("chain scheduled:", await text("#status"));
  await shot("reset");
};
