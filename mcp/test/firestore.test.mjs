/*
 * The Firestore stores (src/stores/firestore.ts), in the Firestore emulator.
 *
 *   npm run test:firestore      (starts the emulator; needs Java)
 *
 * The fixture players are written to the emulator in the shape the site
 * writes (docs/contracts.md, section 7: the position as JSON text), and the
 * personal tools must then give exactly the answers they give on the memory
 * store. The OAuth store is checked for expiry and for one-time use.
 */

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { handle } from "../src/core/handle.ts";
import { MemoryStore } from "../src/stores/memory.ts";
import { FirestoreUserStore, FirestoreOAuthStore } from "../src/stores/firestore.ts";
import fixtures from "../fixtures/users.json" with { type: "json" };

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("FIRESTORE_EMULATOR_HOST is not set. Run this with: npm run test:firestore");
  process.exit(2);
}

let failures = 0;
let checks = 0;
function check(label, ok, detail = "") {
  checks++;
  if (!ok) {
    failures++;
    console.error(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
  }
}

const db = getFirestore(initializeApp({ projectId: "demo-coolmaths" }));

/* -------------------------------------- the fixtures, as the site writes them */

for (const [uid, player] of Object.entries(fixtures)) {
  if (player.profile) await db.doc(`users/${uid}`).set(player.profile);
  for (const [slug, record] of Object.entries(player.progress || {})) {
    await db.doc(`users/${uid}/progress/${slug}`).set(record);
  }
  if (player.live) await db.doc(`users/${uid}/live/current`).set({ ...player.live, state: JSON.stringify(player.live.state) });
}

/* --------------------------------- the same answers as on the memory store */

const now = () => Date.UTC(2026, 10, 14, 10, 0, 0);
const firestore = new FirestoreUserStore(db);
const memory = new MemoryStore(fixtures);

async function answer(store, uid, name) {
  const [reply] = await handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: {} } }, { user: { uid }, store, now });
  return JSON.stringify(reply);
}

for (const uid of [...Object.keys(fixtures), "nobody"]) {
  for (const tool of ["whoami", "my_progress", "recommend_next", "my_position"]) {
    const a = await answer(firestore, uid, tool);
    const b = await answer(memory, uid, tool);
    check(`${tool} for ${uid} matches the memory store`, a === b, `${a.slice(0, 160)} vs ${b.slice(0, 160)}`);
  }
}

await db.doc("users/broken/live/current").set({ slug: "coins", sessionId: "s", stateVersion: 1, state: "{not json", status: "", updatedAt: 1 });
check("an unreadable position reads as none", (await firestore.getLive("broken")) === null);

/* ------------------------------------------------------------ the OAuth store */

let clock = 1_000_000;
const oauth = new FirestoreOAuthStore(db, () => clock);

await oauth.put("clients", "c1", { client_id: "c1", redirect_uris: ["https://c.example/cb"] });
check("a record without expiry is kept", (await oauth.get("clients", "c1"))?.client_id === "c1");

// A client's registration arrives with fields set to undefined.
await oauth.put("clients", "c2", { client_id: "c2", client_secret: undefined, nested: { logo_uri: undefined, name: "x" } });
check("undefined fields are dropped, not refused", JSON.stringify(await oauth.get("clients", "c2")) === '{"client_id":"c2","nested":{"name":"x"}}');

await oauth.put("codes", "abc", { uid: "ada" }, clock + 1000);
check("a record is readable before it expires", (await oauth.get("codes", "abc"))?.uid === "ada");
clock += 1001;
check("and not after", (await oauth.get("codes", "abc")) === null);
check("an expired record cannot be taken either", (await oauth.take("codes", "abc")) === null);

await oauth.put("codes", "once", { uid: "ada" }, clock + 60_000);
const takes = await Promise.all(Array.from({ length: 6 }, () => oauth.take("codes", "once")));
check("of six requests at once, exactly one gets a one-time code", takes.filter(Boolean).length === 1, String(takes.filter(Boolean).length));
check("and it is gone", (await oauth.get("codes", "once")) === null);

await oauth.put("access", "t1", { uid: "ada" }, clock + 60_000);
await oauth.delete("access", "t1");
check("a deleted record is gone", (await oauth.get("access", "t1")) === null);
check("kinds are kept apart", (await oauth.get("refresh", "c1")) === null);

if (failures) {
  console.error(`FAIL firestore: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`ok   firestore (${checks} checks)`);
process.exit(0);
