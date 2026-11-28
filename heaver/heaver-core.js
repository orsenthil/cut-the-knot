"use strict";

/*
 * Heaver, from Alexander Bogomolny's Java applet Heaver (cut-the-knot.org).
 *
 * A rotating shape is drawn and then covered by several fixed copies of a
 * shape, leaving only a small aperture near the middle. The shape never really
 * grows or shrinks: rotation keeps every vertex the same distance from the
 * centre. What changes is how much of it can be seen through the aperture —
 * the source of the "expanding and shrinking square" illusion described on the
 * applet's page.
 *
 * This file is the DOM-free logic: no document, no window, no storage. It
 * defines one global, HeaverCore, so a plain <script> loads it in the page and
 * porting/check-heaver.mjs loads it in Node. The position is plain data: the
 * four choices and three slider values from the applet's panel, plus the
 * current one of the applet's 200 animation steps.
 *
 * Every construction here follows HeaverCanvas's bytecode: reset() chooses the
 * centre and calls one CreateFix or CreateRot method, DrawRotated() turns
 * SPoly by I * 2*pi/N, and SetHole() turns slider value v into hole = 2v + 3.
 */

const HeaverCore = (() => {
  /* The APPLET tag on the page is 500 by 300; N, the ranges and the defaults
     are the applet's own fields and AWT scrollbar settings. */
  const WIDTH = 500;
  const HEIGHT = 300;
  const N = 200;
  const FIX = { SQUARE: 0, TRIANGLE: 1, HEXAGON: 2, PENTAGON: 3 };
  const ROT = { SQUARE: 0, TRIANGLE: 1, HEXAGON: 2, PENTAGON: 3, STAR: 4 };
  const GAP = { MIN: 0, MAX: 80, START: 5 };
  const SPEED = { MIN: 0, MAX: 200, START: 40 };
  const OPACITY = { MIN: 0, MAX: 255, START: 255 };
  const FIX_NAMES = ["Squares", "4 triangles", "6 triangles", "5 triangles"];
  const ROT_NAMES = ["Square", "Triangle", "Hexagon", "Pentagon", "Star"];

  /* Java's Math.round is floor(x + 0.5), including for negative x. The
     applet rounds every point before handing it to java.awt.Polygon. */
  const round = (x) => Math.floor(x + 0.5);

  function clampInt(v, lo, hi, fallback) {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(lo, Math.min(hi, round(n)));
  }

  /* GeoSDoub.Rotate(centre, point, angle, direction), with screen y growing
     downwards: direction +1 is a clockwise turn. */
  function rotate(c, p, angle, direction) {
    const co = Math.cos(angle);
    const si = Math.sin(angle);
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    return {
      x: c.x + co * dx - direction * si * dy,
      y: c.y + direction * si * dx + co * dy,
    };
  }

  /* GeoSDoub.SqDist/Dist uses sqrt(dx*dx + dy*dy), not Math.hypot: the two
     differ in the last bit, which can flip a Math.round at exactly x.5. */
  const distance = (a, b) => Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
  const pt = (x, y) => ({ x: round(x), y: round(y) });

  /** The initial panel: Squares over a turning Square, as in HeaverCanvas. */
  function start(options) {
    const o = options || {};
    return {
      fix: clampInt(o.fix === undefined ? FIX.SQUARE : o.fix, 0, 3, FIX.SQUARE),
      rot: clampInt(o.rot === undefined ? ROT.SQUARE : o.rot, 0, 4, ROT.SQUARE),
      gap: clampInt(o.gap === undefined ? GAP.START : o.gap, GAP.MIN, GAP.MAX, GAP.START),
      speed: clampInt(o.speed === undefined ? SPEED.START : o.speed, SPEED.MIN, SPEED.MAX, SPEED.START),
      opacity: clampInt(o.opacity === undefined ? OPACITY.START : o.opacity,
        OPACITY.MIN, OPACITY.MAX, OPACITY.START),
      frame: clampInt(o.frame === undefined ? 0 : o.frame, 0, N - 1, 0),
    };
  }

  /** A panel change keeps the current animation step, just as the AWT
      adjustment/item listeners only change fields and call reset(). */
  function option(state, key, value) {
    const next = Object.assign({}, state);
    switch (key) {
      case "fix": next.fix = clampInt(value, 0, 3, state.fix); break;
      case "rot": next.rot = clampInt(value, 0, 4, state.rot); break;
      case "gap": next.gap = clampInt(value, GAP.MIN, GAP.MAX, state.gap); break;
      case "speed": next.speed = clampInt(value, SPEED.MIN, SPEED.MAX, state.speed); break;
      case "opacity": next.opacity = clampInt(value, OPACITY.MIN, OPACITY.MAX, state.opacity); break;
      case "frame": {
        const n = typeof value === "number" ? value : Number(value);
        const v = Number.isFinite(n) ? round(n) : state.frame;
        next.frame = ((v % N) + N) % N;
        break;
      }
      default: return state;
    }
    return next;
  }

  /** DrawRotated() advances I mod N once per repaint. */
  function advance(state) {
    return option(state, "frame", state.frame + 1);
  }

  /** SetHole(): the first AWT scrollbar maps its value v to 2v + 3. */
  const holeSize = (state) => 2 * state.gap + 3;

  /* ------------------------------------------------ the fixed occluding shapes */

  function fixedSquares(c, s, hole) {
    const a = round(s - hole / 2);
    const b = round(a + hole);
    const x = c.x - s, y = c.y - s;
    return [
      [pt(x, y), pt(x + a, y), pt(x + a, y + a), pt(x, y + a)],
      [pt(x + b, y), pt(x + b + a, y), pt(x + b + a, y + a), pt(x + b, y + a)],
      [pt(x + b, y + b), pt(x + b + a, y + b), pt(x + b + a, y + b + a), pt(x + b, y + b + a)],
      [pt(x, y + b), pt(x + a, y + b), pt(x + a, y + b + a), pt(x, y + b + a)],
    ];
  }

  function smallTriangle(c, apex, other1, other2, hole) {
    const side = distance(apex, other1);
    const t = ((side - hole) / 2) / side;
    const step = (from, to) => pt(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
    return [pt(apex.x, apex.y), step(apex, other1), step(apex, other2)];
  }

  function fixedTriangles4(c, s, hole) {
    const d = 3 * s / 2;
    const p = { x: c.x, y: c.y - d };
    const q = rotate(c, p, 2.0943951023931953, 1);
    const r = rotate(c, p, 2.0943951023931953, -1);
    const side = distance(p, q);
    const t = (side - hole) / 2;
    const k = t / side;
    const t3 = t / Math.sqrt(3);
    const mid = { x: c.x, y: c.y + t3 };
    /* The third occluder's first corner is (r.x, q.y) in the bytecode; q and
       r have the same y, so this is the same point as r. */
    return [
      smallTriangle(c, p, q, r, hole),
      smallTriangle(c, q, p, r, hole),
      [pt(r.x, q.y), pt(r.x + (p.x - r.x) * k, r.y + (p.y - r.y) * k),
        pt(r.x + (q.x - r.x) * k, r.y + (q.y - r.y) * k)],
      [pt(mid.x, mid.y), pt(rotate(c, mid, 2.0943951023931953, 1).x,
        rotate(c, mid, 2.0943951023931953, 1).y),
        pt(rotate(c, mid, 2.0943951023931953, -1).x,
          rotate(c, mid, 2.0943951023931953, -1).y)],
    ];
  }

  function fixedTriangles6(c, s, hole) {
    const d = 4 * s / 3;
    const u = (2 * d / Math.sqrt(3) - hole) / 2;
    let p = { x: c.x - u, y: c.y - d };
    let q = { x: c.x + u, y: c.y - d };
    let r = rotate(c, q, 1.0471975511965976, -1);
    const out = [];
    for (let i = 0; i < 6; i++) {
      out.push([pt(p.x, p.y), pt(q.x, q.y), pt(r.x, r.y)]);
      p = rotate(c, p, 1.0471975511965976, 1);
      q = rotate(c, q, 1.0471975511965976, 1);
      r = rotate(c, r, 1.0471975511965976, 1);
    }
    return out;
  }

  function fixedTriangles5(c, s, hole) {
    const d = 3 * s / 2;
    const u = d * Math.sin(0.6283185307179586) - hole;
    const v = d * Math.cos(0.6283185307179586);
    let p = { x: c.x - u, y: c.y - v };
    let q = { x: c.x + u, y: c.y - v };
    let r = { x: c.x, y: c.y - hole };
    const out = [];
    for (let i = 0; i < 5; i++) {
      out.push([pt(p.x, p.y), pt(q.x, q.y), pt(r.x, r.y)]);
      p = rotate(c, p, 1.2566370614359172, 1);
      q = rotate(c, q, 1.2566370614359172, 1);
      r = rotate(c, r, 1.2566370614359172, 1);
    }
    return out;
  }

  /* ----------------------------------------------- the rotating shape's vertices */

  function spinBase(rot, c, s) {
    const d = 2 * s / 3;
    switch (rot) {
      case ROT.SQUARE: {
        const h = d / Math.sqrt(2);
        return [pt(c.x + h, c.y - h), pt(c.x + h, c.y + h),
          pt(c.x - h, c.y + h), pt(c.x - h, c.y - h)];
      }
      case ROT.TRIANGLE: {
        const p = { x: c.x, y: c.y - d };
        return [p, rotate(c, p, 2.0943951023931953, 1), rotate(c, p, 2.0943951023931953, -1)];
      }
      case ROT.HEXAGON: {
        const inner = d / Math.sqrt(3);
        const out = [];
        for (let i = 0; i < 6; i++) {
          const a = 1.0471975511965976 * i;
          out.push({ x: c.x + d * Math.cos(a), y: c.y + d * Math.sin(a) });
          out.push({ x: c.x + inner * Math.cos(a + 0.5235987755982988),
            y: c.y + inner * Math.sin(a + 0.5235987755982988) });
        }
        return out;
      }
      case ROT.PENTAGON: {
        const out = [];
        for (let i = 0; i < 5; i++) {
          const a = 2 * i * Math.PI / 5;
          out.push({ x: c.x + d * Math.cos(a), y: c.y + d * Math.sin(a) });
        }
        return out;
      }
      default: { // STAR: five points, skipping round the circle by 4/5 of a turn
        const out = [];
        for (let i = 0; i < 5; i++) {
          const a = 4 * i * Math.PI / 5;
          out.push({ x: c.x + d * Math.cos(a), y: c.y + d * Math.sin(a) });
        }
        return out;
      }
    }
  }

  /** All the geometry the page draws, in the applet's own pixel coordinates. */
  function geometry(state, width, height) {
    const w = width === undefined ? WIDTH : width;
    const h = height === undefined ? HEIGHT : height;
    const s = Math.min(w, h) / 3;
    const hole = holeSize(state);
    /* Only the four-triangle occlusion lowers the centre by h/10. */
    const c = state.fix === FIX.TRIANGLE
      ? { x: w / 2, y: h / 2 + h / 10 }
      : { x: w / 2, y: h / 2 };
    let fixed;
    switch (state.fix) {
      case FIX.TRIANGLE: fixed = fixedTriangles4(c, s, hole); break;
      case FIX.HEXAGON: fixed = fixedTriangles6(c, s, hole); break;
      case FIX.PENTAGON: fixed = fixedTriangles5(c, s, hole); break;
      default: fixed = fixedSquares(c, s, hole); break;
    }
    const base = spinBase(state.rot, c, s);
    const angle = state.frame * Math.PI * 2 / N;
    const spinning = base.map((p) => {
      const q = rotate(c, p, angle, 1);
      return pt(q.x, q.y);
    });
    return { center: c, side: s, hole: hole, fixed: fixed, base: base, spinning: spinning };
  }

  /** A draggable handle on the guide circle scrubs the animation step. */
  function frameFromPoint(point, center) {
    let a = Math.atan2(point.y - center.y, point.x - center.x);
    if (a < 0) a += 2 * Math.PI;
    return ((round(a * N / (2 * Math.PI)) % N) + N) % N;
  }

  function describe(state, width, height) {
    const g = geometry(state, width, height);
    return FIX_NAMES[state.fix] + " cover a turning " + ROT_NAMES[state.rot].toLowerCase()
      + " · opening " + g.hole + " px · step " + state.frame + " of " + N
      + " · " + Math.max(1, state.speed) + " ms between steps";
  }

  return {
    WIDTH: WIDTH, HEIGHT: HEIGHT, N: N, FIX: FIX, ROT: ROT,
    GAP: GAP, SPEED: SPEED, OPACITY: OPACITY,
    FIX_NAMES: FIX_NAMES, ROT_NAMES: ROT_NAMES,
    round: round, rotate: rotate, distance: distance,
    start: start, option: option, advance: advance, holeSize: holeSize,
    geometry: geometry, frameFromPoint: frameFromPoint, describe: describe,
  };
})();
