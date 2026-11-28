"use strict";

/*
 * Lemma, from Alexander Bogomolny's Java applet Lemma and the cut-the-knot
 * article "Salinon: From Archimedes' Book of Lemmas".
 *
 * The article claims Euclid II.10, (a+b)^2 + (a-b)^2 = 2(a^2+b^2), and uses it
 * to prove Archimedes' Proposition 14: the area inside the four semicircles of
 * the salinon equals the area of the circle on CF as diameter. The applet draws
 * that figure: a big semicircle on AB, two small ones on AD and BE, an inverted
 * one on DE, and the circle whose vertical diameter is CF. One point on AO can
 * be dragged; everything else follows from it.
 *
 * The bytecode's draggable point lives on the line from A to O (the LEFT HALF
 * of AB), not on all of AB. DoubLine.CreateMidPoint(0.3) puts it 30% of the way
 * from A to O, and DoubLine.UpdateMidPoint projects a mouse point back onto
 * that same half. L = (int)(point.x - rect.x) is the length AD = BE; the applet
 * truncates it to a whole pixel. All areas are exact functions of L.
 *
 * This file is only the logic: no document, no window, no storage. It defines
 * one global, LemmaCore, and every function returns plain data.
 */

const LemmaCore = (() => {
  // LemmaCanvas.init: margin 10; side = min(width-2m, height-2m).
  const WIDTH = 360;
  const HEIGHT = 240;
  const MARGIN = 10;
  const SIDE = Math.min(WIDTH - 2 * MARGIN, HEIGHT - 2 * MARGIN); // 220
  const HALF = SIDE / 2; // 110: the line A..O that the point slides on
  const RECT = { x: MARGIN, y: MARGIN, width: SIDE, height: SIDE };
  const BASE_Y = RECT.y + RECT.height / 2; // 120, the diameter AB
  // DoubLine.CreateMidPoint(0.3); PointIsEligible refuses x <= rect.x+2.
  const START_T = 0.3;
  const MIN_GAP = 2;

  /** The applet's m_T, the fraction from O (0) to A (1) along the half-line. */
  function clampT(t) {
    const v = Number.isFinite(t) ? t : START_T;
    return Math.max(0, Math.min(1, v));
  }

  /** PointIsEligible(x, y) from the bytecode, including its odd upper half. */
  function eligible(x, y) {
    return x > RECT.x + MIN_GAP && y > RECT.y &&
      x < RECT.x + RECT.width && y < RECT.y + RECT.height / 2 - MIN_GAP;
  }

  /** The pixel length AD = BE: Java's (int)(point.x - rect.x), i.e. truncate. */
  function lengthAD(t) {
    const x = RECT.x + HALF * (1 - clampT(t));
    // A tiny epsilon undoes binary round-off at an integral pixel, so setting
    // the handle on an integer x recovers exactly that integer length.
    return Math.max(0, Math.min(HALF, Math.trunc(x - RECT.x + 1e-9)));
  }

  /** The position a new diagram starts from. */
  function start(options) {
    const t = options && options.t !== undefined ? options.t : START_T;
    return { t: clampT(t) };
  }

  /** Move the point to a board x, as DoubLine.UpdateMidPoint does. */
  function setPointX(state, x) {
    const d = Number.isFinite(x) ? x : RECT.x + HALF * (1 - clampT(state && state.t));
    const t = 1 - (d - RECT.x) / HALF;
    return { t: clampT(t) };
  }

  /** A new state with a different m_T; the input is never changed. */
  function setT(state, t) {
    return { t: clampT(t) };
  }

  /** The board x of the draggable point, from A to O. */
  function pointX(state) {
    return RECT.x + HALF * (1 - clampT(state.t));
  }

  /** Everything the page draws and reports, derived from the point alone. */
  function geometry(state) {
    const t = clampT(state.t);
    const L = lengthAD(t);
    const de = SIDE - 2 * L;
    const cf = SIDE - L;
    const A = { x: RECT.x, y: BASE_Y };
    const O = { x: RECT.x + HALF, y: BASE_Y };
    const B = { x: RECT.x + SIDE, y: BASE_Y };
    const D = { x: RECT.x + L, y: BASE_Y };
    const E = { x: B.x - L, y: BASE_Y };
    const C = { x: O.x, y: RECT.y };
    const F = { x: O.x, y: BASE_Y + de / 2 };
    const bigR = HALF;
    const smallR = L / 2;
    const deR = de / 2;
    const circle = { center: { x: O.x, y: RECT.y + cf / 2 }, radius: cf / 2 };

    // Areas of the half-circles: (1/2) pi r^2 = (pi/8) d^2.
    const bigSemi = Math.PI * bigR * bigR / 2;
    const deSemi = Math.PI * deR * deR / 2;
    const smallSemis = 2 * (Math.PI * smallR * smallR / 2);
    const circleArea = Math.PI * (cf / 2) * (cf / 2);
    // The salinon: the big half-circle, plus the inverted one, minus AD and BE.
    const salinon = bigSemi + deSemi - smallSemis;

    return {
      t: t,
      L: L,
      A: A, O: O, B: B, D: D, E: E, C: C, F: F,
      point: { x: pointX(state), y: BASE_Y },
      bigR: bigR, smallR: smallR, deR: deR, de: de, cf: cf,
      eo: HALF - L, oa: HALF, ea: cf,
      circle: circle,
      bigSemi: bigSemi, deSemi: deSemi, smallSemis: smallSemis,
      salinon: salinon, circleArea: circleArea,
      sumOnABDE: bigSemi + deSemi,
      sumOnCircleAndSmall: circleArea + smallSemis,
    };
  }

  /** A compact, JSON-safe summary for Track.state and the tutor. */
  function position(state) {
    const g = geometry(state);
    const round = (v) => Number(v.toFixed(6));
    return {
      t: round(g.t),
      L: g.L,
      D: { x: round(g.D.x), y: round(g.D.y) },
      de: round(g.de),
      cf: round(g.cf),
      salinon: round(g.salinon),
      circleArea: round(g.circleArea),
    };
  }

  return {
    WIDTH: WIDTH, HEIGHT: HEIGHT, MARGIN: MARGIN, SIDE: SIDE, HALF: HALF,
    RECT: RECT, BASE_Y: BASE_Y, START_T: START_T, MIN_GAP: MIN_GAP,
    clampT: clampT, eligible: eligible, lengthAD: lengthAD,
    start: start, setT: setT, setPointX: setPointX, pointX: pointX,
    geometry: geometry, position: position,
  };
})();
