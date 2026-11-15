/*
 * Where the OAuth server keeps what it must remember: registered clients,
 * sign-ins in progress, one-time codes and tokens.
 *
 * It is a small keyed store with expiry, so the provider (oauth-provider.ts)
 * is the same on memory, for tests, and on Firestore, in production, and
 * nothing is lost when Fly stops an idle machine.
 *
 * Codes and tokens are never stored themselves: the provider keys them by
 * their SHA-256, so a copy of this store cannot be used to sign in.
 */

export type OAuthKind = "clients" | "requests" | "codes" | "access" | "refresh";

export type OAuthRecord = Record<string, unknown>;

export interface OAuthStore {
  /** Saves a record. `expiresAt` is milliseconds since 1970, or absent to keep it. */
  put(kind: OAuthKind, id: string, value: OAuthRecord, expiresAt?: number): Promise<void>;
  /** The record, or null when it is missing or has expired. */
  get(kind: OAuthKind, id: string): Promise<OAuthRecord | null>;
  /** Returns the record and removes it in one step, so it can be used once. */
  take(kind: OAuthKind, id: string): Promise<OAuthRecord | null>;
  delete(kind: OAuthKind, id: string): Promise<void>;
}

export class MemoryOAuthStore implements OAuthStore {
  private readonly items = new Map<string, { value: OAuthRecord; expiresAt?: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  private key(kind: OAuthKind, id: string) {
    return `${kind}/${id}`;
  }

  async put(kind: OAuthKind, id: string, value: OAuthRecord, expiresAt?: number): Promise<void> {
    this.items.set(this.key(kind, id), { value, expiresAt });
  }

  async get(kind: OAuthKind, id: string): Promise<OAuthRecord | null> {
    const item = this.items.get(this.key(kind, id));
    if (!item) return null;
    if (item.expiresAt !== undefined && item.expiresAt <= this.now()) {
      this.items.delete(this.key(kind, id));
      return null;
    }
    return item.value;
  }

  async take(kind: OAuthKind, id: string): Promise<OAuthRecord | null> {
    const value = await this.get(kind, id);
    this.items.delete(this.key(kind, id));
    return value;
  }

  async delete(kind: OAuthKind, id: string): Promise<void> {
    this.items.delete(this.key(kind, id));
  }
}
