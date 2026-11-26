"use strict";

/*
 * The page for Brianchon in Ellipse: drawing and input only; the geometry is
 * in brianchon-in-ellipse-core.js. An SVG holds the ellipse, the four rectangle
 * handles that set its radii and six draggable touching points. The tangents at
 * those points, their six intersections and the three main diagonals are
 * created once and only moved on a redraw, so a handle keeps keyboard focus.
 */

(function () {
  const Core = BrianchonCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const checkBtn = document.getElementById("checkBtn");
  const namesBtn = document.getElementById("namesBtn");
  const view = board.viewBox;

  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 6, view.x + view.width - 6),
    y: Geom.clamp(p.y, view.y + 6, view.y + view.height - 6),
  });
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);

  let state = Core.start({ width: view.width, height: view.height });

  /* Layers, back to front. */
  const guides = board.layer("guides");
  const diagonalsLayer = board.layer("diagonals");
  const marks = board.layer("marks");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const ellipseNode = board.el("ellipse", {}, "ellipse", guides);
  const ellipse = {
    node: ellipseNode,
    set: function (e) {
      ellipseNode.setAttribute("cx", e.center.x);
      ellipseNode.setAttribute("cy", e.center.y);
      ellipseNode.setAttribute("rx", Math.abs(e.A));
      ellipseNode.setAttribute("ry", Math.abs(e.B));
      return ellipse;
    },
    show: function (on) {
      ellipseNode.style.display = on ? "" : "none";
      return ellipse;
    },
  };
  const rectGuide = board.polygon(state.V, "rect-guide", guides);
  const tangents = state.P.map(() => board.line(state.P[0], state.P[1], "tangent", guides));

  const initial = Core.compute(state);
  const diagonals = initial.diagonals.map((d) => board.line(d.p, d.q, "diagonal", diagonalsLayer));
  const vertexDots = initial.vertices.map((p) => board.point(p, "vertex-dot", 4, marks));
  const sDot = board.point(initial.S || state.P[0], "center-dot", 6, marks);
  const pointLabels = Core.POINT_NAMES.map((n) => board.label(state.P[0], n, "point-label", 9, -9, labelsLayer));
  const sLabel = board.label(state.P[0], "S", "point-label s-label", 9, -9, labelsLayer);

  /**
   * #status is how the player's record sees an explored illustration. There
   * is no win or loss here: "done" means the player has checked the theorem.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const c = Core.claims(state);
    const g = c.geometry;

    ellipse.set(g.ellipse).show(true);
    rectGuide.set(state.V).show(true);

    for (let i = 0; i < 6; i++) {
      const l = g.tangents[i];
      const ok = Boolean(l && finite(l.p) && finite(l.q));
      tangents[i].show(ok);
      if (ok) tangents[i].set(l.p, l.q);
      vertexDots[i].show(finite(g.vertices[i]));
      if (finite(g.vertices[i])) vertexDots[i].set(g.vertices[i]);
      pointLabels[i].show(state.names && finite(state.P[i]));
      if (finite(state.P[i])) pointLabels[i].set(state.P[i]);
    }
    for (let i = 0; i < 3; i++) {
      const d = g.diagonals[i];
      const ok = finite(d.p) && finite(d.q);
      diagonals[i].show(ok);
      if (ok) diagonals[i].set(d.p, d.q);
    }

    sDot.show(Boolean(g.S));
    sLabel.show(Boolean(g.S));
    if (g.S) {
      sDot.set(g.S);
      sLabel.set(g.S);
    }

    handles.V.forEach((h, i) => h.set(state.V[i]));
    handles.P.forEach((h, i) => h.set(state.P[i]));

    say(Core.describe(state), state.explored && c.concurrent ? "done" : null);
    if (window.Track) window.Track.state(Core.position(state));
  }

  /* V0..V3 reshape the ellipse; A..F slide along it. */
  const handles = { V: [], P: [] };
  [0, 1, 2, 3].forEach((i) => {
    const name = "V" + i;
    handles.V.push(board.handle(name, state.V[i], {
      r: 7, step: 3, shift: 9, cls: "geom-handle rect-handle", layer: handlesLayer,
      clamp: (p) => Core.clampCorner(inside(p), state),
      label: `Ellipse corner ${i + 1}. Drag, or focus and use the arrow keys, to resize the ellipse.`,
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p, who) => {
        state = Core.move(state, who, inside(p));
        render();
      },
    }));
  });
  Core.POINT_NAMES.forEach((name, i) => {
    handles.P.push(board.handle(name, state.P[i], {
      r: 8, step: 3, shift: 9, layer: handlesLayer,
      clamp: (p) => inside(p),
      label: `Touching point ${name}. Drag along the ellipse, or focus and use the arrow keys.`,
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p, who) => {
        state = Core.move(state, who, inside(p));
        render();
      },
    }));
  });

  function reset() {
    state = Core.start({ width: view.width, height: view.height });
    render();
    handles.P[0].node.focus();
  }

  function check() {
    const c = Core.claims(state);
    if (c.concurrent && c.tangentsFinite) {
      state = { ...state, explored: true };
      render();
      say("The three diagonals meet at S. Brianchon's theorem holds here too.", "done");
    } else {
      say("Not yet: keep the six touching points apart and try again.", null);
    }
  }

  resetBtn.addEventListener("click", reset);
  checkBtn.addEventListener("click", check);
  namesBtn.addEventListener("click", () => {
    state = { ...state, names: !state.names };
    namesBtn.setAttribute("aria-pressed", String(state.names));
    namesBtn.textContent = state.names ? "Hide names" : "Show names";
    render();
  });
  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLButtonElement) return;
    if (e.key === "r" || e.key === "R") reset();
    if (e.key === "c" || e.key === "C") check();
  });

  board.onTheme(render);
  render();
})();
