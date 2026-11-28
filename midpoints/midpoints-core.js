"use strict";

/*
 * midpoints — Alexander Bogomolny's applet "Construction of n-gon from the
 * midpoints of its sides" (cut-the-knot.org/pythagoras/midpoints.shtml).
 *
 * Place n dots; they are to be the midpoints of the sides of a polygon. The
 * applet picks a starting vertex A (its moving cursor) and reflects A in each
 * dot in turn: A_{k+1} = 2 * O_k - A_k. The last point A_n is joined back to A.
 * A red target circle is drawn around the midpoint of A and A_n.
 *
 * The key idea is that a reflection in a point is x -> 2O - x, so the
 * composition of an odd number of reflections is another reflection, in
 * M = O1 - O2 + O3 - ... + On; an even number composes to the translation
 * x -> x + 2*(O2 - O1 + O4 - O3 + ... + On - O(n-1)). Thus with odd n there is
 * exactly one starting vertex (M) that closes the polygon, while with even n
 * there is a closing start only when that translation is zero, and then every
 * start works.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, MidpointsCore, so the page loads it with a
 * plain <script> and porting/check-midpoints.mjs loads it in Node. Positions
 * are plain data in the board's user units, which match the applet's canvas.
 */
const MidpointsCore = (() => {
  /* The Java canvas accepted clicks to x < 400 and y < 350; mouse coords were
     snapped to a multiple of mouseStep = 2 before being stored. */
  const VIEW = { width: 400, height: 350 };
  const STEP = 2;
  const MAX_POINTS = 100; // m_nMax in midpointer
  const TOL = 3;          // the applet's |dx| < 3 && |dy| < 3 closing test
  const MARGIN = 10;

  const point = (x, y) => ({ x, y });
  const snapCoord = (v) => Math.trunc(v / STEP) * STEP; // Java's (v/2)*2
  const snap = (p) => point(snapCoord(p.x), snapCoord(p.y));
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** Keep a handle inside the board, leaving room for its circle. */
  function clamp(p) {
    return point(
      Math.max(MARGIN, Math.min(VIEW.width - MARGIN, p.x)),
      Math.max(MARGIN, Math.min(VIEW.height - MARGIN, p.y)),
    );
  }

  /**
   * MidpointsCanvas.mouseReleased: the union of its two rectangles. In the
   * top strip (y <= 30) only x < 340 was accepted; below that, x < 400 was.
   * The test uses the raw event position, before snapping.
   */
  function inCanvas(p) {
    if (!finite(p)) return false;
    return (p.x > 0 && p.x < 340 && p.y > 0 && p.y < 350)
      || (p.x > 0 && p.x < 400 && p.y > 30 && p.y < 350);
  }

  /** The opening position: no dots, the cursor near the middle, Place points. */
  function start(options) {
    const o = options || {};
    return {
      points: (o.points || []).map(snap).slice(0, MAX_POINTS),
      cursor: o.cursor ? snap(o.cursor) : point(200, 180),
      mode: o.mode === "drag" ? "drag" : "place",
      explored: false,
    };
  }

  /** Switching modes marks the illustration explored, as any interaction does. */
  function setMode(state, mode) {
    if (mode !== "place" && mode !== "drag") return state;
    if (state.mode === mode) return state;
    return Object.assign({}, state, { mode, explored: true });
  }

  /**
   * Place a midpoint. midpointer.Add only adds while !m_bDefined, i.e. in
   * Place points mode; the applet's mouseReleased also checked inCanvas().
   * The applet ran off the end of its 100-element array on a 101st click;
   * here we simply stop adding, so the page stays alive.
   */
  function addPoint(state, raw) {
    if (state.mode !== "place" || !inCanvas(raw)) return state;
    if (state.points.length >= MAX_POINTS) return state;
    const p = snap(raw);
    return Object.assign({}, state, {
      points: state.points.concat([p]),
      explored: true,
    });
  }

  /** Move the starting vertex. The applet snapped both coordinates to 2. */
  function moveCursor(state, raw) {
    if (!finite(raw)) return state;
    const p = clamp(snap(raw));
    if (p.x === state.cursor.x && p.y === state.cursor.y) return state;
    return Object.assign({}, state, { cursor: p, explored: true });
  }

  /** The Reset button: clear the dots and return to Place points. */
  function reset(state) {
    return Object.assign({}, state, { points: [], mode: "place" });
  }

  /** An illustration has no win or loss. */
  function result(state) {
    return null;
  }

  /**
   * midpointer.draw(), transcribed in order: p1 starts at the cursor and p2
   * starts at (0,0); for each dot, p2 = p1 + 2*(dot - p1), a line is drawn
   * from p1 to p2, then p1 becomes p2. With no dots p2 is still (0,0), which
   * is why the target sits halfway to the corner in that case. The target
   * rings are centred at (cursor + p2)/2, and the applet calls it finished
   * when |cursor.x - p2.x| < 3 and |cursor.y - p2.y| < 3.
   */
  function chain(state) {
    const midpoints = state.points || [];
    let p1 = point(state.cursor.x, state.cursor.y);
    let p2 = point(0, 0); // the constructor's p2: unchanged when N == 0
    const segments = [];
    const vertices = [point(p1.x, p1.y)];
    for (let i = 0; i < midpoints.length; i++) {
      const o = midpoints[i];
      p2 = point(p1.x + 2 * (o.x - p1.x), p1.y + 2 * (o.y - p1.y));
      segments.push([point(p1.x, p1.y), point(p2.x, p2.y)]);
      vertices.push(point(p2.x, p2.y));
      p1 = p2;
    }
    const target = point(Math.trunc((state.cursor.x + p2.x) / 2),
      Math.trunc((state.cursor.y + p2.y) / 2));
    const finished = Math.abs(state.cursor.x - p2.x) < TOL
      && Math.abs(state.cursor.y - p2.y) < TOL;
    return { segments, vertices, end: p2, target, finished, n: midpoints.length };
  }

  /**
   * The composition of all n reflections, from the alternating sum
   * S = O1 - O2 + O3 - ... . An odd number gives reflection in S; an even
   * number gives translation by 2*S (the identity when S is zero).
   */
  function symmetry(points) {
    let sx = 0, sy = 0;
    for (let i = 0; i < points.length; i++) {
      const sign = (i % 2 === 0) ? 1 : -1;
      sx += sign * points[i].x;
      sy += sign * points[i].y;
    }
    if (points.length % 2 === 1) {
      return { type: "reflection", center: point(sx, sy), S: point(sx, sy) };
    }
    /* alt() starts with +O1, so the shift is 2*(O2-O1+O4-O3+...) = -2*alt. */
    const vector = point(-2 * sx, -2 * sy);
    return {
      type: "translation",
      vector,
      S: point(sx, sy),
      identity: sx === 0 && sy === 0,
    };
  }

  /** Everything the page draws and claims, from a position. */
  function geometry(state) {
    const ch = chain(state);
    const sym = symmetry(state.points);
    const odd = sym.type === "reflection";
    /* Independent prediction of the red circle's centre: for odd n it is the
       fixed point S, for even n it is the cursor plus half the shift. */
    const predictedTarget = odd
      ? point(sym.center.x, sym.center.y)
      : point(state.cursor.x - sym.S.x, state.cursor.y - sym.S.y);
    const targetAgrees = ch.target.x === predictedTarget.x && ch.target.y === predictedTarget.y;
    const closesExactly = ch.end.x === state.cursor.x && ch.end.y === state.cursor.y;
    return Object.assign({}, ch, {
      symmetry: sym,
      parity: odd ? "odd" : "even",
      fixedPoint: odd ? sym.center : null,
      shift: odd ? null : sym.vector,
      predictedTarget,
      targetAgrees,
      closesExactly,
      /* With no dots the applet's p2 stays at the corner rather than at the
         cursor, so there is no polygon to speak of. */
      solutions: ch.n === 0 ? null : (odd ? 1 : (sym.identity ? Infinity : 0)),
    });
  }

  /** The status line: a plain description of what the chain is doing. */
  function describe(state) {
    const g = geometry(state);
    if (state.mode === "place") {
      if (g.n === 0) return "Click the board to place midpoints, or use Place midpoint at cursor.";
      return "Placed " + g.n + " midpoint" + (g.n === 1 ? "" : "s")
        + ". Switch to Drag mouse to follow the chain.";
    }
    if (g.n === 0) return "No midpoints yet: switch to Place points and add some dots.";
    if (g.parity === "even" && g.symmetry.identity) {
      return "With " + g.n + " midpoints the chain ends where it starts, "
        + "wherever you put the cursor: any start closes the polygon.";
    }
    if (g.finished) {
      return "The chain closes: these " + g.n + " midpoints make a "
        + g.n + "-gon with the cursor as a vertex.";
    }
    if (g.parity === "odd") {
      return "With " + g.n + " midpoints the red target stays at one spot. "
        + "Move the cursor onto it to close the polygon.";
    }
    return "With " + g.n + " midpoints the chain ends " + g.shift.x + " across and "
      + g.shift.y + " down from the cursor, so it never closes.";
  }

  return {
    VIEW, STEP, MAX_POINTS, TOL,
    start, setMode, addPoint, moveCursor, reset, result,
    snap, clamp, inCanvas, chain, symmetry, geometry, describe,
  };
})();
