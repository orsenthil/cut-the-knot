"use strict";

/*
 * The Josephus Flavius game, from Alexander Bogomolny's applet flavius.
 *
 * N people stand in a circle. Starting from the topmost place, every K-th person still in the circle
 * is removed, until one is left. Josephus, with 40 soldiers and every third person to go (and a friend
 * beside him), found the safe place. You pick a place and watch whether you survive.
 *
 * Read off the bytecode (flaviuscanvas): the places are numbered from 0 at the top, going round;
 * the count starts at place 0 ("1" is said at the top), so the first to go is place K - 1 (mod N);
 * GetNextEmpty steps to the next person still in the circle (a place that is free or is yours);
 * FindNext does K such steps and removes the person it ends on. When N people have been counted the
 * last one is the survivor (it is marked, not removed). If your place is removed, the game ends with
 * "You got killed. Please get another life. Press Reset."; if you are the survivor, "Hooray. You
 * survived. Please try again. Press Reset." The controls: How many (N) from 3 to 50, opening on 30;
 * Every which (K) from 1 to 50 (the < > buttons keep K below N), opening on 3; Fast and Slow
 * start the counting once you have picked a place; Reset starts again. Changing N or K resets.
 * Place states as in the applet: 0 free, 1 removed, 2 yours, 3 yours and removed, 5 the survivor.
 * The position is plain data.
 */
const FlaviusCore = (() => {
  const MIN_N = 3;
  const MAX = 50;
  const START_N = 30;
  const START_K = 3;
  const MESSAGES = ["Please select a smiley", "You can select another fellow or press Slow/Fast", "You got killed. Please get another life. Press Reset.", "Hooray. You survived. Please try again. Press Reset."];

  /** A new game: n people, every k-th, nobody picked. */
  function start(options) {
    const o = options || {};
    const n = Number.isFinite(Number(o.n)) ? Math.max(MIN_N, Math.min(MAX, Math.trunc(Number(o.n)))) : START_N;
    const k = Number.isFinite(Number(o.k)) ? Math.max(1, Math.min(MAX, Math.trunc(Number(o.k)))) : START_K;
    return { n, k, status: new Array(n).fill(0), hits: 0, counter: -1, finished: false, selected: -1, order: [], moves: 0, explored: false };
  }

  /** The next person still in the circle after `from` (the applet's GetNextEmpty). */
  function nextAlive(status, n, from) {
    for (let j = 1; ; j++) {
      const pos = (from + j) % n;
      if (status[pos] === 0 || status[pos] === 2) return pos;
    }
  }

  /** The message the applet shows: the prompt, the hint after a pick, or how it ended. */
  function message(s) {
    if (s.finished) return s.status[s.counter] === 5 && s.survived ? MESSAGES[3] : MESSAGES[2];
    return s.selected === -1 ? MESSAGES[0] : MESSAGES[1];
  }

  /** "win" if you are the survivor, "lose" if you were removed, else null. */
  function result(s) {
    if (!s.finished) return null;
    return s.survived ? "win" : "lose";
  }

  /**
   * Moves: {type:"pick", place} (pick or change your place before the counting starts), {type:"step"} (one
   * removal), {type:"run"} (all the way), {type:"n", value}, {type:"k", value}, {type:"reset"}.
   */
  function move(s, m) {
    if (!m) return null;
    if (m.type === "pick") {
      if (s.hits > 0 || s.finished || !(m.place >= 0 && m.place < s.n)) return null;
      const status = s.status.map((v) => (v === 2 ? 0 : v));
      status[m.place] = m.place === s.selected ? 0 : 2; // a second press on your place takes the pick back
      return { ...s, status, selected: m.place === s.selected ? -1 : m.place, moves: s.moves + 1 };
    }
    if (m.type === "step") {
      if (s.selected === -1 || s.finished) return null;
      let c = s.counter;
      for (let i = 0; i < s.k; i++) c = nextAlive(s.status, s.n, c);
      const status = s.status.slice();
      status[c] += 1;
      const hits = s.hits + 1;
      const t = { ...s, status, counter: c, hits, order: s.order.concat(c), moves: s.moves + 1, explored: true };
      if (hits === s.n) { status[c] = 5; return { ...t, finished: true, survived: s.selected === c }; }
      if (status[c] === 3) return { ...t, finished: true, survived: false };
      return t;
    }
    if (m.type === "run") {
      let t = s;
      while (t && !t.finished && t.selected !== -1) t = move(t, { type: "step" });
      return t === null ? null : t;
    }
    if (m.type === "n") {
      const v = Math.trunc(Number(m.value));
      if (!(v >= MIN_N && v <= MAX)) return null;
      return start({ n: v, k: s.k });
    }
    if (m.type === "k") {
      const v = Math.trunc(Number(m.value));
      if (!(v >= 1 && v <= MAX)) return null;
      return start({ n: s.n, k: v });
    }
    if (m.type === "reset") return start({ n: s.n, k: s.k });
    return null;
  }

  function legalMoves(s) {
    if (s.finished) return [{ type: "reset" }];
    if (s.selected === -1 || s.hits === 0) return s.status.map((_, place) => ({ type: "pick", place })).concat(s.selected === -1 ? [] : [{ type: "step" }]);
    return [{ type: "step" }];
  }

  /** The whole game from nothing but N and K: the order in which places are removed and the survivor (the applet's counting). */
  function simulate(n, k) {
    const status = new Array(n).fill(0);
    const order = [];
    let c = -1;
    for (let hits = 1; hits <= n; hits++) {
      for (let i = 0; i < k; i++) c = nextAlive(status, n, c);
      status[c] = 1;
      order.push(c);
    }
    return { order, survivor: order[n - 1] };
  }

  /** The survivor's place by the recurrence J(1) = 0, J(m) = (J(m - 1) + k) mod m (0 = the top). */
  function safePlace(n, k) {
    let j = 0;
    for (let m = 2; m <= n; m++) j = (j + k) % m;
    return j;
  }

  return { MIN_N, MAX, START_N, START_K, MESSAGES, start, nextAlive, message, result, move, legalMoves, simulate, safePlace };
})();
