/*
 * Who is calling the personal endpoint.
 *
 * An Authenticator turns a request's Authorization header into a player, or
 * null when the header does not name one. The HTTP layer knows only this
 * interface, so the sign-in method can change without touching it:
 *
 *   auth/dev.ts   a fixed token for local work and tests
 *   (to come)     OAuth tokens issued after a Firebase sign-in; see
 *                 tasks/012-mcp-oauth.md
 */

import type { User } from "../core/store.js";

export interface Authenticator {
  readonly name: string;
  authenticate(authorization: string | null): Promise<User | null>;
}

/** The token from "Bearer <token>", or null. */
export function bearerToken(authorization: string | null): string | null {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization ?? "");
  return match ? match[1] : null;
}
