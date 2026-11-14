/*
 * The player's record in their coolmaths account (Cloud Firestore).
 *
 * This is a backend for Track (assets/progress.js): the same seven methods
 * as the localStorage backend, kept under users/{uid} in the database. The
 * shapes are in docs/contracts.md, section 7, and firebase/firestore.rules
 * decides what is allowed.
 *
 * The Firestore functions are passed in rather than imported, so this one
 * file runs in the browser (assets/auth.js passes the SDK loaded from the
 * CDN) and in Node against the emulator (firebase/test/backend.test.mjs
 * passes the npm package).
 *
 * Two things differ from the stored shape in the contract:
 *   - live.state is saved as JSON text. Firestore cannot hold a list inside
 *     a list, which board positions often are, and text lets the rules cap
 *     its size.
 *   - a session gets an `expireAt` date, for a Firestore TTL policy to
 *     remove old plays.
 */

const SESSION_DAYS = 180;
const SESSIONS_READ = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @param {object} deps
 * @param {object} deps.db    a Firestore instance
 * @param {string} deps.uid   the signed-in player
 * @param {object} deps.sdk   the firebase/firestore module (doc, getDoc, ...)
 * @param {object} deps.core  Track.core, for the reference merge of a record
 */
export function firebaseBackend({ db, uid, sdk, core }) {
  const { doc, collection, getDoc, getDocs, setDoc, addDoc, deleteDoc, runTransaction, query, orderBy, limitToLast, writeBatch, Timestamp } = sdk;

  const progressRef = (slug) => doc(db, "users", uid, "progress", slug);
  const progressCol = () => collection(db, "users", uid, "progress");
  const sessionsCol = () => collection(db, "users", uid, "sessions");
  const liveRef = () => doc(db, "users", uid, "live", "current");

  /** Firestore refuses `undefined`; a record never needs it. */
  const clean = (record) => Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));

  return {
    name: "firebase",

    async readProgress() {
      const out = {};
      (await getDocs(progressCol())).forEach((snap) => {
        out[snap.id] = snap.data();
      });
      return out;
    },

    // Read, merge with the same rule the local backend uses, write: all in
    // one transaction, so two tabs adding to a count cannot lose one.
    async bump(slug, delta) {
      return runTransaction(db, async (tx) => {
        const snap = await tx.get(progressRef(slug));
        const at = delta.at || Date.now();
        const next = core.applyDelta(snap.exists() ? snap.data() : undefined, slug, delta, at);
        if (delta.firstAt) next.firstAt = Math.min(next.firstAt, delta.firstAt);
        tx.set(progressRef(slug), clean(next));
        return next;
      });
    },

    async readSessions() {
      const snaps = await getDocs(query(sessionsCol(), orderBy("startedAt"), limitToLast(SESSIONS_READ)));
      return snaps.docs.map((snap) => {
        const { expireAt, ...session } = snap.data();
        return session;
      });
    },

    async addSession(session) {
      const expireAt = Timestamp.fromMillis(session.endedAt + SESSION_DAYS * DAY_MS);
      await addDoc(sessionsCol(), { ...clean(session), expireAt });
    },

    async readLive() {
      const snap = await getDoc(liveRef());
      if (!snap.exists()) return null;
      const live = snap.data();
      try {
        return { ...live, state: JSON.parse(live.state) };
      } catch (e) {
        return null; // unreadable: treat as no position
      }
    },

    async setLive(live) {
      if (!live) {
        await deleteDoc(liveRef());
        return;
      }
      await setDoc(liveRef(), {
        slug: live.slug,
        sessionId: String(live.sessionId || ""),
        stateVersion: live.stateVersion || 1,
        state: JSON.stringify(live.state),
        status: String(live.status || "").slice(0, 300),
        updatedAt: live.updatedAt,
      });
    },

    // Forgets what was played. The account itself (users/{uid}) stays.
    async clear() {
      const [progress, sessions] = await Promise.all([getDocs(progressCol()), getDocs(sessionsCol())]);
      const refs = [...progress.docs, ...sessions.docs].map((snap) => snap.ref).concat(liveRef());
      // A batch holds at most 500 writes.
      for (let i = 0; i < refs.length; i += 400) {
        const batch = writeBatch(db);
        refs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
        await batch.commit();
      }
    },
  };
}

/**
 * Copies everything in one backend into another, adding to what is there,
 * then empties the first. This is how a guest's record in the browser joins
 * their account when they sign in, and how anything recorded before the
 * account finished loading catches up.
 */
export async function moveRecord(from, to) {
  const [progress, sessions, live, liveThere] = await Promise.all([
    from.readProgress(),
    from.readSessions(),
    from.readLive(),
    to.readLive(),
  ]);

  for (const [slug, record] of Object.entries(progress)) {
    await to.bump(slug, {
      opens: record.opens,
      activeSeconds: record.activeSeconds,
      plays: record.plays,
      completed: record.completed,
      wins: record.wins,
      losses: record.losses,
      best: record.best,
      lastOptions: record.lastOptions,
      firstAt: record.firstAt,
      at: record.lastAt,
    });
  }
  for (const session of sessions) await to.addSession(session);
  if (live && (!liveThere || live.updatedAt > liveThere.updatedAt)) await to.setLive(live);

  await from.clear();
  return Object.keys(progress).length;
}

/**
 * A backend that uses `primary` and, when a call to it fails (offline, or
 * the service is down), falls back to `fallback`. Writes that land in the
 * fallback are not lost: moveRecord carries them over on a later page load.
 */
export function withFallback(primary, fallback) {
  const wrap = (method) => async (...args) => {
    try {
      return await primary[method](...args);
    } catch (err) {
      console.warn(`coolmaths: ${primary.name}.${method} failed, using ${fallback.name}`, err);
      return fallback[method](...args);
    }
  };
  const out = { name: primary.name };
  for (const method of ["readProgress", "bump", "readSessions", "addSession", "readLive", "setLive", "clear"]) {
    out[method] = wrap(method);
  }
  return out;
}
