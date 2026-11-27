"use strict";

/*
 * The page for Equi Tri In Rec: drawing and input only. The construction
 * lives in equi-tri-in-rec-core.js. The SVG shows the draggable parallelogram
 * ABCD, the two equilateral triangles CDX and BCY, and the orange triangle
 * APQ. The four switches are the Java panel's names, statement, premise and
 * hint checkboxes; all shapes keep focus-friendly SVG nodes across redraws.
 */

(() => {
  const C = EquiTriInRecCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const boxes = {
    names: document.getElementById("namesBox"),
    statement: document.getElementById("statementBox"),
    premise: document.getElementById("premiseBox"),
    hint: document.getElementById("hintBox"),
  };
  const resetBtn = document.getElementById("resetBtn");

  let state = C.start();
  let note = "";

  /** The line under the board. "done" tells the record this demo was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  // Paint order: soft fills, guides, angle arcs, outlines, dots, labels, handles.
  const fills = board.layer("fills");
  const guides = board.layer("guides");
  const angles = board.layer("angles");
  const edges = board.layer("edges");
  const dots = board.layer("dots");
  const labelsLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const origin = { x: 0, y: 0 };
  const triAPQ = board.polygon([origin, origin, origin], "tri-apq", fills);
  const triBCY = board.polygon([origin, origin, origin], "tri-small", fills);
  const triCDX = board.polygon([origin, origin, origin], "tri-small", fills);

  const hintXY = board.line(origin, origin, "hint-line", guides);
  const hintPQ = board.line(origin, origin, "hint-line", guides);
  const extAtoP = board.line(origin, origin, "extend-line", guides);
  const extAtoQ = board.line(origin, origin, "extend-line", guides);

  const statementArcs = Array.from({ length: 3 }, () => board.angleArc(origin, origin, origin, 20, "angle", angles));
  const premiseArcs = Array.from({ length: 6 }, () => board.angleArc(origin, origin, origin, 20, "angle", angles));

  const para = board.polygon([origin, origin, origin, origin], "para-outline", edges);
  const apq = board.polygon([origin, origin, origin], "apq-outline", edges);
  const smallSides = Array.from({ length: 4 }, () => board.segment(origin, origin, "small-side", edges));
  const auxDots = Array.from({ length: 4 }, () => board.point(origin, "aux-dot", 3.5, dots));

  const offsets = {
    A: [-18, 20], B: [-18, -8], C: [8, -8], D: [8, 20],
    X: [8, 18], Y: [8, -8], P: [8, 20], Q: [8, -8],
  };
  const labels = Object.fromEntries(Object.keys(offsets).map((name) => [name,
    board.label(origin, name, "pt-label", offsets[name][0], offsets[name][1], labelsLayer)]));

  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const clamp = (q, name) => C.limit(name, q);
  const describe = (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)} in the drawing`;

  let handles;
  const onMove = (p, name) => {
    if (!apply({ type: "point", name, x: p.x, y: p.y })) render();
  };
  handles = Object.fromEntries(C.CORNERS.map((name) => [name,
    board.handle(name, state[name], {
      r: 9, step: 4, shift: 16, layer: handleLayer, clamp, describe, onMove,
    })]));

  function render() {
    const built = C.construct(state);
    const drawn = built && finite(built.P) && finite(built.Q) && finite(built.X) && finite(built.Y);
    const g = drawn ? built : null;

    triAPQ.set(g ? [g.A, g.P, g.Q] : [origin, origin, origin]).show(!!g);
    triBCY.set(g ? [g.B, g.C, g.Y] : [origin, origin, origin]).show(!!g && state.premise);
    triCDX.set(g ? [g.C, g.D, g.X] : [origin, origin, origin]).show(!!g && state.premise);
    para.set(built ? [built.A, built.B, built.C, built.D] : [origin, origin, origin, origin]).show(!!built);
    apq.set(g ? [g.A, g.P, g.Q] : [origin, origin, origin]).show(!!g);

    extAtoP.set(g ? g.A : origin, g ? g.P : origin).show(!!g);
    extAtoQ.set(g ? g.A : origin, g ? g.Q : origin).show(!!g);
    hintXY.set(g ? g.X : origin, g ? g.Y : origin).show(!!g && state.hint);
    hintPQ.set(g ? g.P : origin, g ? g.Q : origin).show(!!g && state.hint);

    if (drawn) {
      const stmt = [[g.A, g.P, g.Q], [g.P, g.Q, g.A], [g.Q, g.A, g.P]];
      statementArcs.forEach((arcShape, i) => {
        const [v, p, q] = stmt[i];
        arcShape.set(v, p, q, 22).show(state.statement);
      });
      const prem = [
        [g.X, g.C, g.D], [g.D, g.X, g.C], [g.Y, g.B, g.C],
        [g.B, g.C, g.Y], [g.C, g.D, g.X], [g.C, g.Y, g.B],
      ];
      premiseArcs.forEach((arcShape, i) => {
        const [v, p, q] = prem[i];
        arcShape.set(v, p, q, i === 5 ? 28 : 18).show(state.premise);
      });
      [[g.P, 4], [g.Q, 4], [g.X, 3], [g.Y, 3]].forEach(([p, r], i) =>
        auxDots[i].set(p, r).show(true));
      [[g.B, g.Y], [g.C, g.Y], [g.C, g.X], [g.D, g.X]].forEach(([p, q], i) =>
        smallSides[i].set(p, q).show(state.premise));
    } else {
      [...statementArcs, ...premiseArcs, ...auxDots, ...smallSides].forEach((s) => s.show(false));
    }

    for (const name of Object.keys(offsets)) {
      const p = drawn ? g[name] : null;
      let visible = state.names && finite(p);
      // The applet suppresses a label that lands on top of C.
      if (visible && (name === "P" || name === "Q") && C.dist(p, g.C) <= 10) visible = false;
      labels[name].set(p || origin, name).show(visible);
    }
    for (const name of C.CORNERS) handles[name].set(g ? g[name] : state[name]);

    for (const key of Object.keys(boxes)) boxes[key].checked = state[key];

    say(note || C.status(state), C.result(state));
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state({
      A: state.A, B: state.B, C: state.C, D: state.D,
      X: g && g.X, Y: g && g.Y, P: g && g.P, Q: g && g.Q,
      names: state.names, statement: state.statement,
      premise: state.premise, hint: state.hint, moves: state.moves,
    });
  }

  function apply(m, message) {
    const next = C.move(state, m);
    if (!next) return false;
    state = next;
    note = message || "";
    render();
    return true;
  }

  for (const key of Object.keys(boxes)) {
    boxes[key].addEventListener("change", () => {
      if (!apply({ type: key, value: boxes[key].checked })) render();
    });
  }
  resetBtn.addEventListener("click", () => apply({ type: "reset" }, "Back to the opening rectangle."));
  board.onTheme(() => render());

  render();
})();
