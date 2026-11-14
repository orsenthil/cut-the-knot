#!/usr/bin/env node
"use strict";

/* Browser behavior test for the applet's click/drag payoff editing. */

import { serveRepo, launch } from "./lib/browser.mjs";

const { server, port } = await serveRepo();
const browser = await launch();
let failed = false;

try {
  const page = await browser.newPage({ viewport: { width: 700, height: 700 } });
  await page.goto(`http://127.0.0.1:${port}/mixed-strategies/`);
  const payoff = page.locator(".payoff").first();
  const box = await payoff.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .7, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width * .8, box.y + box.height / 2);
  await page.mouse.up();
  const afterDrag = await payoff.textContent();
  if (afterDrag !== "2") {
    console.error(`FAIL each right-side drag event changes a payoff by one: expected 2, got ${JSON.stringify(afterDrag)}`);
    failed = true;
  } else {
    console.log("ok   each right-side drag event changes a payoff by one");
  }
  await page.close();
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
