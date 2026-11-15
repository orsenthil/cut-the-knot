#!/usr/bin/env node
"use strict";

/*
 * Finishes a port: runs everything that is mechanical, then the gate, and
 * says in one list what passed and what is still wrong.
 *
 *   NODE_PATH=$(npm root -g) node porting/finish-port.mjs <slug>
 *
 * In order:
 *   1. node porting/stamp-pages.mjs <slug>   the page's standard parts
 *   2. nothing is still marked TODO(port)
 *   3. node porting/build-catalogue.mjs      meta.json -> assets/games.js
 *   4. node porting/build-manifest.mjs       the applet is marked ported
 *   5. porting/verify.sh <slug>              the gate
 *
 * It stops at the first step that fails, because the later ones would only
 * repeat the same complaint. It exits 0 only when the port is ready to
 * commit, and then prints the commit title to use.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const slug = process.argv[2];
if (!slug || !existsSync(join(REPO, slug, "index.html"))) {
  console.error("usage: node porting/finish-port.mjs <slug>   (the folder must exist)");
  process.exit(1);
}

const step = (n, label) => console.log(`\n[${n}/5] ${label}`);

/* the mechanical parts */
function run(n, label, script, args = []) {
  step(n, label);
  const result = spawnSync(process.execPath, [join(HERE, script), ...args], { cwd: REPO, encoding: "utf8" });
  const out = `${result.stdout}${result.stderr}`.trim();
  if (out) console.log(out.split("\n").map((l) => `      ${l}`).join("\n"));
  if (result.status !== 0) process.exit(1);
}
// Stamped first: the page carries the blurb from meta.json, and a blurb that
// has since been written must not be reported as still to do.
run(1, "the page's standard parts", "stamp-pages.mjs", [slug]);

/* 2. nothing left to write */
step(2, "nothing is still marked TODO(port)");
const files = [
  ...readdirSync(join(REPO, slug)).map((f) => join(slug, f)),
  `porting/check-${slug}.mjs`,
  `porting/play/${slug}.mjs`,
].filter((f) => existsSync(join(REPO, f)) && !/\.(png|gif|jpg|webp)$/.test(f));
const todo = [];
for (const file of files) {
  readFileSync(join(REPO, file), "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (/TODO\(port\)|TODO_port_/.test(line)) todo.push(`${file}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
}
if (todo.length) {
  console.error(`      ${todo.length} still to write:`);
  for (const t of todo) console.error(`        ${t}`);
  process.exit(1);
}
console.log("      ok");

run(3, "the catalogue (meta.json -> assets/games.js)", "build-catalogue.mjs");
run(4, "the manifest", "build-manifest.mjs");

/* 5. the gate */
step(5, `porting/verify.sh ${slug}`);
const gate = spawnSync(join(HERE, "verify.sh"), [slug], { cwd: REPO, stdio: "inherit" });
if (gate.status !== 0) process.exit(1);

const meta = JSON.parse(readFileSync(join(REPO, slug, "meta.json"), "utf8"));
console.log(`
Ready. Play it through once more and look at the screenshot:
  NODE_PATH=$(npm root -g) node porting/play.mjs ${slug}
Then commit only this port:
  git add ${slug} assets/games.js porting/manifest.json porting/check-${slug}.mjs porting/play/${slug}.mjs
  git commit -m "Add ${meta.title} puzzle"
The commit body says: what the applet was, how faithfully it was ported and how
that was checked, anything changed on purpose, and what the maths section covers.`);
