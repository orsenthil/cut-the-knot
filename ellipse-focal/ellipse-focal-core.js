"use strict";

/*
 * Ellipse Focal, from Alexander Bogomolny's applet EllipseFocal.
 *
 * The page's claim is that an ellipse is the locus of points P whose two
 * focal distances add to the same number: PF + PF' = const. This core holds
 * the four draggable rectangle corners and the point P. The ellipse is the
 * one inscribed in that rectangle; its foci are found from the two half-widths
 * with c = sqrt(a^2 - b^2), and the applet's own Compute method lays out a
 * broken bar A-S-B whose two pieces have exactly the lengths PF and PF'.
 *
 * This file is the logic and nothing else: no document, no window, no
 * storage. It defines one global, EllipseFocalCore, so the page loads it with
 * a plain <script> and porting/check-ellipse-focal.mjs loads it in Node.
 * Functions take plain data and return new positions; they do not mutate
 * what they are given.
 */
const EllipseFocalCore = (() => {
  /* The applet's own canvas size and its Margin field (EllipseFocalCanvas). */
  const WIDTH = 400;
  const HEIGHT = 300;
  const MARGIN = 20;
  /* CTKEllipse puts its reference point at (Center.x + 200, Center.y). */
  const REACH = 200;

  const sqDist = (p, q) => (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y);
  const dist = (p, q) => Math.sqrt(sqDist(p, q));
  const finite = (p) => Number.isFinite(p.x) && Number.isFinite(p.y);
  const copy = (p) => ({ x: p.x, y: p.y });

  /** The position the applet's init() makes, at EllipseAt(-3*pi/4). */
  function start() {
    const corners = [
      { x: WIDTH / 4, y: (3 * HEIGHT) / 4 },
      { x: (3 * WIDTH) / 4, y: (3 * HEIGHT) / 4 },
      { x: (3 * WIDTH) / 4, y: HEIGHT / 4 },
      { x: WIDTH / 4, y: HEIGHT / 4 },
    ];
    const g = geometry({ corners });
    return { corners, p: ellipseAt(g, -3 * Math.PI / 4) };
  }

  /** CTKEllipse's constructor and EllipseUpdated(): centre, half-widths A and B. */
  function geometry(state) {
    const v = state.corners;
    return {
      center: { x: (v[0].x + v[1].x) / 2, y: (v[1].y + v[2].y) / 2 },
      A: (v[1].x - v[0].x) / 2,
      B: (v[1].y - v[2].y) / 2,
    };
  }

  /** CTKEllipse.EllipseAt(t). */
  function ellipseAt(g, t) {
    return { x: g.center.x + g.A * Math.cos(t), y: g.center.y + g.B * Math.sin(t) };
  }

  /** GeoSDoub.FindOrientation(a, b, c): +1 left of the line, -1 otherwise. */
  function findOrientation(a, b, c) {
    const turn = c.x * (a.y - b.y) + c.y * (b.x - a.x) + a.x * b.y - b.x * a.y;
    return turn > 0 ? 1 : -1;
  }

  /** GeoSDoub.ComputeSignedAngle(a, b, c) - used by KeepOnEllipse. */
  function signedAngle(a, b, c) {
    const cosine = (sqDist(a, b) + sqDist(a, c) - sqDist(b, c)) /
      (2 * dist(a, b) * dist(a, c));
    const theta = Math.acos(cosine);
    return findOrientation(a, b, c) === 1 ? theta : -theta;
  }

  /** CTKEllipse.KeepOnEllipse: snap a raw drag onto the curve. */
  function keepOnEllipse(g, p) {
    /* The applet passes these normalized offsets as if they were a point. */
    const q = { x: (p.x - g.center.x) / g.A, y: (p.y - g.center.y) / g.B };
    const ref = { x: g.center.x + REACH, y: g.center.y };
    return ellipseAt(g, signedAngle(g.center, ref, q));
  }

  /** CTKEllipse.Foci: put the two foci on the longer half-axis. */
  function foci(g) {
    const aa = Math.abs(g.A), bb = Math.abs(g.B);
    const big = aa > bb ? aa : bb;
    const small = aa > bb ? bb : aa;
    const horizontal = aa > bb;
    const c = Math.sqrt(big * big - small * small);
    if (Number.isNaN(c)) return null;
    if (horizontal) {
      return [{ x: g.center.x - c, y: g.center.y }, { x: g.center.x + c, y: g.center.y }];
    }
    return [{ x: g.center.x, y: g.center.y - c }, { x: g.center.x, y: g.center.y + c }];
  }

  /** The applet refuses corner drags that land within 10 px of the centre. */
  function pointIsGood(p) {
    return Math.abs(p.x - WIDTH / 2) > 10 && Math.abs(p.y - HEIGHT / 2) > 10;
  }

  /** CTKEllipse.MaintainRect followed by KeepAllOnEllipse(P). */
  function moveCorner(state, index, target) {
    if (!Number.isInteger(index) || index < 0 || index > 3) return state;
    if (!finite(target) || !pointIsGood(target)) return state;

    const old = geometry(state);
    const dx = old.center.x - target.x;
    const dy = old.center.y - target.y;
    const c = old.center;
    const v = state.corners.map(copy);
    v[index] = copy(target);
    if (index === 0) {
      v[1] = { x: c.x + dx, y: c.y - dy };
      v[2] = { x: c.x + dx, y: c.y + dy };
      v[3] = { x: c.x - dx, y: c.y + dy };
    } else if (index === 1) {
      v[0] = { x: c.x + dx, y: c.y - dy };
      v[2] = { x: c.x - dx, y: c.y + dy };
      v[3] = { x: c.x + dx, y: c.y + dy };
    } else if (index === 2) {
      v[0] = { x: c.x + dx, y: c.y + dy };
      v[1] = { x: c.x - dx, y: c.y + dy };
      v[3] = { x: c.x - dx, y: c.y - dy };
    } else {
      v[0] = { x: c.x - dx, y: c.y + dy };
      v[1] = { x: c.x + dx, y: c.y + dy };
      v[2] = { x: c.x + dx, y: c.y - dy };
    }
    const next = { corners: v, p: state.p };
    const snapped = keepOnEllipse(geometry(next), state.p);
    next.p = finite(snapped) ? snapped : state.p;
    return next;
  }

  /** CTKEllipse.KeepOnEllipse(P) on a drag of P. */
  function movePoint(state, target) {
    if (!finite(target)) return state;
    const snapped = keepOnEllipse(geometry(state), target);
    if (!finite(snapped)) return state;
    return { corners: state.corners.map(copy), p: snapped };
  }

  /**
   * EllipseFocalCanvas.Compute(): the two focal distances and the broken bar
   * A-S-B. AS has length d1 = PF, SB has length d2 = PF'. The bar is drawn
   * along the top when the rectangle is wider than it is tall and along the
   * left side otherwise, just as in the Java paint method.
   */
  function analyse(state) {
    const g = geometry(state);
    const f = foci(g);
    if (!f || !finite(state.p)) return null;
    const d1 = dist(f[0], state.p);
    const d2 = dist(f[1], state.p);
    const sum = d1 + d2;
    const horizontal = Math.abs(state.corners[0].y - state.corners[3].y) <
      Math.abs(state.corners[1].x - state.corners[0].x);
    const start = horizontal
      ? { x: (WIDTH - d1 - d2) / 2, y: MARGIN }
      : { x: MARGIN, y: (HEIGHT - d1 - d2) / 2 };
    const join = horizontal
      ? { x: start.x + d1, y: start.y }
      : { x: start.x, y: start.y + d1 };
    const end = horizontal
      ? { x: join.x + d2, y: join.y }
      : { x: join.x, y: join.y + d2 };
    return {
      g, foci: f, d1, d2, sum, horizontal,
      bar: { start, join, end },
      constant: 2 * Math.max(Math.abs(g.A), Math.abs(g.B)),
    };
  }

  /** The status line: no winning here, just the two lengths and their sum. */
  function describe(state) {
    const a = analyse(state);
    if (!a) return "The ellipse is too small to measure.";
    const round = (n) => n.toFixed(2);
    return `PF = ${round(a.d1)}, PF' = ${round(a.d2)}, so PF + PF' = ${round(a.sum)}. ` +
      `The two coloured pieces of the bar add to the same ${round(a.sum)}.`;
  }

  return {
    WIDTH, HEIGHT, MARGIN, REACH,
    start, geometry, ellipseAt, signedAngle, keepOnEllipse, foci,
    pointIsGood, moveCorner, movePoint, analyse, describe, dist,
  };
})();
