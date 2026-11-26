"use strict";

/*
 * Sine of the Sum Formula, from Alexander Bogomolny's applet SineInRhombus:
 * the proof without words by Volker Priebe and Edgar A. Ramos.
 *
 * A rhombus with sides of length 1 sits in a rectangle, one vertex on each
 * side. It cuts off two pairs of equal right triangles, with acute angles
 * alpha and beta, so the corners split the rectangle's sides into pieces
 * cos(alpha), sin(alpha), cos(beta), sin(beta). The rhombus's angle is
 * alpha + beta, so its area is sin(alpha + beta). Moving the four triangles
 * into two corners of the same rectangle leaves two empty rectangles,
 * sin(alpha) cos(beta) and cos(alpha) sin(beta): the formula
 *   sin(alpha + beta) = sin(alpha) cos(beta) + cos(alpha) sin(beta).
 *
 * Coordinates are in units of the rhombus's side, y pointing up, the
 * rectangle from (0, 0) to (W, H) with W = cos a + cos b, H = sin a + sin b.
 * Rhombus: bottom (cos b, 0), right (W, sin a), top (cos a, H), left
 * (0, sin b); from the bottom vertex one side rises at alpha to the right,
 * the other at beta to the left. The applet starts with sides at 72 and 45
 * degrees and lets you drag the vertices; here the two angles, whole
 * degrees 1..89, are the position.
 *
 * This file is the game's logic and nothing else. It defines one global,
 * SineOfSumCore. The position is plain data.
 */
const SineOfSumCore = (() => {
  const MIN = 1, MAX = 89;
  const clamp = (v, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(MIN, Math.min(MAX, n)) : d; };
  const rad = (d) => (d * Math.PI) / 180;

  function start(options = {}) {
    return { alpha: clamp(options.alpha ?? 72, 72), beta: clamp(options.beta ?? 45, 45), labels: !!options.labels, angles: !!options.angles };
  }

  function setAngles(s, alpha, beta) {
    return { ...s, alpha: clamp(alpha, s.alpha), beta: clamp(beta, s.beta) };
  }

  /** Both figures: the rhombus with its four triangles, and the rearrangement. */
  function figures(s) {
    const ca = Math.cos(rad(s.alpha)), sa = Math.sin(rad(s.alpha));
    const cb = Math.cos(rad(s.beta)), sb = Math.sin(rad(s.beta));
    const W = ca + cb, H = sa + sb;
    const B = [cb, 0], R = [W, sa], T = [ca, H], L = [0, sb];
    const left = {
      W, H,
      rhombus: [B, R, T, L],
      triangles: [
        { kind: "alpha", pts: [B, [W, 0], R] },
        { kind: "beta", pts: [R, [W, H], T] },
        { kind: "alpha", pts: [T, [0, H], L] },
        { kind: "beta", pts: [L, [0, 0], B] },
      ],
    };
    // Right: the alpha triangles fill the cos a x sin a corner at the bottom
    // left, the beta triangles the cos b x sin b corner at the top right.
    const right = {
      W, H,
      triangles: [
        { kind: "alpha", pts: [[0, 0], [ca, 0], [ca, sa]] },
        { kind: "alpha", pts: [[0, 0], [0, sa], [ca, sa]] },
        { kind: "beta", pts: [[ca, sa], [W, sa], [W, H]] },
        { kind: "beta", pts: [[ca, sa], [ca, H], [W, H]] },
      ],
      empty: [
        { name: "sin a cos b", pts: [[ca, 0], [W, 0], [W, sa], [ca, sa]], w: cb, h: sa },
        { name: "cos a sin b", pts: [[0, sa], [ca, sa], [ca, H], [0, H]], w: ca, h: sb },
      ],
    };
    return { ca, sa, cb, sb, left, right };
  }

  const area = (p) => Math.abs(p.reduce((t, q, i) => t + q[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * q[1], 0)) / 2;

  /** The numbers the page writes: the rhombus's area and the two rectangles. */
  function values(s) {
    const f = figures(s);
    return {
      sinSum: Math.sin(rad(s.alpha + s.beta)),
      rhombus: area(f.left.rhombus),
      sinAcosB: f.sa * f.cb,
      cosAsinB: f.ca * f.sb,
      rhombusAngle: s.alpha + s.beta,
    };
  }

  return { MIN, MAX, start, setAngles, figures, values, area };
})();
