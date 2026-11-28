"use strict";

/*
 * The page for Isogonal Tangents. All of the geometry lives in
 * isogonal-tangents-core.js; this file only draws it and takes input. Four
 * handles move the three rays (O and the three points U, V, W); the three
 * circle centres follow their angle bisectors exactly as the applet moves
 * them. The SVG shows the circles, the rays, the three second internal
 * tangents, their crossings with the rays (A, B, C) and their common point X.
 */

(function () {
  const Core = IsogonalTangentsCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const view = board.viewBox;

  const rayLayer = board.layer("rays");
  const circleLayer = board.layer("circles");
  const tangentLayer = board.layer("tangents");
  const markLayer = board.layer("marks");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  let state = Core.start({ width: view.width, height: view.height });
  let explored = false;
  const handles = {};

  const rays = {
    U: board.line(state.points.O, state.points.U, "ray", rayLayer),
    V: board.line(state.points.O, state.points.V, "ray", rayLayer),
    W: board.line(state.points.O, state.points.W, "ray", rayLayer),
  };
  const circles = {};
  for (const name of Core.CENTRES) {
    circles[name] = board.circle(state.points[name], 1, "circle", circleLayer);
  }
  const tangents = {};
  for (const name of ["QR", "RP", "PQ"]) {
    tangents[name] = board.line(state.points.O, state.points.O, "second-tangent", tangentLayer);
  }
  const dots = {};
  for (const name of ["A", "B", "C", "X"]) {
    dots[name] = board.point(state.points.O, name === "X" ? "meet-dot" : "cross-dot",
      name === "X" ? 6 : 4.5, markLayer);
  }
  const labels = {};
  for (const name of [...Core.NAMES, "A", "B", "C", "X"]) {
    labels[name] = board.label(state.points.O, name, "glabel", 12, -10, labelLayer);
  }

  /** The status line. An illustration is "done" once the player has explored it. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function finitePoint(p) { return Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y); }
  const fmt = (v) => Number.isFinite(v) ? v.toFixed(1) : "—";

  function render() {
    const g = Core.compute(state);
    const cl = Core.claims(state);
    const p = state.points;

    for (const name of ["U", "V", "W"]) rays[name].set(p.O, p[name]);
    for (const name of Core.CENTRES) {
      circles[name].set(g.circles[name], g.circles[name].r);
    }
    for (const name of ["QR", "RP", "PQ"]) {
      const ln = g.lines[name];
      tangents[name].show(Boolean(ln));
      if (ln) tangents[name].set(ln.a, ln.b);
    }
    for (const name of ["A", "B", "C"]) {
      const q = g.crossings[name];
      dots[name].show(finitePoint(q));
      if (finitePoint(q)) dots[name].set(q);
    }
    dots.X.show(finitePoint(g.X));
    if (finitePoint(g.X)) dots.X.set(g.X);

    for (const name of Core.NAMES) {
      labels[name].show(state.showNames);
      if (state.showNames) labels[name].set(p[name]);
    }
    for (const name of ["A", "B", "C"]) {
      const q = g.crossings[name];
      labels[name].show(state.showNames && finitePoint(q));
      if (finitePoint(q)) labels[name].set(q, name, 7, -9);
    }
    labels.X.show(finitePoint(g.X));
    if (finitePoint(g.X)) labels.X.set(g.X, "X", 10, -10);

    for (const name of Core.RAY_NAMES) {
      handles[name].set(p[name]);
    }

    if (!cl.regular || !cl.raysTangent || !cl.linesTangent) {
      say("Move the ray points further apart so all three second tangents can be drawn.", null);
    } else if (cl.degenerate) {
      say("Two circles almost touch: their tangents merge here, so the crossing is hard to read. Move a ray point.", null);
    } else if (!explored) {
      say("Drag the four coloured points. Watch the three new tangents: they always meet in one place.", null);
    } else {
      say(`The three second tangents meet at X = (${fmt(g.X.x)}, ${fmt(g.X.y)}); their three crossings are ` +
        `${cl.spread.toExponential(1)} units apart.`, "done");
    }
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function inside(q) {
    return {
      x: Geom.clamp(q.x, view.x + 12, view.x + view.width - 12),
      y: Geom.clamp(q.y, view.y + 12, view.y + view.height - 12),
    };
  }

  function clampOrigin(q) { return inside(q); }

  /* Keep a ray point away from O: a zero-length ray has no angle to bisect. */
  function clampRay(q, name) {
    const p = inside(q);
    const o = state.points.O;
    const dx = p.x - o.x, dy = p.y - o.y;
    const d = Math.hypot(dx, dy);
    if (d >= 24) return p;
    if (d < 1e-6) return { x: o.x + 24, y: o.y };
    return { x: o.x + (dx / d) * 24, y: o.y + (dy / d) * 24 };
  }

  for (const name of Core.RAY_NAMES) {
    handles[name] = board.handle(name, state.points[name], {
      r: name === "O" ? 12 : 11, step: 6, shift: 24, layer: handleLayer,
      cls: name === "O" ? "geom-handle origin-handle" : "geom-handle",
      clamp: name === "O" ? clampOrigin : clampRay,
      label: `Point ${name}. Drag this ray point, or focus it and use the arrow keys.`,
      describe: (q) => `at ${Math.round(q.x)}, ${Math.round(q.y)}`,
      onMove: (q) => { state = Core.withPoint(state, name, q); explored = true; render(); },
    });
  }

  function syncButtons() {
    namesBtn.setAttribute("aria-pressed", String(state.showNames));
    namesBtn.textContent = state.showNames ? "Hide names" : "Show names";
  }

  function reset() {
    const showNames = state.showNames; // like the applet, the checkbox keeps its setting
    state = Core.withNames(Core.start({ width: view.width, height: view.height }), showNames);
    explored = false;
    syncButtons();
    render();
    handles.U.node.focus();
  }

  function toggleNames() {
    state = Core.withNames(state, !state.showNames);
    explored = true;
    syncButtons();
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
  syncButtons();
  render();
})();
