"use strict";

/*
 * Inversion Demo, from Alexander Bogomolny's Java applet InversionDemo.
 *
 * The drawing has a circle of inversion (centre O, passing through A) and a
 * stack of coloured circles, each given by its centre C and a point B on its
 * rim. For every coloured circle the applet draws its image in the inversion:
 * a circle becomes another circle, or a straight line if it passes through O.
 *
 * Everything here is geometry and state: no document, no window, no storage.
 * It defines one global, InversionDemoCore, so a page loads it with a plain
 * <script> and porting/check-inversion-demo.mjs loads it in Node. The position
 * is plain data, so the player's record can save it as it stands.
 *
 * Formulae are transcribed from the applet's own classes in classes.zip:
 *   InversionDemoCanvas.init / Add / Remove / Draw,
 *   InvLine.InvertCinC, InvLine.TangentAt, Inversion.Invert,
 *   DoubCircle.GetRadius and MoveableCircle.GetRadius / UpdateLocation.
 * In particular, InvLine switches to a straight line when |OP^2 - r^2| <= 100:
 * that is a drawing tolerance, and it is kept here exactly as in the applet.
 */

const InversionDemoCore = (() => {
  /* The archived page embeds the applet with WIDTH=600, HEIGHT=450. */
  const VIEW = Object.freeze({ width: 600, height: 450 });
  const EPS = 100;          // InvLine's |power| cut-off, in square board units
  const COLORS = Object.freeze([
    "#cc3333", "#339933", "#333399", "#cc3333", "#00b200",
    "#0000ff", "#ff0000", "#b27a7a", "#ff00ff", "#b28c00",
  ]);

  /*
   * InversionDemoCanvas.init(): cx = width/2, cy = height/2,
   * s = min(width, height)/4; O = (cx*4/7, cy), A = (cx/6, cy).
   */
  const START = Object.freeze({
    O: Object.freeze({ x: (VIEW.width / 2) * (4 / 7), y: VIEW.height / 2 }),
    A: Object.freeze({ x: VIEW.width / 12, y: VIEW.height / 2 }),
  });

  const copy = (p) => ({ x: p.x, y: p.y });
  const sqDist = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const dist = (a, b) => Math.sqrt(sqDist(a, b));

  /** The starting picture: the inversion circle and no coloured circles. */
  function start() {
    return { O: copy(START.O), A: copy(START.A), circles: [], touches: 0 };
  }

  /** True for the applet's two inversion-circle handles and each C/B pair. */
  function isHandle(name, state) {
    const s = state || start();
    if (name === "O" || name === "A") return true;
    const m = /^([CB])(\d+)$/.exec(name || "");
    return Boolean(m && Number(m[2]) < s.circles.length);
  }

  /*
   * Mover.IsHit stores the grab offset and UpdateLocation adds it back, so a
   * dragged point follows the cursor without snapping. Here the point simply
   * goes to p; the page supplies the offset through Geom's pointer handling
   * and clamps a dragged dot to the board so it stays reachable on a phone.
   */
  function moveVertex(state, name, p) {
    if (!isHandle(name, state) || !p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return state;
    const next = { O: copy(state.O), A: copy(state.A),
      circles: state.circles.map((c) => ({ C: copy(c.C), B: copy(c.B), color: c.color })),
      touches: state.touches + 1 };
    if (name === "O" || name === "A") next[name] = copy(p);
    else {
      const m = /^([CB])(\d+)$/.exec(name);
      next.circles[Number(m[2])][m[1]] = copy(p);
    }
    return next;
  }

  /* MoveableCircle.UpdateLocation: centre and rim translate together. */
  function moveCircle(state, index, center) {
    if (!Number.isInteger(index) || index < 0 || index >= state.circles.length) return state;
    if (!center || !Number.isFinite(center.x) || !Number.isFinite(center.y)) return state;
    const old = state.circles[index];
    const shift = { x: center.x - old.C.x, y: center.y - old.C.y };
    const next = moveVertex(state, "C" + index, center);
    next.circles[index].B = { x: old.B.x + shift.x, y: old.B.y + shift.y };
    return next;
  }

  /*
   * InversionDemoCanvas.Add(), with Math.random supplied by the caller so a
   * test can replay the applet's exact sequence. Radius = 50 + 50*rand,
   * angle = PI*rand, centre = s + rand*(size - 2s) in x and y, s = min/5.
   */
  function addCircle(state, rand) {
    const random = typeof rand === "function" ? rand : Math.random;
    const n = state.circles.length;
    const s = Math.min(VIEW.width, VIEW.height) / 5;
    const d = 2 * s;
    const radius = 50 + random() * (100 - 50);
    const angle = random() * Math.PI;
    const C = {
      x: s + random() * (VIEW.width - d),
      y: s + random() * (VIEW.height - d),
    };
    const B = { x: C.x + radius * Math.cos(angle), y: C.y + radius * Math.sin(angle) };
    const next = { O: copy(state.O), A: copy(state.A),
      circles: state.circles.map((c) => ({ C: copy(c.C), B: copy(c.B), color: c.color })),
      touches: state.touches };
    next.circles.push({ C, B, color: COLORS[n % COLORS.length] });
    return next;
  }

  /** Stack.pop(): remove the last circle; an empty stack stays empty. */
  function removeCircle(state) {
    if (!state.circles.length) return state;
    const next = { O: copy(state.O), A: copy(state.A),
      circles: state.circles.slice(0, -1).map((c) => ({ C: copy(c.C), B: copy(c.B), color: c.color })),
      touches: state.touches };
    return next;
  }

  function inversionCircle(state) {
    return { center: copy(state.O), radius: dist(state.O, state.A) };
  }

  function targetCircle(circle) {
    return { center: copy(circle.C), radius: dist(circle.C, circle.B) };
  }

  /* Inversion.Invert(DoubCircle, DoubPoint): r^2 / |p-O|^2 along O->p. */
  function invertPoint(center, power, p) {
    const d = dist(center, p);
    if (!(d > 1e-12)) return null; // the centre itself has no image
    const k = (power / d) / d;
    return { x: center.x + k * (p.x - center.x), y: center.y + k * (p.y - center.y) };
  }

  /*
   * InvLine.InvertCinC(DoubCircle, boolean). The boolean is false in the
   * applet, which fixes the sign at +1. The line branch inverts the point of
   * the source circle diametrically opposite O and takes the tangent at that
   * inverted point to the circle of inversion (InvLine.TangentAt).
   */
  function invertCircle(center, power, target) {
    const r = target.radius;
    const d = sqDist(center, target.center) - r * r;
    if (Math.abs(d) > EPS) {
      const k = power / d;
      return {
        kind: "circle",
        center: { x: center.x + (target.center.x - center.x) * k,
                  y: center.y + (target.center.y - center.y) * k },
        radius: r * Math.abs(k),
      };
    }
    const antipode = { x: 2 * target.center.x - center.x, y: 2 * target.center.y - center.y };
    const q = invertPoint(center, power, antipode);
    if (!q) return { kind: "line", point: null, direction: null };
    return {
      kind: "line",
      point: q,
      direction: { x: 100 * (q.y - center.y), y: 100 * (center.x - q.x) },
    };
  }

  /** Everything the page needs to draw and describe. */
  function geometry(state) {
    const inversion = inversionCircle(state);
    const power = inversion.radius * inversion.radius;
    return {
      inversion,
      power,
      items: state.circles.map((circle, i) => {
        const source = targetCircle(circle);
        const d = sqDist(inversion.center, source.center) - source.radius * source.radius;
        return {
          index: i,
          color: circle.color,
          source,
          d,
          orthogonal: Math.abs(d - power) < 1e-6,
          image: invertCircle(inversion.center, power, source),
        };
      }),
    };
  }

  /** A plain-language line under the picture; this illustration has no end. */
  function status(state, info) {
    const g = info || geometry(state);
    if (!g.items.length) {
      return "No coloured circles yet. Press Add circle to make one appear with its image.";
    }
    const lines = g.items.filter((item) => item.image.kind === "line").length;
    const still = g.items.filter((item) => item.orthogonal).length;
    const parts = [];
    if (lines) parts.push(`${lines} image${lines === 1 ? " is a straight line" : "s are straight lines"}`);
    if (still) parts.push(`${still} circle${still === 1 ? " keeps" : "s keep"} its own shape`);
    if (!parts.length) parts.push("each image is another circle");
    return `${g.items.length} coloured circle${g.items.length === 1 ? "" : "s"}: ${parts.join("; ")}. ` +
      "Drag a dot or a circle to change the picture.";
  }

  /** An illustration: there is no win, loss or end. */
  function result() {
    return null;
  }

  return {
    VIEW, EPS, COLORS, START,
    start, isHandle, moveVertex, moveCircle, addCircle, removeCircle,
    inversionCircle, targetCircle, invertPoint, invertCircle, geometry, status, result,
    sqDist, dist,
  };
})();
