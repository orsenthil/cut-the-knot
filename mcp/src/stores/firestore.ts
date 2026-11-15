/*
 * The stores on Cloud Firestore, through firebase-admin.
 *
 * FirestoreUserStore reads what the site wrote for a player (the shapes are
 * in docs/contracts.md, section 7). FirestoreOAuthStore keeps the OAuth
 * server's records under oauth/{kind}/items/{id}, a part of the database the
 * security rules close to every browser.
 *
 * The admin SDK is not bound by the security rules, so everything here must
 * take the uid from a verified sign-in and nothing else.
 */

import type { Firestore } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";

import type { OAuthKind, OAuthRecord, OAuthStore } from "../auth/oauth-store.js";
import type { LivePosition, Profile, ProgressRecord, UserStore } from "../core/store.js";

export class FirestoreUserStore implements UserStore {
  constructor(private readonly db: Firestore) {}

  async getProfile(uid: string): Promise<Profile | null> {
    const snap = await this.db.doc(`users/${uid}`).get();
    return snap.exists ? (snap.data() as Profile) : null;
  }

  async getProgress(uid: string): Promise<Record<string, ProgressRecord>> {
    const snaps = await this.db.collection(`users/${uid}/progress`).get();
    const out: Record<string, ProgressRecord> = {};
    snaps.forEach((snap) => {
      out[snap.id] = snap.data() as ProgressRecord;
    });
    return out;
  }

  // The page saves the position as JSON text (see assets/backends/firebase.js).
  async getLive(uid: string): Promise<LivePosition | null> {
    const snap = await this.db.doc(`users/${uid}/live/current`).get();
    if (!snap.exists) return null;
    const data = snap.data() as Omit<LivePosition, "state"> & { state: string };
    try {
      return { ...data, state: JSON.parse(data.state) };
    } catch {
      return null;
    }
  }
}

export class FirestoreOAuthStore implements OAuthStore {
  constructor(
    private readonly db: Firestore,
    private readonly now: () => number = Date.now,
  ) {}

  private ref(kind: OAuthKind, id: string) {
    return this.db.doc(`oauth/${kind}/items/${id}`);
  }

  private read(data: FirebaseFirestore.DocumentData | undefined): OAuthRecord | null {
    if (!data) return null;
    if (typeof data.expiresAt === "number" && data.expiresAt <= this.now()) return null;
    return data.value as OAuthRecord;
  }

  // `expireAt` is the same moment as a date, for a Firestore TTL policy to
  // clear out old records; `expiresAt` is what this code checks.
  async put(kind: OAuthKind, id: string, record: OAuthRecord, expiresAt?: number): Promise<void> {
    // Through JSON and back: Firestore refuses `undefined`, which a client's
    // registration is full of, and this drops those fields.
    const value = JSON.parse(JSON.stringify(record)) as OAuthRecord;
    await this.ref(kind, id).set(
      expiresAt === undefined ? { value } : { value, expiresAt, expireAt: Timestamp.fromMillis(expiresAt) },
    );
  }

  async get(kind: OAuthKind, id: string): Promise<OAuthRecord | null> {
    return this.read((await this.ref(kind, id).get()).data());
  }

  // A transaction, so that of two requests presenting the same one-time code
  // only one can get it.
  async take(kind: OAuthKind, id: string): Promise<OAuthRecord | null> {
    const ref = this.ref(kind, id);
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      tx.delete(ref);
      return this.read(snap.data());
    });
  }

  async delete(kind: OAuthKind, id: string): Promise<void> {
    await this.ref(kind, id).delete();
  }
}
