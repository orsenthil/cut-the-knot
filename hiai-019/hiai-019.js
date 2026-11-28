"use strict";

/*
 * The page for Circle Chains on Napoleon Triangles: drawing and input only.
 * hiai-019-core.js holds the rules.  The board shows the original triangle,
 * the three equilateral triangles on its sides and their circumcircles, and
 * the chain D - B - E - C - F - A - D.  A and B and C can be dragged freely;
 * D, E and F slide along their own circles and carry the rest of the chain
 * with them.  This is an illustration: there is nothing to win.
 */

(function () {
  const Core = Hiai019Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("namesBox");
  const premisesBox = document.getElementById("premisesBox");
  const statementBox = document.getElementById("statementBox");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});

  /**
   * Shows the line under the picture. `kind` is "win", "lose" or "done" and
   * tells the player's record that a play ended.  This illustration never
   * ends, so no kind is ever passed here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Layers in paint order. */
  const circlesLayer = board.layer("circles");
  const baseLayer = board.layer("base");
  const napLayer = board.layer("napoleons");
  const chainLayer = board.layer("chain");
  const marksLayer = board.layer("marks");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const circles = [0, 1, 2].map((i) => board.circle(state.circles[i].center, state.circles[i].r, "nap-circle", circlesLayer));
  const base = board.polygon(state.vertices, "base-tri", baseLayer);
  const naps = [0, 1, 2].map((i) => board.polygon(
    [state.vertices[i], state.vertices[(i + 1) % 3], state.napoleons[i]], "nap-tri", napLayer));
  const napDots = [0, 1, 2].map((i) => board.point(state.napoleons[i], "nap-dot", 3.5, marksLayer));
  /* D (point 0) joins B to E (point 1), E joins C to F (point 2), F joins A to D. */
  const links = [
    board.segment(state.points[0], state.points[1], "chain-line", chainLayer),
    board.segment(state.points[1], state.points[2], "chain-line", chainLayer),
    board.segment(state.points[2], state.points[0], "chain-line", chainLayer),
  ];
  const napMarks = [0, 1, 2].map((i) => board.angleArc(
    state.napoleons[i], state.vertices[i], state.vertices[(i + 1) % 3], 12, "angle-mark", marksLayer));
  const resultMarks = [0, 1, 2].map((i) => board.angleArc(
    state.points[i], state.points[(i + 1) % 3], state.points[(i + 2) % 3], 11, "angle-mark result-mark", marksLayer));

  const names = ["A", "B", "C", "C\u2032", "A\u2032", "B\u2032", "D", "E", "F"];
  const labels = names.map((text) => board.label(state.vertices[0], text, "pt-label", 8, -8, labelsLayer));
  /* Labels 0..2: vertices, 3..5: Napoleon apexes, 6..8: chain points. */

  const clampToBoard = (q) => ({
    x: Core.clamp(q.x, Core.PAD, state.width - Core.PAD),
    y: Core.clamp(q.y, Core.PAD, state.height - Core.PAD),
  });
  const clampToCircle = (i) => (q) => {
    const circle = state.circles[i];
    return Core.onCircle(circle, Core.angleOn(circle, q));
  };

  const vertexHandles = [0, 1, 2].map((i) => board.handle(names[i], state.vertices[i], {
    r: 11, step: 4, shift: 12, cls: "geom-handle vertex-handle", layer: handlesLayer,
    clamp: clampToBoard,
    label: `Vertex ${names[i]}. Drag it, or focus it and use the arrow keys to move it`,
    describe: (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`,
    onMove: (p) => { state = Core.moveVertex(state, i, p); render(); },
  }));
  const pointHandles = [0, 1, 2].map((i) => board.handle(names[6 + i], state.points[i], {
    r: 11, step: 2, shift: 8, cls: "geom-handle point-handle", layer: handlesLayer,
    clamp: clampToCircle(i),
    label: `Point ${names[6 + i]}, on circle ${
      ["A B C-prime", "B C A-prime", "C A B-prime"][i]}. Drag it round the circle, ` +
           `or focus it and use the arrow keys`,
    describe: (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`,
    onMove: (p) => { state = Core.movePointTo(state, i, p); render(); },
  }));

  /* Where a label sits depends on which side of the board its point is on. */
  function labelOffset(p) {
    return [p.x > state.width * 0.62 ? -18 : 9, p.y > state.height * 0.55 ? -8 : 16];
  }

  function render() {
    const g = Core.compute(state);
    circles.forEach((shape, i) => shape.set(state.circles[i].center, state.circles[i].r));
    base.set(state.vertices);
    naps.forEach((shape, i) => shape.set([
      state.vertices[i], state.vertices[(i + 1) % 3], state.napoleons[i],
    ]));
    links.forEach((shape, i) => {
      const a = state.points[i], b = state.points[(i + 1) % 3];
      shape.set(a, b);
    });
    napDots.forEach((shape, i) => shape.set(state.napoleons[i], 3.5));
    napMarks.forEach((mark, i) => mark.set(
      state.napoleons[i], state.vertices[i], state.vertices[(i + 1) % 3], 12));
    resultMarks.forEach((mark, i) => mark.set(
      state.points[i], state.points[(i + 1) % 3], state.points[(i + 2) % 3], 11));

    vertexHandles.forEach((h, i) => h.set(state.vertices[i]));
    pointHandles.forEach((h, i) => h.set(state.points[i]));

    const allNames = [
      state.vertices[0], state.vertices[1], state.vertices[2],
      state.napoleons[0], state.napoleons[1], state.napoleons[2],
      state.points[0], state.points[1], state.points[2],
    ];
    labels.forEach((label, i) => {
      const [dx, dy] = labelOffset(allNames[i]);
      label.set(allNames[i], names[i], dx, dy);
      label.show(state.showNames);
    });
    napDots.forEach((dot) => dot.show(true));
    napMarks.forEach((mark) => mark.show(state.showPremises));
    resultMarks.forEach((mark) => mark.show(state.showStatement));

    namesBox.checked = state.showNames;
    premisesBox.checked = state.showPremises;
    statementBox.checked = state.showStatement;
    say(Core.describe(state) +
      (g.closure < 1e-4 ? " Try moving D: the other two points follow." : ""));

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function reset() {
    state = Core.start({
      showNames: state.showNames,
      showPremises: state.showPremises,
      showStatement: state.showStatement,
    });
    render();
  }

  resetBtn.addEventListener("click", reset);
  namesBox.addEventListener("change", () => { state = Core.toggle(state, "showNames"); render(); });
  premisesBox.addEventListener("change", () => { state = Core.toggle(state, "showPremises"); render(); });
  statementBox.addEventListener("change", () => { state = Core.toggle(state, "showStatement"); render(); });
  document.querySelectorAll("[data-turn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state = Core.turnPoint(state, Number(btn.dataset.point), Number(btn.dataset.turn));
      render();
    });
  });

  board.onTheme(render);
  render();
})();
