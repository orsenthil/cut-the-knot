#!/usr/bin/env node
"use strict";

/*
 * A compact view of an applet's bytecode, for porting.
 *
 *   node porting/disasm.mjs <Applet>                 # every class, summarised
 *   node porting/disasm.mjs <Applet> --method Solve  # only methods matching "Solve"
 *   node porting/disasm.mjs <Applet> --all           # include drawing/mouse methods
 *   node porting/disasm.mjs <Applet> --raw <Class>   # plain `javap -c -p` of one class
 *
 * It extracts classes/<Applet>.zip or .jar from classes.zip into
 * $TMPDIR/coolmaths-disasm/<Applet>/, runs javap, and prints for each class:
 * its fields and methods, every string constant, the static int tables built
 * in <clinit> (lookup tables such as Grundy's NimValue), and each method's
 * code with the noise taken out - `aload_0`, `dup`, `pop`, StringBuffer and
 * AWT plumbing - one instruction per token, with `@offset:` marking only the
 * offsets something branches to. Methods that only draw or track the mouse
 * are listed but not printed unless --all is given.
 *
 * There is no decompiler; javap comes from a JDK on PATH or, failing that,
 * `mise exec java@temurin-21 -- javap` (fetched once into ~/.local/share/mise).
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const applet = args.find((a) => !a.startsWith("--"));
if (!applet) {
  console.error("usage: node porting/disasm.mjs <Applet> [--method <name>] [--all] [--raw <Class>]");
  process.exit(2);
}
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const onlyMethod = opt("--method");
const raw = opt("--raw");
const all = args.includes("--all");

/* ---------------------------------------------------------- extraction */

const work = join(tmpdir(), "coolmaths-disasm", applet);
function extract() {
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  const names = execFileSync("unzip", ["-Z1", join(REPO, "classes.zip")], { encoding: "utf8" }).split("\n");
  const archive = names.find((n) => n === `classes/${applet}.zip`) || names.find((n) => n === `classes/${applet}.jar`);
  const loose = names.find((n) => n === `classes/${applet}.class`);
  if (!archive && !loose) {
    console.error(`no classes/${applet}.zip, .jar or .class in classes.zip`);
    process.exit(1);
  }
  execFileSync("unzip", ["-q", "-o", join(REPO, "classes.zip"), archive || loose, "-d", work]);
  if (archive) execFileSync("unzip", ["-q", "-o", join(work, archive), "-d", join(work, "x")]);
  return archive ? join(work, "x") : join(work, "classes");
}
const dir = extract();

function classFiles(d) {
  const out = [];
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) out.push(...classFiles(p));
    else if (e.endsWith(".class")) out.push(p);
  }
  return out.sort();
}
const files = classFiles(dir);
const other = readdirSync(dir).filter((e) => !e.endsWith(".class") && e !== "META-INF");

/* ---------------------------------------------------------------- javap */

const direct = spawnSync("javap", ["-version"], { encoding: "utf8" }).status === 0;
function javap(flags, file) {
  const cmd = direct ? "javap" : "mise";
  const argv = direct ? [...flags, file] : ["exec", "java@temurin-21", "--", "javap", ...flags, file];
  return execFileSync(cmd, argv, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

if (raw) {
  const f = files.find((p) => basename(p, ".class") === raw);
  if (!f) { console.error(`no class ${raw}; have: ${files.map((p) => basename(p, ".class")).join(" ")}`); process.exit(1); }
  process.stdout.write(javap(["-c", "-p"], f));
  process.exit(0);
}

/* ------------------------------------------------------------ summarise */

const NOISE = /^(aload_0|dup|dup_x1|dup_x2|dup2|pop|pop2|return|nop)$/;
const PLUMBING = /StringBuffer|StringBuilder|java\/awt\/(Graphics|Color|Font|FontMetrics|Dimension|Image|MediaTracker|Component\.(repaint|getSize|getGraphics|createImage))|Graphics2D|RenderingHints/;
const DRAWING = /^(paint|update|Draw\w*|draw\w*|mouse(Entered|Exited|Moved)|getAppletInfo|getParameterInfo)$/;

function compactMethod(lines) {
  const ins = [];
  const targets = new Set();
  for (const l of lines) {
    const m = l.match(/^\s*(\d+):\s+(\S+)\s*(.*)$/);
    if (!m) continue;
    const [, off, op, rest] = m;
    const branch = rest.match(/^(\d+)\s*$/);
    if (/^(if|goto|jsr)/.test(op) && branch) targets.add(branch[1]);
    const sw = rest.match(/\d+:\s*(\d+)/g);
    if (/switch/.test(op) && sw) for (const s of sw) targets.add(s.split(":")[1].trim());
    ins.push({ off, op, rest });
  }
  for (const l of lines) {
    // tableswitch/lookupswitch bodies span several lines: "  0: 84"
    const m = l.match(/^\s+(-?\d+|default):\s+(\d+)\s*$/);
    if (m) targets.add(m[2]);
  }
  const out = [];
  for (const { off, op, rest } of ins) {
    const comment = (rest.split("//")[1] || "").trim();
    if (NOISE.test(op) && !targets.has(off)) continue;
    if (PLUMBING.test(comment) && !targets.has(off)) continue;
    let tok;
    if (/^(iconst|lconst|fconst|dconst)_/.test(op)) tok = op.replace(/^.const_/, "").replace("m1", "-1");
    else if (/^(bipush|sipush)$/.test(op)) tok = rest.trim();
    else if (/^ldc/.test(op)) tok = comment.replace(/^String /, '"').replace(/^(int|float|long|double) /, "") + (comment.startsWith("String ") ? '"' : "");
    else if (/^(i|l|f|d|a)(load|store)(_\d)?$/.test(op)) tok = op.replace(/^(.)(load|store)_?/, (_, t, w) => (w === "load" ? "L" : "S")) + (rest.trim() || "");
    else if (/^(get|put)(field|static)$/.test(op)) tok = op.replace("field", "").replace("static", "S") + " " + comment.replace(/^Field /, "").replace(/:.*$/, "");
    else if (/^invoke/.test(op)) tok = "call " + comment.replace(/^(Interface)?Method /, "").replace(/:\(.*$/, "").replace(/^java\/(lang|util)\//, "");
    else if (/^(if|goto)/.test(op)) tok = op + "→" + rest.trim();
    else if (/^iinc$/.test(op)) tok = "iinc " + rest.trim().replace(/\s+/g, "");
    else if (/^new$/.test(op)) tok = "new " + comment.replace(/^class /, "").replace(/^java\/(lang|util)\//, "");
    else if (/switch/.test(op)) tok = op;
    else tok = op;
    out.push((targets.has(off) ? "@" + off + ": " : "") + tok);
  }
  return out;
}

function staticTables(codeText) {
  const clinit = codeText.split(/\n  static \{\};\n/)[1];
  if (!clinit) return [];
  const tables = [];
  const lines = clinit.split("\n").map((l) => l.match(/^\s*\d+:\s+(\S+)\s*(.*)$/)).filter(Boolean);
  let cur = null;
  const num = ([op, rest]) => {
    if (/^iconst_/.test(op)) return Number(op.slice(7).replace("m1", "-1"));
    if (/^(bipush|sipush)$/.test(op)) return Number(rest.trim());
    if (op === "ldc" && /int /.test(rest)) return Number(rest.split("int ")[1]);
    return null;
  };
  for (let i = 0; i < lines.length; i++) {
    const [, op, rest] = lines[i];
    if (op === "newarray" && /int|byte|short/.test(rest)) cur = { values: [] };
    else if (cur && /^(iastore|bastore|sastore)$/.test(op)) {
      const v = num(lines[i - 1].slice(1));
      const k = num(lines[i - 2].slice(1));
      if (k !== null && v !== null) cur.values[k] = v;
    } else if (cur && op === "putstatic") {
      const name = (rest.split("Field ")[1] || "?").replace(/:.*$/, "");
      const vals = Array.from({ length: cur.values.length }, (_, j) => cur.values[j] ?? 0);
      if (vals.length) tables.push(`${name}[${vals.length}] = ${vals.join(" ")}`);
      cur = null;
    }
  }
  return tables;
}

console.log(`# ${applet}: ${files.length} classes in ${dir}` + (other.length ? `\n# other files: ${other.join(" ")}` : ""));
for (const f of files) {
  const name = basename(f, ".class");
  const members = javap(["-p"], f).split("\n").filter((l) => l && !l.startsWith("Compiled from"));
  const code = javap(["-c", "-p"], f);
  const strings = [...new Set([...code.matchAll(/\/\/ String (.*)$/gm)].map((m) => m[1]))];
  console.log(`\n## ${name}`);
  console.log(members.join("\n"));
  if (strings.length) console.log("strings: " + strings.map((s) => JSON.stringify(s)).join(" "));
  for (const t of staticTables(code)) console.log("table " + t);

  const methods = code.split(/\n(?=  \S.*\);$|  static \{\};$)/m).slice(1);
  for (const block of methods) {
    const [sig, ...body] = block.split("\n");
    const mname = (sig.match(/(\w+)\(/) || [, sig.trim()])[1];
    if (onlyMethod && !sig.includes(onlyMethod)) continue;
    const toks = compactMethod(body);
    if (!toks.length) continue;
    const drawing = DRAWING.test(mname) || /java\.awt\.Graphics/.test(sig);
    if (drawing && !all && !onlyMethod) {
      console.log(`- ${sig.trim()}  (${toks.length} ops, drawing; --all to show)`);
      continue;
    }
    console.log(`- ${sig.trim()}`);
    console.log("  " + toks.join(" | "));
  }
}
