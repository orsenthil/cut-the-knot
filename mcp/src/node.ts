/*
 * The Node entry point: reads the environment, builds the app, listens.
 *
 * This is what runs on Fly.io (see Dockerfile and fly.toml), and what
 * `npm run dev` runs locally. The server has three modes, chosen by what
 * is in the environment:
 *
 *   nothing set
 *       Only the public endpoint, /mcp. /mcp/me answers 503.
 *
 *   FIREBASE_SERVICE_ACCOUNT (the service account's JSON key, a Fly secret)
 *       The real thing: players' records come from Firestore, and /mcp/me
 *       is signed in to with OAuth, which is kept in Firestore too.
 *       Also needs PUBLIC_URL, SIGN_IN_URL and SIGN_IN_ORIGINS (fly.toml).
 *
 *   FIRESTORE_EMULATOR_HOST + FIREBASE_AUTH_EMULATOR_HOST + FIREBASE_PROJECT_ID
 *       The same code against the Firebase emulators, with no key. For tests.
 *
 *   COOLMATHS_DEV_TOKEN + COOLMATHS_DEV_USER
 *       Local work only: /mcp/me accepts one fixed token and serves the
 *       fixture players in fixtures/users.json. No OAuth, no database.
 *
 *   PORT    port to listen on (default 8080)
 */

import { DevAuthenticator } from "./auth/dev.js";
import { CoolmathsOAuthProvider } from "./auth/oauth-provider.js";
import { createApp, type AppOptions } from "./app.js";
import { MemoryStore } from "./stores/memory.js";
import fixtures from "../fixtures/users.json";

const port = Number(process.env.PORT) || 8080;

async function firebaseOptions(env: NodeJS.ProcessEnv): Promise<AppOptions> {
  // Loaded only in this mode: firebase-admin is large and slow to start.
  const { initializeApp, cert } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");
  const { getFirestore } = await import("firebase-admin/firestore");
  const { FirestoreUserStore, FirestoreOAuthStore } = await import("./stores/firestore.js");

  const app = env.FIREBASE_SERVICE_ACCOUNT
    ? initializeApp({ credential: cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)) })
    : initializeApp({ projectId: env.FIREBASE_PROJECT_ID });
  const db = getFirestore(app);
  const auth = getAuth(app);

  const publicUrl = env.PUBLIC_URL ?? `http://localhost:${port}`;
  const signInUrl = env.SIGN_IN_URL;
  if (!signInUrl) throw new Error("SIGN_IN_URL must be set: the address of the site's sign-in page");
  const signInOrigins = (env.SIGN_IN_ORIGINS ?? new URL(signInUrl).origin).split(",").map((s) => s.trim());

  const provider = new CoolmathsOAuthProvider({
    store: new FirestoreOAuthStore(db),
    signInUrl,
    // checkRevoked: a player who has signed out everywhere, or been
    // disabled, cannot be signed in to the tutor with an old token.
    verifyIdToken: async (idToken) => (await auth.verifyIdToken(idToken, true)).uid,
  });
  return { store: new FirestoreUserStore(db), oauth: { provider, publicUrl, signInOrigins } };
}

async function optionsFromEnv(env: NodeJS.ProcessEnv): Promise<AppOptions> {
  if (env.FIREBASE_SERVICE_ACCOUNT) {
    console.log("players' records: Firestore; /mcp/me: OAuth");
    return firebaseOptions(env);
  }
  if (env.FIRESTORE_EMULATOR_HOST && env.FIREBASE_AUTH_EMULATOR_HOST && env.FIREBASE_PROJECT_ID) {
    console.warn("using the Firebase EMULATORS. Never do this in production.");
    return firebaseOptions(env);
  }
  if (env.COOLMATHS_DEV_TOKEN && env.COOLMATHS_DEV_USER) {
    console.warn(`dev sign-in is ON: /mcp/me serves fixture player "${env.COOLMATHS_DEV_USER}". Never do this in production.`);
    return { authenticator: new DevAuthenticator(env.COOLMATHS_DEV_TOKEN, env.COOLMATHS_DEV_USER), store: new MemoryStore(fixtures) };
  }
  console.log("public endpoint only: no sign-in is configured, so /mcp/me answers 503");
  return {};
}

const server = createApp(await optionsFromEnv(process.env)).listen(port, () => {
  console.log(`coolmaths tutor listening on :${port}`);
});

// Fly stops idle machines with SIGINT; finish what is in flight and leave.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
