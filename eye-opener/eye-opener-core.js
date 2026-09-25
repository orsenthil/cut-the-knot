"use strict";

/*
 * Pure geometry for The Eye Opener (99 = 100), ported from the decompiled
 * cheater.java of tricky.zip (Alexander Bogomolny, cut-the-knot.org).
 * No DOM, so it can be checked in Node.
 *
 * Units are grid squares, with y pointing down. The grey rectangle is
 * (n+1) wide and (n-1) tall with its top-left corner at (0, 0), and the target
 * square is n by n with its top-left corner at (1, -1). A staircase with n
 * steps cuts the rectangle into an upper and a lower piece. Each step is only
 * (n-1)/n of a square tall, so it does not follow the grid lines.
 *
 * Moving the upper piece right by 1 and up by one step, (n-1)/n, makes the
 * stairs mesh exactly, but leaves its top 1/n of a square short of the
 * square's top edge. The original applet hides that gap: once the piece is
 * lifted far enough (CheatHere), it silently stretches the piece's top edge
 * by 1/n. A strip n squares wide and 1/n tall is exactly one extra square.
 */
const EyeOpener = (() => {
  const MIN_N = 5;
  const MAX_N = 25;
  const SNAP = 0.2; // how close (in squares) counts as "fitted"

  function step(n) {
    return (n - 1) / n;
  }

  // Where the upper piece fits: one square right, one step up.
  function target(n) {
    return { dx: 1, dy: -step(n) };
  }

  // How much the top edge is stretched when the piece is lifted by dy.
  // The applet adds nothing until the piece is a third of a square up and the
  // full 1/n once it is two thirds up; in between it grows (by a pixel or so
  // in the original), which we make a smooth ramp.
  function cheat(n, dy) {
    const full = 1 / n;
    if (dy >= -1 / 3) return 0;
    if (dy <= -2 / 3) return full;
    return full * ((-1 / 3 - dy) / (1 / 3));
  }

  // Lower piece: fixed. Points go clockwise from the bottom of column 1.
  function lowerPolygon(n) {
    const H = n - 1;
    const h = step(n);
    const pts = [];
    let y = H;
    for (let j = 0; j < n; j++) {
      pts.push([j + 1, y]);
      y = H - (j + 1) * h;
      pts.push([j + 1, y]);
    }
    pts.push([n + 1, y], [n + 1, H], [1, H]);
    return pts;
  }

  // Upper piece moved by (dx, dy) with its top edge raised by c.
  function upperPolygon(n, dx, dy, c) {
    const H = n - 1;
    const h = step(n);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const y = H - i * h;
      pts.push([i, y], [i + 1, y]);
    }
    pts.push([n, -c], [0, -c], [0, H]);
    return pts.map(([x, y]) => [x + dx, y + dy]);
  }

  function area(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      s += x1 * y2 - x2 * y1;
    }
    return Math.abs(s) / 2;
  }

  // Snap the piece into place when it is close to where it fits.
  function snap(n, dx, dy) {
    const t = target(n);
    if (Math.abs(dx - t.dx) < SNAP && Math.abs(dy - t.dy) < SNAP) return { dx: t.dx, dy: t.dy, fitted: true };
    return { dx, dy, fitted: false };
  }

  function clampN(n) {
    return Math.max(MIN_N, Math.min(MAX_N, n));
  }

  return { MIN_N, MAX_N, step, target, cheat, lowerPolygon, upperPolygon, area, snap, clampN };
})();
