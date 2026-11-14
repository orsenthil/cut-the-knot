/*
 * Sign-in, and the switch from the browser's record to the account's.
 *
 * site.js loads this module only where it is needed: on the profile page,
 * and on every page once the player has signed in on this browser. A guest
 * never downloads the Firebase SDK and never gets an account; their record
 * stays in localStorage (assets/progress.js).
 *
 * When a player signs in, Track is switched to the Firestore backend and
 * whatever was recorded in the browser is moved into the account. The same
 * move runs on every later page load, which also picks up anything recorded
 * in the moment before this module finished loading, or while offline.
 *
 * It sets window.COOLMATHS_AUTH and fires "authchange" on window whenever
 * the signed-in player changes:
 *
 *   COOLMATHS_AUTH.ready            resolves once it is known who is signed in
 *   COOLMATHS_AUTH.user             null, or { uid, displayName, providers }
 *   COOLMATHS_AUTH.signIn("google" | "github")
 *   COOLMATHS_AUTH.signOut()
 *   COOLMATHS_AUTH.getSettings()    -> { mcpAccess, public }
 *   COOLMATHS_AUTH.setMcpAccess(true | false)
 *   COOLMATHS_AUTH.deleteAccount()  the record, the profile and the sign-in
 */

import { firebaseConfig, FIREBASE_SDK } from "./firebase-config.js";
import { firebaseBackend, moveRecord, withFallback } from "./backends/firebase.js";

/** Set while the player is signed in on this browser; site.js reads it. */
const SIGNED_IN_KEY = "coolmaths-account";
const DEFAULT_SETTINGS = { mcpAccess: true, public: false };

/*
 * Tests run against the Firebase emulators. A page may ask for them by
 * setting window.COOLMATHS_EMULATORS, and only when it is served from this
 * machine, so the live site can never be pointed away from the real project.
 */
const onThisMachine = ["localhost", "127.0.0.1"].includes(location.hostname);
const emulators = onThisMachine ? window.COOLMATHS_EMULATORS || null : null;

const [{ initializeApp }, authSdk, firestoreSdk] = await Promise.all([
  import(`${FIREBASE_SDK}/firebase-app.js`),
  import(`${FIREBASE_SDK}/firebase-auth.js`),
  import(`${FIREBASE_SDK}/firebase-firestore.js`),
]);

const app = initializeApp(emulators ? { ...firebaseConfig, projectId: emulators.projectId } : firebaseConfig);
const auth = authSdk.getAuth(app);
const db = firestoreSdk.getFirestore(app);
if (emulators) {
  authSdk.connectAuthEmulator(auth, emulators.auth, { disableWarnings: true });
  firestoreSdk.connectFirestoreEmulator(db, emulators.firestoreHost, emulators.firestorePort);
}

const { doc, getDoc, setDoc, deleteDoc } = firestoreSdk;
const profileRef = (uid) => doc(db, "users", uid);

function setFlag(on) {
  try {
    if (on) localStorage.setItem(SIGNED_IN_KEY, "1");
    else localStorage.removeItem(SIGNED_IN_KEY);
  } catch (e) {
    // storage blocked: the profile page still loads this module
  }
}

function localBackend() {
  try {
    return window.Track.localBackend(window.localStorage);
  } catch (e) {
    return window.Track.memoryBackend();
  }
}

/** Track arrives a moment after this module on pages where site.js adds it. */
async function whenTrack() {
  for (let i = 0; i < 100 && !window.Track; i++) await new Promise((r) => setTimeout(r, 50));
  return window.Track || null;
}

const describe = (user) =>
  user && {
    uid: user.uid,
    displayName: user.displayName || "",
    providers: user.providerData.map((p) => p.providerId),
  };

/** Creates the profile on first sign-in; afterwards only refreshes the name. */
async function saveProfile(user) {
  const snap = await getDoc(profileRef(user.uid));
  const base = { displayName: user.displayName || "", providers: user.providerData.map((p) => p.providerId), lastSeenAt: Date.now() };
  if (snap.exists()) await setDoc(profileRef(user.uid), base, { merge: true });
  else await setDoc(profileRef(user.uid), { ...base, createdAt: Date.now(), settings: DEFAULT_SETTINGS });
}

/** Points Track at the account and moves the browser's record into it. */
async function useAccount(user) {
  const Track = await whenTrack();
  if (!Track) return;
  const local = Track.backend().name === "local" ? Track.backend() : localBackend();
  const remote = firebaseBackend({ db, uid: user.uid, sdk: firestoreSdk, core: Track.core });
  Track.useBackend(withFallback(remote, local));
  try {
    const moved = await moveRecord(local, remote);
    if (moved) Track.useBackend(Track.backend()); // announce: the record changed
  } catch (err) {
    console.warn("coolmaths: could not move the browser's record into the account yet", err);
  }
}

async function useBrowser() {
  const Track = await whenTrack();
  if (Track && Track.backend().name !== "local") Track.useBackend(localBackend());
}

const api = {
  user: null,
  ready: null,

  async signIn(providerName) {
    const provider = providerName === "github" ? new authSdk.GithubAuthProvider() : new authSdk.GoogleAuthProvider();
    try {
      await authSdk.signInWithPopup(auth, provider);
    } catch (err) {
      if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") return;
      if (err.code === "auth/account-exists-with-different-credential") {
        throw new Error("That email already has a coolmaths account with the other sign-in. Use the one you used before.");
      }
      if (err.code === "auth/popup-blocked") throw new Error("Your browser blocked the sign-in window. Allow pop-ups for this site and try again.");
      throw new Error("Signing in did not work. Please try again.");
    }
  },

  signOut() {
    return authSdk.signOut(auth);
  },

  async getSettings() {
    if (!auth.currentUser) return { ...DEFAULT_SETTINGS };
    const snap = await getDoc(profileRef(auth.currentUser.uid));
    return { ...DEFAULT_SETTINGS, ...((snap.exists() && snap.data().settings) || {}) };
  },

  async setMcpAccess(on) {
    const settings = { ...(await api.getSettings()), mcpAccess: Boolean(on) };
    await setDoc(profileRef(auth.currentUser.uid), { settings }, { merge: true });
  },

  // Asks the player to sign in once more first: the sign-in service insists
  // on a recent sign-in before deleting, and it must be asked for straight
  // from the click, before any waiting, or the browser blocks the window.
  async deleteAccount() {
    const user = auth.currentUser;
    if (!user) return;
    const providerId = user.providerData[0] && user.providerData[0].providerId;
    const provider = providerId === "github.com" ? new authSdk.GithubAuthProvider() : new authSdk.GoogleAuthProvider();
    if (!emulators) await authSdk.reauthenticateWithPopup(user, provider);
    const Track = await whenTrack();
    if (Track) await firebaseBackend({ db, uid: user.uid, sdk: firestoreSdk, core: Track.core }).clear();
    await deleteDoc(profileRef(user.uid));
    await authSdk.deleteUser(user);
  },
};

// Tests only, and only against the emulator, which accepts a made-up Google
// identity; there is no way to reach this on the live site.
if (emulators) {
  api.signInForTest = (identity) =>
    authSdk.signInWithCredential(auth, authSdk.GoogleAuthProvider.credential(JSON.stringify({ email_verified: true, ...identity })));
}

let firstState;
api.ready = new Promise((resolve) => {
  firstState = resolve;
});

authSdk.onAuthStateChanged(auth, async (user) => {
  api.user = describe(user);
  setFlag(Boolean(user));
  try {
    if (user) {
      await saveProfile(user);
      await useAccount(user);
    } else {
      await useBrowser();
    }
  } catch (err) {
    console.warn("coolmaths: the account could not be reached; playing on with this browser's record", err);
  }
  firstState();
  window.dispatchEvent(new Event("authchange"));
});

window.COOLMATHS_AUTH = api;
