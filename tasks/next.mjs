#!/usr/bin/env node
"use strict";

/*
 * Lists the tasks in tasks/*.md that can be started now.
 *
 *   node tasks/next.mjs            ready tasks
 *   node tasks/next.mjs --offline  ready tasks that need no network or accounts
 *   node tasks/next.mjs --all      every task with its status
 *   node tasks/next.mjs --check    exit 1 if a task file is malformed
 *
 * A task is ready when its status is "todo" and all of its deps are "done".
 * The frontmatter is a small fixed subset of YAML (see tasks/README.md), read
 * here by hand so this needs nothing installed.
 */

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const STATUSES = ["todo", "claimed", "done"];

function parse(file) {
  const text = readFileSync(join(HERE, file), "utf8");
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) throw new Error(`${file}: no frontmatter`);
  const task = { file, files: [] };
  let listKey = null;
  for (const line of match[1].split("\n")) {
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && listKey) {
      task[listKey].push(item[1].trim());
      continue;
    }
    const pair = /^(\w+):\s*(.*)$/.exec(line);
    if (!pair) continue;
    const [, key, raw] = pair;
    const value = raw.trim();
    listKey = null;
    if (value === "") {
      if (key === "files") listKey = key;
      else task[key] = "";
    } else if (value.startsWith("[")) {
      task[key] = JSON.parse(value);
    } else {
      task[key] = value.replace(/^"(.*)"$/, "$1");
    }
  }
  return task;
}

const tasks = readdirSync(HERE)
  .filter((f) => /^\d{3}.*\.md$/.test(f))
  .sort()
  .map(parse);
const byId = new Map(tasks.map((t) => [t.id, t]));

const problems = [];
for (const t of tasks) {
  if (!t.id || !t.file.startsWith(t.id)) problems.push(`${t.file}: id does not match the file name`);
  if (!STATUSES.includes(t.status)) problems.push(`${t.file}: status "${t.status}" is not one of ${STATUSES.join(", ")}`);
  if (!t.title) problems.push(`${t.file}: no title`);
  if (!t.verify) problems.push(`${t.file}: no verify command`);
  if (t.files.length === 0) problems.push(`${t.file}: no files`);
  for (const dep of t.deps || []) if (!byId.has(dep)) problems.push(`${t.file}: unknown dep "${dep}"`);
}
if (problems.length) {
  for (const p of problems) console.error(p);
  process.exit(1);
}
if (process.argv.includes("--check")) {
  console.log(`ok   ${tasks.length} task files`);
  process.exit(0);
}

const ready = (t) => t.status === "todo" && (t.deps || []).every((d) => byId.get(d).status === "done");
const row = (t) => `${t.id}  ${t.status.padEnd(7)}  offline:${String(t.offline).padEnd(6)}  ${t.title}${t.owner ? `  (${t.owner})` : ""}`;

if (process.argv.includes("--all")) {
  for (const t of tasks) console.log(row(t));
} else {
  const offlineOnly = process.argv.includes("--offline");
  const list = tasks.filter(ready).filter((t) => !offlineOnly || t.offline === "yes");
  if (list.length === 0) console.log("Nothing is ready. See: node tasks/next.mjs --all");
  for (const t of list) {
    console.log(row(t));
    const waiting = tasks.filter((x) => x.status !== "done" && (x.deps || []).includes(t.id)).map((x) => x.id);
    if (waiting.length) console.log(`     unblocks ${waiting.join(", ")}`);
  }
}
