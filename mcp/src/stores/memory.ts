/*
 * A UserStore held in memory, filled from plain data.
 *
 * It backs the tests (fixtures/users.json) and local development with the
 * dev sign-in (src/auth/dev.ts), so the personal tools can be built and run
 * with no database and no network.
 */

import type { LivePosition, Profile, ProgressRecord, UserStore } from "../core/store.js";

export interface StoredUser {
  profile?: Profile;
  progress?: Record<string, ProgressRecord>;
  live?: LivePosition | null;
}

export class MemoryStore implements UserStore {
  constructor(private readonly users: Record<string, StoredUser>) {}

  async getProfile(uid: string): Promise<Profile | null> {
    return this.users[uid]?.profile ?? null;
  }

  async getProgress(uid: string): Promise<Record<string, ProgressRecord>> {
    return this.users[uid]?.progress ?? {};
  }

  async getLive(uid: string): Promise<LivePosition | null> {
    return this.users[uid]?.live ?? null;
  }
}
