/*
 * The security rules, in the Firestore emulator.
 *
 *   cd firebase && npm test
 *
 * Each check is a read or write that must be allowed or must be refused.
 */

import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, Timestamp, setLogLevel } from "firebase/firestore";

// Most checks here are writes that must be refused; the SDK would log each one.
setLogLevel("silent");

const env = await initializeTestEnvironment({
  projectId: "demo-coolmaths",
  firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
});

let failures = 0;
let checks = 0;
async function allowed(label, op) {
  checks++;
  try {
    await assertSucceeds(op);
  } catch (err) {
    failures++;
    console.error(`  FAIL should be allowed: ${label} (${err.code || err.message})`);
  }
}
async function refused(label, op) {
  checks++;
  try {
    await assertFails(op);
  } catch (err) {
    failures++;
    console.error(`  FAIL should be refused: ${label}`);
  }
}

const ada = env.authenticatedContext("ada").firestore();
const bob = env.authenticatedContext("bob").firestore();
const guest = env.unauthenticatedContext().firestore();

const progress = (over = {}) => ({ slug: "coins", firstAt: 1000, lastAt: 2000, opens: 2, activeSeconds: 60, plays: 1, completed: 1, wins: 1, losses: 0, ...over });
const session = (over = {}) => ({ slug: "coins", startedAt: 1000, endedAt: 2000, outcome: "win", ...over });
const live = (over = {}) => ({ slug: "coins", sessionId: "s1", stateVersion: 1, state: '{"values":[1,2]}', status: "Your turn.", updatedAt: 2000, ...over });

/* --------------------------------------------------------------- profile */

await allowed("ada creates her profile", setDoc(doc(ada, "users/ada"), { displayName: "Ada", providers: ["google.com"], createdAt: 1, settings: { mcpAccess: true, public: false } }));
await allowed("ada reads her profile", getDoc(doc(ada, "users/ada")));
await allowed("ada changes a setting", updateDoc(doc(ada, "users/ada"), { "settings.mcpAccess": false }));
await refused("bob reads ada's profile", getDoc(doc(bob, "users/ada")));
await refused("a guest reads ada's profile", getDoc(doc(guest, "users/ada")));
await refused("bob writes ada's profile", setDoc(doc(bob, "users/ada"), { displayName: "Bob was here" }));
await refused("a profile with an unknown field", setDoc(doc(ada, "users/ada"), { displayName: "Ada", admin: true }));
await refused("a setting that is not true or false", setDoc(doc(ada, "users/ada"), { settings: { mcpAccess: "yes" } }));
await refused("an unknown setting", setDoc(doc(ada, "users/ada"), { settings: { superuser: true } }));
await refused("a name of 5,000 characters", setDoc(doc(ada, "users/ada"), { displayName: "x".repeat(5000) }));

/* -------------------------------------------------------------- progress */

const coins = doc(ada, "users/ada/progress/coins");
await allowed("ada records a game", setDoc(coins, progress()));
await allowed("ada reads it", getDoc(coins));
await allowed("ada lists her games", getDocs(collection(ada, "users/ada/progress")));
await allowed("counts go up", setDoc(coins, progress({ opens: 3, plays: 2, losses: 1, lastAt: 3000 })));
await allowed("best and options are kept", setDoc(coins, progress({ opens: 3, plays: 2, losses: 1, lastAt: 3000, best: { score: 4 }, lastOptions: { coins: 8 } })));
await refused("a count goes down", setDoc(coins, progress({ opens: 1, plays: 2, losses: 1, lastAt: 3000 })));
await refused("wins are taken back", setDoc(coins, progress({ opens: 3, plays: 2, wins: 0, losses: 1, lastAt: 3000 })));
await refused("lastAt goes back", setDoc(coins, progress({ opens: 3, plays: 2, losses: 1, lastAt: 10 })));
await refused("firstAt moves later", setDoc(coins, progress({ opens: 3, plays: 2, losses: 1, lastAt: 3000, firstAt: 2500 })));
await refused("a negative count", setDoc(doc(ada, "users/ada/progress/hanoi"), progress({ slug: "hanoi", opens: -1 })));
await refused("a count that is not a whole number", setDoc(doc(ada, "users/ada/progress/hanoi"), progress({ slug: "hanoi", opens: 1.5 })));
await refused("a slug that does not match the id", setDoc(doc(ada, "users/ada/progress/hanoi"), progress()));
await refused("an id that is not a slug", setDoc(doc(ada, "users/ada/progress/Not A Slug"), progress({ slug: "Not A Slug" })));
await refused("a missing counter", setDoc(doc(ada, "users/ada/progress/hanoi"), { slug: "hanoi", firstAt: 1, lastAt: 1, opens: 1 }));
await refused("an extra field", setDoc(doc(ada, "users/ada/progress/hanoi"), progress({ slug: "hanoi", cheat: 1 })));
await refused("bob reads ada's game", getDoc(doc(bob, "users/ada/progress/coins")));
await refused("bob lists ada's games", getDocs(collection(bob, "users/ada/progress")));
await refused("bob writes ada's game", setDoc(doc(bob, "users/ada/progress/coins"), progress({ opens: 99 })));
await refused("a guest writes a game", setDoc(doc(guest, "users/ada/progress/coins"), progress({ opens: 99 })));

/* -------------------------------------------------------------- sessions */

const sessions = collection(ada, "users/ada/sessions");
const made = await addDoc(sessions, session({ moves: 4, options: { coins: 8 }, expireAt: Timestamp.fromMillis(5000) }));
await allowed("ada logs a play", addDoc(sessions, session()));
await allowed("ada reads her plays", getDocs(sessions));
await refused("a play is edited afterwards", updateDoc(made, { outcome: "win" }));
await refused("an outcome that does not exist", addDoc(sessions, session({ outcome: "cheated" })));
await refused("a play with an extra field", addDoc(sessions, session({ note: "hi" })));
await refused("bob logs a play for ada", addDoc(collection(bob, "users/ada/sessions"), session()));
await refused("bob reads ada's plays", getDocs(collection(bob, "users/ada/sessions")));

/* ------------------------------------------------------------------ live */

const current = doc(ada, "users/ada/live/current");
await allowed("ada saves her position", setDoc(current, live()));
await allowed("ada saves it again", setDoc(current, live({ state: '{"values":[2]}', updatedAt: 3000 })));
await allowed("a position of 8,000 characters", setDoc(current, live({ state: "x".repeat(8000) })));
await refused("a position of 8,001 characters", setDoc(current, live({ state: "x".repeat(8001) })));
await refused("a position that is not text", setDoc(current, live({ state: { values: [1] } })));
await refused("a second live document", setDoc(doc(ada, "users/ada/live/other"), live()));
await refused("bob reads ada's position", getDoc(doc(bob, "users/ada/live/current")));
await refused("bob overwrites ada's position", setDoc(doc(bob, "users/ada/live/current"), live()));

/* ------------------------------------------------------ everything else */

for (const path of ["handles/ada", "publicProfiles/ada", "oauth/tokens/t/abc", "matches/m1", "matches/m1/moves/1", "anything/else"]) {
  await refused(`ada reads ${path}`, getDoc(doc(ada, path)));
  await refused(`ada writes ${path}`, setDoc(doc(ada, path), { uid: "ada" }));
}
await refused("ada writes into someone else's tree", setDoc(doc(ada, "users/bob/progress/coins"), progress()));

/* -------------------------------------------------------------- deleting */

await allowed("ada forgets a game", deleteDoc(coins));
await allowed("ada forgets a play", deleteDoc(made));
await allowed("ada forgets her position", deleteDoc(current));
await refused("bob deletes ada's profile", deleteDoc(doc(bob, "users/ada")));
await allowed("ada deletes her profile", deleteDoc(doc(ada, "users/ada")));

await env.cleanup();
if (failures) {
  console.error(`FAIL rules: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`ok   rules (${checks} checks)`);
