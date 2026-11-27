"use strict";

/*
 * Euclid's proof of the Pythagorean theorem, as in Alexander Bogomolny's
 * applet "euclid" (classes/euclid.zip, pyTriangle.java).
 *
 * A right triangle has vertices tr0 = (120, 270), tr1 = (120, 180) and
 * tr2 = (300, 270): legs 90 and 180, right angle at tr0. A fourth, moving
 * point m joins tr1 and tr2 to make a triangle on the sloping side. Two more
 * triangles are built on the legs by the applet's own maps: about tr2 a
 * reflection scaled by c = cos(pi/6 - 0.06), and about tr1 a rotation scaled
 * by s = sin(pi/6 - 0.06). The three triangles are nearly similar copies of
 * one another, with area scales c^2, s^2 and 1.
 *
 * The applet rounds each constructed vertex to whole pixels, computes each
 * area by Heron's formula, rounds the number with (int)(area + 0.5), and —
 * as a leftover quirk — adds 45 whenever the second displayed number ends in
 * 5. All of that is kept here: the page's two suggestive configurations have
 * displayed numbers that add up, but most positions do not.
 *
 * This file is the game's logic and nothing else: no document, no window,
 * no storage. It defines one global, EuclidCore, so the page loads it with a
 * plain <script> and the logic test loads it in Node. Positions are plain
 * data and every function returns a new position.
 */
const EuclidCore = (() => {
  // The applet's init(): a 400x400 canvas, mouseStep = 2, corner (120, 270),
  // and three mouseTracker eye boxes (x, y, width, height).
  const APPLET = { width: 400, height: 400, mouseStep: 2 };
  const CORNER = { x: 120, y: 270 };
  const TRIANGLE = [
    { x: 120, y: 270 },
    { x: 120, y: 180 },
    { x: 300, y: 270 },
  ];
  const EYES = [
    { x: 30, y: 20, w: 40, h: 20 },
    { x: 350, y: 80, w: 40, h: 20 },
    { x: 200, y: 10, w: 60, h: 30 },
  ];
  const THETA = Math.PI / 6 - 0.06; // the applet's draw(): 0.5235987755982988 - 0.06
  const S = Math.sin(THETA);
  const C = Math.cos(THETA);

  // The page shows two configurations. The first is the moving point at the
  // right-angle corner; the second is the fold-in view captured in the
  // applet's own fallback picture (a point on the parallel line through
  // (140, 92)), where the displayed areas read 7020, 1800 and 8820.
  const PRESETS = {
    corner: { x: 120, y: 270 },
    fold: { x: 140, y: 92 },
  };

  const pt = (x, y) => ({ x, y });
  const clone = (p) => pt(p.x, p.y);

  /** A Java (int) cast: truncate toward zero, and NaN becomes zero. */
  function javaInt(v) {
    return Number.isNaN(v) ? 0 : Math.trunc(v);
  }

  /** mouseDragged: x -= x % mouseStep, with Java's truncation of negatives. */
  function snap(v) {
    return Math.trunc(v / APPLET.mouseStep) * APPLET.mouseStep;
  }

  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  /** pyTriangle.Area(): the Heron formula the page describes. */
  function heron(a, b, c) {
    const ab = distance(a, b);
    const ac = distance(a, c);
    const cb = distance(c, b);
    const p = (ab + ac + cb) / 2;
    return Math.sqrt(p * (p - ab) * (p - ac) * (p - cb));
  }

  /** The moving point that starts the picture: pyTriangle's m_Mouse = tr1. */
  function start() {
    return { mouse: clone(TRIANGLE[1]) };
  }

  /** Drag to a new moving point, snapped exactly as the applet snaps it. */
  function withMouse(state, x, y) {
    return { mouse: pt(snap(x), snap(y)) };
  }

  /** Jump to one of the two configurations the page points out. */
  function preset(name) {
    const at = PRESETS[name];
    return at ? withMouse(start(), at.x, at.y) : start();
  }

  /** The applet turns every eye "full" only when the point hits the corner. */
  function fullEyes(state) {
    return state.mouse.x === CORNER.x && state.mouse.y === CORNER.y;
  }

  /* pyTriangle.draw(), first derived vertex: about tr2, reflection x scale c. */
  function vertexOnLongLeg(m) {
    const t = TRIANGLE[2];
    const dx = m.x - t.x, dy = m.y - t.y;
    return pt(
      javaInt(t.x + C * (C * dx + S * dy)),
      javaInt(2 * t.y - (t.y + C * (-S * dx + C * dy)))
    );
  }

  /* pyTriangle.draw(), second derived vertex: about tr1, rotation x scale s. */
  function vertexOnShortLeg(m) {
    const t = TRIANGLE[1];
    const dx = m.x - t.x, dy = m.y - t.y;
    return pt(
      javaInt(2 * t.x - (t.x + S * (-S * dx + C * dy))),
      javaInt(t.y + S * (C * dx + S * dy))
    );
  }

  /** mouseTracker.draw(): three pairs of eyes look at the moving point. */
  function eyes(m, full) {
    return EYES.map((box) => {
      // Both radii are Java int divisions in mouseTracker's constructor.
      const r = Math.trunc(Math.min(box.w, box.h) / 2);
      const iris = Math.trunc(r / 2);
      const centers = [pt(box.x + r, box.y + r), pt(box.x + box.w - r, box.y + r)];
      return {
        r, iris, full,
        centers,
        irises: centers.map((center) => {
          if (full) return clone(center);
          const vx = m.x - center.x, vy = m.y - center.y;
          const len = Math.hypot(vx, vy);
          return pt(
            center.x + javaInt((vx / len) * (r - iris)),
            center.y + javaInt((vy / len) * (r - iris))
          );
        }),
      };
    });
  }

  /**
   * Everything the applet draws or displays for one position: the two
   * constructed vertices, the three areas by Heron, the three displayed
   * integers, and the eyes. Pure data, safe to hand to the tutor.
   */
  function figure(state) {
    const m = state.mouse;
    const long = vertexOnLongLeg(m);
    const short = vertexOnShortLeg(m);
    const areas = {
      long: heron(long, TRIANGLE[0], TRIANGLE[2]),
      short: heron(short, TRIANGLE[1], TRIANGLE[0]),
      hyp: heron(m, TRIANGLE[1], TRIANGLE[2]),
    };
    const shown = {
      long: javaInt(areas.long + 0.5),
      short: javaInt(areas.short + 0.5),
      hyp: javaInt(areas.hyp + 0.5),
    };
    // The applet's leftover quirk, straight from pyTriangle.draw().
    if (shown.short % 10 === 5) shown.short += 45;
    const full = fullEyes(state);
    return {
      mouse: clone(m),
      long, short,
      areas, shown,
      full,
      eyes: eyes(m, full),
    };
  }

  /**
   * The same three triangles without the applet's pixel truncation. This is
   * the geometry the page's claim is about; the logic test compares it with
   * the displayed numbers to show where the pixels and the quirk matter.
   */
  function ideal(state) {
    const m = state.mouse;
    const t2 = TRIANGLE[2], t1 = TRIANGLE[1];
    const dx2 = m.x - t2.x, dy2 = m.y - t2.y;
    const dx1 = m.x - t1.x, dy1 = m.y - t1.y;
    const long = pt(
      t2.x + C * (C * dx2 + S * dy2),
      t2.y + C * (S * dx2 - C * dy2)
    );
    const short = pt(
      t1.x + S * (S * dx1 - C * dy1),
      t1.y + S * (C * dx1 + S * dy1)
    );
    const areas = {
      long: heron(long, TRIANGLE[0], TRIANGLE[2]),
      short: heron(short, TRIANGLE[1], TRIANGLE[0]),
      hyp: heron(m, TRIANGLE[1], TRIANGLE[2]),
    };
    return { mouse: clone(m), long, short, areas };
  }

  return {
    APPLET, CORNER, TRIANGLE, EYES, THETA, S, C, PRESETS,
    pt, javaInt, snap, distance, heron,
    start, withMouse, preset, fullEyes, figure, ideal,
  };
})();
