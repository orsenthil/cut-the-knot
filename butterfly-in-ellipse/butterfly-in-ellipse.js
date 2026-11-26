"use strict";

/*
 * The page for Butterfly in Ellipse: drawing and input only; the geometry is
 * in butterfly-in-ellipse-core.js. The SVG holds an axis-aligned ellipse, its
 * four rectangle corners, the polygon of vertices on it, a fixed straight line
 * and the crossing points where the polygon's sides meet that line. Shapes are
 * created once and only moved on a redraw, so a handle keeps keyboard focus.
 */

(function () {
  const Core = ButterflyInEllipseCore;
  const board = Geom.board(document.getElementById("board"));
  const view = board.viewBox;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const checkBtn = document.getElementById("checkBtn");
  const namesBtn = document.getElementById("namesBtn");
  const minusBtn = document.getElementById("nMinus");
  const plusBtn = document.getElementById("nPlus");
  const nValue = document.getElementById("nValue");
  const MAX = Core.N_MAX;

  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 6, view.x + view.width - 6),
    y: Geom.clamp(p.y, view.y + 6, view.y + view.height - 6),
  });
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);

  let state = Core.start({ width: view.width, height: view.height, n: 4 });

  /* Layers, back to front. */
  const guides = board.layer("guides");
  const sidesLayer = board.layer("sides");
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
  const rectGuide = board.polygon(state.V, "rect-guide", guides);
  const crossLine = board.line(state.line.p, state.line.q, "cross-line", guides);

  const sides = Array.from({ length: MAX }, (_, i) =>
    board.segment(state.P[0], state.P[1], "side", sidesLayer));
  const fDots = Array.from({ length: MAX }, (_, i) => board.point(state.L[0], "f-dot", 4, marks));
  const pLabels = Array.from({ length: MAX }, (_, i) =>
    board.label(state.P[0], "", "point-label", 8, -8, labelsLayer));
  const fLabels = Array.from({ length: MAX }, (_, i) =>
    board.label(state.L[0], "", "point-label f-label", 6, 15, labelsLayer));
  const lineLabel = board.label(state.line.p, "L", "point-label line-label", -14, -6, labelsLayer);

  /**
   * #status is how the player's record sees an explored illustration. There
   * is no win or loss here: "done" means the player has checked the picture.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const e = Core.ellipseFrom(state.V);
    ellipse.set(e);
    rectGuide.set(state.V);
    crossLine.set(state.line.p, state.line.q);
    lineLabel.set(state.line.p);

    for (let i = 0; i < MAX; i++) {
      const shown = i < state.n;
      sides[i].show(shown);
      fDots[i].show(false);
      pLabels[i].show(false);
      fLabels[i].show(false);
      handles.P[i].show(shown);
      handles.F[i].show(shown);
      if (!shown) continue;
      const j = (i + state.n - 1) % state.n;
      sides[i].set(state.P[i], state.P[j]);
      if (finite(state.L[i])) fDots[i].show(true).set(state.L[i]);
      if (state.names && i < 4 && finite(state.P[i])) {
        pLabels[i].show(true).set(state.P[i]);
        pLabels[i].node.textContent = Core.POINT_NAMES[i];
      }
      if (state.names && i < 4 && finite(state.L[i])) {
        fLabels[i].show(true).set(state.L[i]);
        fLabels[i].node.textContent = "F" + Core.L_NAMES[i];
      }
      handles.P[i].set(state.P[i]);
      handles.F[i].set(state.L[i]);
    }
    handles.V.forEach((h, i) => h.set(state.V[i]));
    handles.m.line[0].set(state.line.p);
    handles.m.line[1].set(state.line.q);

    namesBtn.setAttribute("aria-pressed", String(state.names));
    namesBtn.disabled = state.n !== 4;
    namesBtn.textContent = state.names ? "Hide names" : "Show names";
    nValue.textContent = String(state.n);
    minusBtn.disabled = state.n <= Core.N_MIN;
    plusBtn.disabled = state.n >= Core.N_MAX;

    const c = Core.claims(state);
    say(Core.describe(state), state.explored && c.holds ? "done" : null);
    if (window.Track) window.Track.state(Core.position(state));
  }

  /* V0..V3 reshape the ellipse; the other handles slide on the line or oval. */
  const handles = { V: [], P: [], F: [], m: { line: [] } };
  [0, 1, 2, 3].forEach((i) => {
    handles.V.push(board.handle("V" + i, state.V[i], {
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
  for (let i = 0; i < MAX; i++) {
    const name = i < 4 ? Core.POINT_NAMES[i] : "P" + (i + 1);
    handles.P.push(board.handle(name, state.P[0], {
      r: 8, step: 2, shift: 8, layer: handlesLayer,
      clamp: (p) => inside(p),
      label: `Vertex ${name}. Drag along the ellipse, or focus and use the arrow keys.`,
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p, who) => {
        const index = who.length === 1 ? Core.POINT_NAMES.indexOf(who) : Number(who.slice(1)) - 1;
        state = Core.move(state, "P" + index, inside(p));
        render();
      },
    }));
    const fName = i < 4 ? "F " + Core.L_NAMES[i] : "F " + (i + 1);
    handles.F.push(board.handle(fName, state.L[0], {
      r: 7, step: 2, shift: 8, cls: "geom-handle f-handle", layer: handlesLayer,
      clamp: (p) => inside(p),
      label: `Crossing ${fName}. Drag along the straight line, or focus and use the arrow keys.`,
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p, who) => {
        const label = who.replace("F ", "");
        const index = Core.L_NAMES.indexOf(label);
        const n = index >= 0 ? index : Number(label) - 1;
        state = Core.move(state, "F" + n, inside(p));
        render();
      },
    }));
  }
  ["Start", "End"].forEach((label, i) => {
    handles.m.line.push(board.handle("Line " + label, i ? state.line.q : state.line.p, {
      r: 7, step: 3, shift: 9, cls: "geom-handle line-handle", layer: handlesLayer,
      clamp: (p) => inside(p),
      label: `${label} of the straight line. Drag, or focus and use the arrow keys, to move the line.`,
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p, who) => {
        state = Core.move(state, who.indexOf("Start") >= 0 ? "m1" : "m2", inside(p));
        render();
      },
    }));
  });

  function reset() {
    state = Core.start({ width: view.width, height: view.height, n: state.n, seed: state.seed + 1 });
    render();
    handles.P[0].node.focus();
  }

  function check() {
    const c = Core.claims(state);
    if (c.holds) {
      state = { ...state, explored: true };
      render();
      say("Every side still meets the line at its own dot. The butterfly theorem holds here.", "done");
    } else {
      say("Not yet: keep the sides away from being parallel to the line and try again.", null);
    }
  }

  function setN(delta) {
    const n = Math.max(Core.N_MIN, Math.min(Core.N_MAX, state.n + delta));
    if (n === state.n) return;
    state = Core.start({ width: view.width, height: view.height, n, seed: state.seed + 1 });
    render();
  }

  resetBtn.addEventListener("click", reset);
  checkBtn.addEventListener("click", check);
  namesBtn.addEventListener("click", () => {
    if (state.n !== 4) return;
    state = { ...state, names: !state.names };
    render();
  });
  minusBtn.addEventListener("click", () => setN(-1));
  plusBtn.addEventListener("click", () => setN(1));
  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLButtonElement) return;
    if (e.key === "r" || e.key === "R") reset();
    if (e.key === "c" || e.key === "C") check();
  });

  board.onTheme(render);
  render();
})();
