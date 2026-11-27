"use strict";

/*
 * Euler Collinearity: drawing and input only. The geometry is in
 * euler-collinearity-core.js. Drag a triangle corner or the point P, move the
 * t slider, and the three lines from the vertices to the scaled midpoints
 * keep meeting at one point S on the line GP. Turning on "Show hint" shades
 * the two homothetic midpoint triangles; "Show names" labels the points.
 * There is nothing to win or lose: the applet is an illustration.
 */

(() => {
  const Core = EulerCollinearityCore;
  const statusEl = document.getElementById("status");
  const slider = document.getElementById("tSlider");
  const tOut = document.getElementById("tValue");
  const hintBox = document.getElementById("hintBox");
  const nameBox = document.getElementById("nameBox");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();

  const board = Geom.board(document.getElementById("board"));
  const guides = board.layer("guides");
  const ceviansLayer = board.layer("cevians");
  const marks = board.layer("marks");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const hintMedial = board.polygon([], "hint-triangle hint-medial", guides);
  const hintScaled = board.polygon([], "hint-triangle hint-scaled", guides);
  const locus = board.line({ x: 0, y: 0 }, { x: 1, y: 1 }, "locus-line", guides);
  const cevians = [0, 1, 2].map(() => board.line({ x: 0, y: 0 }, { x: 1, y: 1 }, "cevian", ceviansLayer));
  const vectors = [0, 1, 2].map(() => board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "vector", ceviansLayer));
  const vectorTips = [0, 1, 2].map(() => board.point({ x: 0, y: 0 }, "vector-tip", 3, ceviansLayer));
  const edges = [0, 1, 2].map(() => board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "triangle-edge", marks));
  const midDots = [0, 1, 2].map(() => board.point({ x: 0, y: 0 }, "dot dot-m", 4, marks));
  const mtDots = [0, 1, 2].map(() => board.point({ x: 0, y: 0 }, "dot dot-mt", 5, marks));
  const uDot = board.point({ x: 0, y: 0 }, "dot dot-u", 6, marks);
  const sDot = board.point({ x: 0, y: 0 }, "dot dot-s", 5, marks);
  const gDot = board.point({ x: 0, y: 0 }, "dot dot-g", 5, marks);

  const vertexLabels = [0, 1, 2].map((k) =>
    board.label({ x: 0, y: 0 }, "V" + (k + 1), "pt-label vertex-label", 8, -8, labelsLayer));
  const midLabels = [0, 1, 2].map((k) =>
    board.label({ x: 0, y: 0 }, "M" + (k + 1), "pt-label mid-label", -22, -7, labelsLayer));
  const mtLabels = [0, 1, 2].map((k) =>
    board.label({ x: 0, y: 0 }, "Mt" + (k + 1), "pt-label mt-label", 8, 16, labelsLayer));
  const sLabel = board.label({ x: 0, y: 0 }, "S", "pt-label s-label", 8, -8, labelsLayer);
  const gLabel = board.label({ x: 0, y: 0 }, "G", "pt-label g-label", 8, -8, labelsLayer);
  const pLabel = board.label({ x: 0, y: 0 }, "P", "pt-label p-label", 8, -8, labelsLayer);

  const fmt = (n) => (Math.abs(n) < 0.05 ? "0" : n.toFixed(1));

  /** A demo has no result: the status line only describes what is on screen. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function moved(p, name) {
    state = Core.withPoint(state, name, p);
    render();
  }

  const handles = [0, 1, 2].map((k) => board.handle("V" + k, state.V[k], {
    r: 12, step: 4, shift: 4, cls: "geom-handle vertex-handle", layer: handlesLayer,
    label: "Triangle corner V" + (k + 1) + ". Drag it, or focus it and use the arrow keys, to move the triangle.",
    describe: (p) => "x " + Math.round(p.x) + ", y " + Math.round(p.y),
    onMove: moved,
  }));
  const pHandle = board.handle("P", state.P, {
    r: 12, step: 4, shift: 4, cls: "geom-handle p-handle", layer: handlesLayer,
    label: "Point P. Drag it, or focus it and use the arrow keys, to move the center of the scaling.",
    describe: (p) => "x " + Math.round(p.x) + ", y " + Math.round(p.y),
    onMove: moved,
  });

  function render() {
    const c = Core.compute(state);
    const names = state.showNames;

    hintMedial.set(c.M).show(state.showHint);
    hintScaled.set(c.Mt).show(state.showHint);
    locus.set(state.P, c.S || state.P).show(Boolean(c.L));

    cevians.forEach((shape, k) => {
      const line = c.lines[k];
      shape.set(line ? line.p : state.P, line ? line.q : state.P).show(Boolean(line));
      const v = c.vectors[k];
      vectors[k].set(v ? v.p : state.P, v ? v.q : state.P).show(Boolean(v));
      vectorTips[k].set(v ? v.q : state.P).show(Boolean(v));
    });

    edges.forEach((shape, k) => shape.set(state.V[k], state.V[(k + 1) % 3]));
    midDots.forEach((dot, k) => dot.set(c.M[k]));
    mtDots.forEach((dot, k) => dot.set(c.Mt[k]));
    uDot.set(c.U);
    sDot.set(c.S || c.U).show(Boolean(c.S));
    gDot.set(c.G);

    vertexLabels.forEach((label, k) => {
      label.set(state.V[k]).show(names);
      midLabels[k].set(c.M[k]).show(names);
      mtLabels[k].set(c.Mt[k]).show(names);
    });
    sLabel.set(c.S || c.U).show(names && Boolean(c.S));
    gLabel.set(c.G).show(names);
    pLabel.set(state.P).show(names);

    handles.forEach((h, k) => h.set(state.V[k]));
    pHandle.set(state.P);

    tOut.textContent = fmt(state.t);
    if (Number(slider.value) !== Math.round(state.t * 10)) slider.value = String(Math.round(state.t * 10));

    const O = Core.circumcenter(state.V);
    const onEuler = O && Core.distance(O, state.P) < 0.5;
    let message = c.S
      ? `t = ${fmt(state.t)}. The three lines meet at S = (${fmt(c.S.x)}, ${fmt(c.S.y)}), on the line through P and G.`
      : `t = ${fmt(state.t)}. Two lines are almost parallel, so the applet cannot draw their meeting point.`;
    if (onEuler) message += " P is the circumcenter, so this line is the Euler line.";
    if (state.showHint) message += " The two shaded triangles are scaled copies of each other.";
    say(message);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  slider.addEventListener("input", () => {
    state = Core.withT(state, Number(slider.value));
    render();
  });
  hintBox.addEventListener("change", () => {
    state = Core.withFlag(state, "showHint", hintBox.checked);
    render();
  });
  nameBox.addEventListener("change", () => {
    state = Core.withFlag(state, "showNames", nameBox.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.start();
    hintBox.checked = false;
    nameBox.checked = false;
    render();
  });

  board.onTheme(render);
  render();
})();
