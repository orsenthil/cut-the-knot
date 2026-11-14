/*
 * The coolmaths Firebase project, as the browser needs to know it.
 *
 * This is public by design: every Firebase web app ships these values in its
 * pages. They only say which project to talk to. What a visitor may read or
 * write is decided by firebase/firestore.rules, not by keeping this secret.
 *
 * Analytics is deliberately not loaded anywhere on the site, so the
 * project's measurementId is left out.
 *
 * FIREBASE_SDK is the one place the SDK version is pinned; firebase/package.json
 * tests against the same version.
 */

export const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/13.3.0";

export const firebaseConfig = {
  apiKey: "AIzaSyB5y4ILnWT8Pj6hlZ-2CPI37XFCr2OwfvQ",
  authDomain: "coolmaths-ramanujan1729.firebaseapp.com",
  projectId: "coolmaths-ramanujan1729",
  storageBucket: "coolmaths-ramanujan1729.firebasestorage.app",
  messagingSenderId: "267942142287",
  appId: "1:267942142287:web:d3d633a22069bc4bdae53a",
};
