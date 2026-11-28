"use strict";

/*
 * Menelaus — the applet "Menelaus and Ceva Theorems" from Alexander
 * Bogomolny's cut-the-knot page
 * https://www.cut-the-knot.org/Curriculum/Geometry/Menelaus.shtml
 * (its "Explanation" is https://www.cut-the-knot.org/Generalization/Menelaus.shtml).
 *
 * The applet has a two-position switch. In Ceva mode a point K can be dragged
 * anywhere; D = AK∩BC, E = BK∩AC and F = CK∩AB, so AD, BE, CF meet at K.
 * In Menelaus mode the vertices A, B, C and the three side points D (on BC),
 * E (on AC, the point the applet now calls K) and F (on AB) can be dragged.
 * Whenever one of them moves, the applet recomputes one of the others as an
 * intersection, so D, E, F stay on one straight line.
 *
 * This file copies the applet's arithmetic: GetPoint (the initial triangle),
 * GeoSDoub.Intersect (including its |determinant| <= 1 NaN guard),
 * GeoSDoub.NearestPoint (the line constraint on D, E and F) and the three
 * update rules in DrawMenelaus. It defines one global, no document, no window,
 * no storage; all positions are plain data so the tutor can read them.
 */
const MenelausCore = (() => {
  const CEVA = 0;
  const MENELAUS = 1;
  const MODES = ["ceva", "menelaus"];
  const WIDTH = 500;
  const HEIGHT = 380;

  const copy = (p) => ({ x: p.x, y: p.y });
  const valid = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** GeoSDoub.Intersect: NaN when the determinant is too close to zero. */
  function intersect(a, b, c, d) {
    const s4 = a.y - b.y;
    const s6 = b.x - a.x;
    const s8 = a.x * b.y - a.y * b.x;
    const s10 = c.y - d.y;
    const s12 = d.x - c.x;
    const s14 = c.x * d.y - c.y * d.x;
    const s16 = s6 * s14 - s12 * s8;
    const s18 = s8 * s10 - s14 * s4;
    const s20 = s4 * s12 - s10 * s6;
    return Math.abs(s20) > 1
      ? { x: s16 / s20, y: s18 / s20 }
      : { x: NaN, y: NaN };
  }

  /** GeoSDoub.NearestPoint(p, a, b): the foot of the perpendicular on AB. */
  function project(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    // GeoSDoub.NearestPoint returns p when it lies within sqrt(0.1) of a.
    if ((p.x - a.x) ** 2 + (p.y - a.y) ** 2 < 0.1) return copy(p);
    const t = (dx * (p.x - a.x) + dy * (p.y - a.y)) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** MenelausCanvas.GetPoint(i): three points on a circle, rounded to pixels. */
  function getPoint(i, width, height) {
    const size = Math.min(width, height) / 5;
    const angle = (2 * Math.PI * i) / 3;
    return {
      x: Math.floor(width / 2 + size * Math.cos(angle) + 0.5),
      y: Math.floor(height / 2 + size * Math.sin(angle) + 0.5),
    };
  }

  function modeOf(value) {
    if (value === MENELAUS || value === "menelaus") return "menelaus";
    return "ceva";
  }

  /** The opening tableau of MenelausCanvas.Init() on a width x height canvas. */
  function start(options) {
    const src = options || {};
    const width = src.width === undefined ? WIDTH : src.width;
    const height = src.height === undefined ? HEIGHT : src.height;
    const A = getPoint(0, width, height);
    const B = getPoint(1, width, height);
    const C = getPoint(2, width, height);
    const K = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 };
    const opening = {
      mode: "ceva",
      width, height, A, B, C, K,
      Dm: null, Fm: null,
      selected: null,
    };
    // A requested Menelaus opening has to go through Reset(1), which swaps
    // A with F and seeds the two draggable side dots.
    return modeOf(src.mode === undefined ? "ceva" : src.mode) === "menelaus"
      ? switchMode(opening, "menelaus")
      : opening;
  }

  /** The three marked points. In Ceva mode they are computed from K on every draw. */
  function points(state) {
    if (state.mode === "menelaus") {
      return { D: copy(state.Dm), E: copy(state.K), F: copy(state.Fm) };
    }
    return {
      D: intersect(state.A, state.K, state.B, state.C),
      E: intersect(state.B, state.K, state.A, state.C),
      F: intersect(state.C, state.K, state.A, state.B),
    };
  }

  /** Position along P->Q: 0 at P, 1 at Q, negative or above 1 on an extension. */
  function parameter(p, origin, end) {
    const dx = end.x - origin.x, dy = end.y - origin.y;
    const len2 = dx * dx + dy * dy;
    if (!(len2 > 0)) return NaN;
    return ((p.x - origin.x) * dx + (p.y - origin.y) * dy) / len2;
  }

  /**
   * The lengths in AF/BF * BD/CD * CE/AE and the signed Ceva product
   * AF/FB * BD/DC * CE/EA. The page needs exactly one or three points on
   * side extensions for the unsigned product to mean collinearity.
   */
  function numbers(state) {
    const p = points(state);
    const tF = parameter(p.F, state.A, state.B);
    const tD = parameter(p.D, state.B, state.C);
    const uE = parameter(p.E, state.A, state.C);
    const a = tF / (1 - tF);
    const b = tD / (1 - tD);
    const c = (1 - uE) / uE;
    const signed = a * b * c;
    const AFBF = Math.abs(a), BDCD = Math.abs(b), CEAE = Math.abs(c);
    const product = AFBF * BDCD * CEAE;
    const ts = [tF, tD, uE];
    const outside = ts.filter((t) => t < 0 || t > 1).length;
    const cross = (p.D.x - p.E.x) * (p.F.y - p.E.y) -
      (p.D.y - p.E.y) * (p.F.x - p.E.x);
    return { tF, tD, uE, AFBF, BDCD, CEAE, product, signed, outside, cross };
  }

  /** The side line a constrained handle glides along. */
  function sideEnds(state, name) {
    if (name === "K") return [state.A, state.C];
    if (name === "D") return [state.B, state.C];
    if (name === "F") return [state.A, state.B];
    return null;
  }

  function projectHandle(state, name, p) {
    const ends = sideEnds(state, name);
    return ends ? project(p, ends[0], ends[1]) : copy(p);
  }

  /** MenelausCanvas.PointIsEligible: x > 2, y > 0, x < width, y < height-2. */
  function clampToBoard(state, p) {
    const eps = 1e-6;
    return {
      x: Math.min(Math.max(p.x, 2 + eps), state.width - eps),
      y: Math.min(Math.max(p.y, eps), state.height - 2 - eps),
    };
  }

  /*
   * MenelausCanvas.Reset(mode). The switch swaps A and F on the way in and
   * back on the way out, limits E=K to the line AC, and creates two draggable
   * dots D and F on BC and AB. That swap is part of the original applet.
   */
  function switchMode(state, mode) {
    const to = modeOf(mode);
    if (to === state.mode) return state;
    const old = points(state);
    if (to === "menelaus") {
      const newA = copy(old.F);
      const newF = copy(state.A);
      return {
        ...state,
        mode: to,
        A: newA,
        K: project(copy(state.K), newA, state.C),
        Dm: copy(old.D),
        Fm: newF,
        selected: null,
      };
    }
    return {
      ...state,
      mode: to,
      A: copy(state.Fm),
      K: copy(state.K),
      selected: null,
    };
  }

  /**
   * A pointer or arrow-key move. In Menelaus mode the three side dots are
   * recomputed exactly as DrawMenelaus does after a drag: moving A rebuilds F,
   * moving B rebuilds D, moving C rebuilds E, and dragging any side dot
   * rebuilds the next one round the cycle.
   */
  function move(state, name, p) {
    const inMenelaus = state.mode === "menelaus";
    const movable = inMenelaus
      ? ["A", "B", "C", "K", "D", "F"]
      : ["A", "B", "C", "K"];
    if (!movable.includes(name)) return state;
    const moved = projectHandle(state, name, clampToBoard(state, p));
    const next = { ...state, [name === "D" ? "Dm" : name === "F" ? "Fm" : name]: moved, selected: name };
    if (!inMenelaus) return next;

    const update = { A: 3, B: 1, C: 2 }[name] || 0;
    if (name === "F" || update === 2) {
      next.K = intersect(next.Fm, next.Dm, next.A, next.C);
    }
    if (name === "D" || update === 3) {
      next.Fm = intersect(next.Dm, next.K, next.B, next.A);
    }
    if (name === "K" || update === 1) {
      next.Dm = intersect(next.K, next.Fm, next.C, next.B);
    }
    return next;
  }

  /** A keyboard nudge: the current point translated by (dx,dy). */
  function step(state, name, dx, dy) {
    const key = name === "D" ? "Dm" : name === "F" ? "Fm" : name;
    const at = state[key];
    if (!at) return state;
    return move(state, name, { x: at.x + dx, y: at.y + dy });
  }

  /** This is an illustration: there is no win, loss or finishing move. */
  function result(state) {
    return null;
  }

  return {
    CEVA, MENELAUS, WIDTH, HEIGHT,
    start, points, numbers, intersect, project, getPoint,
    parameter, sideEnds, projectHandle, clampToBoard,
    switchMode, move, step, result,
  };
})();
