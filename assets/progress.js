"use strict";

/*
 * Track: a player's record of what they have played.
 *
 * This is the only progress API a game page calls, and it knows nothing about
 * where the record is kept. It hands every write to a backend: by default one
 * that keeps the record in this browser's localStorage, later one that keeps
 * it in the signed-in player's account (see docs/contracts.md). Games never
 * talk to a database.
 *
 * A game page does not have to call anything. On every page with
 * <body data-game="slug"> this file counts the visit and the time spent, and
 * watches #status: when it gains the shared .win or .lose class, that is
 * recorded as a finished play. A game that wants more calls:
 *
 *   Track.start("coins", { options: { coins: 8 }, stateVersion: 1 });
 *   Track.state({ values: [5, 1, 10] });       // the position, after each move
 *   Track.end({ outcome: "win", moves: 4 });   // "win" | "loss" | "draw" | "quit" | "impossible" | "done"
 *
 * Calling Track.start turns the #status watching off for that page, so a
 * play is never counted twice. Starting again before the play ends logs the
 * old one as "quit", but only if its position had changed: pressing Reset on
 * an untouched board is not a play.
 *
 * What is stored (times are milliseconds since 1970):
 *
 *   progress[slug]  { slug, firstAt, lastAt, opens, activeSeconds, plays,
 *                     completed, wins, losses, best?, lastOptions? }
 *   sessions[]      { slug, startedAt, endedAt, outcome, moves?, options? }
 *   live            { slug, sessionId, stateVersion, state, status, updatedAt }
 *
 * The top of the file is pure logic and runs in Node
 * (porting/check-progress.mjs); the browser wiring is at the bottom.
 */

const Track = (() => {
  const STORAGE_KEY = "coolmaths-profile-v1";
  const LIVE_DEBOUNCE_MS = 2000;
  const MAX_STATE_CHARS = 8000;
  const MAX_SESSIONS = 50;

  const OUTCOMES = ["win", "loss", "draw", "quit", "impossible", "done"];
  /** In `best`, these are better when smaller; every other number when larger. */
  const SMALLER_IS_BETTER = ["moves", "seconds", "flips", "steps"];

  /* ------------------------------------------------------------ pure logic */

  function emptyProgress(slug, at) {
    return { slug, firstAt: at, lastAt: at, opens: 0, activeSeconds: 0, plays: 0, completed: 0, wins: 0, losses: 0 };
  }

  /** Keeps, field by field, the better of two `best` records. */
  function mergeBest(old, fresh) {
    const out = { ...(old || {}) };
    for (const [key, value] of Object.entries(fresh || {})) {
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      const smaller = SMALLER_IS_BETTER.includes(key);
      if (!(key in out) || (smaller ? value < out[key] : value > out[key])) out[key] = value;
    }
    return out;
  }

  /**
   * A progress record after a change. `delta` carries amounts to add
   * (opens, activeSeconds, plays, completed, wins, losses) and values to
   * replace or merge (best, lastOptions). Counters never go down.
   */
  function applyDelta(doc, slug, delta, at) {
    const out = { ...(doc || emptyProgress(slug, at)) };
    for (const counter of ["opens", "activeSeconds", "plays", "completed", "wins", "losses"]) {
      const add = Number(delta[counter]) || 0;
      if (add > 0) out[counter] = (out[counter] || 0) + add;
    }
    if (delta.best) out.best = mergeBest(out.best, delta.best);
    if (delta.lastOptions) out.lastOptions = delta.lastOptions;
    out.lastAt = Math.max(out.lastAt || 0, at);
    return out;
  }

  /** What finishing a play adds to the progress record. */
  function deltaForEnd(result) {
    const outcome = result.outcome;
    const completed = result.completed !== undefined ? Boolean(result.completed) : outcome === "win" || outcome === "done";
    return {
      plays: 1,
      wins: outcome === "win" ? 1 : 0,
      losses: outcome === "loss" ? 1 : 0,
      completed: completed ? 1 : 0,
      best: result.best,
    };
  }

  /** True when a position is small enough to store. */
  function stateFits(state) {
    try {
      return JSON.stringify(state).length <= MAX_STATE_CHARS;
    } catch (e) {
      return false; // circular, or otherwise not JSON
    }
  }

  /* -------------------------------------------------------------- backends */

  /*
   * A backend keeps one player's record. Every method returns a promise:
   *
   *   readProgress()      -> { slug: progress record }
   *   bump(slug, delta)   -> the updated progress record
   *   readSessions()      -> sessions, oldest first
   *   addSession(session)
   *   readLive()          -> the live position, or null
   *   setLive(live)
   *   clear()             forgets everything
   *
   * memoryBackend keeps it in a variable; `persist`, when given, is called
   * with the whole record after each write.
   */
  function memoryBackend(initial, persist) {
    const data = {
      progress: { ...((initial && initial.progress) || {}) },
      sessions: [...((initial && initial.sessions) || [])],
      live: (initial && initial.live) || null,
    };
    const saved = () => {
      if (persist) persist(data);
    };
    return {
      name: "memory",
      async readProgress() {
        return { ...data.progress };
      },
      async bump(slug, delta) {
        data.progress[slug] = applyDelta(data.progress[slug], slug, delta, delta.at || Date.now());
        saved();
        return data.progress[slug];
      },
      async readSessions() {
        return [...data.sessions];
      },
      async addSession(session) {
        data.sessions.push(session);
        if (data.sessions.length > MAX_SESSIONS) data.sessions.splice(0, data.sessions.length - MAX_SESSIONS);
        saved();
      },
      async readLive() {
        return data.live;
      },
      async setLive(live) {
        data.live = live;
        saved();
      },
      async clear() {
        data.progress = {};
        data.sessions = [];
        data.live = null;
        saved();
      },
    };
  }

  /** The record in this browser. Falls back to memory when storage is blocked. */
  function localBackend(storage) {
    let initial = null;
    try {
      initial = JSON.parse(storage.getItem(STORAGE_KEY) || "null");
    } catch (e) {
      // unreadable or blocked: start empty
    }
    const backend = memoryBackend(initial, (data) => {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        // private windows may block storage; the record lasts for this page
      }
    });
    backend.name = "local";
    return backend;
  }

  /* ------------------------------------------------------------ the tracker */

  let backend = memoryBackend();
  let now = () => Date.now();

  /** The play in progress on this page, or null. */
  let session = null;
  /** True once the page has called Track.start itself. */
  let explicit = false;

  let pendingLive = null;
  let liveTimer = null;
  let warnedTooBig = false;

  function announce() {
    if (typeof window !== "undefined" && typeof Event === "function") {
      window.dispatchEvent(new Event("progresschange"));
    }
  }

  function newSessionId() {
    return now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function openSession(slug, opts) {
    session = {
      id: newSessionId(),
      slug,
      startedAt: now(),
      options: opts && opts.options,
      stateVersion: (opts && opts.stateVersion) || 1,
    };
    return session;
  }

  /** Counts one visit to a game page. */
  function visit(slug) {
    return backend.bump(slug, { opens: 1, at: now() }).then(announce);
  }

  /** A new play begins. A play still open, and moved in, is recorded as quit. */
  function start(slug, opts) {
    explicit = true;
    const closing = session && session.moved ? end({ outcome: "quit" }) : Promise.resolve();
    openSession(slug, opts);
    const delta = { at: now() };
    if (opts && opts.options) delta.lastOptions = opts.options;
    return closing.then(() => backend.bump(slug, delta));
  }

  /** The position changed. Written at most once every LIVE_DEBOUNCE_MS. */
  function state(stateObj, status) {
    if (!session) return;
    if (!stateFits(stateObj)) {
      if (!warnedTooBig && typeof console !== "undefined") {
        console.warn(`Track.state: the position for ${session.slug} is over ${MAX_STATE_CHARS} characters and was not saved`);
        warnedTooBig = true;
      }
      return;
    }
    const json = JSON.stringify(stateObj);
    if (session.firstState === undefined) session.firstState = json;
    else if (json !== session.firstState) session.moved = true;
    pendingLive = { slug: session.slug, sessionId: session.id, stateVersion: session.stateVersion, state: stateObj, status };
    if (liveTimer === null && typeof setTimeout === "function") {
      liveTimer = setTimeout(flush, LIVE_DEBOUNCE_MS);
    }
  }

  /** Writes a waiting position now. */
  function flush() {
    if (liveTimer !== null) {
      clearTimeout(liveTimer);
      liveTimer = null;
    }
    if (!pendingLive) return Promise.resolve();
    const live = { ...pendingLive, updatedAt: now() };
    if (live.status === undefined) live.status = readStatusText();
    pendingLive = null;
    return backend.setLive(live);
  }

  /** The play is over. Does nothing when no play is open. */
  function end(result) {
    if (!session) return Promise.resolve();
    const finished = session;
    session = null;
    const res = result || {};
    const outcome = OUTCOMES.includes(res.outcome) ? res.outcome : "done";
    const record = { slug: finished.slug, startedAt: finished.startedAt, endedAt: now(), outcome };
    if (typeof res.moves === "number") record.moves = res.moves;
    if (finished.options) record.options = finished.options;
    const delta = { ...deltaForEnd({ ...res, outcome }), at: record.endedAt };
    return flush()
      .then(() => backend.addSession(record))
      .then(() => backend.bump(finished.slug, delta))
      .then(announce);
  }

  function useBackend(next) {
    backend = next;
    announce();
  }

  /* --------------------------------------------------------- browser wiring */

  function readStatusText() {
    if (typeof document === "undefined") return "";
    const el = document.getElementById("status");
    return el ? el.textContent.trim().slice(0, 300) : "";
  }

  /**
   * For pages that never call Track.start: a play ends each time #status
   * gains the .win or .lose class, and the next one starts right after.
   */
  function watchStatus(slug) {
    const el = document.getElementById("status");
    if (!el || typeof MutationObserver !== "function") return;
    const read = () => (el.classList.contains("win") ? "win" : el.classList.contains("lose") ? "loss" : null);
    let last = read();
    openSession(slug);
    new MutationObserver(() => {
      const current = read();
      if (current === last) return;
      last = current;
      if (explicit || !current) return;
      if (!session) openSession(slug);
      end({ outcome: current });
      openSession(slug);
    }).observe(el, { attributes: true, attributeFilter: ["class"] });
  }

  /** Adds the seconds this page was visible to the game's record. */
  function watchTime(slug) {
    let visibleSince = document.visibilityState === "visible" ? now() : null;
    const settle = () => {
      if (visibleSince === null) return;
      const seconds = Math.round((now() - visibleSince) / 1000);
      visibleSince = null;
      if (seconds > 0) backend.bump(slug, { activeSeconds: seconds, at: now() });
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") visibleSince = now();
      else {
        settle();
        flush();
      }
    });
    window.addEventListener("pagehide", () => {
      settle();
      flush();
    });
  }

  function boot() {
    let storage = null;
    try {
      storage = window.localStorage;
    } catch (e) {
      // blocked: stay on the memory backend
    }
    if (storage) backend = localBackend(storage);

    const onReady = () => {
      const slug = document.body && document.body.dataset.game;
      if (!slug) return;
      visit(slug);
      watchTime(slug);
      if (!explicit) watchStatus(slug);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", onReady);
    else onReady();
  }

  const api = {
    visit,
    start,
    state,
    end,
    flush,
    useBackend,
    backend: () => backend,
    progress: () => backend.readProgress(),
    sessions: () => backend.readSessions(),
    live: () => backend.readLive(),
    /** Forgets the whole record. */
    clear: () => backend.clear().then(announce),
    memoryBackend,
    localBackend,
    // Exposed for the logic test and for other backends.
    core: { STORAGE_KEY, MAX_STATE_CHARS, MAX_SESSIONS, OUTCOMES, emptyProgress, applyDelta, mergeBest, deltaForEnd, stateFits },
    /** Tests only: a fixed clock. */
    _setClock(fn) {
      now = fn;
    },
  };

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    window.Track = api;
    boot();
  }
  return api;
})();
