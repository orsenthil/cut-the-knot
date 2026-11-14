/*
 * Sign-in for local development and tests: one fixed token names one player.
 *
 * It exists so the personal tools can be run end to end before real sign-in
 * is built. It is only switched on when both COOLMATHS_DEV_TOKEN and
 * COOLMATHS_DEV_USER are set (see src/node.ts); never set them in production.
 */

import { timingSafeEqual } from "node:crypto";

import type { User } from "../core/store.js";
import { bearerToken, type Authenticator } from "./authenticator.js";

export class DevAuthenticator implements Authenticator {
  readonly name = "dev";

  constructor(
    private readonly token: string,
    private readonly uid: string,
  ) {
    if (token.length < 16) throw new Error("COOLMATHS_DEV_TOKEN must be at least 16 characters");
  }

  async authenticate(authorization: string | null): Promise<User | null> {
    const given = Buffer.from(bearerToken(authorization) ?? "");
    const wanted = Buffer.from(this.token);
    if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return null;
    return { uid: this.uid };
  }
}
