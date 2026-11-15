#!/usr/bin/env node
"use strict";

/*
 * One compact read of an applet, for whoever is about to port it.
 *
 *   node porting/brief.mjs <Applet> [--full]
 *
 * Prints, in this order and capped in length so it fits a small model's
 * context: the manifest entry, the applet's page on cut-the-knot (the rules
 * and the claims to check), and the applet's code (fields, strings, tables
 * and methods). --full lifts the caps.
 *
 * It only gathers what page.mjs and disasm.mjs print; when the code is cut
 * short, read one method at a time with:
 *
 *   node porting/disasm.mjs <Applet> --method <Name>
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE_CAP = 7000;
const CODE_CAP = 14000;

const name = process.argv.slice(2).find((a) => !a.startsWith("--"));
const full = process.argv.includes("--full");
if (!name) {
  console.error("usage: node porting/brief.mjs <Applet> [--full]");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(HERE, "manifest.json"), "utf8"));
const applet = manifest.applets.find((a) => a.name === name);
if (!applet) {
  console.error(`No applet "${name}" in porting/manifest.json.`);
  process.exit(1);
}

function run(script, args) {
  try {
    return execFileSync(process.execPath, [join(HERE, script), ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120000 });
  } catch (err) {
    return `(${script} failed: ${String(err.stderr || err.message).trim().split("\n")[0]})`;
  }
}

function capped(text, cap, hint) {
  if (full || text.length <= cap) return text.trimEnd();
  return `${text.slice(0, cap).trimEnd()}\n\n[... cut at ${cap} of ${text.length} characters. ${hint}]`;
}

const page = run("page.mjs", [name]);
const code = run("disasm.mjs", [name]);

console.log(`# Brief: ${applet.name}

kind: ${applet.kind}    status: ${applet.status}    archive: ${applet.archive ?? "none"}
page: ${applet.ctkUrl ?? "unknown"}${applet.notes ? `\nnotes: ${applet.notes}` : ""}

## The page: rules, and claims to check

${capped(page, PAGE_CAP, `For all of it: node porting/page.mjs ${name}`)}

## The applet's code

${capped(code, CODE_CAP, `Read one method at a time: node porting/disasm.mjs ${name} --method <Name>`)}

## What to take from this

- The rules, the win and loss conditions, the option ranges and the messages: port them as they are.
- The computer's moves, if it plays: the same choice in the same position.
- Every formula, minimum or "always" on the page is a claim. The logic test checks it.
- If the page credits someone other than Alexander Bogomolny with all rights reserved,
  take only the rules and write the computer player yourself.`);
