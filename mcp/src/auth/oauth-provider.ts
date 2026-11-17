/*
 * Sign-in for /mcp/me: an OAuth 2.1 authorization server for MCP clients
 * such as claude.ai.
 *
 * The protocol endpoints (/authorize, /token, /register, /revoke and the
 * discovery documents) are the MCP SDK's own; src/app.ts mounts them. The
 * SDK checks client ids, redirect URIs and PKCE. This class supplies what
 * is ours: who the player is, and what is remembered.
 *
 * How a sign-in goes:
 *
 *   1. The client sends the player's browser to /authorize. authorize()
 *      saves the request and sends the browser on to the coolmaths sign-in
 *      page (signin/ on the site) with the request's id.
 *   2. That page shows who is asking (describeRequest), signs the player in
 *      with Firebase, and on "Allow" posts the request id with the player's
 *      Firebase ID token to /oauth/complete (completeRequest).
 *   3. completeRequest verifies the ID token, which is the only thing that
 *      says who the player is, and answers with the client's redirect URL
 *      carrying a one-time code.
 *   4. The client swaps the code for an access token (one hour) and a
 *      refresh token (thirty days, replaced each time it is used).
 *
 * Codes and tokens are random, used through their SHA-256, and kept in an
 * OAuthStore. An access token gives read-only access to one player's
 * record, and only while that player leaves the tutor's access switched on.
 */

import { createHash, randomBytes } from "node:crypto";

import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import { InvalidGrantError, InvalidRequestError, InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { AuthorizationParams, OAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { OAuthClientInformationFull, OAuthTokenRevocationRequest, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";

import type { User } from "../core/store.js";
import { bearerToken, type Authenticator } from "./authenticator.js";
import type { OAuthStore } from "./oauth-store.js";

const MINUTE = 60_000;
const REQUEST_TTL = 10 * MINUTE;
const CODE_TTL = 5 * MINUTE;
const ACCESS_TTL = 60 * MINUTE;
const REFRESH_TTL = 30 * 24 * 60 * MINUTE;

/** The one scope: read this player's coolmaths record. */
export const SCOPE = "record:read";

export interface OAuthProviderOptions {
  store: OAuthStore;
  /** The sign-in page on the site, e.g. https://coolmaths.ai/signin/ */
  signInUrl: string;
  /** Checks a Firebase ID token and returns the player's uid; throws if it is not valid. */
  verifyIdToken: (idToken: string) => Promise<string>;
  now?: () => number;
}

const randomToken = () => randomBytes(32).toString("base64url");
const hash = (secret: string) => createHash("sha256").update(secret).digest("hex");

/** Limits on what a client may register, so the store cannot be filled with junk. */
function checkClient(client: OAuthClientInformationFull): void {
  if (client.redirect_uris.length === 0 || client.redirect_uris.length > 5) {
    throw new InvalidRequestError("a client needs between 1 and 5 redirect_uris");
  }
  for (const uri of client.redirect_uris) {
    const url = new URL(uri);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
      throw new InvalidRequestError("redirect_uris must be https, or http on localhost");
    }
  }
  if (JSON.stringify(client).length > 4000) throw new InvalidRequestError("the client metadata is too large");
}

export class CoolmathsOAuthProvider implements OAuthServerProvider, Authenticator {
  readonly name = "oauth";

  private readonly store: OAuthStore;
  private readonly signInUrl: string;
  private readonly verifyIdToken: (idToken: string) => Promise<string>;
  private readonly now: () => number;

  constructor(options: OAuthProviderOptions) {
    this.store = options.store;
    this.signInUrl = options.signInUrl;
    this.verifyIdToken = options.verifyIdToken;
    this.now = options.now ?? Date.now;
  }

  /* --------------------------------------------------------------- clients */

  get clientsStore(): OAuthRegisteredClientsStore {
    return {
      getClient: async (clientId) => {
        const record = await this.store.get("clients", clientId);
        return (record as OAuthClientInformationFull | null) ?? undefined;
      },
      registerClient: async (client) => {
        const full = client as OAuthClientInformationFull;
        checkClient(full);
        await this.store.put("clients", full.client_id, full as unknown as Record<string, unknown>);
        return full;
      },
    };
  }

  /* ---------------------------------------------------- step 1: /authorize */

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: { redirect(url: string): void },
  ): Promise<void> {
    const id = randomToken();
    await this.store.put(
      "requests",
      id,
      {
        clientId: client.client_id,
        clientName: String(client.client_name ?? "").slice(0, 100),
        redirectUri: params.redirectUri,
        codeChallenge: params.codeChallenge,
        state: params.state ?? null,
      },
      this.now() + REQUEST_TTL,
    );
    const url = new URL(this.signInUrl);
    url.searchParams.set("request", id);
    res.redirect(url.href);
  }

  /* ------------------------------------------- step 2: the sign-in page asks */

  /** What the sign-in page shows the player before they decide. */
  async describeRequest(id: string): Promise<{ clientName: string; redirectHost: string } | null> {
    const request = await this.store.get("requests", id);
    if (!request) return null;
    return {
      clientName: String(request.clientName) || "An app",
      redirectHost: new URL(String(request.redirectUri)).host,
    };
  }

  /* ----------------------------------- step 3: the player allows or refuses */

  /**
   * Finishes a sign-in. With `allow` and a valid ID token the answer is the
   * client's redirect URL carrying a one-time code; otherwise the same URL
   * carrying access_denied. Returns null when the request is unknown or has
   * expired. A request can be finished once.
   */
  async completeRequest(id: string, idToken: string | null, allow: boolean): Promise<string | null> {
    // Check who is asking before the request is used up, so a bad token
    // does not cost the player their sign-in.
    let uid: string | null = null;
    if (allow) {
      if (!idToken) throw new InvalidRequestError("an ID token is required");
      try {
        uid = await this.verifyIdToken(idToken);
      } catch {
        throw new InvalidRequestError("the sign-in could not be verified");
      }
    }

    const request = await this.store.take("requests", id);
    if (!request) return null;
    const redirect = new URL(String(request.redirectUri));
    if (request.state !== null) redirect.searchParams.set("state", String(request.state));

    if (!uid) {
      redirect.searchParams.set("error", "access_denied");
      return redirect.href;
    }

    const code = randomToken();
    await this.store.put(
      "codes",
      hash(code),
      { clientId: request.clientId, uid, codeChallenge: request.codeChallenge, redirectUri: request.redirectUri },
      this.now() + CODE_TTL,
    );
    redirect.searchParams.set("code", code);
    return redirect.href;
  }

  /* ------------------------------------------------------- step 4: /token */

  async challengeForAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    const record = await this.store.get("codes", hash(authorizationCode));
    if (!record || record.clientId !== client.client_id) throw new InvalidGrantError("the authorization code is not valid");
    return String(record.codeChallenge);
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
  ): Promise<OAuthTokens> {
    // take(): the code is gone whether or not the rest succeeds.
    const record = await this.store.take("codes", hash(authorizationCode));
    if (!record || record.clientId !== client.client_id) throw new InvalidGrantError("the authorization code is not valid");
    if (redirectUri !== undefined && redirectUri !== record.redirectUri) {
      throw new InvalidGrantError("redirect_uri does not match the authorization request");
    }
    return this.issueTokens(client.client_id, String(record.uid));
  }

  async exchangeRefreshToken(client: OAuthClientInformationFull, refreshToken: string): Promise<OAuthTokens> {
    // take(): a refresh token works once, and is replaced by the new one.
    const record = await this.store.take("refresh", hash(refreshToken));
    if (!record || record.clientId !== client.client_id) throw new InvalidGrantError("the refresh token is not valid");
    return this.issueTokens(client.client_id, String(record.uid));
  }

  private async issueTokens(clientId: string, uid: string): Promise<OAuthTokens> {
    const access = randomToken();
    const refresh = randomToken();
    const now = this.now();
    await this.store.put("access", hash(access), { clientId, uid }, now + ACCESS_TTL);
    await this.store.put("refresh", hash(refresh), { clientId, uid }, now + REFRESH_TTL);
    return {
      access_token: access,
      token_type: "Bearer",
      expires_in: ACCESS_TTL / 1000,
      refresh_token: refresh,
      scope: SCOPE,
    };
  }

  /* ------------------------------------------------------ using a token */

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const record = await this.store.get("access", hash(token));
    if (!record) throw new InvalidTokenError("the access token is not valid or has expired");
    return { token, clientId: String(record.clientId), scopes: [SCOPE], extra: { uid: record.uid } };
  }

  /** The Authenticator the HTTP layer uses for /mcp/me. */
  async authenticate(authorization: string | null): Promise<User | null> {
    const token = bearerToken(authorization);
    if (!token) return null;
    const record = await this.store.get("access", hash(token));
    return record ? { uid: String(record.uid) } : null;
  }

  async revokeToken(client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest): Promise<void> {
    const id = hash(request.token);
    for (const kind of ["access", "refresh"] as const) {
      const record = await this.store.get(kind, id);
      if (record && record.clientId === client.client_id) await this.store.delete(kind, id);
    }
  }
}
