"use strict";

/*
 * de Villiers — the Java applet deVilliers, from Alexander Bogomolny's
 * cut-the-knot page "Similar Triangles on Sides of a Quadrilateral".
 *
 * Four similar triangles ABP, CBQ, CDR, ADS are erected on the sides of a
 * quadrilateral.  The applet keeps one common turn Alpha and one common
 * scale Coef: for each side X->Y it puts the apex at
 *
 *     apex = X + Coef * Rotate(Y about X by Alpha),
 *
 * where Rotate is GeoSDoub.Rotate(center, point, angle, 1).  Dragging a
 * corner recomputes the four apexes (AdjustApexes); dragging an apex first
 * recovers Alpha and Coef from that apex (AdjustParams), then recomputes the
 * other three apexes.  The page claims PQRS is a parallelogram.  Writing
 * k = Coef * exp(i*Alpha), the four apexes are
 *
 *     P = (1-k)A + kB,  Q = (1-k)C + kB,
 *     R = (1-k)C + kD,  S = (1-k)A + kD,
 *
 * so P + R = Q + S for every quadrilateral and every k.  The page's printed
 * product (1)/(3) uses RD/DC where its own line (2) uses RD/RC; the test
 * shows the printed product equals Coef, while RD/RC makes it 1.
 *
 * This file is geometry and state only: no document, no window, no storage.
 * It defines one global, DeVilliersCore.  Positions are plain data in the
 * SVG viewBox units.  Functions never change the position they are given.
 */
const DeVilliersCore = (() => {
  /* The applet's canvas was 600x450; the board keeps its aspect on a phone. */
  const VIEW = { x: 0, y: 0, width: 460, height: 300 };
  const PAD = 12;
  /* deVilliersCanvas(): Alpha = 1.0471975511965976 (pi/3), Coef = 1. */
  const ALPHA0 = 1.0471975511965976;
  const COEF0 = 1;
  /* init(): the four corners sit on a circle of radius min(W,H)/3. */
  const START_ANGLES = [0.5235987755982988, 2.0943951023931953,
    2.9670597283903604, 5.235987755982989];
  const BASE = ["A", "B", "C", "D"];
  const APEX = ["P", "Q", "R", "S"];
  /* AdjustApexes(): which two corners carry each apex, in the applet's order. */
  const SIDES = {
    P: ["A", "B"],
    Q: ["C", "B"],
    R: ["C", "D"],
    S: ["A", "D"],
  };
  const OPTION_KEYS = ["names", "para", "angles"];

  const point = (x, y) => ({ x: x, y: y });
  const add = (p, q) => point(p.x + q.x, p.y + q.y);
  const sub = (p, q) => point(p.x - q.x, p.y - q.y);
  const mul = (p, k) => point(p.x * k, p.y * k);
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

  /** Keep a dragged point inside the board, with room for its handle. */
  function clamp(p) {
    return point(
      Math.max(VIEW.x + PAD, Math.min(VIEW.x + VIEW.width - PAD, p.x)),
      Math.max(VIEW.y + PAD, Math.min(VIEW.y + VIEW.height - PAD, p.y)),
    );
  }

  /* GeoSDoub.Rotate(center, point, angle, 1), with the screen's y axis down:
   * x' = cx + cos(a)*dx - sin(a)*dy; y' = cy + sin(a)*dx + cos(a)*dy. */
  function rotate(center, p, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const dx = p.x - center.x, dy = p.y - center.y;
    return point(center.x + c * dx - s * dy, center.y + s * dx + c * dy);
  }

  /* AdjustOneApex(): apex = Y + Coef * (Rotate(Y, X, Alpha) - Y). */
  function spiral(center, end, alpha, coef) {
    const t = rotate(center, end, alpha);
    return point(center.x + coef * (t.x - center.x),
      center.y + coef * (t.y - center.y));
  }

  /* AdjustApexes(DoubPoint changed): skip the dragged apex, if any. */
  function setApexes(pts, alpha, coef, skip) {
    for (const key of APEX) {
      if (key === skip) continue;
      const side = SIDES[key];
      pts[key] = spiral(pts[side[0]], pts[side[1]], alpha, coef);
    }
    return pts;
  }

  /* GeoSDoub.ComputeAngle(a,b,c): the angle at a, by the cosine rule. */
  function angleAt(a, b, c) {
    const ab = dist(a, b), ac = dist(a, c), bc = dist(b, c);
    if (!ab || !ac) return 0;
    const cos = (ab * ab + ac * ac - bc * bc) / (2 * ab * ac);
    return Math.acos(Math.max(-1, Math.min(1, cos)));
  }

  /* GeoSDoub.FindOrientation(a,b,c): sign of (b-a) cross (c-a). */
  function orientation(a, b, c) {
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    return cross > 0 ? 1 : -1;
  }

  /* AdjustParams(apex, X, Y, 1): Coef and the signed common angle. */
  function adjustedParams(apex, x, y) {
    const den = dist(x, y);
    if (!den) return null;
    const coef = dist(x, apex) / den;
    if (!Number.isFinite(coef)) return null;
    const alpha = angleAt(x, y, apex) * orientation(x, y, apex);
    if (!Number.isFinite(alpha)) return null;
    return { alpha: alpha, coef: coef };
  }

  function copy(state) {
    const s = {};
    for (const key of BASE.concat(APEX)) s[key] = point(state[key].x, state[key].y);
    s.alpha = state.alpha;
    s.coef = state.coef;
    s.options = {
      names: !!state.options.names,
      para: !!state.options.para,
      angles: !!state.options.angles,
    };
    s.explored = !!state.explored;
    return s;
  }

  /** deVilliersCanvas.init() on a VIEW-sized canvas, with all boxes off. */
  function start(options) {
    const o = options || {};
    const cx = VIEW.width / 2, cy = VIEW.height / 2;
    const r = Math.min(VIEW.width, VIEW.height) / 3;
    const s = {
      A: point(cx + r * Math.cos(START_ANGLES[0]), cy + r * Math.sin(START_ANGLES[0])),
      B: point(cx + r * Math.cos(START_ANGLES[1]), cy + r * Math.sin(START_ANGLES[1])),
      C: point(cx + r * Math.cos(START_ANGLES[2]), cy + r * Math.sin(START_ANGLES[2])),
      D: point(cx + r * Math.cos(START_ANGLES[3]), cy + r * Math.sin(START_ANGLES[3])),
      P: point(0, 0), Q: point(0, 0), R: point(0, 0), S: point(0, 0),
      alpha: ALPHA0, coef: COEF0,
      options: {
        names: !!o.names,
        para: !!o.para,
        angles: !!o.angles,
      },
      explored: false,
    };
    setApexes(s, s.alpha, s.coef, null);
    return s;
  }

  function reset(state) {
    const s = start(state.options);
    s.explored = !!state.explored;
    return s;
  }

  /** Dragging a corner or an apex, exactly as the applet's mouse handlers do. */
  function move(state, name, p) {
    if (BASE.indexOf(name) < 0 && APEX.indexOf(name) < 0) return state;
    if (!finite(p)) return state;
    const s = copy(state);
    s[name] = clamp(p);
    if (BASE.indexOf(name) >= 0) {
      /* mouseDragged with MOV: AdjustApexes() with no skipped apex. */
      setApexes(s, s.alpha, s.coef, null);
    } else {
      /* mouseDragged with MOP: AdjustParams(apex), AdjustApexes(apex). */
      const side = SIDES[name];
      const params = adjustedParams(s[name], s[side[0]], s[side[1]]);
      if (params) {
        s.alpha = params.alpha;
        s.coef = params.coef;
      }
      setApexes(s, s.alpha, s.coef, name);
    }
    s.explored = true;
    return s;
  }

  function setOption(state, name, on) {
    if (OPTION_KEYS.indexOf(name) < 0) return state;
    const s = copy(state);
    s.options[name] = !!on;
    s.explored = true;
    return s;
  }

  /* The page's claims, measured from the current drawing. */
  function geometry(state) {
    if (!state) return null;
    for (const key of BASE.concat(APEX)) {
      if (!finite(state[key])) return null;
    }
    const A = state.A, B = state.B, Cc = state.C, D = state.D;
    const P = state.P, Q = state.Q, R = state.R, S = state.S;

    /* The equal angles at the four apexes, and the equal angles at the
     * corners shared by the two triangles meeting there. */
    const apexAngles = [
      angleAt(P, A, B), angleAt(Q, Cc, B),
      angleAt(R, Cc, D), angleAt(S, A, D),
    ];
    const sharedAngles = {
      A: [angleAt(A, B, P), angleAt(A, D, S)],
      B: [angleAt(B, A, P), angleAt(B, Cc, Q)],
      C: [angleAt(Cc, B, Q), angleAt(Cc, D, R)],
      D: [angleAt(D, Cc, R), angleAt(D, A, S)],
    };

    /* The page's line (2): PB/PA = QB/QC = RD/RC = SD/SA. */
    const q = (a, b) => (b > 0 ? a / b : NaN);
    const ratios = [
      q(dist(P, B), dist(P, A)),
      q(dist(Q, B), dist(Q, Cc)),
      q(dist(R, D), dist(R, Cc)),
      q(dist(S, D), dist(S, A)),
    ];
    const invQ = q(dist(Q, Cc), dist(Q, B));
    const invS = q(dist(S, A), dist(S, D));
    /* Line (1)/(3) prints RD/DC; line (2) has RD/RC.  Keep both. */
    const correctedProduct = ratios[0] * invQ * ratios[2] * invS;
    const printedProduct = ratios[0] * invQ * q(dist(R, D), dist(D, Cc)) * invS;

    /* PQRS opposite sides: Q-P should equal R-S, and R-Q equal S-P. */
    const sideError = Math.max(dist(sub(Q, P), sub(R, S)),
      dist(sub(R, Q), sub(S, P)));
    const diagonalError = dist(add(P, R), add(Q, S));

    const all = [A, B, Cc, D, P, Q, R, S];
    let scale = 1;
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) scale = Math.max(scale, dist(all[i], all[j]));
    }
    const tol = 1e-9 * scale;
    const spread = (values) => Math.max.apply(null, values) - Math.min.apply(null, values);

    const angleSpread = spread(apexAngles);
    const sharedSpread = Math.max.apply(null,
      Object.keys(sharedAngles).map((key) => Math.abs(sharedAngles[key][0] - sharedAngles[key][1])));
    const ratioSpread = spread(ratios);

    /* ShowAnglesInTriangle: three arcs per triangle, at X, Y and the apex. */
    const triangles = [
      { name: "ABP", X: A, Y: B, apex: P },
      { name: "CBQ", X: Cc, Y: B, apex: Q },
      { name: "CDR", X: Cc, Y: D, apex: R },
      { name: "ADS", X: A, Y: D, apex: S },
    ];
    const arcs = [];
    const radii = [17, 20, 23];
    for (const t of triangles) {
      const pts = [t.X, t.Y, t.apex];
      for (let i = 0; i < 3; i++) {
        arcs.push({
          vertex: pts[i],
          p: pts[(i + 1) % 3],
          q: pts[(i + 2) % 3],
          r: radii[i],
        });
      }
    }

    return {
      A: A, B: B, C: Cc, D: D, P: P, Q: Q, R: R, S: S,
      alpha: state.alpha, coef: state.coef,
      triangles: triangles, arcs: arcs,
      apexAngles: apexAngles, sharedAngles: sharedAngles,
      ratios: ratios, correctedProduct: correctedProduct, printedProduct: printedProduct,
      measures: {
        sideError: sideError,
        diagonalError: diagonalError,
        angleSpread: angleSpread,
        sharedSpread: sharedSpread,
        ratioSpread: ratioSpread,
      },
      tol: tol,
      claims: {
        /* The exact claim on the page: PQRS is a parallelogram. */
        parallelogram: sideError <= tol && diagonalError <= tol,
        /* The angle conditions that make the four triangles similar. */
        apexAnglesEqual: angleSpread <= 1e-9,
        sharedAnglesEqual: sharedSpread <= 1e-9,
        ratiosEqual: ratioSpread <= 1e-9 * Math.max(1, ratios[0]),
        correctedProductIsOne: Math.abs(correctedProduct - 1) <= 1e-9
          * Math.max(1, Math.abs(correctedProduct)),
        /* As printed in (1)/(3), using RD/DC: true only when Coef = 1. */
        printedProductIsOne: Math.abs(printedProduct - 1) <= 1e-9
          * Math.max(1, Math.abs(printedProduct)),
      },
    };
  }

  /* An illustration has no win, loss or finish. */
  function result(state) {
    return null;
  }

  function describe(state) {
    const g = geometry(state);
    if (!g) return "Move a point so the four triangles can be drawn.";
    let text = "P, Q, R and S make a parallelogram.";
    if (g.claims.parallelogram && state.explored) {
      text = "The four triangles stay alike, and P, Q, R, S still make a parallelogram.";
    }
    if (state.options.names) text += " Names are shown.";
    if (state.options.para) text += " The parallelogram is outlined.";
    if (state.options.angles) text += " The equal angles are marked.";
    return text;
  }

  return {
    VIEW: VIEW, PAD: PAD, ALPHA0: ALPHA0, COEF0: COEF0,
    BASE: BASE, APEX: APEX, SIDES: SIDES, START_ANGLES: START_ANGLES,
    point: point, add: add, sub: sub, mul: mul, dist: dist, clamp: clamp,
    rotate: rotate, spiral: spiral, angleAt: angleAt, orientation: orientation,
    adjustedParams: adjustedParams,
    start: start, reset: reset, move: move, setOption: setOption,
    geometry: geometry, result: result, describe: describe,
  };
})();
