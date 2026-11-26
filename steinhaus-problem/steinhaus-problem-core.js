"use strict";

/*
 * Steinhaus' Problem, from Alexander Bogomolny's applet SteinhausProblem.
 *
 * Hugo Steinhaus asked for numbers x1, x2, ... in [0, 1] such that x1, x2
 * are in different halves, x1, x2, x3 in different thirds, and so on: for
 * every k the first k numbers lie in k different k-ths of the interval. Ten
 * is possible; how far can you go? M. Warmus proved that 17 is the most.
 *
 * Transcribed from SteinhausProblemCanvas. The numbered tiles 1..18 are
 * dragged onto the line in order; a tile lands on a multiple of 0.005 of
 * the form .xx0 or .xx5 (a drop 4-6 thousandths past a hundredth gives the
 * half, otherwise the nearest hundredth). TheFirstOK(k): the k-th of the
 * interval holding x is floor(1000 x k / 1000) in thousandths, and each of
 * the k pieces must be hit exactly once (so x = 1 counts as outside). The
 * check passes when it holds for every k up to the number of tiles placed.
 * "Remove last" takes the highest-numbered tile off the line.
 *
 * The idea the test relies on: only which piece each number falls in
 * matters, so an exact search over the pieces (with all fractions put over
 * the common denominator lcm(1..18)) settles every length.
 *
 * This file is the game's logic and nothing else. It defines one global,
 * SteinhausProblemCore. The position is plain data: the places of the
 * tiles on the line, in thousandths.
 */
const SteinhausProblemCore = (() => {
  const TILES = 18;
  const EXAMPLES = {
    "Steinhaus, 10 (i)": [950, 50, 340, 740, 580, 170, 450, 870, 260, 660],
    "Steinhaus, 10 (ii)": [60, 550, 770, 390, 960, 280, 640, 130, 880, 480],
    "Steinhaus, 14": [60, 550, 770, 390, 960, 280, 640, 130, 880, 480, 190, 710, 350, 820],
    "Rearranged, 14": [190, 960, 550, 390, 770, 60, 640, 280, 880, 480, 130, 710, 350, 820],
    "Guy, 17": [710, 90, 420, 850, 270, 540, 925, 170, 620, 355, 780, 30, 480, 970, 220, 660, 320],
  };

  function start(options = {}) {
    const places = Array.isArray(options.places) ? options.places.slice(0, TILES).map(snapExact) : [];
    return { places };
  }

  /** A place in thousandths that is already on the grid of .005 (0..1000). */
  function snapExact(t) {
    const v = Math.round(Number(t) / 5) * 5;
    return Math.max(0, Math.min(1000, v));
  }

  /** mouseReleased: where a tile dropped at x thousandths lands. */
  function snap(x) {
    const r = Math.round(Number(x));
    const L4 = ((r % 10) + 10) % 10;
    let pos, half = false;
    if (L4 < 4) pos = Math.floor(r / 10);
    else if (L4 > 6) pos = Math.floor(r / 10) + 1;
    else { pos = Math.floor(r / 10); half = true; }
    pos = Math.max(0, Math.min(100, pos)); // SetPos clamps to 0..100
    return Math.min(1000, pos * 10 + (half ? 5 : 0));
  }

  /** Drop tile i (0-based) at x thousandths: the next new tile, or one already on the line. */
  function place(s, i, x) {
    if (!(Number.isInteger(i) && i >= 0 && i <= s.places.length && i < TILES) || !Number.isFinite(Number(x))) return null;
    const places = s.places.slice();
    places[i] = snap(x);
    return { places };
  }

  /** Remove last. */
  function removeLast(s) {
    if (!s.places.length) return null;
    return { places: s.places.slice(0, -1) };
  }

  /** TheFirstOK(k). */
  function firstOK(places, k) {
    const hits = new Array(k + 1).fill(0);
    for (let i = 0; i < k; i++) hits[Math.floor((places[i] * k) / 1000)]++;
    for (let j = 0; j < k; j++) if (hits[j] !== 1) return false;
    return true;
  }

  /** The largest k such that the first 1, 2, ..., k all pass (0 if the first fails). */
  function goodPrefix(s) {
    let k = 0;
    while (k < s.places.length && firstOK(s.places, k + 1)) k++;
    return k;
  }

  /** CheckOK: every k up to the number placed passes (and something is placed). */
  const ok = (s) => s.places.length > 0 && goodPrefix(s) === s.places.length;

  /** For the first failing k, the pieces that hold two numbers or none. */
  function trouble(s) {
    const k = goodPrefix(s) + 1;
    if (k > s.places.length) return null;
    const hits = new Array(k).fill(null).map(() => []);
    for (let i = 0; i < k; i++) { const b = Math.floor((s.places[i] * k) / 1000); if (b < k) hits[b].push(i + 1); }
    return { k, crowded: hits.map((h, j) => ({ piece: j + 1, tiles: h })).filter((x) => x.tiles.length > 1), empty: hits.map((h, j) => (h.length ? null : j + 1)).filter(Boolean) };
  }

  const format = (t) => (t >= 1000 ? "1.00" : "." + String(Math.floor(t / 10)).padStart(2, "0") + (t % 10 === 5 ? "5" : ""));

  return { TILES, EXAMPLES, start, snap, place, removeLast, firstOK, goodPrefix, ok, trouble, format };
})();
