"use strict";

/*
 * The page for Ceva Cradle: drawing and input only; the geometry is in
 * ceva-cradle-core.js. An SVG holds the triangle ABC, the smaller triangle
 * XYZ on its sides, the three lines through O and the points D, E, F where
 * they cross the sides of XYZ. Seven handles are draggable (and arrow-key
 * movable); the checkboxes match the applet's show names / cevians / hint.
 * The two Ceva products are printed in the status line, and when both reach 1
 * the six cevians through the two meeting points are drawn.
 */

(function () {
  const Core = CevaCradleCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBox = document.getElementById("namesBox");
  const ceviansBox = document.getElementById("ceviansBox");
  const hintBox = document.getElementById("hintBox");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 6, view.x + view.width - 6),
    y: Geom.clamp(p.y, view.y + 6, view.y + view.height - 6),
  });
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(3) : "—");

  let state = Core.start({ width: view.width, height: view.height });
  let diagram = Core.compute(state);

  const shapes = board.layer("shapes");
  const cevianLayer = board.layer("cevians");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  /* Every element is made once; redraws only call .set(...) / .show(...). */
  const triLines = [
    board.line(state.A, state.B, "tri-line", shapes),
    board.line(state.B, state.C, "tri-line", shapes),
    board.line(state.C, state.A, "tri-line", shapes),
  ];
  const innerLines = [
    board.line(state.X, state.Y, "inner-line", shapes),
    board.line(state.Y, state.Z, "inner-line", shapes),
    board.line(state.Z, state.X, "inner-line", shapes),
  ];
  const rays = [
    board.line(state.A, state.O, "ray", shapes),
    board.line(state.B, state.O, "ray", shapes),
    board.line(state.C, state.O, "ray", shapes),
  ];
  const cevians = [
    board.line(state.A, state.X, "cevian", cevianLayer),
    board.line(state.B, state.Y, "cevian", cevianLayer),
    board.line(state.C, state.Z, "cevian", cevianLayer),
  ];
  const cradleCevians = [
    board.line(state.X, state.D || state.X, "cevian-inner", cevianLayer),
    board.line(state.Y, state.E || state.Y, "cevian-inner", cevianLayer),
    board.line(state.Z, state.F || state.Z, "cevian-inner", cevianLayer),
  ];
  const solvedABC = [
    board.line(state.A, state.A, "solved-a", cevianLayer),
    board.line(state.B, state.B, "solved-a", cevianLayer),
    board.line(state.C, state.C, "solved-a", cevianLayer),
  ];
  const solvedXYZ = [
    board.line(state.X, state.X, "solved-b", cevianLayer),
    board.line(state.Y, state.Y, "solved-b", cevianLayer),
    board.line(state.Z, state.Z, "solved-b", cevianLayer),
  ];
  const hints = [
    board.segment(state.Y, state.Y, "hint", cevianLayer),
    board.segment(state.Z, state.Z, "hint", cevianLayer),
  ];
  const auxDots = [
    board.point(state.X, "aux-dot", 3.5, marks),
    board.point(state.Y, "aux-dot", 3.5, marks),
    board.point(state.Z, "aux-dot", 3.5, marks),
  ];
  const footDots = [
    board.point(state.Y, "foot-dot", 3, marks),
    board.point(state.Z, "foot-dot", 3, marks),
  ];
  const meetingDots = [
    board.point(state.A, "meeting-dot a", 4.5, marks),
    board.point(state.A, "meeting-dot b", 4.5, marks),
  ];

  const labelSpec = [
    ["A", state.A, -18, -10], ["B", state.B, -18, 16], ["C", state.C, -18, -10],
    ["X", state.X, -16, 18], ["Y", state.Y, 8, -12], ["Z", state.Z, 8, 18],
    ["O", state.O, 8, -10],
  ];
  const labels = labelSpec.map(([text, p, dx, dy]) => board.label(p, text, "glabel", dx, dy, marks));
  const auxLabels = ["D", "E", "F"].map((text) => board.label(state.X, text, "glabel small", 6, -8, marks));
  const meetingLabels = [
    board.label(state.A, "M", "glabel meet a", 8, -8, marks),
    board.label(state.A, "N", "glabel meet b", 8, -8, marks),
  ];

  /**
   * Shows the status line. `kind` is "done" when both Ceva products reach 1;
   * an illustration has no winner or loser. The class is also how the
   * player's record learns that the diagram has been explored.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    diagram = Core.compute(state);
    // Moving a vertex carries its two side points, so keep every dot in sync.
    for (const name of Object.keys(handles)) handles[name].set(state[name]);
    triLines[0].set(state.A, state.B);
    triLines[1].set(state.B, state.C);
    triLines[2].set(state.C, state.A);
    innerLines[0].set(state.X, state.Y);
    innerLines[1].set(state.Y, state.Z);
    innerLines[2].set(state.Z, state.X);
    rays[0].set(state.A, state.O);
    rays[1].set(state.B, state.O);
    rays[2].set(state.C, state.O);

    const showCevians = ceviansBox.checked;
    const D = diagram.D, E = diagram.E, F = diagram.F;
    cevians.forEach((seg, i) => {
      const ends = [[state.A, state.X], [state.B, state.Y], [state.C, state.Z]][i];
      seg.set(ends[0], ends[1]);
      seg.show(showCevians);
    });
    cradleCevians.forEach((seg, i) => {
      const ends = [[state.X, D], [state.Y, E], [state.Z, F]][i];
      seg.show(showCevians && Boolean(ends[1]));
      if (ends[1]) seg.set(ends[0], ends[1]);
    });

    const showHint = hintBox.checked && diagram.valid;
    hints.forEach((seg, i) => {
      const foot = [diagram.G, diagram.H][i];
      seg.show(showHint && Boolean(foot));
      if (foot) seg.set([state.Y, state.Z][i], foot);
      footDots[i].show(showHint && Boolean(foot));
      if (foot) footDots[i].set(foot);
    });

    [D, E, F].forEach((p, i) => {
      auxDots[i].show(Boolean(p));
      auxLabels[i].show(Boolean(p) && namesBox.checked);
      if (p) {
        auxDots[i].set(p);
        auxLabels[i].set(p);
      }
    });

    const done = diagram.finished && diagram.M && diagram.N;
    solvedABC.forEach((seg, i) => {
      const vertex = [state.A, state.B, state.C][i];
      seg.show(Boolean(done));
      if (done) seg.set(vertex, diagram.M);
    });
    solvedXYZ.forEach((seg, i) => {
      const vertex = [D, E, F][i];
      seg.show(Boolean(done));
      if (done) seg.set(vertex, diagram.N);
    });
    meetingDots[0].show(Boolean(done));
    meetingDots[1].show(Boolean(done));
    meetingLabels[0].show(Boolean(done) && namesBox.checked);
    meetingLabels[1].show(Boolean(done) && namesBox.checked);
    if (done) {
      meetingDots[0].set(diagram.M);
      meetingDots[1].set(diagram.N);
      meetingLabels[0].set(diagram.M);
      meetingLabels[1].set(diagram.N);
    }

    labelSpec.forEach(([, p], i) => {
      labels[i].set(p);
      labels[i].show(namesBox.checked);
    });

    if (!diagram.valid) {
      say("Move O away from the corners to build the cradle again.");
    } else if (done) {
      say("Both products are 1: the cevians meet in both triangles.", "done");
    } else {
      say(`(AZ/ZB)(BX/XC)(CY/YA) = ${fmt(diagram.left)} and ` +
        `(ZD/DY)(YF/FX)(XE/EZ) = ${fmt(diagram.right)}. ` +
        "They are equal for every position of O.");
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function move(name, p) {
    state = Core.movePoint(state, name, p);
    render();
  }

  const clampInside = (p) => inside(p);
  const clampOnSide = (p, name) => Core.movePoint(state, name, p)[name];
  const sideOpts = (name, text) => ({
    r: 8, step: 0.5, shift: 2, layer: handlesLayer,
    clamp: clampOnSide,
    label: text + " on the side of the triangle. Drag, or focus and use the arrow keys.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p, n) => move(n, p),
  });
  const freeOpts = (name, text) => ({
    r: 9, step: 4, shift: 12, layer: handlesLayer,
    clamp: clampInside,
    label: text + ". Drag, or focus and use the arrow keys to move it.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p, n) => move(n, p),
  });

  const handles = {
    A: board.handle("A", state.A, freeOpts("A", "Corner A")),
    B: board.handle("B", state.B, freeOpts("B", "Corner B")),
    C: board.handle("C", state.C, freeOpts("C", "Corner C")),
    X: board.handle("X", state.X, sideOpts("X", "X")),
    Y: board.handle("Y", state.Y, sideOpts("Y", "Y")),
    Z: board.handle("Z", state.Z, sideOpts("Z", "Z")),
    O: board.handle("O", state.O, freeOpts("O", "Point O")),
  };

  function newGame() {
    state = Core.start({ width: view.width, height: view.height });
    for (const name of Object.keys(handles)) handles[name].set(state[name]);
    render();
  }

  newBtn.addEventListener("click", newGame);
  for (const box of [namesBox, ceviansBox, hintBox]) box.addEventListener("change", render);
  document.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    if (key === "r") newGame();
    else if (key === "c") { ceviansBox.checked = !ceviansBox.checked; render(); }
    else if (key === "h") { hintBox.checked = !hintBox.checked; render(); }
    else if (key === "n") { namesBox.checked = !namesBox.checked; render(); }
    else return;
    e.preventDefault();
  });

  board.onTheme(render);
  render();
})();
