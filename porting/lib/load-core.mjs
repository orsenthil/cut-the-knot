"use strict";

/*
 * Loads a DOM-free core module into Node.
 *
 * The cores are plain browser scripts: they define one global and have no
 * module.exports (CLAUDE.md keeps them that way so the pages can load them with
 * a bare <script>). So they are evaluated and the global is pulled back out,
 * which is the one-liner in CLAUDE.md generalised.
 *
 *   const H = loadCore("hourglass/hourglass-core.js", "HourglassCore");
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function loadCore(relPath, globalName) {
  const src = readFileSync(join(REPO, relPath), "utf8");
  return new Function(`${src}\n; return ${globalName};`)();
}

/* ------------------------------------------------------- tiny test harness */

let failures = 0;
let checks = 0;

export function check(label, cond, detail = "") {
  checks++;
  if (!cond) {
    failures++;
    console.error(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
  }
}

export function equal(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  check(label, a === e, `expected ${e}, got ${a}`);
}

export function done(name) {
  if (failures) {
    console.error(`FAIL ${name}: ${failures} of ${checks} checks failed`);
    process.exit(1);
  }
  console.log(`ok   ${name} (${checks} checks)`);
}

/** Deterministic PRNG, so a failing run can be reproduced from its seed. */
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}
