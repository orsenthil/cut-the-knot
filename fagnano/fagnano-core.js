"use strict";

/*
 * Fagnano's Problem, from Alexander Bogomolny's applet Fagnano.
 *
 * Given a triangle ABC, choose one point on each side: P on BC, Q on CA and
 * R on AB. Which inscribed triangle PQR has the smallest perimeter? The
 * answer is the orthic triangle, whose vertices are the feet of the three
 * altitudes. Schwarz's picture in the applet rolls ABC five times about its
 * sides (CA, BC, AB, CA, BC). The three sides of PQR then appear as six
 * consecutive pieces of one broken line. When PQR is orthic those pieces
 * straighten out into one segment whose length is twice the orthic
 * perimeter; any other PQR gives a longer, bent line.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage. It defines one global, FagnanoCore, so the page loads it with a
 * plain <script> and porting/check-fagnano.mjs loads it in Node. Positions
 * are plain data (points, three side parameters and two checkbox flags), and
 * every function returns a new position rather than changing its argument.
 */
const FagnanoCore = (() => {
  // The applet's HTML used WIDTH=500, HEIGHT=400. Its init() takes
  // s = min(width, height) / 8 and puts A=(2s, H-4s), B=(s, H-s),
  // C=(4s, H-2s). P, Q and R start at 0.4, 0.4 and 0.3 along BC, CA and AB.
  const WIDTH = 500;
  const HEIGHT = 400;
  const EPS = 1e-9;

  const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });
  const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });
  const mul = (p, k) => ({ x: p.x * k, y: p.y * k });
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const len = (p) => Math.hypot(p.x, p.y);
  const dist = (p, q) => len(sub(p, q));
  const lerp = (a, b, t) => add(mul(a, t), mul(b, 1 - t));
  const copy = (p) => ({ x: p.x, y: p.y });

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /** Foot of the perpendicular from p onto the line through a and b. */
  function foot(p, a, b) {
    const d = sub(b, a);
    const n = dot(d, d);
    if (n < EPS) return copy(a);
    return add(a, mul(d, dot(sub(p, a), d) / n));
  }

  /**
   * FagnanoCanvas$FagnanoTriangle.ComputeReflection(p, a, b), transcribed
   * from the bytecode. If |b.x - a.x| < 1 the applet takes its short path and
   * reflects across the vertical line x = a.x, ignoring b.y; otherwise it
   * reflects in the line ab. The short path is kept as the applet has it.
   */
  function reflectPoint(p, a, b) {
    if (Math.abs(b.x - a.x) < 1) {
      return { x: 2 * a.x - p.x, y: p.y };
    }
    const d = sub(a, b); // a.Diff(b)
    const t = -dot(sub(b, p), d) / dot(d, d);
    return sub(mul(add(b, mul(d, t)), 2), p);
  }

  /** The parameter t with p = t*u + (1-t)*v on line uv, clamped to the side. */
  function sideParameter(p, u, v) {
    const d = sub(u, v);
    const n = dot(d, d);
    if (n < EPS) return 0;
    return clamp(dot(d, sub(p, v)) / n, 0, 1);
  }

  /** Keep a dragged point inside the applet's canvas eligibility rectangle. */
  function clampPoint(q) {
    return { x: clamp(q.x, 2, WIDTH), y: clamp(q.y, 1, HEIGHT - 2) };
  }

  /** The starting picture: a slanted acute triangle and a non-orthic PQR. */
  function start() {
    const s = Math.min(HEIGHT, WIDTH) / 8;
    const A = { x: 2 * s, y: HEIGHT - 4 * s };
    const B = { x: s, y: HEIGHT - s };
    const C = { x: 4 * s, y: HEIGHT - 2 * s };
    const tP = 0.4, tQ = 0.4, tR = 0.3;
    return {
      A, B, C,
      P: lerp(B, C, tP), Q: lerp(C, A, tQ), R: lerp(A, B, tR),
      tP, tQ, tR,
      showNames: false,
      showAltitudes: false,
    };
  }

  /** One of the applet's two checkboxes. */
  function option(s, name, value) {
    if (name !== "showNames" && name !== "showAltitudes") return s;
    return Object.assign({}, s, { [name]: !!value });
  }

  /*
   * One reflection of a FagnanoTriangle. The switch in Reflect(int) is:
   *   0 - reflect in AB, keeping R and the line AB;
   *   1 - reflect in BC, keeping P and the line BC;
   *   2 - reflect in CA, keeping Q and the line CA.
   * m_Type says which side of the reflected inscribed triangle is red:
   *   2 -> Q-R, 1 -> P-Q, 0 -> R-P.
   */
  function reflect(tri, kind) {
    if (kind === 0) {
      return {
        A: copy(tri.A), B: copy(tri.B), C: reflectPoint(tri.C, tri.A, tri.B),
        P: reflectPoint(tri.P, tri.A, tri.B),
        Q: reflectPoint(tri.Q, tri.A, tri.B),
        R: copy(tri.R), type: 2,
      };
    }
    if (kind === 1) {
      return {
        A: reflectPoint(tri.A, tri.B, tri.C), B: copy(tri.B), C: copy(tri.C),
        P: copy(tri.P),
        Q: reflectPoint(tri.Q, tri.B, tri.C),
        R: reflectPoint(tri.R, tri.B, tri.C), type: 0,
      };
    }
    return {
      A: copy(tri.A), B: reflectPoint(tri.B, tri.C, tri.A), C: copy(tri.C),
      P: reflectPoint(tri.P, tri.C, tri.A),
      Q: copy(tri.Q),
      R: reflectPoint(tri.R, tri.C, tri.A), type: 1,
    };
  }

  /** The six triangles the applet draws: original, then CA, BC, AB, CA, BC. */
  function chain(s) {
    const first = {
      A: copy(s.A), B: copy(s.B), C: copy(s.C),
      P: copy(s.P), Q: copy(s.Q), R: copy(s.R), type: 2,
    };
    const out = [first];
    for (const kind of [2, 1, 0, 2, 1]) {
      out.push(reflect(out[out.length - 1], kind));
    }
    return out;
  }

  /** The side of triangle number i that the applet paints red. */
  function redSide(tri) {
    if (tri.type === 2) return [tri.Q, tri.R];
    if (tri.type === 1) return [tri.P, tri.Q];
    return [tri.R, tri.P];
  }

  /** The six red pieces joined end to end: a line from R to the final R. */
  function folded(s) {
    return chain(s).map(redSide);
  }

  function perimeter(p, q, r) {
    return dist(p, q) + dist(q, r) + dist(r, p);
  }

  /** The three feet of the altitudes, in the same P, Q, R order. */
  function orthic(s) {
    return {
      P: foot(s.A, s.B, s.C), // foot from A onto BC
      Q: foot(s.B, s.C, s.A), // foot from B onto CA
      R: foot(s.C, s.A, s.B), // foot from C onto AB
    };
  }

  /** Largest sine of the angle between successive red pieces (0 if straight). */
  function bend(path) {
    let worst = 0;
    for (let i = 1; i < path.length; i++) {
      const a = sub(path[i - 1][1], path[i - 1][0]);
      const b = sub(path[i][1], path[i][0]);
      const la = len(a), lb = len(b);
      if (la > EPS && lb > EPS) {
        worst = Math.max(worst, Math.abs(cross(a, b)) / (la * lb));
      }
    }
    return worst;
  }

  /** Fejér's two reflections of P: base P'P'' has length 2*AP*sin(A). */
  function fejer(s, P) {
    const prime = reflectPoint(P, s.C, s.A); // reflect in CA
    const second = reflectPoint(P, s.A, s.B); // reflect in AB
    const u = sub(prime, s.A), v = sub(second, s.A);
    const lu = len(u), lv = len(v);
    const cosine = lu < EPS || lv < EPS ? 1 : clamp(dot(u, v) / (lu * lv), -1, 1);
    return {
      prime, second,
      angle: Math.acos(cosine),
      base: dist(prime, second),
      ap: dist(s.A, P),
      angleA: Math.acos(clamp(dot(sub(s.B, s.A), sub(s.C, s.A)) /
        (dist(s.A, s.B) * dist(s.A, s.C)), -1, 1)),
    };
  }

  /** All the numbers the page talks about, computed from a position. */
  function compute(s) {
    const chainTR = chain(s);
    const path = chainTR.map(redSide);
    const o = orthic(s);
    const f = fejer(s, s.P);
    return {
      chain: chainTR,
      path,
      perimeter: perimeter(s.P, s.Q, s.R),
      orthic: o,
      orthicPerimeter: perimeter(o.P, o.Q, o.R),
      foldedLength: path.reduce((sum, seg) => sum + dist(seg[0], seg[1]), 0),
      bend: bend(path),
      finalAB: sub(chainTR[5].B, chainTR[5].A),
      initialAB: sub(s.B, s.A),
      fejer: f,
    };
  }

  function describe(s) {
    const f = compute(s);
    const straight = f.bend < 1e-7 ? "The red pieces form a straight line." :
      "The red path is bent.";
    return `${straight} Perimeter ${f.perimeter.toFixed(1)}; straightened path ` +
      `${f.foldedLength.toFixed(1)}; twice the orthic perimeter ` +
      `${(2 * f.orthicPerimeter).toFixed(1)}.`;
  }

  /*
   * The applet's CheckMidPoint(): moving a vertex projects the point on the
   * opposite side straight down onto that side (DoubLine.UpdateMidPoint),
   * while moving P, Q or R refreshes the other two sides at their saved
   * parameters (DoubLine.UpdateEndPoints). This is deliberately faithful to
   * the Java, including its habit of leaving the other two dots where they
   * are when a vertex is dragged.
   */
  function move(s, name, q) {
    if (!q) return s;
    const p = clampPoint(q);
    if (name === "A" || name === "B" || name === "C") {
      const next = Object.assign({}, s, { [name]: p });
      if (name === "A") {
        const t = sideParameter(p, next.B, next.C);
        next.P = lerp(next.B, next.C, t); next.tP = t;
      } else if (name === "B") {
        const t = sideParameter(p, next.C, next.A);
        next.Q = lerp(next.C, next.A, t); next.tQ = t;
      } else {
        const t = sideParameter(p, next.A, next.B);
        next.R = lerp(next.A, next.B, t); next.tR = t;
      }
      return next;
    }
    if (name === "P" || name === "Q" || name === "R") {
      const next = Object.assign({}, s, { [name]: p });
      if (name === "P") {
        next.Q = lerp(next.C, next.A, s.tQ);
        next.R = lerp(next.A, next.B, s.tR);
      } else if (name === "Q") {
        next.P = lerp(next.B, next.C, s.tP);
        next.R = lerp(next.A, next.B, s.tR);
      } else {
        next.P = lerp(next.B, next.C, s.tP);
        next.Q = lerp(next.C, next.A, s.tQ);
      }
      return next;
    }
    return s;
  }

  /**
   * Page-side convenience: keep one of P, Q, R on its side. The Java let a
   * dragged dot wander off its side; the illustration keeps it on the side,
   * which is the configuration every claim on the page is about.
   */
  function setSide(s, name, q) {
    if (!["P", "Q", "R"].includes(name) || !q) return s;
    let t, point;
    if (name === "P") {
      t = sideParameter(q, s.B, s.C); point = lerp(s.B, s.C, t);
    } else if (name === "Q") {
      t = sideParameter(q, s.C, s.A); point = lerp(s.C, s.A, t);
    } else {
      t = sideParameter(q, s.A, s.B); point = lerp(s.A, s.B, t);
    }
    const next = move(s, name, point);
    next["t" + name] = t;
    return next;
  }

  /** Put the three dots on the altitude feet, the answer to Fagnano's problem. */
  function orthicState(s) {
    const o = orthic(s);
    const tP = sideParameter(o.P, s.B, s.C);
    const tQ = sideParameter(o.Q, s.C, s.A);
    const tR = sideParameter(o.R, s.A, s.B);
    return Object.assign({}, s, { P: o.P, Q: o.Q, R: o.R, tP, tQ, tR });
  }

  return {
    WIDTH, HEIGHT, EPS,
    add, sub, mul, dot, cross, len, dist, lerp, clamp,
    foot, reflectPoint, sideParameter, clampPoint,
    start, option, reflect, chain, redSide, folded,
    perimeter, orthic, orthicState, bend, fejer, compute, describe,
    move, setSide,
  };
})();
