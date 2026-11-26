"use strict";

/*
 * Balls In Jar, from Alexander Bogomolny's applet BallsInJar.
 *
 * Thirteen equal circles are stacked in a rack: three on the floor, then two,
 * three, two, and three. The middle bottle of the bottom row can be slid, and
 * the common radius can be changed. The question on the page is whether the
 * top row K, L, M is always level.
 *
 * The one idea the code relies on: two circles of radius r that touch have
 * centres 2r apart, so the next circle is found by intersecting the two
 * "double radius" circles around its parents and taking the point above them.
 * A circle against a side of the rack is likewise the upper intersection of a
 * vertical wall line with the double-radius circle of its parent. The applet's
 * two small repair rules (a new circle that overlaps an older one is rebuilt
 * from the older pair; H is lifted onto C if it hits C) are kept as they are.
 *
 * No document, no window, no storage. It defines one global so that the page
 * loads it with a plain <script> and porting/check-balls-in-jar.mjs can load it
 * in Node. Positions are plain data and functions never change their input.
 */
const BallsInJarCore = (() => {
  // The applet's 400 x 300 canvas: P1 and P2 are the inner faces of the rack.
  const WIDTH = 400;
  const HEIGHT = 300;
  const P1 = { x: WIDTH / 4, y: HEIGHT * 0.9 };
  const P2 = { x: WIDTH - P1.x, y: P1.y };
  const PERCENT_MIN = 0;
  const PERCENT_MAX = 105; // the applet's scroll bar goes to 105

  const circle = (p, r) => ({ x: p.x, y: p.y, r: r });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  /** The applet's SetPercent: r runs from width/8+0.05 to width/6. */
  function radius(percent) {
    const span = P2.x - P1.x;
    const smallest = span / 8 + 0.05;
    const largest = span / 6;
    return smallest + ((largest - smallest) * percent) / 100;
  }

  /** The applet's PushBFrom: keep B at least 2r away from another bottle. */
  function pushBFrom(B, other, r) {
    if (Math.abs(B.x - other.x) < 2 * r) {
      B.x = B.x < other.x ? other.x - 2 * r : other.x + 2 * r;
    }
    return B;
  }

  /** The bottom row, exactly as the applet's init / UpgradeForRadius sets it. */
  function bottom(percent, bX) {
    const p = Math.max(PERCENT_MIN, Math.min(PERCENT_MAX, Number(percent) || 0));
    const r = radius(p);
    const y = P1.y - r;
    const A = { x: P1.x + r, y: y };
    const C = { x: P2.x - r, y: y };
    const B = { x: Number.isFinite(bX) ? bX : (P1.x + P2.x) / 2 + r / 6, y: y };
    pushBFrom(B, A, r);
    pushBFrom(B, C, r);
    return { percent: p, r: r, A: A, B: B, C: C };
  }

  /** The position a new diagram starts from (Percent = 50). */
  function start() {
    return bottom(50, undefined);
  }

  /** A new diagram with a different bottle size, keeping B where it can be. */
  function withPercent(state, percent) {
    return bottom(percent, state.B.x);
  }

  /** A new diagram with bottle B slid to x, as far as the other two allow. */
  function withB(state, x) {
    const lo = state.A.x + 2 * state.r;
    const hi = state.C.x - 2 * state.r;
    const wanted = lo <= hi ? Math.max(lo, Math.min(hi, x)) : x;
    return bottom(state.percent, wanted);
  }

  /** Same radius read back as the applet's scroll bar value would be. */
  function percentOfRadius(r) {
    const span = P2.x - P1.x;
    return ((r - (span / 8 + 0.05)) / (span / 6 - (span / 8 + 0.05))) * 100;
  }

  /*
   * Intersections of two offset circles, by the same radical-axis computation
   * the applet's GeoSDoub.Intersect uses. Keeping its arithmetic order matters:
   * the two possible hint circles are almost level with their parent, and the
   * applet's "is the first root above the centre?" test can come down to the
   * last bit of a floating-point comparison.
   */
  function offsets(c1, c2) {
    if (Math.abs(c1.x - c2.x) > 1) {
      const m = -(c1.y - c2.y) / (c1.x - c2.x);
      const aa = (c1.x * c1.x - c2.x * c2.x + c1.y * c1.y - c2.y * c2.y -
        c1.r * c1.r + c2.r * c2.r) / (2 * (c1.x - c2.x));
      const q = m * m + 1;
      const bb = m * (aa - c1.x) - c1.y;
      const cc = (aa - c1.x) * (aa - c1.x) + c1.y * c1.y - c1.r * c1.r;
      const disc = bb * bb - q * cc;
      if (disc < 0) return null;
      const s = Math.sqrt(disc);
      const y0 = (-bb + s) / q, y1 = (-bb - s) / q;
      return [{ x: m * y0 + aa, y: y0 }, { x: m * y1 + aa, y: y1 }];
    }
    if (Math.abs(c1.y - c2.y) > 1) {
      const m = -(c1.x - c2.x) / (c1.y - c2.y);
      const aa = (c1.y * c1.y - c2.y * c2.y + c1.x * c1.x - c2.x * c2.x -
        c1.r * c1.r + c2.r * c2.r) / (2 * (c1.y - c2.y));
      const q = m * m + 1;
      const bb = m * (aa - c1.y) - c1.x;
      const cc = (aa - c1.y) * (aa - c1.y) + c1.x * c1.x - c1.r * c1.r;
      const disc = bb * bb - q * cc;
      if (disc < 0) return null;
      const s = Math.sqrt(disc);
      const x0 = (-bb + s) / q, x1 = (-bb - s) / q;
      return [{ x: x0, y: m * x0 + aa }, { x: x1, y: m * x1 + aa }];
    }
    return [{ x: c1.x, y: c1.y }, { x: c1.x, y: c1.y }];
  }

  /** A circle of radius r above both parents (or below both, for the hints). */
  function tangentToTwo(c1, c2, down) {
    const pts = offsets(circle(c1, 2 * c1.r), circle(c2, 2 * c2.r));
    if (!pts) return null;
    const e1 = circle(c1, 2 * c1.r);
    const useFirst = down ? pts[0].y > e1.y : pts[0].y < e1.y;
    return circle(useFirst ? pts[0] : pts[1], c1.r);
  }

  /** A circle of radius r resting on the vertical wall at x, above its parent. */
  function tangentToWall(x, c) {
    // GeoSDoub.IntersectX for the vertical line (x,0)-(x,200).
    const R = 2 * c.r;
    const bb = -c.y;
    const cc = (x - c.x) * (x - c.x) + c.y * c.y - R * R;
    const disc = bb * bb - cc;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const y0 = -bb + s, y1 = -bb - s;
    return circle({ x: x, y: y0 < c.y ? y0 : y1 }, c.r);
  }

  /** The applet's CheckCrossing: a new bottle that overlaps an older pair is rebuilt. */
  function checkCrossing(candidate, older, partner) {
    if (candidate && offsets(candidate, older)) {
      return tangentToTwo(older, partner, false);
    }
    return candidate;
  }

  /** The applet's CheckCrossing2: H is lifted onto C when the two overlap. */
  function checkCrossing2(candidate, other) {
    if (candidate && offsets(candidate, other)) {
      candidate.y = other.y - 2 * candidate.r;
    }
    return candidate;
  }

  /*
   * The whole stack, transcribed from BallsInJarCanvas.Compute. Returns null
   * where the applet's Compute throws and catches (it keeps the old drawing);
   * the page leaves its last good picture on the board in that case.
   */
  function stack(state) {
    const r = state.r;
    const cA = circle(state.A, r), cB = circle(state.B, r), cC = circle(state.C, r);
    let cD = tangentToTwo(cA, cB, false);
    if (!cD) return null;
    let cE = tangentToTwo(cB, cC, false);
    if (!cE) return null;

    let cF = tangentToWall(P1.x + r, cD);
    if (!cF) return null;
    cF = checkCrossing(cF, cA, cD);
    if (!cF) return null;

    let cG = tangentToTwo(cD, cE, false);
    if (!cG) return null;
    cG = cG.x > state.B.x ? checkCrossing(cG, cB, cE) : checkCrossing(cG, cB, cD);
    if (!cG) return null;

    let cH = tangentToWall(P2.x - r, cE);
    if (!cH) return null;
    cH = checkCrossing2(cH, cC);

    const cI = tangentToTwo(cF, cG, false);
    const cJ = tangentToTwo(cG, cH, false);
    if (!cI || !cJ) return null;

    let cK = tangentToWall(P1.x + r, cI);
    if (!cK) return null;
    cK = checkCrossing(cK, cF, cI);
    if (!cK) return null;

    const cL = tangentToTwo(cI, cJ, false);
    if (!cL) return null;

    let cM = tangentToWall(P2.x - r, cJ);
    if (!cM) return null;
    cM = checkCrossing(cM, cH, cJ);
    if (!cM) return null;

    const cIL = tangentToTwo(cI, cL, true);
    const cJL = tangentToTwo(cJ, cL, true);
    const dKL = Math.abs(cK.y - cL.y);
    const dML = Math.abs(cM.y - cL.y);

    return {
      circles: {
        A: cA, B: cB, C: cC, D: cD, E: cE, F: cF, G: cG, H: cH,
        I: cI, J: cJ, K: cK, L: cL, M: cM,
      },
      hints: { IL: cIL, JL: cJL },
      dKL: dKL,
      dML: dML,
      showIL: dML > dKL + 1,
      showJL: dKL > dML + 1,
      showAll: dML <= dKL + 1 && dKL <= dML + 1,
      FAtWall: Math.abs(cF.x - (P1.x + r)) < 1e-9,
      HAtWall: Math.abs(cH.x - (P2.x - r)) < 1e-9,
    };
  }

  /** A one-line report of what the drawing shows; used by the page's status. */
  function report(figure) {
    if (!figure) return "This size cannot hold the stack. Move B or change the bottle size.";
    const f = figure;
    if (f.showIL) return "K and L are the nearly level pair; M sits lower. The rack claims all three are level.";
    if (f.showJL) return "L and M are the nearly level pair; K sits higher. The rack claims all three are level.";
    return "K, L and M are level: all three tops sit on one horizontal line.";
  }

  return {
    WIDTH: WIDTH, HEIGHT: HEIGHT, P1: P1, P2: P2,
    PERCENT_MIN: PERCENT_MIN, PERCENT_MAX: PERCENT_MAX,
    radius: radius, percentOfRadius: percentOfRadius, pushBFrom: pushBFrom,
    bottom: bottom, start: start, withPercent: withPercent, withB: withB,
    offsets: offsets, tangentToTwo: tangentToTwo, tangentToWall: tangentToWall,
    checkCrossing: checkCrossing, checkCrossing2: checkCrossing2,
    stack: stack, report: report, dist: dist,
  };
})();
