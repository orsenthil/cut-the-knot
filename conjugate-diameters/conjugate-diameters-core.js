"use strict";

/*
 * Conjugate Diameters — the geometry behind Bogomolny's applet.
 *
 * An ellipse is fixed by the four corners of its bounding rectangle V0..V3.
 * P is a point on the ellipse; P' is the point diametrically opposite it.
 * PP is the diameter through them. R slides along that diameter, and a chord
 * is drawn through R parallel to the tangent at P. That direction is the
 * conjugate diameter QQ, the line through the centre parallel to the chord.
 * The applet then draws the tangents at the two ends T, T' of the chord: they
 * always meet at a point U on PP. In other words, the midpoints of chords
 * parallel to one diameter lie on its conjugate partner, and the tangents at
 * their endpoints meet on that same partner.
 *
 * The one idea the code relies on: the applet turns the ellipse into the unit
 * circle by scaling (x-cx)/a, (y-cy)/b. A tangent to the circle at u is
 * rotated by 90 degrees and mapped back; a line cuts the ellipse where its
 * scaled version cuts the circle. That is also why the chord through R has R
 * for its midpoint: the chord's direction is the conjugate direction.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, ConjugateDiametersCore, so the page loads it with a
 * plain <script> and porting/check-conjugate-diameters.mjs loads it in Node.
 * Positions are plain data; every function returns a new position.
 */
const ConjugateDiametersCore = (() => {
  const EPS = 1e-9;
  const VIEW = { width: 400, height: 300 };
  /* CTKEllipse.EllipseAt(-2.356194490192345) in ConjugateDiametersCanvas.init. */
  const START_ANGLE = -2.356194490192345;
  /* PP.CreateMidPoint(0.4) in init: the starting position of R. */
  const START_R = 0.4;
  /* CTKEllipse.Inf is 200 units to the right of the centre. */
  const INF_OFFSET = 200;
  /* GeoSDoub.GetParallelTo multiplies a direction by 100. */
  const PARALLEL_FACTOR = 100;
  /* The unit circle is represented by a circle of radius 1000. */
  const CIRCLE_R = 1000;

  const copy = (p) => ({ x: p.x, y: p.y });
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const sqDist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clamp01 = (t) => Math.max(0, Math.min(1, t));

  /** CTKEllipse(MoveablePoint[]) and EllipseUpdated. */
  function ellipseFrom(V) {
    return {
      center: { x: (V[0].x + V[1].x) / 2, y: (V[1].y + V[2].y) / 2 },
      inf: { x: (V[0].x + V[1].x) / 2 + INF_OFFSET, y: (V[1].y + V[2].y) / 2 },
      A: (V[1].x - V[0].x) / 2,
      B: (V[1].y - V[2].y) / 2,
    };
  }

  /** CTKEllipse.EllipseAt(t). */
  function pointAt(e, t) {
    return { x: e.center.x + e.A * Math.cos(t), y: e.center.y + e.B * Math.sin(t) };
  }

  /** GeoSDoub.FindOrientation(a,b,c): +1 for a left turn, else -1. */
  function orientation(a, b, c) {
    const s = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
    return s > 0 ? 1 : -1;
  }

  /** GeoSDoub.ComputeSignedAngle(a,b,c), used by CTKEllipse.KeepOnEllipse. */
  function signedAngle(a, b, c) {
    const ca = sqDist(a, b), cb = sqDist(a, c), ab = sqDist(b, c);
    const cosv = (ca + cb - ab) / (2 * Math.sqrt(ca) * Math.sqrt(cb));
    const angle = Math.acos(Math.max(-1, Math.min(1, cosv)));
    return orientation(a, b, c) === 1 ? angle : -angle;
  }

  /** CTKEllipse.KeepOnEllipse: slide a dragged point back onto the ellipse. */
  function keepOnEllipse(e, p) {
    if (Math.abs(e.A) < EPS || Math.abs(e.B) < EPS) return copy(p);
    const u = { x: (p.x - e.center.x) / e.A, y: (p.y - e.center.y) / e.B };
    if (sqDist(u, { x: 0, y: 0 }) < EPS * EPS) return pointAt(e, 0);
    const onUnitCircle = { x: e.center.x + u.x, y: e.center.y + u.y };
    return pointAt(e, signedAngle(e.center, e.inf, onUnitCircle));
  }

  /** CTKEllipse.KeepAllOnEllipse: P and R after a rectangle corner moves. */
  function keepAllOnEllipse(e, points) {
    return points.map((p) => keepOnEllipse(e, p));
  }

  /**
   * CTKEllipse.MaintainRect: a dragged corner is mirrored across both centre
   * lines, so the centre of the ellipse never moves.
   */
  function maintainRect(V, index, p) {
    const center = ellipseFrom(V).center;
    const dx = center.x - p.x, dy = center.y - p.y;
    const v = V.map(copy);
    v[index] = copy(p);
    const set = (i, x, y) => { v[i].x = x; v[i].y = y; };
    if (index === 0) {
      set(1, center.x + dx, center.y - dy);
      set(2, center.x + dx, center.y + dy);
      set(3, center.x - dx, center.y + dy);
    } else if (index === 1) {
      set(0, center.x + dx, center.y - dy);
      set(2, center.x - dx, center.y + dy);
      set(3, center.x + dx, center.y + dy);
    } else if (index === 2) {
      set(0, center.x + dx, center.y + dy);
      set(1, center.x - dx, center.y + dy);
      set(3, center.x + dx, center.y - dy);
    } else if (index === 3) {
      set(0, center.x - dx, center.y + dy);
      set(1, center.x + dx, center.y + dy);
      set(2, center.x + dx, center.y - dy);
    }
    return v;
  }

  /** The applet's DoubLine(p, q). */
  const line = (p, q) => ({ p: copy(p), q: copy(q) });

  /**
   * GeoSDoub.Intersect(a,b,c,d) from the bytecode: two lines in coefficient
   * form solved by Cramer's rule. |det| < 1 gives NaN in the applet.
   */
  function intersect(a, b, c, d) {
    const a1 = a.y - b.y, b1 = b.x - a.x, c1 = a.x * b.y - a.y * b.x;
    const a2 = c.y - d.y, b2 = d.x - c.x, c2 = c.x * d.y - c.y * d.x;
    const det = b1 * a2 - b2 * a1;
    if (Math.abs(det) < 1) return { x: NaN, y: NaN };
    return { x: (c1 * b2 - c2 * b1) / det, y: (a1 * c2 - a2 * c1) / det };
  }

  const intersectLines = (l, m) => intersect(l.p, l.q, m.p, m.q);

  /** CTKGeometryPlus.Prorate(p, anchor, d): go d units from p towards anchor. */
  function prorate(p, anchor, d) {
    const len = dist(p, anchor);
    if (len < 0.1) return copy(p);
    const k = d / len;
    return { x: p.x + (anchor.x - p.x) * k, y: p.y + (anchor.y - p.y) * k };
  }

  /** SetPp(): Pp is the point diametrically opposite P on the ellipse. */
  function antipode(e, p) {
    return prorate(p, e.center, 2 * dist(p, e.center));
  }

  /** GeoSDoub.GetParallelTo(p, a, b): a long segment through p parallel to ab. */
  function parallelThrough(p, l) {
    return {
      x: p.x + PARALLEL_FACTOR * (l.q.x - l.p.x),
      y: p.y + PARALLEL_FACTOR * (l.q.y - l.p.y),
    };
  }

  /** DoubCircle(0,0,1000).Tangent(u), literally: rotate u by 90 degrees. */
  function circleTangent(u) {
    const len = Math.hypot(u.x, u.y);
    if (Math.abs(len - CIRCLE_R) > 1) return null;
    return { x: u.x + (0 - u.y), y: u.y - (0 - u.x) };
  }

  /** CTKEllipse.TangentAt(p), including its 1000-unit circle transform. */
  function tangentAt(e, p) {
    if (Math.abs(e.A) < EPS || Math.abs(e.B) < EPS) return null;
    const u = {
      x: ((p.x - e.center.x) / e.A) * CIRCLE_R,
      y: ((p.y - e.center.y) / e.B) * CIRCLE_R,
    };
    const t = circleTangent(u);
    if (!t) return null;
    return line(p, {
      x: e.center.x + (t.x * e.A) / CIRCLE_R,
      y: e.center.y + (t.y * e.B) / CIRCLE_R,
    });
  }

  /** ConjugateDiametersCanvas.GetLineCoefs(a,b): coefficients of line ab. */
  function lineCoefs(a, b) {
    const A = b.y - a.y, B = -(b.x - a.x);
    return [A, B, -a.x * A - a.y * B];
  }

  /**
   * CTKEllipse.Intersect(A,B,C): cut the line by the ellipse. In scaled
   * coordinates (u,v) = ((x-cx)/a,(y-cy)/b) the line is A1*u+B1*v+C=0 and the
   * ellipse is the unit circle. Its two cuts are foot +/- half-chord along the
   * perpendicular to (A1,B1). This is the same quadratic as the applet's
   * circle/line intersection, without the 1000-unit scaling.
   */
  function ellipseIntersect(e, A, B, C) {
    const A1 = A * e.A, B1 = B * e.B;
    const den = A1 * A1 + B1 * B1;
    if (den < EPS * EPS) return null;
    const c = A * e.center.x + B * e.center.y + C;
    const foot = { x: (-c * A1) / den, y: (-c * B1) / den };
    const h2 = 1 - (foot.x * foot.x + foot.y * foot.y);
    if (h2 < 0) return null;
    const h = Math.sqrt(h2 / den);
    return [
      { x: e.center.x + e.A * (foot.x - h * B1), y: e.center.y + e.B * (foot.y + h * A1) },
      { x: e.center.x + e.A * (foot.x + h * B1), y: e.center.y + e.B * (foot.y - h * A1) },
    ];
  }

  /**
   * DoubLine.UpdateMidPoint: the parameter t of R on P--P', clamped to [0,1]
   * because DoubLine starts with m_PointInSegment = true.
   */
  function projectParam(p, pp, r) {
    const d = { x: p.x - pp.x, y: p.y - pp.y };
    const len2 = dot(d, d);
    if (len2 < EPS * EPS) return 0.5;
    return clamp01(dot(d, { x: r.x - pp.x, y: r.y - pp.y }) / len2);
  }

  const atParam = (p, pp, t) => ({
    x: pp.x + t * (p.x - pp.x), y: pp.y + t * (p.y - pp.y),
  });

  /** ConjugateDiametersCanvas.Compute, with the same objects in the same order. */
  function compute(state) {
    const e = ellipseFrom(state.V);
    const P = copy(state.P);
    const Pp = antipode(e, P);
    const tangentP = tangentAt(e, P);
    const tangentPp = tangentAt(e, Pp);
    const PP = line(P, Pp);
    const R = copy(state.R);
    if (!tangentP) {
      return { ellipse: e, P, Pp, R, tangentP: null, tangentPp: null, PP,
        chord: null, S: null, tangentS: [null, null], U: { x: NaN, y: NaN }, QQ: null };
    }
    const chordQ = parallelThrough(R, tangentP);
    const chord = line(R, chordQ);
    const [A, B, C] = lineCoefs(R, chordQ);
    const S = ellipseIntersect(e, A, B, C);
    const tangentS = S ? S.map((p) => tangentAt(e, p)) : [null, null];
    const U = tangentS[0] && tangentS[1]
      ? intersectLines(tangentS[0], tangentS[1]) : { x: NaN, y: NaN };
    /* QQ is the diameter through O parallel to the tangent at P, i.e. the
       direction of the chords. In normalised coordinates it is (-sin t,
       cos t); PP is its conjugate, the locus of the chords' midpoints. */
    const QQ = line(e.center, parallelThrough(e.center, tangentP));
    return { ellipse: e, P, Pp, R, tangentP, tangentPp, PP, chord, S, tangentS, U, QQ };
  }

  /** The applet's starting rectangle, point P and chord midpoint R. */
  function start(options) {
    const o = options || {};
    const width = o.width === undefined ? VIEW.width : o.width;
    const height = o.height === undefined ? VIEW.height : o.height;
    if (o.V && o.P) {
      const t = o.t === undefined ? START_R : o.t;
      const e = ellipseFrom(o.V);
      return {
        view: { width, height },
        V: o.V.map(copy), P: copy(o.P),
        R: o.R ? copy(o.R) : atParam(o.P, antipode(e, o.P), t),
        t, explored: Boolean(o.explored), names: Boolean(o.names),
      };
    }
    const cx = width / 2, cy = height / 2;
    const rx = width / 8, ry = height / 10;
    const V = [
      { x: cx - rx, y: cy + ry }, { x: cx + rx, y: cy + ry },
      { x: cx + rx, y: cy - ry }, { x: cx - rx, y: cy - ry },
    ];
    const e = ellipseFrom(V);
    const P = pointAt(e, START_ANGLE);
    const t = START_R;
    return {
      view: { width, height }, V, P, R: atParam(P, antipode(e, P), t),
      t, explored: false, names: false,
    };
  }

  /** Keep a handle inside the drawing area, with a small margin. */
  function clamp(p, state) {
    const view = (state && state.view) || VIEW;
    return {
      x: Math.max(6, Math.min(view.width - 6, p.x)),
      y: Math.max(6, Math.min(view.height - 6, p.y)),
    };
  }

  /**
   * The applet only accepts a rectangle-corner drag more than 10 px from each
   * centre line (PointIsGood); this clamp keeps the same 11-unit margin.
   */
  function clampCorner(p, state) {
    const q = clamp(p, state);
    const e = ellipseFrom(state.V);
    const dx = q.x - e.center.x, dy = q.y - e.center.y;
    const sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
    return {
      x: e.center.x + sx * Math.max(11, Math.abs(dx)),
      y: e.center.y + sy * Math.max(11, Math.abs(dy)),
    };
  }

  /** Move V0..V3 (reshape), P (along the ellipse) or R (along PP). */
  function move(state, name, p) {
    const next = {
      view: { ...state.view }, V: state.V.map(copy), P: copy(state.P),
      R: copy(state.R), t: state.t, explored: state.explored, names: state.names,
    };
    if (name[0] === "V") {
      const index = Number(name.slice(1));
      if (!Number.isInteger(index) || index < 0 || index > 3) return next;
      next.V = maintainRect(next.V, index, p);
      const e = ellipseFrom(next.V);
      /* KeepAllOnEllipse(P) then KeepAllOnEllipse(R), followed by
         PP.UpdateMidPoint(): the applet's actual order of operations. */
      const kept = keepAllOnEllipse(e, [state.P, state.R]);
      next.P = kept[0];
      const Pp = antipode(e, next.P);
      next.t = projectParam(next.P, Pp, kept[1]);
      next.R = atParam(next.P, Pp, next.t);
    } else if (name === "P") {
      const e = ellipseFrom(next.V);
      next.P = keepOnEllipse(e, p);
      const Pp = antipode(e, next.P);
      next.t = projectParam(next.P, Pp, state.R);
      next.R = atParam(next.P, Pp, next.t);
    } else if (name === "R") {
      const e = ellipseFrom(next.V);
      const Pp = antipode(e, next.P);
      next.t = projectParam(next.P, Pp, p);
      next.R = atParam(next.P, Pp, next.t);
    }
    return next;
  }

  /** Distance from p to the infinite line through a,b. */
  function distToLine(p, a, b) {
    const len = dist(a, b);
    if (len < EPS) return Infinity;
    return Math.abs(cross({ x: b.x - a.x, y: b.y - a.y },
      { x: p.x - a.x, y: p.y - a.y })) / len;
  }

  /** Area of the parallelogram made by the tangents at P,P',Q,Q'. */
  function tangentParallelogram(e, t) {
    const Q = pointAt(e, t + Math.PI / 2);
    const Qp = antipode(e, Q);
    const lP = tangentAt(e, pointAt(e, t));
    if (!lP) return NaN;
    const lPp = tangentAt(e, antipode(e, lP.p));
    const lQ = tangentAt(e, Q), lQp = tangentAt(e, Qp);
    if (!lP || !lPp || !lQ || !lQp) return NaN;
    const v = [
      intersectLines(lP, lQ), intersectLines(lQ, lPp),
      intersectLines(lPp, lQp), intersectLines(lQp, lP),
    ];
    if (!v.every(finite)) return NaN;
    let sum = 0;
    for (let i = 0; i < 4; i++) {
      const a = v[i], b = v[(i + 1) % 4];
      sum += a.x * b.y - a.y * b.x;
    }
    return Math.abs(sum) / 2;
  }

  /** The page's claims, measured on the current diagram. */
  function claims(state) {
    const g = compute(state);
    const e = g.ellipse;
    const scale = 4 * Math.max(1, Math.abs(e.A), Math.abs(e.B), e.center.x, e.center.y);
    const tol = 1e-5 * scale;
    const onEllipse = (p) => finite(p) &&
      Math.abs(((p.x - e.center.x) / e.A) ** 2 + ((p.y - e.center.y) / e.B) ** 2 - 1) < 1e-5;
    const hasS = Boolean(g.S && g.S.length === 2 && g.S.every(finite));

    /* The chord through R has R as its midpoint, and R lies on PP. */
    const mid = hasS ? midpoint(g.S[0], g.S[1]) : null;
    const chordMidpoint = hasS && dist(mid, g.R) < tol;
    const chordEndsOnEllipse = hasS && g.S.every(onEllipse);
    const rOnPP = distToLine(g.R, g.P, g.Pp) < tol;
    const pOnEllipse = onEllipse(g.P) && onEllipse(g.Pp);

    /* The tangents at P and P' are parallel: parallel chords, same direction. */
    const tangentsParallel = Boolean(g.tangentP && g.tangentPp) &&
      Math.abs(cross(
        { x: g.tangentP.q.x - g.tangentP.p.x, y: g.tangentP.q.y - g.tangentP.p.y },
        { x: g.tangentPp.q.x - g.tangentPp.p.x, y: g.tangentPp.q.y - g.tangentPp.p.y },
      )) < tol;

    /* Tangents at the chord's ends meet on PP, the diameter of its midpoints. */
    const hasTangents = Boolean(g.tangentS[0] && g.tangentS[1]);
    const uFinite = finite(g.U);
    const uOnTangents = hasTangents && uFinite &&
      distToLine(g.U, g.tangentS[0].p, g.tangentS[0].q) < tol &&
      distToLine(g.U, g.tangentS[1].p, g.tangentS[1].q) < tol;
    const uOnPP = uFinite && distToLine(g.U, g.PP.p, g.PP.q) < tol;

    /* Slopes -b/a cot t and b/a tan t: product -b²/a², so not perpendicular
       unless a = b (the page's own observation). */
    const ct = (g.P.x - e.center.x) / e.A, st = (g.P.y - e.center.y) / e.B;
    const m1 = -(e.B / e.A) * ct / st, m2 = (e.B / e.A) * st / ct;
    const slopeProduct = Number.isFinite(m1) && Number.isFinite(m2) &&
      Math.abs(m1 * m2 + (e.B * e.B) / (e.A * e.A)) < 1e-5;
    const perpendicularOnlyForCircle = Math.abs(e.A - e.B) < 1e-9
      ? Math.abs(m1 * m2 + 1) < 1e-5
      : Math.abs(m1 * m2 + 1) > 1e-5;

    /* First theorem of Apollonius: OP² + OQ² = a² + b². */
    const t = Math.atan2(st, ct);
    const Q = pointAt(e, t + Math.PI / 2);
    const apollonius1 = Math.abs(sqDist(e.center, g.P) + sqDist(e.center, Q)
      - (e.A * e.A + e.B * e.B)) < tol;

    /* Second theorem of Apollonius: the tangent parallelogram has area 4ab. */
    const area = tangentParallelogram(e, t);
    const apollonius2 = Number.isFinite(area) && Math.abs(area - 4 * Math.abs(e.A * e.B)) < tol;

    return {
      chordMidpoint, chordEndsOnEllipse, rOnPP, pOnEllipse, tangentsParallel,
      uOnTangents, uOnPP, slopeProduct, perpendicularOnlyForCircle,
      apollonius1, apollonius2, geometry: g, midpoint: mid, Q, area,
    };
  }

  /** A plain-English line for the illustration; there is no win or loss. */
  function describe(state) {
    const c = claims(state);
    if (!c.pOnEllipse || !c.chordEndsOnEllipse || !c.uOnPP) {
      return "Move P away from a flat spot and try again.";
    }
    if (state.explored) {
      return "The chord's midpoint R stays on PP, and the tangents at its ends meet at U on PP too.";
    }
    return `R is at (${Math.round(state.R.x)}, ${Math.round(state.R.y)}). Press Check the theorem to test the tangents.`;
  }

  /** Board-unit position for the player's record and the tutor. */
  function position(state) {
    const c = claims(state);
    return {
      V: state.V.map(copy), P: copy(state.P), R: copy(state.R), t: state.t,
      Pp: copy(c.geometry.Pp), S: c.geometry.S ? c.geometry.S.map(copy) : null,
      midpoint: c.midpoint ? copy(c.midpoint) : null,
      U: finite(c.geometry.U) ? copy(c.geometry.U) : null,
      names: state.names, explored: state.explored,
    };
  }

  /** An illustration cannot be won or lost. */
  function result(/* state */) {
    return null;
  }

  return {
    EPS, VIEW, START_ANGLE, START_R, CIRCLE_R, PARALLEL_FACTOR,
    copy, dot, cross, dist, sqDist, midpoint, finite, ellipseFrom, pointAt,
    orientation, signedAngle, keepOnEllipse, keepAllOnEllipse, maintainRect,
    line, intersect, intersectLines, prorate, antipode, parallelThrough,
    circleTangent, tangentAt, lineCoefs, ellipseIntersect, projectParam, atParam,
    compute, start, clamp, clampCorner, move, distToLine, tangentParallelogram,
    claims, describe, position, result,
  };
})();
