"use strict";

/*
 * The page for Isosceles On Sides: drawing and input only. Isosceles-on-sides-core.js
 * holds the geometry. The SVG has six draggable points: the corners A, B, C of
 * the big triangle and D, E, F on the perpendicular bisectors of its sides.
 * D, E and F can be dragged along those bisectors (and across a side, which
 * flips them to the other end); A, B and C carry them along. The three
 * perpendiculars, their common point P and the optional circles are redrawn
 * from the core on every move.
 */

(function () {
  const Core = IsoscelesOnSidesCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const checkBtn = document.getElementById("checkBtn");
  const namesBtn = document.getElementById("namesBtn");
  const statementBtn = document.getElementById("statementBtn");
  const hintBtn = document.getElementById("hintBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 7, view.x + view.width - 7),
    y: Geom.clamp(p.y, view.y + 7, view.y + view.height - 7),
  });
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const fmt = (p) => finite(p) ? `(${Math.round(p.x)}, ${Math.round(p.y)})` : "no point";

  let state = Core.start();
  let showNames = false;
  let showStatement = false;
  let showHint = false;
  let checked = false;

  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  /* The picture is built once; render() only updates each object's geometry. */
  const bisectors = [0, 1, 2].map(() => board.line(state.A, state.B, "bisector-guide", guides));
  const triSides = [0, 1, 2].map(() => board.segment(state.A, state.B, "tri-side", shapes));
  const legs = [0, 1, 2, 3, 4, 5].map(() => board.segment(state.A, state.B, "leg", shapes));
  const defSides = [0, 1, 2].map(() => board.segment(state.D, state.E, "def-side", shapes));
  const perps = [0, 1, 2].map(() => board.line(state.A, state.B, "perp", shapes));
  const feet = [0, 1, 2].map(() => board.point(state.A, "foot-dot", 3, marks));
  const rightAngles = [0, 1, 2].map(() => board.rightAngle(state.A, state.B, state.C, 9, "right-angle", marks));
  const ticks = [];
  for (let i = 0; i < 18; i++) ticks.push(board.segment(state.A, state.B, "tick", marks));
  const hintCircles = [0, 1, 2].map(() => board.circle(state.D, 1, "hint-circle", guides));
  const chords = [0, 1, 2].map(() => board.segment(state.A, state.D, "hint-chord", guides));
  const secondDots = [0, 1, 2].map(() => board.point(state.A, "second-dot", 4, marks));
  const centerDot = board.point(state.A, "center-dot", 5, marks);
  const centerLabel = board.label(state.A, "P", "glabel center-label", 9, -9, labelsLayer);
  const pointLabels = ["A", "B", "C", "D", "E", "F"].map((s) =>
    board.label(state.A, s, "glabel", 8, -8, labelsLayer));

  /* Three short strokes across a segment mark the equal legs of one triangle. */
  function setTicks(index, count, p, q) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len, nx = -uy * 4, ny = ux * 4;
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    for (let i = 0; i < 3; i++) {
      const t = i - (count - 1) / 2;
      const cx = mx + ux * t * 5, cy = my + uy * t * 5;
      const obj = ticks[index * 3 + i];
      obj.show(showStatement && i < count && len > 1);
      if (i < count) obj.set({ x: cx - nx, y: cy - ny }, { x: cx + nx, y: cy + ny });
    }
  }

  /**
   * Shows the line under the board. `kind` is "done" once the player has
   * pressed Check the claim; the shared record uses that class to note that
   * the illustration has been explored. There is no win or loss here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.measure(state);
    const cl = Core.claims(state);
    const A = state.A, B = state.B, C = state.C, D = state.D, E = state.E, F = state.F;

    /* Faint axes: each attached point is held on the bisector of its side. */
    const pairs = [[B, C], [C, A], [A, B]];
    for (let i = 0; i < 3; i++) {
      const [p, q] = pairs[i];
      bisectors[i].set(Core.perpPoint(Core.midpoint(p, q), p, q, -320),
        Core.perpPoint(Core.midpoint(p, q), p, q, 320));
      bisectors[i].show(showHint);
    }

    triSides[0].set(A, B); triSides[1].set(B, C); triSides[2].set(C, A);
    const legPairs = [[A, F], [F, B], [B, D], [D, C], [C, E], [E, A]];
    for (let i = 0; i < 6; i++) legs[i].set(legPairs[i][0], legPairs[i][1]);
    defSides[0].set(D, E); defSides[1].set(E, F); defSides[2].set(F, D);

    const rays = [m.rays.A, m.rays.B, m.rays.C];
    const vertices = [A, B, C];
    for (let i = 0; i < 3; i++) {
      perps[i].set(vertices[i], rays[i]);
      const foot = m.feet[["A", "B", "C"][i]];
      feet[i].show(finite(foot));
      if (finite(foot)) feet[i].set(foot);
    }

    setTicks(0, 1, D, B); setTicks(1, 1, D, C);
    setTicks(2, 2, E, C); setTicks(3, 2, E, A);
    setTicks(4, 3, F, A); setTicks(5, 3, F, B);
    const rightTriples = [
      [m.feet.A, A, E], [m.feet.B, B, F], [m.feet.C, C, D],
    ];
    for (let i = 0; i < 3; i++) {
      const [v, p, q] = rightTriples[i];
      rightAngles[i].show(showStatement && finite(v));
      if (finite(v)) rightAngles[i].set(v, p, q, 9);
    }

    const cs = [m.circles.D, m.circles.E, m.circles.F];
    const seconds = [m.second.A, m.second.B, m.second.C];
    for (let i = 0; i < 3; i++) {
      hintCircles[i].show(showHint && Number.isFinite(cs[i].r));
      if (Number.isFinite(cs[i].r)) hintCircles[i].set(cs[i].c, cs[i].r);
      chords[i].show(showHint && finite(seconds[i]));
      if (finite(seconds[i])) chords[i].set(vertices[i], seconds[i]);
      secondDots[i].show(showHint && finite(seconds[i]));
      if (finite(seconds[i])) secondDots[i].set(seconds[i]);
    }

    const showP = finite(m.P);
    centerDot.show(showP);
    centerLabel.show(showP && showNames);
    if (showP) { centerDot.set(m.P); centerLabel.set(m.P); }

    const place = [[A, -16, 24], [B, 9, 0], [C, 7, -8],
      [D, 8, -8], [E, -20, -5], [F, 8, 4]];
    for (let i = 0; i < 6; i++) {
      pointLabels[i].show(showNames);
      pointLabels[i].set(place[i][0], undefined, place[i][1], place[i][2]);
    }

    if (!cl.concurrent) {
      say("D, E and F are in one line, so the three perpendiculars do not meet. Drag one of them off the line.");
    } else if (checked) {
      say(`Confirmed: the perpendiculars meet at P ${fmt(m.P)}, the three equal-leg circles give P the same power, and the other intersections lie on those lines.`, "done");
    } else {
      say("The three perpendiculars meet at P. Drag any point to move the picture, or press Check the claim.");
    }
    if (window.Track) window.Track.state(state);
  }

  /* An attached point only moves along its side's perpendicular bisector. */
  const clampVertex = (p) => inside(p);
  const clampAttached = (p, name) => Core.withPoint(state, name, inside(p))[name] || inside(p);

  function movePoint(p, name) {
    const next = Core.withPoint(state, name, inside(p));
    state = next;
    checked = false;
    hA.set(state.A); hB.set(state.B); hC.set(state.C);
    hD.set(state.D); hE.set(state.E); hF.set(state.F);
    render();
  }

  const describe = (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`;
  const hA = board.handle("A", state.A, {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: clampVertex,
    label: "Corner A. Drag, or focus and use the arrow keys to move it",
    describe, onMove: movePoint,
  });
  const hB = board.handle("B", state.B, {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: clampVertex,
    label: "Corner B. Drag, or focus and use the arrow keys to move it",
    describe, onMove: movePoint,
  });
  const hC = board.handle("C", state.C, {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: clampVertex,
    label: "Corner C. Drag, or focus and use the arrow keys to move it",
    describe, onMove: movePoint,
  });
  const hD = board.handle("D", state.D, {
    r: 7, step: 2, shift: 8, cls: "geom-handle aux-handle", layer: handlesLayer,
    clamp: clampAttached,
    label: "Point D on the perpendicular bisector of BC. Drag along that line, or use the arrow keys",
    describe, onMove: movePoint,
  });
  const hE = board.handle("E", state.E, {
    r: 7, step: 2, shift: 8, cls: "geom-handle aux-handle", layer: handlesLayer,
    clamp: clampAttached,
    label: "Point E on the perpendicular bisector of CA. Drag along that line, or use the arrow keys",
    describe, onMove: movePoint,
  });
  const hF = board.handle("F", state.F, {
    r: 7, step: 2, shift: 8, cls: "geom-handle aux-handle", layer: handlesLayer,
    clamp: clampAttached,
    label: "Point F on the perpendicular bisector of AB. Drag along that line, or use the arrow keys",
    describe, onMove: movePoint,
  });

  function reset() {
    state = Core.start();
    checked = false;
    hA.set(state.A); hB.set(state.B); hC.set(state.C);
    hD.set(state.D); hE.set(state.E); hF.set(state.F);
    render();
    hA.node.focus();
  }

  function checkClaim() {
    checked = Core.claims(state).all;
    render();
    if (!checked) say("Move D, E or F off their common line, then check again.");
  }

  function toggle(btn, value, label) {
    btn.setAttribute("aria-pressed", String(value));
    btn.textContent = (value ? "Hide " : "Show ") + label;
  }

  resetBtn.addEventListener("click", reset);
  checkBtn.addEventListener("click", checkClaim);
  namesBtn.addEventListener("click", () => {
    showNames = !showNames;
    toggle(namesBtn, showNames, "names");
    render();
  });
  statementBtn.addEventListener("click", () => {
    showStatement = !showStatement;
    toggle(statementBtn, showStatement, "statement");
    render();
  });
  hintBtn.addEventListener("click", () => {
    showHint = !showHint;
    toggle(hintBtn, showHint, "hint circles");
    render();
  });
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === "r") reset();
    else if (key === "c") checkClaim();
    else if (key === "n") namesBtn.click();
    else if (key === "s") statementBtn.click();
    else if (key === "h") hintBtn.click();
  });

  board.onTheme(render);
  render();
})();
