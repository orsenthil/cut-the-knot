"use strict";

/*
 * Kürschak's Tile, from Alexander Bogomolny's applet KurschakTile.
 *
 * A regular dodecagon is drawn as a twelve-pointed star: 24 thin isosceles
 * 15-15-150 triangles (red in the applet) and 12 equilateral triangles
 * (blue). Pressing "Move them" hides nine of those pieces and slides nine
 * copies into three corners of the square around the circle. What is left,
 * coloured, is exactly three quarters of the square.
 *
 * The key idea is that all the triangles have the same two side lengths:
 * with circle radius R they are R/(2 cos 15 deg). That makes every red triangle
 * an isosceles 15-15-150 and every blue one equilateral, so the same pieces
 * tile both the dodecagon and the square. This file holds only that geometry,
 * the 30-step rearrangement and the checks used by the logic test; it never
 * touches the DOM. It defines one global, KurschakTileCore.
 */
const KurschakTileCore = (() => {
  const SIDES = 12;
  const STEPS = 30; // the applet's NSteps
  const TAU = 2 * Math.PI;
  const STEP_ANGLE = Math.PI / 6; // 30 degrees, between successive star tips
  const HALF_ANGLE = Math.PI / 12; // 15 degrees

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const scale = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const bary = (pts) => ({
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  });
  const turn = (p, angle) => ({
    x: p.x * Math.cos(angle) - p.y * Math.sin(angle),
    y: p.x * Math.sin(angle) + p.y * Math.cos(angle),
  });
  const angleBetween = (a, b) => {
    const cross = a.x * b.y - a.y * b.x;
    const dot = a.x * b.x + a.y * b.y;
    let angle = Math.atan2(cross, dot);
    // SetRotatingPoly adds 2*PI only when its angle is strictly negative;
    // -0 (a tiny negative rounding error on parallel edges) stays zero.
    if (angle < -1e-12) angle += TAU;
    else if (angle < 0) angle = 0;
    return angle;
  };

  /** The state a newly opened applet shows: the whole star, no labels or hint. */
  function start(options) {
    const o = options || {};
    return {
      width: Number.isFinite(o.width) ? o.width : 500,
      height: Number.isFinite(o.height) ? o.height : 450,
      step: 0,
      moving: false,
      showNames: Boolean(o.showNames),
      showHint: Boolean(o.showHint),
    };
  }

  /*
   * The bytecode of KurschakTileCanvas.init:
   *   C = (width/2, height/2), R = min(width, height)/2.5,
   *   V[i] = C + R (cos(i*30), sin(i*30)),
   *   W[i] = C + R/(2 cos 15) (cos((i+0.5)*30), sin((i+0.5)*30)),
   *   U[0..3] = C + (R,R), (-R,R), (-R,-R), (R,-R).
   * The two arrays of 24 thin pieces and 12 equilateral pieces are built in
   * the same loops as the applet.
   */
  function geometry(state) {
    const C = { x: state.width / 2, y: state.height / 2 };
    const r = Math.min(state.width, state.height) / 2.5;
    const inner = r / (2 * Math.cos(HALF_ANGLE));
    const V = [], W = [];
    for (let i = 0; i < SIDES; i++) {
      const a = i * STEP_ANGLE;
      V.push(add(C, scale({ x: Math.cos(a), y: Math.sin(a) }, r)));
      W.push(add(C, scale({ x: Math.cos(a + HALF_ANGLE), y: Math.sin(a + HALF_ANGLE) }, inner)));
    }
    const U = [
      add(C, { x: r, y: r }),
      add(C, { x: -r, y: r }),
      add(C, { x: -r, y: -r }),
      add(C, { x: r, y: -r }),
    ];
    const iso = [], equi = [];
    for (let i = 0; i < SIDES; i++) {
      const j = (i + 1) % SIDES;
      iso.push([C, V[i], W[i]], [C, W[i], V[j]]);
      equi.push([V[i], V[j], W[i]]);
    }
    return { C, r, inner, V, W, U, iso, equi };
  }

  /*
   * The twelve triangles outside the dodecagon but inside the square, two
   * thin and one equilateral at each corner. The index j follows Draw's loop:
   * corner U[j] is joined to V[3j+1] and V[3j+2].
   */
  function outer(g) {
    const corners = [];
    for (let j = 0; j < 4; j++) {
      const a = 3 * j, b = 3 * j + 1, c = 3 * j + 2, d = (3 * j + 3) % SIDES;
      corners.push([
        { kind: "iso", points: [g.U[j], g.V[b], g.V[a]] },
        { kind: "equi", points: [g.V[c], g.V[b], g.U[j]] },
        { kind: "iso", points: [g.U[j], g.V[d], g.V[c]] },
      ]);
    }
    return corners;
  }

  /*
   * The nine pairings transcribed literally from MoveThem. Each line is
   * (index of the piece in init, the final triangle stored by
   * StoreFinalPosition). Pieces 0..5 are thin, 24..26 are equilateral.
   */
  function movingSpecs(g) {
    const { U, V } = g;
    return [
      { piece: 0, final: [U[3], V[0], V[11]], kind: "iso" },
      { piece: 1, final: [U[3], V[9], V[10]], kind: "iso" },
      { piece: 2, final: [U[2], V[9], V[8]], kind: "iso" },
      { piece: 3, final: [U[2], V[7], V[6]], kind: "iso" },
      { piece: 4, final: [U[1], V[6], V[5]], kind: "iso" },
      { piece: 5, final: [U[1], V[4], V[3]], kind: "iso" },
      { piece: 24, final: [V[11], V[10], U[3]], kind: "equi" },
      { piece: 25, final: [V[8], V[7], U[2]], kind: "equi" },
      { piece: 26, final: [U[1], V[5], V[4]], kind: "equi" },
    ];
  }

  /** The point labels from ShowNames, in the applet's A..O order. */
  function labels(g) {
    return [
      { name: "A", point: g.U[1] }, { name: "B", point: g.U[0] },
      { name: "C", point: g.U[3] }, { name: "D", point: g.U[2] },
      { name: "E", point: g.V[3] }, { name: "F", point: g.V[0] },
      { name: "G", point: g.V[9] }, { name: "H", point: g.V[6] },
      { name: "M", point: g.V[10] }, { name: "N", point: g.V[11] },
      { name: "K", point: g.W[9] }, { name: "L", point: g.W[10] },
      { name: "O", point: g.C },
    ];
  }

  /** The segment families from ShowHint, kept in the applet's loop order. */
  function hints(g) {
    const lines = [];
    for (let i = 0; i < SIDES; i++) {
      const j = (i + 1) % SIDES;
      lines.push([g.V[i], g.W[i]]);
      lines.push([g.C, g.W[i]]);
      lines.push([g.V[j], g.W[i]]);
      lines.push([g.V[i], g.V[j]]);
    }
    for (let j = 0; j < 4; j++) {
      lines.push([g.U[j], g.V[3 * j + 1]]);
      lines.push([g.U[j], g.V[3 * j + 2]]);
    }
    for (let i = 0; i < SIDES; i++) lines.push([g.C, g.V[i]]);
    for (let j = 0; j < 4; j++) {
      const v = g.V[3 * (j + 1) % SIDES];
      lines.push([g.U[j], v]);
      lines.push([g.U[(j + 1) % 4], v]);
    }
    return lines;
  }

  /*
   * The position of one moving copy at step t of 30. Until the last step the
   * copy turns about its starting centre and its centre travels towards the
   * stored final centre, exactly the 30 increments of MoveThem's thread. At
   * step 30 the copy is drawn at the stored final triangle itself (the
   * applet's RotatingPoly draws FP once it has arrived).
   */
  function movingTriangle(spec, g, step) {
    if (step >= STEPS) return { id: spec.piece, kind: spec.kind, points: spec.final, moving: true };
    const original = spec.piece < 24 ? g.iso[spec.piece] : g.equi[spec.piece - 24];
    const from = bary(original), to = bary(spec.final);
    const first = angleBetween(sub(original[1], original[0]), sub(spec.final[1], spec.final[0]));
    const fraction = step / STEPS;
    const centre = add(from, scale(sub(to, from), fraction));
    const points = original.map((p) => add(centre, turn(sub(p, from), first * fraction)));
    return { id: spec.piece, kind: spec.kind, points, moving: true };
  }

  /**
   * All 36 star pieces plus the 9 travelling copies. Once the move has
   * started the originals of those 9 are painted in the background colour,
   * so they are hidden here; at step 0 the copies sit exactly on them.
   */
  function positions(state) {
    const g = geometry(state);
    const specs = movingSpecs(g);
    const hidden = new Set(state.step > 0 ? specs.map((s) => s.piece) : []);
    const pieces = [];
    for (let i = 0; i < 24; i++) {
      pieces.push({
        id: i, kind: "iso", points: g.iso[i], moving: false, hidden: hidden.has(i),
      });
    }
    for (let i = 0; i < 12; i++) {
      const id = 24 + i;
      pieces.push({
        id, kind: "equi", points: g.equi[i], moving: false, hidden: hidden.has(id),
      });
    }
    if (state.step > 0) for (const spec of specs) pieces.push(movingTriangle(spec, g, state.step));
    return pieces;
  }

  /** The page's formula, checked from the geometry rather than quoted. */
  function claim(radius) {
    const r = radius === undefined ? 1 : radius;
    const g = geometry(start({ width: 2.5 * r, height: 2.5 * r }));
    const area = (pts) => {
      let twice = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        twice += p.x * q.y - q.x * p.y;
      }
      return Math.abs(twice) / 2;
    };
    const thin = area(g.iso[0]);
    const regular = area(g.equi[0]);
    const dodecagon = 24 * thin + 12 * regular;
    const outside = 8 * thin + 4 * regular;
    return {
      r, thin, regular, dodecagon, outside,
      polygon: area(g.V), square: area(g.U),
      ratio: dodecagon / (dodecagon + outside),
      side: dist(g.V[0], g.V[1]),
      equalSide: dist(g.V[0], g.W[0]),
    };
  }

  /** True only when the rearrangement has finished. There is no win or loss. */
  function result(state) {
    return state.step >= STEPS ? "done" : null;
  }

  /** The four changes the applet's panel offers, plus the 30 animation steps. */
  function move(state, action) {
    if (!action) return null;
    switch (action.type) {
      case "option":
        if (!(action.key in state)) return null;
        return { ...state, [action.key]: Boolean(action.value) };
      case "reset":
        return { ...state, step: 0, moving: false };
      case "move":
        return { ...state, step: 0, moving: true };
      case "advance":
        if (!state.moving || state.step >= STEPS) return null;
        return { ...state, step: state.step + 1, moving: state.step + 1 < STEPS };
      case "step": {
        const step = Math.max(0, Math.min(STEPS, Math.round(Number(action.value) || 0)));
        return { ...state, step, moving: false };
      }
      default:
        return null;
    }
  }

  return {
    SIDES, STEPS, TAU, STEP_ANGLE, HALF_ANGLE,
    start, geometry, outer, movingSpecs, labels, hints,
    movingTriangle, positions, claim, result, move,
  };
})();
