/*
 * Golden test: the server's answers, compared with saved copies.
 *
 *   npm run golden              compare with test/golden/
 *   npm run golden -- --update  rewrite test/golden/ from the current answers
 *   npm run golden -- --all [--update] --dir <folder>
 *                               the same for every request, including the
 *                               ones whose answers change whenever a game is
 *                               added; useful before and after a refactor
 *
 * The saved set is deliberately limited to answers that do not change when a
 * game is ported: the lists of tools, prompts and resources, and calls into
 * the games' real logic. It runs the server in-process through
 * src/core/handle.ts, so it needs no network and no port.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { handle } from "../src/core/handle.ts";
import { MemoryStore } from "../src/stores/memory.ts";
import fixtures from "../fixtures/users.json" with { type: "json" };

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const update = args.includes("--update");
const all = args.includes("--all");
const dir = args.includes("--dir") ? args[args.indexOf("--dir") + 1] : join(HERE, "golden");

const call = (name, toolArgs = {}) => ({ method: "tools/call", params: { name, arguments: toolArgs } });

/** Answers that stay the same when games are added. */
const STABLE = {
  "initialize": { method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "golden", version: "0" } } },
  "tool-names": { method: "tools/list", keep: (reply) => reply.result.tools.map((t) => t.name) },
  "prompts-list": { method: "prompts/list" },
  "resource-templates-list": { method: "resources/templates/list" },
  "hourglass-solve": call("run_game_logic", { slug: "hourglass", action: "solve", args: { a: 7, b: 11, target: 15 } }),
  "hourglass-unsolvable": call("run_game_logic", { slug: "hourglass", action: "solve", args: { a: 4, b: 6, target: 5 } }),
  "coins-parity-split": call("run_game_logic", { slug: "coins", action: "parity_split", args: { values: [4, 2, 9, 1] } }),
  "coins-computer-reply": call("run_game_logic", { slug: "coins", action: "computer_reply", args: { values: [4, 2, 9, 1], taken: ["first"] } }),
  "coins-play-out": call("run_game_logic", { slug: "coins", action: "play_out", args: { values: [4, 2, 9, 1], humanChoices: ["first", "last"] } }),
  "knights-shortest": call("run_game_logic", { slug: "four-knights", action: "shortest_solution", args: {} }),
  "eye-opener-areas": call("run_game_logic", { slug: "eye-opener", action: "areas", args: {} }),
  "unknown-game": call("run_game_logic", { slug: "nowhere", action: "solve", args: {} }),
  "unknown-action": call("run_game_logic", { slug: "coins", action: "nothing", args: {} }),
  "unknown-slug": call("get_game", { slug: "nowhere" }),
};

/** Answers that follow the site's content. */
const CONTENT = {
  "tools-list": { method: "tools/list" },
  "resources-list": { method: "resources/list" },
  "list-games": call("list_games"),
  "list-games-parity": call("list_games", { tag: "parity" }),
  "get-game": call("get_game", { slug: "hourglass" }),
  "get-game-source": call("get_game", { slug: "coins", includeSource: true }),
  "search": call("search", { query: "parity strategy", limit: 5 }),
  "explain-concept": call("explain_concept", { concept: "invariants" }),
  "porting-status": call("porting_status"),
  "porting-status-games": call("porting_status", { kind: "game", status: "todo", limit: 5 }),
  "next-to-port": call("next_to_port", { count: 3 }),
  "get-original": call("get_original", { name: "Coins" }),
  "read-catalogue": { method: "resources/read", params: { uri: "coolmaths://catalogue" } },
  "read-game": { method: "resources/read", params: { uri: "coolmaths://game/coins" } },
  "read-tag": { method: "resources/read", params: { uri: "coolmaths://tag/parity" } },
  "read-manifest": { method: "resources/read", params: { uri: "coolmaths://manifest" } },
  "prompt-tutor": { method: "prompts/get", params: { name: "tutor", arguments: { slug: "coins" } } },
  "prompt-quiz": { method: "prompts/get", params: { name: "quiz_me", arguments: { tag: "parity" } } },
  "prompt-explain": { method: "prompts/get", params: { name: "explain_like_im", arguments: { slug: "hanoi", level: "a ten year old" } } },
  "prompt-review": { method: "prompts/get", params: { name: "review_port", arguments: { slug: "coins" } } },
};

/** The signed-in endpoint, as the fixture player "ada". */
const PERSONAL = {
  "me-tool-names": { method: "tools/list", keep: (reply) => reply.result.tools.map((t) => t.name) },
  "me-prompts-list": { method: "prompts/list" },
  "me-whoami": call("whoami"),
  "me-position-coins": call("my_position"),
};

/** Answers that follow both the fixture player and the site's content. */
const PERSONAL_CONTENT = {
  "me-progress": call("my_progress"),
  "me-recommend": call("recommend_next", { count: 3 }),
  "me-prompt-coach": { method: "prompts/get", params: { name: "coach_me", arguments: {} } },
};

// A fixed clock, one minute after the fixture player's last move.
const store = new MemoryStore(fixtures);
const signedIn = { user: { uid: "ada" }, store, now: () => Date.UTC(2026, 10, 14, 10, 0, 0) };

const suites = [
  [STABLE, {}],
  [PERSONAL, signedIn],
  ...(all ? [[CONTENT, {}], [PERSONAL_CONTENT, signedIn]] : []),
];

mkdirSync(dir, { recursive: true });
let failed = 0;
let count = 0;

for (const [requests, context] of suites) {
  for (const [name, { keep, ...request }] of Object.entries(requests)) {
    count++;
    const [reply] = await handle({ jsonrpc: "2.0", id: 1, ...request }, context);
    const actual = JSON.stringify(keep ? keep(reply) : reply, null, 2) + "\n";
    const file = join(dir, `${name}.json`);
    if (update) {
      writeFileSync(file, actual);
      continue;
    }
    if (!existsSync(file)) {
      console.error(`FAIL ${name}: no saved answer (run with --update)`);
      failed++;
    } else if (readFileSync(file, "utf8") !== actual) {
      console.error(`FAIL ${name}: the answer changed (diff against ${file})`);
      failed++;
    }
  }
}

if (update) console.log(`wrote ${count} answers to ${dir}`);
else if (failed) {
  console.error(`FAIL golden: ${failed} of ${count} answers differ`);
  process.exit(1);
} else console.log(`ok   golden (${count} answers)`);
