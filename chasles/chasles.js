"use strict";

/*
 * The page for Chasles: drawing and input only; the mathematics is in
 * chasles-core.js. The SVG holds an ellipse inside a dashed bounding box, six
 * draggable points on it and the hexagon they form. The blue line is PQ: the
 * crossings P, Q, R and S mark the Pascal line, L and M are where it cuts the
 * conic, and T is where it meets AD. Four small corner handles resize the
 * ellipse exactly as the applet's draggable rectangle corners do.
 */

(function () {
  const Core = ChaslesCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");

  const view = board.viewBox;
  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = Core.start();
  let explored = false;

  const box = board.polygon(state.corners, "bbox", guides);
  const ellipse = board.el("ellipse", null, "conic", guides);
  const sides = Core.NAMES.map((_, i) =>
    board.segment(state.points[Core.NAMES[i]], state.points[Core.NAMES[(i + 1) % 6]], "side", shapes));
  const pascal = board.line(state.points.A, state.points.B, "pascal", shapes);
  const aux = board.line(state.points.A, state.points.D, "aux", shapes);
  const dots = {};
  for (const nm of ["P", "Q", "R", "S", "T", "L", "M"]) {
    dots[nm] = board.point(state.points.A, nm === "L" || nm === "M" ? "end-dot" : "aux-dot", 4, marks);
  }
  const texts = {};
  for (const nm of [...Core.NAMES, "P", "Q", "R/S", "T", "L", "M"]) {
    texts[nm] = board.label(state.points.A, nm, "glabel", 8, -8, labels);
  }

  /** The status line: a demo has no win or loss, just "done" once explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function fmt(v) {
    return Number.isFinite(v) ? v.toFixed(3) : "—";
  }

  function render() {
    const g = Core.compute(state);
    const cl = Core.claims(state);
    const p = state.points;

    box.set(state.corners);
    const el = state.ellipse;
    ellipse.setAttribute("cx", el.cx);
    ellipse.setAttribute("cy", el.cy);
    ellipse.setAttribute("rx", Math.abs(el.a));
    ellipse.setAttribute("ry", Math.abs(el.b));

    Core.NAMES.forEach((nm, i) => {
      sides[i].set(p[nm], p[Core.NAMES[(i + 1) % 6]]);
    });
    pascal.show(Boolean(g.line));
    if (g.line) pascal.set(g.P, g.Q);
    aux.set(p.A, p.D);

    for (const nm of ["P", "Q", "R", "S", "T", "L", "M"]) {
      const on = Boolean(g[nm]) && Number.isFinite(g[nm].x) && Number.isFinite(g[nm].y);
      dots[nm].show(on);
      if (on) dots[nm].set(g[nm]);
    }
    for (const nm of Core.NAMES) {
      texts[nm].show(state.showNames);
      if (state.showNames) texts[nm].set(p[nm]);
    }
    for (const nm of ["P", "Q", "T", "L", "M"]) {
      texts[nm].show(state.showNames && Boolean(g[nm]));
      if (state.showNames && g[nm]) texts[nm].set(g[nm]);
    }
    const r = Number.isFinite(g.R) ? g.R : p.E;
    texts["R/S"].show(state.showNames && Number.isFinite(g.R));
    if (state.showNames && Number.isFinite(g.R)) texts["R/S"].set(r);

    if (pointHandles) {
      for (const nm of Core.NAMES) pointHandles[nm].set(p[nm]);
    }
    if (cornerHandles) {
      state.corners.forEach((c, i) => cornerHandles[i].set(c));
    }

    const line = g.line;
    const cr = line
      ? Core.crossRatioLine(g.L, g.Q, g.R, g.M)
      : NaN;
    if (!cl.regular) {
      say("Move the points apart so the lines meet, then watch the crossings again.", null);
    } else if (explored) {
      say(`R and S are the same point: the three crossings lie on one line. ` +
        `The cross-ratio is ${fmt(cr)} from either fifth point.`, "done");
    } else {
      say("Drag A, B, C, D, E or F along the ellipse, or a small corner dot to change its shape. R and S always meet.", null);
    }
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  const inside = (q) => ({
    x: Geom.clamp(q.x, view.x + 10, view.x + view.width - 10),
    y: Geom.clamp(q.y, view.y + 10, view.y + view.height - 10),
  });

  /** The four box corners stay in their own quarter of the centre cross. */
  function clampCorner(q, name) {
    const i = Number(name.slice(1));
    const p = inside(q);
    const cx = state.ellipse.cx, cy = state.ellipse.cy;
    const m = 14;
    if (i === 0) return { x: Math.min(p.x, cx - m), y: Math.max(p.y, cy + m) };
    if (i === 1) return { x: Math.max(p.x, cx + m), y: Math.max(p.y, cy + m) };
    if (i === 2) return { x: Math.max(p.x, cx + m), y: Math.min(p.y, cy - m) };
    return { x: Math.min(p.x, cx - m), y: Math.min(p.y, cy - m) };
  }

  let pointHandles = null;
  let cornerHandles = null;

  cornerHandles = state.corners.map((c, i) => board.handle("V" + i, c, {
    r: 5.5, step: 3, shift: 12, cls: "geom-handle corner-handle", layer: handlesLayer,
    clamp: clampCorner,
    label: `Box corner ${i}. Drag, or focus and use the arrow keys, to change the ellipse.`,
    describe: (q) => `at ${Math.round(q.x)}, ${Math.round(q.y)}`,
    onMove: (q) => { state = Core.withCorner(state, i, q); explored = true; render(); },
  }));

  pointHandles = {};
  for (const nm of Core.NAMES) {
    pointHandles[nm] = board.handle(nm, state.points[nm], {
      r: 7, step: 3, shift: 12, layer: handlesLayer,
      clamp: (q) => Core.withPoint(state, nm, inside(q)).points[nm],
      label: `Point ${nm}. Drag along the ellipse, or focus and use the arrow keys.`,
      describe: (q) => `at ${Math.round(q.x)}, ${Math.round(q.y)}`,
      onMove: (q) => { state = Core.withPoint(state, nm, q); explored = true; render(); },
    });
  }

  function reset() {
    const showNames = state.showNames; // the applet's checkbox keeps its setting
    state = Core.withNames(Core.start(), showNames);
    explored = false;
    namesBtn.setAttribute("aria-pressed", String(showNames));
    namesBtn.textContent = showNames ? "Hide names" : "Show names";
    render();
    pointHandles.A.node.focus();
  }

  function toggleNames() {
    state = Core.withNames(state, !state.showNames);
    explored = true;
    namesBtn.setAttribute("aria-pressed", String(state.showNames));
    namesBtn.textContent = state.showNames ? "Hide names" : "Show names";
    render();
  }

  newBtn.addEventListener("click", reset);
  namesBtn.addEventListener("click", toggleNames);
  document.addEventListener("keydown", (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === "r" || e.key === "R") reset();
    if (e.key === "n" || e.key === "N") toggleNames();
  });
  board.onTheme(render);
  render();
})();
