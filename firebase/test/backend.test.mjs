/*
 * The Firestore backend (assets/backends/firebase.js), in the emulator and
 * under the real security rules.
 *
 *   cd firebase && npm test
 *
 * The same plays are run through the Firestore backend and through the
 * memory backend; both must end with the same record. Then a guest's record
 * is moved into an account, and one player is checked against another.
 */

import { readFileSync } from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import * as sdk from "firebase/firestore";

import { firebaseBackend, moveRecord, withFallback } from "../../assets/backends/firebase.js";

const repo = (path) => new URL(`../../${path}`, import.meta.url);
const Track = new Function(`${readFileSync(repo("assets/progress.js"), "utf8")}\n; return Track;`)();

const env = await initializeTestEnvironment({
  projectId: "demo-coolmaths",
  firestore: { rules: readFileSync(repo("firebase/firestore.rules"), "utf8") },
});
await env.clearFirestore();

let failures = 0;
let checks = 0;
function equal(label, actual, expected) {
  checks++;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failures++;
    console.error(`  FAIL ${label}: expected ${e}, got ${a}`);
  }
}
/** Field order differs between stores; compare records key by key. */
const sorted = (value) =>
  Array.isArray(value)
    ? value.map(sorted)
    : value && typeof value === "object"
      ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, sorted(value[k])]))
      : value;

const backendFor = (uid) => firebaseBackend({ db: env.authenticatedContext(uid).firestore(), uid, sdk, core: Track.core });

/* ----------------------------------- the same plays, on both backends */

async function play(backend) {
  await backend.bump("coins", { opens: 1, at: 1000 });
  await backend.bump("coins", { activeSeconds: 42, at: 2000 });
  await backend.bump("coins", { plays: 1, wins: 1, completed: 1, best: { score: 5, moves: 9 }, lastOptions: { coins: 8, loop: false }, at: 3000 });
  await backend.bump("coins", { plays: 1, losses: 1, best: { score: 2, moves: 7 }, at: 4000 });
  await backend.bump("hanoi", { opens: 1, at: 2500 });
  await backend.addSession({ slug: "coins", startedAt: 1000, endedAt: 3000, outcome: "win", moves: 4, options: { coins: 8 } });
  await backend.addSession({ slug: "coins", startedAt: 3000, endedAt: 4000, outcome: "loss" });
  // A list inside a list: Firestore cannot store this directly.
  await backend.setLive({ slug: "hanoi", sessionId: "s2", stateVersion: 1, state: { pegs: [[3, 2, 1], [], []] }, status: "Your move.", updatedAt: 4500 });
  return { progress: await backend.readProgress(), sessions: await backend.readSessions(), live: await backend.readLive() };
}

const remote = backendFor("ada");
const viaFirestore = await play(remote);
const viaMemory = await play(Track.memoryBackend());
equal("progress matches the memory backend", sorted(viaFirestore.progress), sorted(viaMemory.progress));
equal("sessions match the memory backend", sorted(viaFirestore.sessions), sorted(viaMemory.sessions));
equal("the position matches the memory backend", sorted(viaFirestore.live), sorted(viaMemory.live));
equal("best keeps the higher score and the fewer moves", viaFirestore.progress.coins.best, { score: 5, moves: 9 > 7 ? 7 : 9 });

/* -------------------------------------------- two tabs adding at once */

await Promise.all(Array.from({ length: 8 }, () => remote.bump("coins", { opens: 1, at: 5000 })));
equal("eight visits at once all count", (await remote.readProgress()).coins.opens, 9);

/* ------------------------------------------------ one player, one record */

equal("another player sees nothing of ada's", await backendFor("bob").readProgress(), {});
equal("another player has no position", await backendFor("bob").readLive(), null);

/* ---------------------------------------- a guest's record joins theirs */

const guest = Track.memoryBackend();
await guest.bump("coins", { opens: 2, plays: 1, wins: 1, completed: 1, best: { score: 9 }, at: 500 });
await guest.bump("torque", { opens: 1, at: 6000 });
await guest.addSession({ slug: "torque", startedAt: 5900, endedAt: 6000, outcome: "quit" });
await guest.setLive({ slug: "torque", sessionId: "g1", stateVersion: 1, state: { beam: [1, 2] }, status: "", updatedAt: 6000 });

equal("two games are moved", await moveRecord(guest, remote), 2);
const merged = await remote.readProgress();
equal("counts are added, not replaced", [merged.coins.opens, merged.coins.plays, merged.coins.wins], [11, 3, 2]);
equal("the earlier first visit wins", merged.coins.firstAt, 500);
equal("the later last visit stays", merged.coins.lastAt, 5000);
equal("the better score is kept", merged.coins.best.score, 9);
equal("a new game arrives", merged.torque.opens, 1);
equal("the guest's plays arrive", (await remote.readSessions()).map((s) => s.outcome), ["win", "loss", "quit"]);
equal("the newer position wins", (await remote.readLive()).slug, "torque");
equal("the guest's copy is emptied", [await guest.readProgress(), await guest.readSessions(), await guest.readLive()], [{}, [], null]);

equal("moving an empty record changes nothing", await moveRecord(Track.memoryBackend(), remote), 0);
equal("an older position does not replace a newer one", await (async () => {
  const old = Track.memoryBackend();
  await old.setLive({ slug: "coins", sessionId: "o", stateVersion: 1, state: {}, status: "", updatedAt: 1 });
  await moveRecord(old, remote);
  return (await remote.readLive()).slug;
})(), "torque");

/* ------------------------------------------------- when the service fails */

{
  const down = { name: "firebase" };
  for (const m of ["readProgress", "bump", "readSessions", "addSession", "readLive", "setLive", "clear"]) {
    down[m] = async () => {
      throw new Error("offline");
    };
  }
  const outbox = Track.memoryBackend();
  const warn = console.warn;
  console.warn = () => {};
  const safe = withFallback(down, outbox);
  await safe.bump("mazes", { opens: 1, at: 7000 });
  await safe.addSession({ slug: "mazes", startedAt: 7000, endedAt: 7100, outcome: "done" });
  console.warn = warn;
  equal("a failed write lands in the fallback", (await outbox.readProgress()).mazes.opens, 1);
  equal("it keeps the primary's name", safe.name, "firebase");
  await moveRecord(outbox, remote);
  equal("and reaches the account later", (await remote.readProgress()).mazes.opens, 1);
}

/* -------------------------------------------------------------- forgetting */

await remote.clear();
equal("forgetting empties the record", [await remote.readProgress(), await remote.readSessions(), await remote.readLive()], [{}, [], null]);

await env.cleanup();
if (failures) {
  console.error(`FAIL backend: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`ok   backend (${checks} checks)`);
