#!/usr/bin/env node
"use strict";

/*
 * Starts a port: makes the game's folder from porting/template/.
 *
 *   node porting/new-port.mjs <Applet> [--slug my-slug] [--title "My Title"]
 *                             [--kind demo] [--no-core]
 *
 * <Applet> is the applet's name in porting/manifest.json (for example
 * Nim, or FrogsAndToads). The script writes:
 *
 *   <slug>/index.html        the page, with every part to write marked TODO(port)
 *   <slug>/<slug>-core.js    the game's logic            (not with --no-core)
 *   <slug>/<slug>.js         drawing and input
 *   <slug>/meta.json         title, applet and order filled in; blurb, tags, level to do
 *   <slug>/thumb.svg         a placeholder to replace
 *   porting/check-<slug>.mjs the logic test              (not with --no-core)
 *   porting/play/<slug>.mjs  the play-through scenario
 *
 * and stamps the page's standard parts. Nothing outside those files is
 * touched. What is left to write is exactly the lines marked TODO(port):
 *
 *   grep -rn "TODO(port)" <slug> porting/check-<slug>.mjs porting/play/<slug>.mjs
 *
 * Use --no-core for a demo or illustration with no logic worth testing, and
 * --kind demo for something that cannot be won or lost. When every TODO is
 * gone, run: node porting/finish-port.mjs <slug>
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");

function fail(message) {
  console.error(message);
  process.exit(1);
}

const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const appletName = args.find((a, i) => !a.startsWith("--") && !(i > 0 && ["--slug", "--title", "--kind"].includes(args[i - 1])));
if (!appletName) fail('usage: node porting/new-port.mjs <Applet> [--slug s] [--title "T"] [--kind demo] [--no-core]');

const manifest = JSON.parse(readFileSync(join(HERE, "manifest.json"), "utf8"));
const applet = manifest.applets.find((a) => a.name === appletName);
if (!applet) fail(`No applet "${appletName}" in porting/manifest.json. Names are case-sensitive.`);
if (applet.status === "ported") fail(`${appletName} is already ported, as ${applet.slug}/.`);

/** FrogsAndToads -> frogs-and-toads, Hanoi3c -> hanoi-3c */
const kebab = (name) =>
  name
    .replace(/([a-z])([A-Z0-9])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
/** frogs-and-toads -> FrogsAndToadsCore */
const coreGlobal = (slug) => slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join("") + "Core";

const slug = option("--slug") ?? kebab(appletName);
if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(slug)) fail(`"${slug}" is not a slug: lowercase letters, digits and hyphens.`);
if (existsSync(join(REPO, slug))) fail(`${slug}/ already exists.`);

const title = option("--title") ?? appletName.replace(/([a-z])([A-Z0-9])/g, "$1 $2");
const kind = option("--kind") ?? (applet.kind === "game" ? "game" : "demo");
if (!["game", "demo"].includes(kind)) fail('--kind must be "game" or "demo".');
const withCore = !args.includes("--no-core");

const values = {
  SLUG: slug,
  TITLE: title,
  APPLET: appletName,
  CORE_GLOBAL: coreGlobal(slug),
  CTK_URL: applet.ctkUrl ?? "TODO(port): the applet's own page on cut-the-knot.org",
};
const fill = (text) => text.replace(/\{\{(\w+)\}\}/g, (whole, key) => values[key] ?? whole);
const template = (name) => readFileSync(join(HERE, "template", name), "utf8");

function write(path, text) {
  mkdirSync(dirname(join(REPO, path)), { recursive: true });
  writeFileSync(join(REPO, path), text);
  console.log(`  wrote ${path}`);
}

let html = fill(template("index.html"));
let ui = fill(template("ui.js"));
if (!withCore) {
  // No core: the page's one script holds what little logic there is.
  html = html.replace(`<script src="${slug}-core.js"></script>\n`, "");
  ui = ui
    .replace(`  const Core = ${values.CORE_GLOBAL};\n`, "")
    .replace(`The rules are in\n * ${slug}-core.js. `, "")
    .replace(/Core\.(start|move|result)\(/g, "TODO_port_$1(");
}

// The next free place on the home page.
const orders = readdirSync(REPO, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(REPO, d.name, "meta.json")))
  .map((d) => JSON.parse(readFileSync(join(REPO, d.name, "meta.json"), "utf8")).order || 0);
const meta = {
  title,
  blurb: "TODO(port): one or two sentences that pose the challenge, often ending in a question.",
  tags: [],
  level: 2,
  ...(kind === "demo" ? { kind: "demo" } : {}),
  applet: appletName,
  order: Math.max(0, ...orders) + 10,
};

console.log(`Starting ${slug}/ from applet ${appletName} (${kind}):`);
write(`${slug}/index.html`, html);
if (withCore) write(`${slug}/${slug}-core.js`, fill(template("core.js")));
write(`${slug}/${slug}.js`, ui);
write(`${slug}/meta.json`, JSON.stringify(meta, null, 2) + "\n");
write(`${slug}/thumb.svg`, template("thumb.svg"));
if (withCore) write(`porting/check-${slug}.mjs`, fill(template("check.mjs")));
write(`porting/play/${slug}.mjs`, fill(template("play.mjs")));

execFileSync(process.execPath, [join(HERE, "stamp-pages.mjs"), slug], { stdio: "inherit" });

console.log(`
Next:
  1. node porting/brief.mjs ${appletName}        what the applet does, in one read
  2. write every line marked TODO(port):
       grep -rn "TODO(port)" ${slug} ${withCore ? `porting/check-${slug}.mjs ` : ""}porting/play/${slug}.mjs
     in this order: ${withCore ? `${slug}-core.js, porting/check-${slug}.mjs (run it), ` : ""}${slug}.js, index.html, meta.json, thumb.svg, play
  3. node porting/finish-port.mjs ${slug}        does the rest and says what is still wrong
The whole routine is in porting/PORTING-CARD.md.`);
