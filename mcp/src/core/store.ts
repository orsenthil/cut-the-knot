/*
 * A player's record, as the server reads it.
 *
 * The shapes are the ones the site writes (assets/progress.js, and
 * docs/contracts.md for the full description). UserStore is the only way the
 * server reaches a database, so the tools work the same on fixtures
 * (stores/memory.ts) as on the real thing, and swapping the database means
 * writing one more class.
 *
 * Times are milliseconds since 1970.
 */

export interface User {
  uid: string;
}

export interface Profile {
  displayName?: string;
  settings?: {
    /** False when the player has turned the tutor's access off. Default on. */
    mcpAccess?: boolean;
  };
}

export interface ProgressRecord {
  slug: string;
  firstAt: number;
  lastAt: number;
  opens: number;
  activeSeconds: number;
  plays: number;
  completed: number;
  wins: number;
  losses: number;
  best?: Record<string, number>;
  lastOptions?: Record<string, unknown>;
}

/** The game a player has open, as the page last saved it. */
export interface LivePosition {
  slug: string;
  sessionId: string;
  stateVersion: number;
  state: Record<string, unknown>;
  status: string;
  updatedAt: number;
}

export interface UserStore {
  getProfile(uid: string): Promise<Profile | null>;
  /** Every game the player has opened, by slug. */
  getProgress(uid: string): Promise<Record<string, ProgressRecord>>;
  getLive(uid: string): Promise<LivePosition | null>;
}
