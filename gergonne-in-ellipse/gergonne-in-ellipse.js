"use strict";

/*
 * The page for Gergonne in Ellipse: drawing and input only; the geometry is
 * in gergonne-in-ellipse-core.js. An SVG holds the ellipse, the four frame
 * corners that set its radii, and three draggable touch points. The tangents,
 * the triangle they form, its three cevians and the Gergonne point G are made
 * once and only moved on a redraw, so a handle keeps keyboard focus.
 */

(function () {
  const Core = GergonneInEllipseCore;
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
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

  let state = Core.start({ width: view.width, height: view.height });

  /* Layers, back to front. */
  const guides = board.layer("guides");
  const triangleLayer = board.layer("triangle");
  const ceviansLayer = board.layer("cevians");
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
  };
  const frameGuide = board.polygon(state.V, "rect-guide", guides);
  const tangents = state.P.map(() => board.line(state.P[0], state.P[1], "tangent", guides));
  const triangle = [0, 1, 2].map(() => board.segment(state.P[0], state.P[1], "side", triangleLayer));
  const cevians = [0, 1, 2].map(() => board.line(state.P[0], state.P[1], "cevian", ceviansLayer));
  const vertexDots = [0, 1, 2].map(() => board.point(state.P[0], "vertex-dot", 4.5, marks));
  const gDot = board.point(state.P[0], "g-dot", 6, marks);
  const vertexLabels = [0, 1, 2].map((i) =>
    board.label(state.P[0], "A" + (i + 1), "point-label", 8, -8, labelsLayer));
  const touchLabels = [0, 1, 2].map((i) =>
    board.label(state.P[0], "T" + (i + 1), "touch-label", 8, -8, labelsLayer));
  const gLabel = board.label(state.P[0], "G", "point-label g-label", 8, -8, labelsLayer);

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

    ellipse.set(g.ellipse);
    frameGuide.set(state.V);

    for (let i = 0; i < 3; i++) {
      const tangent = g.tangents[i];
      const tangentOK = Boolean(tangent && finite(tangent.p) && finite(tangent.q));
      tangents[i].show(tangentOK);
      if (tangentOK) tangents[i].set(tangent.p, tangent.q);

      const j = (i + 1) % 3;
      const sideOK = finite(g.vertices[i]) && finite(g.vertices[j]);
      triangle[i].show(sideOK);
      if (sideOK) triangle[i].set(g.vertices[i], g.vertices[j]);

      const cevian = g.cevians[i];
      const cevianOK = Boolean(cevian && finite(cevian.p) && finite(cevian.q));
      cevians[i].show(cevianOK && !g.noDraw);
      if (cevianOK) cevians[i].set(cevian.p, cevian.q);

      vertexDots[i].show(finite(g.vertices[i]) && !g.noDraw);
      if (finite(g.vertices[i])) vertexDots[i].set(g.vertices[i]);
      vertexLabels[i].show(state.names && finite(g.vertices[i]));
      if (finite(g.vertices[i])) vertexLabels[i].set(g.vertices[i]);

      touchLabels[i].show(state.names && finite(state.P[i]));
      if (finite(state.P[i])) touchLabels[i].set(state.P[i]);
    }

    gDot.show(finite(g.G) && !g.noDraw);
    gLabel.show(Boolean(state.names) && finite(g.G));
    if (finite(g.G)) {
      gDot.set(g.G);
      gLabel.set(g.G);
    }

    frameHandles.forEach((h, i) => h.set(state.V[i]));
    touchHandles.forEach((h, i) => h.set(state.P[i]));

    say(Core.describe(state), state.explored && c.concurrent ? "done" : null);
    if (window.Track) window.Track.state(Core.position(state));
  }

  /* V0..V3 reshape the ellipse; A/B/C slide along it. */
  const frameHandles = [];
  const touchHandles = [];
  [0, 1, 2, 3].forEach((i) => {
    const name = "V" + i;
    frameHandles.push(board.handle(name, state.V[i], {
      r: 7, step: 3, shift: 9, cls: "geom-handle rect-handle", layer: handlesLayer,
      clamp: (p) => Core.clampCorner(inside(p), state),
      label: `Ellipse frame corner ${i + 1}. Drag, or focus and use the arrow keys, to resize the ellipse.`,
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p, who) => {
        state = Core.move(state, who, inside(p));
        render();
      },
    }));
  });
  Core.POINT_NAMES.forEach((name, i) => {
    touchHandles.push(board.handle(name, state.P[i], {
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
    touchHandles[0].node.focus();
  }

  function check() {
    const c = Core.claims(state);
    if (c.concurrent && c.tangentsFinite && finite(c.G)) {
      state = { ...state, explored: true };
      render();
      say("The three lines meet at G, the Gergonne point, just as they do for a circle.", "done");
    } else {
      say("Not yet: keep the three touching points apart and try again.", null);
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
