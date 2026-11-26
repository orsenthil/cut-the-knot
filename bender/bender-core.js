"use strict";

/*
 * Bender — Gerbino's illusion, from Alexander Bogomolny's applet Bender.
 *
 * The applet draws a stationary regular polygon and, at every one of its
 * corners, a second regular polygon that spins about that corner. In the
 * "displaced" mode each small polygon is nudged two units away from the
 * centre along the radius through its corner. This file reproduces that
 * construction exactly: the same n and m (3, 4, 5, 6), the same radius
 * min(width, height)/3 with Java's integer division, the same starting
 * centre, the same pixel rounding in the displaced mode, the same 100
 * animation steps, and the same option ranges. Nothing here touches the DOM.
 *
 * The one deliberate generalisation is a movable centre and a turnable
 * stationary polygon: dragging them changes `center` and `phase`, which the
 * Java applet kept fixed. With the default values every formula below is the
 * applet's own.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, BenderCore, so the page loads it with a
 * plain <script> and porting/check-bender.mjs loads it in Node. The position
 * is plain data, so it can be saved for the player's record and the tutor.
 */
const BenderCore = (() => {
  const TAU = Math.PI * 2;
  const FRAMES = 100;                 // the applet's N
  const SIDES = [3, 4, 5, 6];         // the applet's four radio choices
  const RANGES = { side: [0, 80], speed: [0, 200], tint: [0, 100] };
  const DEFAULT = {
    width: 400, height: 300, fixed: 4, rot: 4, side: 40,
    speed: 160, tint: 100, offCenter: false, frame: 0,
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const nearest = (v, values) => values.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

  /** Java's int division of two positive sizes, then widened to double. */
  function radius(state) {
    return Math.trunc(Math.min(state.width, state.height) / 3);
  }

  /** BenderCanvas.reset: the square's centre is deliberately shifted right. */
  function defaultCenter(fixed, width, height) {
    return fixed === 4
      ? { x: Math.trunc((width * 9) / 16), y: Math.trunc(height / 2) }
      : { x: Math.trunc(width / 2), y: Math.trunc(height / 2) };
  }

  /** The player's record and the tutor get this plain object. */
  function start(options) {
    const o = options || {};
    const s = Object.assign({}, DEFAULT, o);
    s.fixed = nearest(s.fixed, SIDES);
    s.rot = nearest(s.rot, SIDES);
    s.side = clamp(Math.trunc(s.side), ...RANGES.side);
    s.speed = clamp(Math.trunc(s.speed), ...RANGES.speed);
    s.tint = clamp(Math.trunc(s.tint), ...RANGES.tint);
    s.frame = ((Math.trunc(s.frame) % FRAMES) + FRAMES) % FRAMES;
    s.offCenter = Boolean(s.offCenter);
    s.width = Math.max(1, Math.trunc(s.width));
    s.height = Math.max(1, Math.trunc(s.height));
    s.center = o.center ? { x: Number(o.center.x), y: Number(o.center.y) } : defaultCenter(s.fixed, s.width, s.height);
    s.phase = o.phase === undefined ? Math.PI / s.fixed : ((o.phase % TAU) + TAU) % TAU;
    return s;
  }

  /** An option change, mirroring the applet's itemStateChanged/SetSide/reset. */
  function withOption(state, name, value) {
    if (name === "offCenter") return Object.assign({}, state, { offCenter: Boolean(value) });
    if (name === "frame") return Object.assign({}, state, { frame: ((Math.trunc(value) % FRAMES) + FRAMES) % FRAMES });
    if (!(name in RANGES) && name !== "fixed" && name !== "rot") return state;
    const next = Object.assign({}, state);
    if (name === "fixed" || name === "rot") {
      const v = nearest(Number(value), SIDES);
      next[name] = v;
      if (name === "fixed") {
        next.center = defaultCenter(v, state.width, state.height);
        next.phase = Math.PI / v;
      }
      return next;
    }
    next[name] = clamp(Math.trunc(Number(value)), ...RANGES[name]);
    return next;
  }

  /** Dragging the centre, or the marked corner that turns the picture. */
  function withCenter(state, p) {
    const r = radius(state);
    return Object.assign({}, state, {
      center: {
        x: clamp(Number(p.x), state.center.x - r, state.center.x + r),
        y: clamp(Number(p.y), state.center.y - r, state.center.y + r),
      },
    });
  }

  function withPhase(state, angle) {
    return Object.assign({}, state, { phase: ((Number(angle) % TAU) + TAU) % TAU });
  }

  /** BenderCanvas.run: I = (I + 1) mod N, one step per animation frame. */
  function advance(state, count) {
    return Object.assign({}, state, {
      frame: (state.frame + (count === undefined ? 1 : Math.trunc(count))) % FRAMES,
    });
  }

  /** The applet's scrollbar is 200 - the delay in milliseconds. */
  function delay(state) {
    return RANGES.speed[1] - state.speed;
  }

  /** GeoSDoub.Rotate with its direction argument fixed at +1. */
  function rotate(about, p, angle) {
    const cs = Math.cos(angle), sn = Math.sin(angle);
    const dx = p.x - about.x, dy = p.y - about.y;
    return { x: about.x + cs * dx - sn * dy, y: about.y + sn * dx + cs * dy };
  }

  /**
   * The exact picture at the current frame. `fixed` and `polygons` are the
   * unrounded geometry; `drawnFixed` and `drawn` are the whole-pixel points
   * the Java Polygon received. The displaced translation is computed from
   * those rounded points, as in the bytecode.
   */
  function picture(state) {
    const n = state.fixed, m = state.rot, s = state.side, C = state.center;
    const r = radius(state);
    const step = TAU / n, rotStep = TAU / m;
    const theta = (TAU * state.frame) / FRAMES;
    const fixed = [];
    for (let k = 0; k < n; k++) {
      const a = state.phase + step * k;
      fixed.push({ x: C.x + r * Math.cos(a), y: C.y + r * Math.sin(a) });
    }
    const polygons = [], drawn = [];
    for (let k = 0; k < n; k++) {
      const V = fixed[k];
      const pts = [], px = [];
      for (let j = 0; j < m; j++) {
        const a = rotStep / 2 + rotStep * j + step * k;
        const q = { x: V.x + s * Math.cos(a), y: V.y + s * Math.sin(a) };
        const turned = rotate(V, q, theta);
        pts.push(turned);
        px.push({ x: Math.round(turned.x), y: Math.round(turned.y) });
      }
      if (state.offCenter) {
        const d = Math.hypot(C.x - fixed[0].x, C.y - fixed[0].y);
        const dx = (2 * (C.x - V.x)) / d;
        const dy = (2 * (C.y - V.y)) / d;
        const mx = Math.trunc(Math.round((px[0].x + px[1].x) / 2 - V.x) + dx);
        const my = Math.trunc(Math.round((px[0].y + px[1].y) / 2 - V.y) + dy);
        for (let j = 0; j < m; j++) {
          pts[j] = { x: pts[j].x - mx, y: pts[j].y - my };
          px[j] = { x: px[j].x - mx, y: px[j].y - my };
        }
      }
      polygons.push(pts);
      drawn.push(px);
    }
    return {
      center: { ...C },
      radius: r,
      fixed,
      drawnFixed: fixed.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })),
      polygons,
      drawn,
    };
  }

  const centroid = (pts) => {
    let x = 0, y = 0;
    for (const p of pts) { x += p.x; y += p.y; }
    return { x: x / pts.length, y: y / pts.length };
  };
  const near = (p, q, tol) => Math.hypot(p.x - q.x, p.y - q.y) <= tol;

  /**
   * The geometry behind the illusion, checked for the current options:
   * the stationary polygon is regular, the small ones are congruent regular
   * polygons turning through the same angle, and the whole picture is carried
   * into itself by a turn of 360/n about the common centre.
   */
  function claims(state) {
    const pic = picture(state);
    const n = state.fixed, m = state.rot, C = pic.center, r = pic.radius;
    const step = TAU / n, rotStep = TAU / m, theta = (TAU * state.frame) / FRAMES;
    // The applet rounded the small polygons to whole pixels before shifting
    // them; that can cost up to about three units of symmetry in board units.
    const tol = state.offCenter ? 4 : 1e-7;

    let regular = true;
    for (let k = 0; k < n; k++) {
      if (!near(rotate(C, pic.fixed[k], step), pic.fixed[(k + 1) % n], 1e-7)) regular = false;
      if (Math.abs(Math.hypot(pic.fixed[k].x - C.x, pic.fixed[k].y - C.y) - r) > 1e-7) regular = false;
    }

    let congruent = true, atVertices = true, synchronous = true, symmetry = true;
    const base = picture(Object.assign({}, state, { frame: 0, offCenter: false }));
    const edge = 2 * state.side * Math.sin(Math.PI / m);
    for (let k = 0; k < n; k++) {
      const pts = pic.polygons[k], V = pic.fixed[k];
      const c = centroid(pts), c0 = centroid(base.polygons[k]);
      for (let j = 0; j < m; j++) {
        const a = pts[j], b = pts[(j + 1) % m];
        if (Math.abs(Math.hypot(b.x - a.x, b.y - a.y) - edge) > tol) congruent = false;
        // Rotate the frame-0 polygon about its own centre, then add the
        // displacement of this frame's centre (zero in the centered mode).
        const turned = rotate(c0, base.polygons[k][j], theta);
        if (!near({ x: turned.x + c.x - c0.x, y: turned.y + c.y - c0.y }, a, tol)) synchronous = false;
        const nextPts = pic.polygons[(k + 1) % n];
        if (!near(rotate(C, a, step), nextPts[j], tol)) symmetry = false;
      }
      if (state.offCenter) {
        // The bytecode puts the midpoint of the small polygon's FIRST EDGE
        // two units out along the radius, not its centre of mass.
        const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        const out = { x: V.x - (2 * (C.x - V.x)) / r, y: V.y - (2 * (C.y - V.y)) / r };
        if (!near(mid, out, tol)) atVertices = false;
      } else if (!near(c, V, tol)) {
        atVertices = false;
      }
    }
    return { regular, congruent, atVertices, synchronous, symmetry };
  }

  /** A picture has no winner; the page marks a checked pattern as "done". */
  function result() {
    return null;
  }

  return {
    FRAMES, SIDES, RANGES, DEFAULT,
    start, withOption, withCenter, withPhase, advance, delay, radius,
    defaultCenter, rotate, picture, claims, result,
  };
})();
