"use strict";

/*
 * Building Bridge — the illustration behind Bogomolny's "Building a Bridge".
 *
 * Two towns A and B sit on opposite sides of a straight river (a strip between
 * two horizontal banks). The road must go straight from A to a point C on the
 * near bank, straight across the bridge CC' (perpendicular to the banks), then
 * straight from C' to B. Drag C along the near bank to make the road short.
 *
 * The one idea the code relies on is translation. Sliding B upstream by the
 * river's width gives B' = B - V (V is the bridge vector); sliding A downstream
 * gives A' = A + V. Because C' = C + V, the land length AC + C'B equals
 * AC + CB'. By the triangle inequality that is at least AB', with equality
 * exactly when C lies on the segment AB'. So the best C is where AB' crosses
 * the near bank, and the best C' is where A'B crosses the far bank: the same
 * bridge, as the page says. The shortest road is AB' + |V|.
 *
 * The construction here mirrors BuildingBridgeCanvas.ComputePoints: BB is
 * B translated by -2H, AA is A translated by +2H (H = height/15), KU is where
 * line A-BB meets the upper bank, and KL where line B-AA meets the lower bank.
 * The applet "finishes" (opens its eyes) when dist(C, KU) < 1.
 *
 * This file is the logic and nothing else: no document, no window, no storage.
 * It defines one global, BuildingBridgeCore, so the page loads it with a plain
 * <script> and porting/check-building-bridge.mjs loads it in Node. All functions
 * take plain data and return new objects; nothing passed in is changed.
 */
const BuildingBridgeCore = (() => {
  const EPS = 1e-9;
  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

  /** The position a new diagram starts from, as BuildingBridgeCanvas.init does. */
  function start(options) {
    const o = options || {};
    if (o.position) {
      const s = o.position;
      return {
        width: s.width, height: s.height, H: s.H,
        yU: s.yU, yL: s.yL,
        A: { ...s.A }, B: { ...s.B }, C: { ...s.C },
      };
    }
    const width = o.width === undefined ? 400 : o.width;
    const height = o.height === undefined ? 300 : o.height;
    const random = o.random === undefined ? 0.5 : o.random;
    const H = Math.floor(height / 15); // Java's `int H = height / 15`
    const mid = height / 2;
    const yU = mid - H, yL = mid + H;
    // Java: (int)(mid*(random+1)/8), truncated toward zero; random is in [0,1).
    // The bytecode subtracts this offset from A's y and adds it to B's y;
    // their x coordinates are width/4 and 3*width/4.
    const k = Math.floor((mid * (random + 1)) / 8);
    return {
      width, height, H, yU, yL,
      A: { x: width / 4, y: mid - k },
      B: { x: (3 * width) / 4, y: mid + k },
      // Cdoub = Upper.CreateMidPoint(): a point on the upper bank. The applet
      // uses a random t; t = 0.75 keeps the start off the best crossing.
      C: { x: 10 * 0.75 + (width - 10) * 0.25, y: yU },
    };
  }

  /** The width of the river: twice H in the applet's coordinates. */
  function riverWidth(s) {
    return 2 * s.H;
  }

  /** B' = B - V and A' = A + V, where V is the perpendicular bridge vector. */
  function translated(s) {
    const width = riverWidth(s);
    return {
      V: { x: 0, y: width },
      Bprime: { x: s.B.x, y: s.B.y - width },
      Aprime: { x: s.A.x, y: s.A.y + width },
    };
  }

  /** Where the infinite line through p and q cuts the horizontal bank y = level. */
  function crossBank(p, q, level) {
    const dy = q.y - p.y;
    if (Math.abs(dy) < EPS) return { x: NaN, y: level };
    const t = (level - p.y) / dy;
    return { x: p.x + (q.x - p.x) * t, y: level };
  }

  /** KU (best near-bank point) and KL (best far-bank point) of ComputePoints. */
  function best(s) {
    const t = translated(s);
    return {
      KU: crossBank(s.A, t.Bprime, s.yU),
      KL: crossBank(s.B, t.Aprime, s.yL),
      Bprime: t.Bprime,
      Aprime: t.Aprime,
    };
  }

  /** The mate of C on the far bank: the applet uses (C.x, C.y + 2H). */
  function bridgeMate(s, C) {
    return { x: C.x, y: C.y + riverWidth(s) };
  }

  /** Total road length: land + bridge + land. */
  function roadLength(s, C) {
    return distance(s.A, C) + riverWidth(s) + distance(bridgeMate(s, C), s.B);
  }

  /** The applet's CheckFinished: within one pixel of KU. */
  function atBest(s) {
    const KU = best(s).KU;
    return Number.isFinite(KU.x) && distance(s.C, KU) < 1;
  }

  /** The exact page claim: the minimum equals |AB'| + river width. */
  function minRoad(s) {
    return distance(s.A, translated(s).Bprime) + riverWidth(s);
  }

  /**
   * Each claim on the applet's page, checked numerically at this diagram.
   * A horizontal A-B' (which happens only if a town sits exactly on a bank)
   * has no crossing; every flag is then false.
   */
  function claims(s) {
    const R = riverWidth(s);
    const t = translated(s);
    const b = best(s);
    const Cp = bridgeMate(s, s.C);
    const good = [b.KU, b.KL].every((p) => Number.isFinite(p.x));
    if (!good) {
      return {
        bridgePerpendicular: false, equalLand: false, triangleInequality: false,
        shortestAtCrossing: false, twoTranslations: false, finishedAtCrossing: false,
      };
    }
    const scale = Math.max(R, distance(s.A, s.B), distance(s.A, t.Bprime));
    const tol = 1e-7 * Math.max(1, scale);
    const C0 = s.C;
    const land = distance(C0, t.Bprime);
    const otherLand = distance(Cp, s.B);
    return {
      // The bridge is perpendicular: C' is straight below C, on the far bank.
      bridgePerpendicular:
        Math.abs(Cp.x - C0.x) < tol && Math.abs(Cp.y - s.yL) < tol &&
        Math.abs(C0.y - s.yU) < tol,
      // Translation preserves distance: C B' has the same length as C' B.
      equalLand: Math.abs(land - otherLand) < tol,
      // Triangle inequality: AC + CB' >= AB', for the dragged C.
      triangleInequality: distance(s.A, C0) + land >= distance(s.A, t.Bprime) - tol,
      // The crossing of AB' with the near bank is the true minimum.
      shortestAtCrossing:
        Math.abs(roadLength(s, b.KU) - minRoad(s)) < tol &&
        Math.abs(b.KU.y - s.yU) < tol,
      // Translating A instead gives the same bridge: A'B meets the far bank at KL,
      // directly below KU, and |AB'| = |A'B|.
      twoTranslations:
        Math.abs(b.KL.x - b.KU.x) < tol && Math.abs(b.KL.y - s.yL) < tol &&
        Math.abs(distance(s.A, t.Bprime) - distance(t.Aprime, s.B)) < tol,
      // The applet's own finishing test: eyes open exactly at the crossing.
      finishedAtCrossing:
        atBest({ ...s, C: { x: b.KU.x, y: s.yU } }) &&
        !atBest({ ...s, C: { x: b.KU.x + 2, y: s.yU } }),
    };
  }

  /**
   * Move a named point. A and B are reflected back out of the river exactly as
   * mouseDragged/mouseReleased do; C is restricted to the upper bank.
   */
  function withPoint(s, name, p) {
    const next = {
      width: s.width, height: s.height, H: s.H, yU: s.yU, yL: s.yL,
      A: { ...s.A }, B: { ...s.B }, C: { ...s.C },
    };
    if (name === "A") {
      next.A = { x: p.x, y: p.y > s.yU ? 2 * s.yU - p.y : p.y };
    } else if (name === "B") {
      next.B = { x: p.x, y: p.y < s.yL ? 2 * s.yL - p.y : p.y };
    } else if (name === "C") {
      next.C = { x: p.x, y: s.yU };
    }
    return next;
  }

  /** An illustration cannot be won or lost. */
  function result(/* state */) {
    return null;
  }

  return {
    start, riverWidth, translated, crossBank, best, bridgeMate, roadLength,
    atBest, minRoad, claims, withPoint, result,
  };
})();
