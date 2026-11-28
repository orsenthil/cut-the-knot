"use strict";

/*
 * Incircles In Quadri — Alexander Bogomolny's applet IncirclesInQuadri
 * ("Pairs of Incircles in a Quadrilateral").
 *
 * The diagonals AC and BD split a quadrilateral into two pairs of triangles:
 * ABC with ADC share AC, BCD with BAD share BD.  Draw the incircle of each
 * triangle.  The page claims that the two incircles of one pair touch exactly
 * when the other pair does, and that this happens exactly when
 * AB + CD = BC + AD (Pitot's condition for an inscriptible quadrilateral).
 * The applet draws one diagonal at a time (the AC / BD radio buttons) and
 * calls the pair touching when its two feet on that diagonal are less than
 * 3 pixels apart.
 *
 * The key identity used here comes from equal tangent lengths from a vertex:
 * in triangle ABC the incircle touches AC a distance (AB + AC - BC)/2 from A,
 * so the two feet on AC are |AB + CD - BC - AD|/2 apart; the feet on BD are
 * the same distance apart.  Both pairs therefore touch together, and both
 * touch exactly at Pitot's equality.
 *
 * This file is the geometry and nothing else: no document, no window, no
 * storage.  It defines one global, IncirclesInQuadriCore, so the page loads it
 * with a plain <script> and porting/check-incircles-in-quadri.mjs loads it in
 * Node.  Positions are plain data in the SVG viewBox units (the applet was
 * 460 by 400 in the archived page).
 */
const IncirclesInQuadriCore = (() => {
  const VIEW = { x: 0, y: 0, width: 460, height: 400 };
  /** Room for a handle and its letter. */
  const PAD = 18;
  /** IncirclesInQuadriCanvas.CheckTouch: GeoSDoub.Dist < 3.0, strictly. */
  const TOUCH = 3;
  const EPS = 1e-9;

  const point = (x, y) => ({ x, y });
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);

  function clamp(p) {
    return point(
      Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
      Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
    );
  }

  /**
   * GeoSDoub.NearestPoint(p, a, b): the perpendicular foot on the whole line
   * through a and b (not clipped to the segment).  The applet has a special
   * case when SqDist(a,p) < 0.1: it returns p itself.
   */
  function foot(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if ((p.x - a.x) ** 2 + (p.y - a.y) ** 2 < 0.1) return { x: p.x, y: p.y };
    const len2 = dx * dx + dy * dy;
    if (len2 < EPS) return { x: a.x, y: a.y };
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return point(a.x + dx * t, a.y + dy * t);
  }

  /**
   * The incenter: the same point the applet finds by intersecting two angle
   * bisectors (GeoSDoub.FindIncenter), written with side-length weights.
   */
  function incenter(a, b, c) {
    const x = dist(b, c), y = dist(c, a), z = dist(a, b);
    const sum = x + y + z;
    if (sum < EPS) return null;
    return point((x * a.x + y * b.x + z * c.x) / sum,
      (x * a.y + y * b.y + z * c.y) / sum);
  }

  /** The triangle's incircle, and its foot on the diagonal from first to second. */
  function incircle(a, b, c, first, second) {
    const area2 = Math.abs(cross(sub(b, a), sub(c, a)));
    if (area2 < EPS || !Number.isFinite(area2)) return null;
    const center = incenter(a, b, c);
    if (!center || !Number.isFinite(center.x) || !Number.isFinite(center.y)) return null;
    // DrawCircle averages the three distances centre-to-foot; for a real
    // incircle all three equal the inradius, so the average is the inradius.
    const f1 = foot(center, a, b), f2 = foot(center, b, c), f3 = foot(center, c, a);
    const radius = (dist(center, f1) + dist(center, f2) + dist(center, f3)) / 3;
    const touch = foot(center, first, second);
    if (![radius, touch.x, touch.y].every(Number.isFinite)) return null;
    return { center, radius, feet: [f1, f2, f3], touch };
  }

  /* The applet's Reset() on a 460x400 canvas: with locals 4=40, 5=60,
   * A = (W/2 - 4*40, H/2 + 60), B = (W/2 + 2*40, H/2 + 2*40 + 60),
   * C = (W/2, H/2 - 2*40 + 60), D = midpoint(A,C) - (40,20).
   * The AC radio button starts selected (the panel sets AC=true, BD=false). */
  function start(options) {
    const o = options || {};
    const w = VIEW.width, h = VIEW.height;
    const A = point(w / 2 - 4 * 40, h / 2 + 60);
    const B = point(w / 2 + 2 * 40, h / 2 + 2 * 40 + 60);
    const C = point(w / 2, h / 2 - 2 * 40 + 60);
    const D = point((A.x + C.x) / 2 - 40, (A.y + C.y) / 2 - 20);
    return {
      A, B, C, D,
      options: { diagonal: o.diagonal === "bd" ? "bd" : "ac" },
      explored: false,
    };
  }

  function reset(state) {
    const s = start(state.options);
    s.explored = state.explored;
    return s;
  }

  function move(state, name, p) {
    if (!Object.prototype.hasOwnProperty.call(state, name) || !p) return state;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return state;
    return Object.assign({}, state, { [name]: clamp(point(p.x, p.y)), explored: true });
  }

  function setDiagonal(state, diagonal) {
    if (diagonal !== "ac" && diagonal !== "bd") return state;
    return Object.assign({}, state, {
      options: Object.assign({}, state.options, { diagonal }),
      explored: true,
    });
  }

  /**
   * A modern convenience, not in the applet: put the four corners on the
   * tangents to a circle, so AB + CD = BC + AD and both pairs of incircles
   * touch.  The geometry it produces is an ordinary tangential quadrilateral;
   * nothing about the theorem is changed.
   */
  function makeTangential(state, options) {
    const o = options || {};
    const cx = o.cx === undefined ? VIEW.width / 2 : o.cx;
    const cy = o.cy === undefined ? VIEW.height / 2 : o.cy;
    const r = o.r === undefined ? 92 : o.r;
    const angles = o.angles || [0.22, 1.66, 3.06, 4.72];
    // Tangent at t: cos(t)*x + sin(t)*y = r.  Two consecutive tangents meet
    // at a corner of the circumscribed quadrilateral.
    const corners = [];
    for (let i = 0; i < 4; i++) {
      const t1 = angles[i], t2 = angles[(i + 1) % 4];
      const a1 = Math.cos(t1), b1 = Math.sin(t1);
      const a2 = Math.cos(t2), b2 = Math.sin(t2);
      const det = a1 * b2 - a2 * b1;
      if (!Number.isFinite(det) || Math.abs(det) < 1e-6) return state;
      corners.push(point(
        cx + r * (b2 - b1) / det,
        cy + r * (a1 - a2) / det,
      ));
    }
    if (!corners.every((p) => p.x >= PAD && p.x <= VIEW.width - PAD
      && p.y >= PAD && p.y <= VIEW.height - PAD)) return state;
    return Object.assign({}, state, {
      A: corners[0], B: corners[1], C: corners[2], D: corners[3], explored: true,
    });
  }

  /** Everything the drawing and the status line need, from four corners. */
  function compute(a, b, c, d) {
    const cs = [a, b, c, d];
    if (!cs.every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
    if (cs.some((p, i) => cs.some((q, j) => j > i && dist(p, q) < EPS))) return null;

    // Draw() calls DrawCircle(A,B,C) and DrawCircle(A,D,C) for AC, and
    // DrawCircle(B,C,D) and DrawCircle(B,A,D) for BD.  DrawCircle returns the
    // foot on its third-to-first side: CA for AC, DB for BD.
    const ac1 = incircle(a, b, c, c, a);
    const ac2 = incircle(a, d, c, c, a);
    const bd1 = incircle(b, c, d, d, b);
    const bd2 = incircle(b, a, d, d, b);
    if (!ac1 || !ac2 || !bd1 || !bd2) return null;

    const acDistance = dist(ac1.touch, ac2.touch);
    const bdDistance = dist(bd1.touch, bd2.touch);
    const ab = dist(a, b), bc = dist(b, c), cd = dist(c, d), da = dist(d, a);
    const pitotGap = (ab + cd) - (bc + da);
    const scale = Math.max(1, ab, bc, cd, da, dist(a, c), dist(b, d));
    const exactTol = 1e-7 * scale;
    const acTouch = acDistance < TOUCH;
    const bdTouch = bdDistance < TOUCH;
    // The page's "iff" is exact: feet coincide when Pitot's gap is zero.
    // The applet only *reports* a touch when the feet are less than 3 apart,
    // so a tiny, nonzero gap can still light up its touch indicator.
    const acCoincide = acDistance <= exactTol;
    const bdCoincide = bdDistance <= exactTol;
    const pitotExact = Math.abs(pitotGap) <= exactTol;

    return {
      A: a, B: b, C: c, D: d,
      ac: { first: ac1, second: ac2, distance: acDistance, touch: acTouch },
      bd: { first: bd1, second: bd2, distance: bdDistance, touch: bdTouch },
      sides: { AB: ab, BC: bc, CD: cd, DA: da, AC: dist(a, c), BD: dist(b, d) },
      pitotGap: pitotGap,
      pitot: pitotExact,
      measures: { acDistance, bdDistance, acError: Math.abs(acDistance - Math.abs(pitotGap) / 2),
        bdError: Math.abs(bdDistance - Math.abs(pitotGap) / 2) },
      claims: {
        acTouch, bdTouch,
        equivalent: acTouch === bdTouch,
        pitot: pitotExact,
        acCoincide, bdCoincide,
        coincideEquivalent: acCoincide === bdCoincide && acCoincide === pitotExact,
        touchMatchesGap: acTouch === (Math.abs(pitotGap) / 2 < TOUCH)
          && bdTouch === (Math.abs(pitotGap) / 2 < TOUCH),
        feetHalfGap: Math.abs(acDistance - Math.abs(pitotGap) / 2) <= exactTol
          && Math.abs(bdDistance - Math.abs(pitotGap) / 2) <= exactTol,
      },
      tol: exactTol,
    };
  }

  function geometry(state) {
    return compute(state.A, state.B, state.C, state.D);
  }

  /* An illustration, not a game: there is nothing to win and nothing to lose. */
  function result() {
    return null;
  }

  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move a corner so the four triangles have room for their circles.";
    const pair = state.options.diagonal === "bd" ? g.bd : g.ac;
    const other = state.options.diagonal === "bd" ? g.ac : g.bd;
    const name = state.options.diagonal === "bd" ? "BD" : "AC";
    const otherName = state.options.diagonal === "bd" ? "AC" : "BD";
    const status = pair.touch
      ? `The two circles on ${name} touch.`
      : `The two circles on ${name} are ${pair.distance.toFixed(1)} units apart.`;
    const partner = other.touch
      ? `The pair on ${otherName} touches too.`
      : `The pair on ${otherName} does not touch.`;
    const sides = `AB + CD is ${g.sides.AB.toFixed(1)} + ${g.sides.CD.toFixed(1)}, and BC + AD is ${g.sides.BC.toFixed(1)} + ${g.sides.DA.toFixed(1)}.`;
    return status + " " + partner + " " + sides;
  }

  /** Plain data for the player's record and the tutor. */
  function position(state) {
    const g = geometry(state);
    return {
      A: state.A, B: state.B, C: state.C, D: state.D,
      diagonal: state.options.diagonal,
      touched: g ? { ac: g.ac.touch, bd: g.bd.touch, both: g.ac.touch && g.bd.touch } : null,
      pitotGap: g ? g.pitotGap : null,
    };
  }

  return {
    VIEW, PAD, TOUCH, EPS,
    point, dist, cross, sub, clamp, foot, incenter, incircle,
    start, reset, move, setDiagonal, makeTangential,
    compute, geometry, result, describe, position,
  };
})();
