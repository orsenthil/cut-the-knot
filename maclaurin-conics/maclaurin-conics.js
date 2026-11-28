"use strict";

/*
 * The page for Mac Laurin Conics: drawing and input only; the geometry lives in
 * maclaurin-conics-core.js. The SVG shows two given lines with draggable ends,
 * two gliders B and C, three fixed points U, V and W, the moving triangle, and
 * the path A has traced. Everything is made once and only moved on a redraw,
 * so a handle keeps keyboard focus while the other objects follow it.
 */

(function () {
  const Core = MaclaurinConicsCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const view = board.viewBox;
  const resetBtn = document.getElementById("resetBtn");
  const lineBtn = document.getElementById("lineBtn");
  const namesBtn = document.getElementById("namesBtn");
  const extraBtn = document.getElementById("extraBtn");
  const checkBtn = document.getElementById("checkBtn");

  let state = Core.start({ width: Core.VIEW.width, height: Core.VIEW.height });

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 8, view.x + view.width - 8),
    y: Geom.clamp(p.y, view.y + 8, view.y + view.height - 8),
  });
  const lineOf = (i) => ({ p: state.ends[i][0], q: state.ends[i][1] });

  /* Layers, back to front. */
  const guides = board.layer("guides");
  const traceLayer = board.layer("trace");
  const sidesLayer = board.layer("sides");
  const marks = board.layer("marks");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const givenLines = [
    board.line(state.ends[0][0], state.ends[0][1], "given-line", guides),
    board.line(state.ends[1][0], state.ends[1][1], "given-line", guides),
  ];
  const sideLines = [0, 1, 2].map((i) => board.line(state.B, state.U, "side", sidesLayer));
  const extraLines = [0, 1].map(() => board.line(state.U, state.V, "extra-line", guides));
  const tracePath = board.el("path", {}, "locus", traceLayer);
  const apex = board.point(state.U, "apex-dot", 5, marks);
  const capDot = board.point(state.U, "cap-dot", 4, marks);
  const extraDots = [0, 1, 2].map(() => board.point(state.U, "extra-dot", 4, marks));
  const lineLabels = [
    board.label(state.ends[0][0], "l", "line-label", -12, -8, labelsLayer),
    board.label(state.ends[1][0], "m", "line-label", -12, -8, labelsLayer),
  ];
  const labels = {
    B: board.label(state.B, "B", "point-label", 10, -10, labelsLayer),
    C: board.label(state.C, "C", "point-label", 10, -10, labelsLayer),
    U: board.label(state.U, "U", "point-label", 10, -10, labelsLayer),
    V: board.label(state.V, "V", "point-label", 10, -10, labelsLayer),
    W: board.label(state.W, "W", "point-label", 10, -10, labelsLayer),
    A: board.label(state.U, "A", "point-label apex-label", 10, -10, labelsLayer),
  };

  /**
   * #status is how the player's record sees an explored illustration. There is
   * no win or loss here: "done" means the player has checked the traced path.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.compute(state);

    givenLines[0].set(g.l.p, g.l.q);
    givenLines[1].set(g.m.p, g.m.q);
    sideLines.forEach((shape, i) => {
      const l = g.sides[i];
      shape.show(finite(l) && dist(l.p, l.q) > 1);
      if (finite(l)) shape.set(l.p, l.q);
    });
    extraLines.forEach((shape, i) => {
      const l = g.extraLines[i];
      shape.show(state.extra && Boolean(l) && finite(l.p) && finite(l.q));
      if (l && finite(l.p)) shape.set(l.p, l.q);
    });
    extraDots.forEach((shape, i) => {
      const p = g.extraPoints[i];
      shape.show(state.extra && finite(p));
      if (finite(p)) shape.set(p);
    });
    capDot.show(state.extra && finite(g.lCapM));
    if (finite(g.lCapM)) capDot.set(g.lCapM);

    const pts = state.trace.filter(finite);
    tracePath.setAttribute("d", pts.length > 1
      ? pts.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ") : "");

    apex.show(finite(g.X));
    if (finite(g.X)) apex.set(g.X);
    lineLabels[0].set(state.ends[0][0]);
    lineLabels[1].set(state.ends[1][0]);
    const at = {
      B: state.B, C: state.C, U: state.U, V: state.V, W: state.W,
      A: finite(g.X) ? g.X : state.U,
    };
    Object.keys(labels).forEach((name) => {
      labels[name].show(state.names && (name !== "A" || finite(g.X)));
      labels[name].set(at[name]);
    });

    handles.L[0].set(state.ends[0][0]);
    handles.L[1].set(state.ends[0][1]);
    handles.M[0].set(state.ends[1][0]);
    handles.M[1].set(state.ends[1][1]);
    handles.B.set(state.B);
    handles.C.set(state.C);
    handles.U.set(state.U);
    handles.V.set(state.V);
    handles.W.set(state.W);

    const verdict = Core.classify(state);
    let text = Core.describe(state);
    if (state.checked) {
      if (verdict.passes && verdict.kind === "conic") {
        text += " Checked: these positions lie on a conic.";
      } else if (verdict.passes) {
        text += " Checked: these positions lie on a straight line through the crossing of l and m.";
      } else {
        text += " Drag B farther along l to trace more of the path, then check again.";
      }
    }
    say(text, state.checked && verdict.passes ? "done" : null);
    if (window.Track) window.Track.state(Core.position(state));
  }

  function clampEnd(p, name) {
    let q = inside(p);
    const i = name[0] === "L" ? 0 : 1;
    const end = name[1] === "0" ? 0 : 1;
    const other = state.ends[i][1 - end];
    if (dist(q, other) < 24) {
      const dx = q.x - other.x, dy = q.y - other.y;
      const d = Math.hypot(dx, dy) || 1;
      q = inside({ x: other.x + (dx / d) * 24, y: other.y + (dy / d) * 24 });
    }
    return q;
  }

  function clampGlider(p, name) {
    const i = name === "B" ? 0 : 1;
    return inside(Core.nearestPoint(inside(p), lineOf(i)));
  }

  function afterMove(p, who) {
    state = { ...Core.move(state, who, p), checked: false };
    render();
  }

  const labelsFor = {
    L0: "Line l, first end. Drag, or focus and use the arrow keys, to turn l.",
    L1: "Line l, second end. Drag, or focus and use the arrow keys, to turn l.",
    M0: "Line m, first end. Drag, or focus and use the arrow keys, to turn m.",
    M1: "Line m, second end. Drag, or focus and use the arrow keys, to turn m.",
    B: "Point B, sliding on line l. Drag, or focus and use the arrow keys, to trace A.",
    C: "Point C, sliding on line m. It follows B through W.",
    U: "Fixed point U on side AB. Drag, or focus and use the arrow keys.",
    V: "Fixed point V on side AC. Drag, or focus and use the arrow keys.",
    W: "Fixed point W on side BC. Drag, or focus and use the arrow keys.",
  };
  const handleOpts = (name) => ({
    r: name === "B" || name === "C" || name === "U" || name === "V" || name === "W" ? 8 : 6,
    step: 4, shift: 12, layer: handlesLayer,
    label: labelsFor[name],
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    clamp: (p, who) =>
      name === "B" || name === "C" ? clampGlider(p, name)
        : name === "L0" || name === "L1" || name === "M0" || name === "M1" ? clampEnd(p, name)
          : inside(p),
    onMove: afterMove,
  });

  const handles = {
    L: [board.handle("L0", state.ends[0][0], handleOpts("L0")),
      board.handle("L1", state.ends[0][1], handleOpts("L1"))],
    M: [board.handle("M0", state.ends[1][0], handleOpts("M0")),
      board.handle("M1", state.ends[1][1], handleOpts("M1"))],
    B: board.handle("B", state.B, handleOpts("B")),
    C: board.handle("C", state.C, handleOpts("C")),
    U: board.handle("U", state.U, handleOpts("U")),
    V: board.handle("V", state.V, handleOpts("V")),
    W: board.handle("W", state.W, handleOpts("W")),
  };

  function reset() {
    state = { ...Core.start({ width: Core.VIEW.width, height: Core.VIEW.height }), checked: false };
    render();
    handles.B.node.focus();
  }
  function presetLine() {
    state = { ...Core.straightLinePreset(state), checked: false };
    render();
    handles.B.node.focus();
  }
  function toggle(which, btn) {
    state = { ...state, [which]: !state[which] };
    btn.setAttribute("aria-pressed", String(state[which]));
    btn.textContent = (which === "names" ? "Show names" : "Show extra lines") +
      (state[which] ? "" : " (off)");
    render();
  }
  function check() {
    state = { ...state, checked: true };
    render();
    const verdict = Core.classify(state);
    say(verdict.passes
      ? (verdict.kind === "line"
        ? "Checked: the positions lie on a straight line through l ∩ m."
        : "Checked: the positions lie on a conic.")
      : "There are too few positions yet. Drag B along l to trace the path, then check again.",
    verdict.passes ? "done" : null);
  }

  resetBtn.addEventListener("click", reset);
  lineBtn.addEventListener("click", presetLine);
  namesBtn.addEventListener("click", () => toggle("names", namesBtn));
  extraBtn.addEventListener("click", () => toggle("extra", extraBtn));
  checkBtn.addEventListener("click", check);
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "r" || e.key === "R") reset();
    if (e.key === "l" || e.key === "L") presetLine();
    if (e.key === "c" || e.key === "C") check();
    if (e.key === "e" || e.key === "E") toggle("extra", extraBtn);
  });

  board.onTheme(render);
  render();
})();
