"use strict";

/*
 * The page for Existence of the Circumcenter: drawing and input only; the
 * geometry is in existence-of-circumcenter-core.js. An SVG holds the triangle,
 * the three perpendicular lines through the side dots, the centre O and the
 * circle that appears when all three dots reach the middles of their sides.
 * Vertices can be dragged anywhere; the side dots slide along their sides,
 * just as the applet's RestrictToLine does.
 */

(function () {
  const Core = ExistenceOfCircumcenterCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const snapBtn = document.getElementById("snapBtn");
  const namesBtn = document.getElementById("namesBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 8, view.x + view.width - 8),
    y: Geom.clamp(p.y, view.y + 8, view.y + view.height - 8),
  });

  let state = Core.start();
  let activeDot = null;

  const background = board.layer("bisectors");
  const circleLayer = board.layer("circle");
  const sidesLayer = board.layer("sides");
  const marksLayer = board.layer("marks");
  const handlesLayer = board.layer("handles");

  const sides = [
    board.segment(state.A, state.B, "tri-side", sidesLayer),
    board.segment(state.B, state.C, "tri-side", sidesLayer),
    board.segment(state.C, state.A, "tri-side", sidesLayer),
  ];
  const bisectors = [
    board.line(state.L, state.L, "bisector", background),
    board.line(state.M, state.M, "bisector", background),
    board.line(state.N, state.N, "bisector", background),
  ];
  const circle = board.circle(state.A, 1, "circumcircle", circleLayer);
  const centerDot = board.point(state.A, "center-dot", 5, marksLayer);
  const radii = [
    board.segment(state.A, state.C, "radius-line", circleLayer),
    board.segment(state.A, state.A, "radius-line", circleLayer),
    board.segment(state.A, state.B, "radius-line", circleLayer),
  ];
  /* One equality tick on each half of a side, as in the applet's LineID.Mark. */
  const ticks = [0, 1, 2, 3, 4, 5].map(() => board.segment(state.A, state.B, "tick", marksLayer));
  const labels = [
    board.label(state.A, "A", "glabel", -20, -10, marksLayer),
    board.label(state.B, "B", "glabel", 8, -10, marksLayer),
    board.label(state.C, "C", "glabel", 8, 20, marksLayer),
    board.label(state.A, "O", "glabel center-label", 9, -9, marksLayer),
    board.label(state.L, "L", "glabel dot-label", 8, -8, marksLayer),
    board.label(state.M, "M", "glabel dot-label", 8, -8, marksLayer),
    board.label(state.N, "N", "glabel dot-label", 8, -8, marksLayer),
  ];

  /** A short cross-stroke at the midpoint of p-q, perpendicular to p-q. */
  function tick(p, q) {
    const mid = Geom.midpoint(p, q);
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * 5, ny = (dx / len) * 5;
    return [{ x: mid.x - nx, y: mid.y - ny }, { x: mid.x + nx, y: mid.y + ny }];
  }

  /**
   * Shows the line under the picture. "done" means the three dots have found
   * their middles and the circle is complete; there is no win or loss here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.measurements(state);
    const { A, B, C, L, M, N } = state;

    sides[0].set(A, B);
    sides[1].set(B, C);
    sides[2].set(C, A);

    bisectors[0].set(m.lines.L.from, m.lines.L.to);
    bisectors[1].set(m.lines.M.from, m.lines.M.to);
    bisectors[2].set(m.lines.N.from, m.lines.N.to);
    for (const line of bisectors) line.show(!m.noDraw);

    circle.show(!m.noDraw && m.allHit);
    centerDot.show(!m.noDraw);
    if (!m.noDraw) {
      circle.set(m.center, m.radius);
      centerDot.set(m.center);
    }

    radii[0].show(m.hits.L && !m.noDraw);
    radii[0].set(m.center, C);
    radii[1].show(m.hits.M && !m.noDraw);
    radii[1].set(m.center, A);
    radii[2].show(m.hits.N && !m.noDraw);
    radii[2].set(m.center, B);

    const marks = [
      [B, L, L, C, m.hits.L],
      [C, M, M, A, m.hits.M],
      [A, N, N, B, m.hits.N],
    ];
    for (let i = 0; i < 3; i++) {
      const [p, q, r, s, on] = marks[i];
      for (let j = 0; j < 2; j++) {
        const [u, v] = tick(j === 0 ? p : r, j === 0 ? q : s);
        ticks[2 * i + j].set(u, v);
        ticks[2 * i + j].show(on);
      }
    }

    labels[0].set(A);
    labels[1].set(B);
    labels[2].set(C);
    labels[3].set(m.center);
    labels[4].set(L);
    labels[5].set(M);
    labels[6].set(N);
    labels[0].show(state.showNames);
    labels[1].show(state.showNames);
    labels[2].show(state.showNames);
    labels[3].show(state.showNames && !m.noDraw);
    labels[4].show(state.showNames && !m.noDraw && Core.distance(B, L) > 10 && Core.distance(C, L) > 10);
    labels[5].show(state.showNames && !m.noDraw && Core.distance(A, M) > 10 && Core.distance(C, M) > 10);
    labels[6].show(state.showNames && !m.noDraw && Core.distance(A, N) > 10 && Core.distance(B, N) > 10);

    hA.set(A); hB.set(B); hC.set(C);
    hL.set(L); hM.set(M); hN.set(N);

    const found = Number(m.hits.L) + Number(m.hits.M) + Number(m.hits.N);
    if (m.noDraw) {
      say("The three corners are on one straight line. Move one off the line to make a triangle.", null);
    } else if (m.allHit) {
      say("O is equally far from A, B and C: the circle through all three is centred at O.", "done");
    } else {
      say(`${found} of 3 dots are exactly in the middle of their sides. Slide the others, or press Put dots at midpoints.`, null);
    }
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function moveVertex(name, p) {
    state = Core.moveVertex(state, name, inside(p));
    render();
  }

  function moveDot(name, p) {
    state = Core.dragMidpoint(state, name, p);
    activeDot = name;
    render();
  }

  function finishDrag() {
    if (!activeDot) return;
    const name = activeDot;
    activeDot = null;
    state = Core.releaseMidpoint(state, name);
    render();
  }

  const hA = board.handle("A", state.A, {
    r: 9, step: 4, shift: 16, layer: handlesLayer, clamp: inside,
    label: "Corner A. Drag, or focus and use the arrow keys to move it.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => moveVertex("A", p),
  });
  const hB = board.handle("B", state.B, {
    r: 9, step: 4, shift: 16, layer: handlesLayer, clamp: inside,
    label: "Corner B. Drag, or focus and use the arrow keys to move it.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => moveVertex("B", p),
  });
  const hC = board.handle("C", state.C, {
    r: 9, step: 4, shift: 16, layer: handlesLayer, clamp: inside,
    label: "Corner C. Drag, or focus and use the arrow keys to move it.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => moveVertex("C", p),
  });
  const hL = board.handle("L", state.L, {
    r: 7, step: 3, shift: 12, cls: "geom-handle dot-handle", layer: handlesLayer,
    label: "Dot L on side BC. Drag along the side, or focus and use the arrow keys.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    clamp: (p) => Core.projectOnLine(p, state.C, state.B),
    onMove: (p) => moveDot("L", p),
  });
  const hM = board.handle("M", state.M, {
    r: 7, step: 3, shift: 12, cls: "geom-handle dot-handle", layer: handlesLayer,
    label: "Dot M on side CA. Drag along the side, or focus and use the arrow keys.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    clamp: (p) => Core.projectOnLine(p, state.A, state.C),
    onMove: (p) => moveDot("M", p),
  });
  const hN = board.handle("N", state.N, {
    r: 7, step: 3, shift: 12, cls: "geom-handle dot-handle", layer: handlesLayer,
    label: "Dot N on side AB. Drag along the side, or focus and use the arrow keys.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    clamp: (p) => Core.projectOnLine(p, state.B, state.A),
    onMove: (p) => moveDot("N", p),
  });

  /* Dragging ends on pointer release; a key press ends with the arrow key. */
  window.addEventListener("pointerup", finishDrag);
  window.addEventListener("pointercancel", finishDrag);
  for (const h of [hL, hM, hN]) {
    h.node.addEventListener("keyup", (e) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) finishDrag();
    });
  }

  function newGame() {
    state = Core.start();
    activeDot = null;
    render();
    hA.node.focus();
  }

  function snapDots() {
    state = Core.snapMidpoints(state);
    activeDot = null;
    render();
  }

  function toggleNames() {
    state = { ...state, showNames: !state.showNames };
    namesBtn.setAttribute("aria-pressed", String(state.showNames));
    namesBtn.textContent = state.showNames ? "Hide names" : "Show names";
    render();
  }

  newBtn.addEventListener("click", newGame);
  snapBtn.addEventListener("click", snapDots);
  namesBtn.addEventListener("click", toggleNames);
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") newGame();
    if (e.key === "m" || e.key === "M") snapDots();
    if (e.key === "n" || e.key === "N") toggleNames();
  });

  board.onTheme(render);
  render();
})();
