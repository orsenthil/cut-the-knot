"use strict";

/*
 * The page for Cevian Triangle: drawing and input only; the mathematics is in
 * cevian-triangle-core.js. An SVG holds a triangle with three draggable corners
 * A, B, C and a draggable point P. The cevian feet Pa, Pb, Pc, the two triangles,
 * and the intersections L, M, N of their matching sides are redrawn on every move.
 */

(function () {
  const Core = CevianTriangleCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const checkBtn = document.getElementById("checkBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 8, view.x + view.width - 8),
    y: Geom.clamp(p.y, view.y + 8, view.y + view.height - 8),
  });
  const onBoard = (p) => Boolean(p) &&
    p.x >= view.x - 2 && p.x <= view.x + view.width + 2 &&
    p.y >= view.y - 2 && p.y <= view.y + view.height + 2;
  const round = (v) => Math.round(v);

  let state = Core.start();
  let showNames = false; // the archived applet's <param name="Show" value="0">
  let checked = false;

  /* Layers give a fixed paint order; elements are made once and only updated. */
  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  const sideGuides = [
    board.line(state.A, state.B, "guide", guides),
    board.line(state.B, state.C, "guide", guides),
    board.line(state.C, state.A, "guide", guides),
  ];
  const footGuides = [
    board.line(state.A, state.B, "guide-alt", guides),
    board.line(state.B, state.C, "guide-alt", guides),
    board.line(state.C, state.A, "guide-alt", guides),
  ];
  const cevians = [
    board.line(state.A, state.P, "cevian", shapes),
    board.line(state.B, state.P, "cevian", shapes),
    board.line(state.C, state.P, "cevian", shapes),
  ];
  const triABC = board.polygon([state.A, state.B, state.C], "tri-abc", shapes);
  const triFeet = board.polygon([state.A, state.B, state.C], "tri-cevian", shapes);
  const axis = board.line(state.A, state.B, "axis", shapes);
  const footDots = [
    board.point(state.A, "foot-dot", 4, marks),
    board.point(state.A, "foot-dot", 4, marks),
    board.point(state.A, "foot-dot", 4, marks),
  ];
  const axisDots = [
    board.point(state.A, "axis-dot", 5, marks),
    board.point(state.A, "axis-dot", 5, marks),
    board.point(state.A, "axis-dot", 5, marks),
  ];
  const labels = {};
  for (const name of ["A", "B", "C", "P", "Pa", "Pb", "Pc", "L", "M", "N"]) {
    const cls = "L M N".split(" ").indexOf(name) >= 0 ? "glabel small-label axis-label"
      : name.length > 1 ? "glabel small-label point-label" : "glabel";
    labels[name] = board.label(state.A, name, cls, 8, -8, marks);
  }

  /**
   * Shows the status line. "done" is used when a claim has been checked; the
   * shared record reads that class. An illustration never wins or loses.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const d = Core.diagram(state);
    const A = state.A, B = state.B, Cc = state.C, P = state.P;
    const feet = [d.feet.Pa, d.feet.Pb, d.feet.Pc];
    const axisPts = [d.axis.L, d.axis.M, d.axis.N];

    triABC.set([A, B, Cc]);
    sideGuides[0].set(A, B);
    sideGuides[1].set(B, Cc);
    sideGuides[2].set(Cc, A);

    for (let i = 0; i < 3; i++) {
      const line = axisPts[i];
      footGuides[i].show(Boolean(feet[i]));
      if (feet[i]) {
        footGuides[i].set([A, B, Cc][i], feet[i]);
      }
      cevians[i].set([A, B, Cc][i], feet[i] || P);
      footDots[i].show(Boolean(feet[i]));
      if (feet[i]) footDots[i].set(feet[i]);
    }
    const drawableFeet = feet.every(Boolean);
    triFeet.show(drawableFeet);
    if (drawableFeet) triFeet.set(feet);

    const axisLine = Core.axisLine(d.axis);
    axis.show(Boolean(axisLine));
    if (axisLine) axis.set(axisLine[0], axisLine[1]);
    const names = {
      A: A, B: B, C: Cc, P: P,
      Pa: d.feet.Pa, Pb: d.feet.Pb, Pc: d.feet.Pc,
      L: d.axis.L, M: d.axis.M, N: d.axis.N,
    };
    for (let i = 0; i < 3; i++) {
      axisDots[i].show(onBoard(axisPts[i]));
      if (onBoard(axisPts[i])) axisDots[i].set(axisPts[i]);
    }
    for (const name of Object.keys(names)) {
      const p = names[name];
      labels[name].show(showNames && onBoard(p));
      if (p) labels[name].set(p);
    }
    if (!drawableFeet) {
      say("Move P away from a corner and off a side so all three cevians have feet.", null);
    } else if (checked) {
      say("Confirmed: L, M and N lie on one line, the axis of the two triangles.", "done");
    } else {
      say(`Pa, Pb and Pc are the cevian feet of P at (${round(P.x)}, ${round(P.y)}). Press Check the theorem to test the third line.`, null);
    }
    // The position, for the player's record and the tutor, in board units.
    if (window.Track) window.Track.state(state);
  }

  function moveVertex(name, p) {
    state = Core.withPoint(state, name, inside(p));
    checked = false;
    render();
  }

  const clampVertex = (p) => inside(p);
  const handles = {};
  for (const name of ["A", "B", "C"]) {
    handles[name] = board.handle(name, state[name], {
      r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: clampVertex,
      label: `Corner ${name}. Drag, or focus and use the arrow keys to move it.`,
      describe: (p) => `at ${round(p.x)}, ${round(p.y)}`,
      onMove: (p) => moveVertex(name, p),
    });
  }
  handles.P = board.handle("P", state.P, {
    r: 9, step: 3, shift: 12, cls: "geom-handle p-handle", layer: handlesLayer,
    clamp: clampVertex,
    label: "Point P. Drag, or focus and use the arrow keys to move it.",
    describe: (p) => `at ${round(p.x)}, ${round(p.y)}`,
    onMove: (p) => moveVertex("P", p),
  });

  function newGame() {
    state = Core.start();
    checked = false;
    render();
    handles.A.node.focus();
  }

  function toggleNames() {
    showNames = !showNames;
    namesBtn.setAttribute("aria-pressed", String(showNames));
    namesBtn.textContent = showNames ? "Hide names" : "Show names";
    render();
  }

  function checkTheorem() {
    const d = Core.diagram(state);
    if (!d.feet.Pa || !d.feet.Pb || !d.feet.Pc) {
      render();
      return;
    }
    checked = true;
    render();
    if (!d.desarguesAxis) {
      say("Pa, Pb and Pc are drawn, but one of L, M, N is off the picture. Move P to bring it back.", null);
    }
  }

  newBtn.addEventListener("click", newGame);
  namesBtn.addEventListener("click", toggleNames);
  checkBtn.addEventListener("click", checkTheorem);
  document.addEventListener("keydown", (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === "r") newGame();
    if (k === "n") toggleNames();
    if (k === "c") checkTheorem();
  });

  board.onTheme(render);
  render();
})();
