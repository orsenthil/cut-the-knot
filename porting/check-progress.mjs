"use strict";

/*
 * The progress tracker (assets/progress.js), without a browser.
 *
 *   node porting/check-progress.mjs
 *
 * Checks the merge rules for a progress record, then drives Track through
 * whole plays on the memory backend with a fixed clock, and checks that the
 * localStorage backend survives a reload and a blocked or corrupt store.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const fresh = () => loadCore("assets/progress.js", "Track");
const T = fresh();
const C = T.core;

/* ------------------------------------------------------------ merge rules */

let doc = C.applyDelta(undefined, "coins", { opens: 1 }, 1000);
equal("first visit", doc, { slug: "coins", firstAt: 1000, lastAt: 1000, opens: 1, activeSeconds: 0, plays: 0, completed: 0, wins: 0, losses: 0 });

doc = C.applyDelta(doc, "coins", { opens: 1, activeSeconds: 30 }, 2000);
equal("second visit adds up", [doc.opens, doc.activeSeconds, doc.firstAt, doc.lastAt], [2, 30, 1000, 2000]);

doc = C.applyDelta(doc, "coins", { opens: -5, wins: -1 }, 1500);
equal("counters never go down", [doc.opens, doc.wins], [2, 0]);
equal("lastAt never goes back", doc.lastAt, 2000);

equal("best keeps fewer moves", C.mergeBest({ moves: 9 }, { moves: 7 }), { moves: 7 });
equal("best ignores more moves", C.mergeBest({ moves: 7 }, { moves: 9 }), { moves: 7 });
equal("best keeps a higher score", C.mergeBest({ score: 3 }, { score: 8, moves: 4 }), { score: 8, moves: 4 });
equal("best ignores junk", C.mergeBest({ score: 3 }, { score: "lots", streak: NaN }), { score: 3 });

equal("a win completes", C.deltaForEnd({ outcome: "win" }), { plays: 1, wins: 1, losses: 0, completed: 1, best: undefined });
equal("a loss does not", C.deltaForEnd({ outcome: "loss" }).completed, 0);
equal("a demo can be done", C.deltaForEnd({ outcome: "done" }).completed, 1);
equal("completed can be said outright", C.deltaForEnd({ outcome: "impossible", completed: true }).completed, 1);

check("a small position fits", C.stateFits({ values: [1, 2, 3] }));
check("a huge position does not", !C.stateFits({ blob: "x".repeat(C.MAX_STATE_CHARS) }));
const loop = {};
loop.self = loop;
check("a circular position does not", !C.stateFits(loop));

/* ----------------------------------------------------------- a whole play */

{
  const track = fresh();
  let clock = 10_000;
  track._setClock(() => clock);
  track.useBackend(track.memoryBackend());

  await track.visit("coins");
  await track.start("coins", { options: { coins: 8 }, stateVersion: 2 });
  track.state({ values: [5, 1, 10] }, "Your turn");
  equal("the position waits for the debounce", await track.live(), null);
  clock = 11_000;
  await track.flush();
  const live = await track.live();
  equal("the position is written", [live.slug, live.stateVersion, live.state, live.status, live.updatedAt], ["coins", 2, { values: [5, 1, 10] }, "Your turn", 11_000]);
  check("the position names its play", typeof live.sessionId === "string" && live.sessionId.length > 4);

  clock = 15_000;
  await track.end({ outcome: "win", moves: 4, best: { moves: 4 } });
  const p = (await track.progress()).coins;
  equal("the win is counted", [p.opens, p.plays, p.wins, p.losses, p.completed], [1, 1, 1, 0, 1]);
  equal("options and best are kept", [p.lastOptions, p.best], [{ coins: 8 }, { moves: 4 }]);
  equal("the play is logged", await track.sessions(), [{ slug: "coins", startedAt: 10_000, endedAt: 15_000, outcome: "win", moves: 4, options: { coins: 8 } }]);

  await track.end({ outcome: "win" });
  equal("ending twice counts once", (await track.progress()).coins.plays, 1);

  // Starting again on an untouched board is not a play...
  await track.start("coins");
  track.state({ values: [1, 2] });
  await track.start("coins");
  equal("an untouched play is not logged", (await track.sessions()).length, 1);
  // ...but starting again after a move records a quit.
  track.state({ values: [1, 2] });
  track.state({ values: [2] });
  await track.start("coins");
  await track.end({ outcome: "loss" });
  const after = (await track.progress()).coins;
  equal("quit and loss are counted", [after.plays, after.wins, after.losses, after.completed], [3, 1, 1, 1]);
  equal("outcomes in order", (await track.sessions()).map((s) => s.outcome), ["win", "quit", "loss"]);

  await track.start("coins");
  await track.end({ outcome: "sideways" });
  equal("an unknown outcome is stored as done", (await track.sessions()).pop().outcome, "done");

  track.state({ values: [] });
  await track.flush();
  equal("no position without a play", (await track.live()).state, { values: [2] });

  await track.start("coins");
  await track.end({ outcome: "draw" });
  const drawn = (await track.progress()).coins;
  equal("a draw is neither won, lost nor completed", [drawn.wins, drawn.losses, drawn.completed], [1, 1, 2]);
}

/* ------------------------------------------------- the session log is capped */

{
  const backend = T.memoryBackend();
  for (let i = 0; i < C.MAX_SESSIONS + 7; i++) await backend.addSession({ slug: "hanoi", startedAt: i, endedAt: i, outcome: "win" });
  const log = await backend.readSessions();
  equal("the log keeps the newest", [log.length, log[0].startedAt], [C.MAX_SESSIONS, 7]);
}

/* --------------------------------------------------------- local storage */

{
  const store = new Map();
  const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) };

  const first = T.localBackend(storage);
  await first.bump("hanoi", { opens: 1, at: 500 });
  await first.setLive({ slug: "hanoi", state: { pegs: [[3, 2, 1], [], []] } });
  check("written under the versioned key", store.has(C.STORAGE_KEY));

  const reloaded = T.localBackend(storage);
  equal("progress survives a reload", (await reloaded.readProgress()).hanoi.opens, 1);
  equal("the position survives a reload", (await reloaded.readLive()).slug, "hanoi");

  store.set(C.STORAGE_KEY, "{not json");
  equal("a corrupt store starts empty", await T.localBackend(storage).readProgress(), {});

  const blocked = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };
  const b = T.localBackend(blocked);
  await b.bump("hanoi", { opens: 1, at: 1 });
  equal("blocked storage still works for the page", (await b.readProgress()).hanoi.opens, 1);
}

done("progress");
