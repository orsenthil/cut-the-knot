"use strict";

/*
 * The page for Midpoints In Isosceles Triangle: drawing and input only; the
 * geometry is in midpoints-in-isosceles-triangle-core.js.
 *
 * The stage holds one SVG. A stays on its vertical line, while B and C are
 * always mirrored about it, just as in the applet. Three toggle buttons show
 * the point names, the right-angle mark at K and the extra construction
 * lines. A fourth button checks the claim for the current position.
 */

(function () {
  const Core = MidpointsInIsoscelesTriangleCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const statementBtn = document.getElementById("statementBtn");
  const extraBtn = document.getElementById("extraBtn");
  const checkBtn = document.getElementById("checkBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 8, view.x + view.width - 8),
    y: Geom.clamp(p.y, view.y + 8, view.y + view.height - 8),
  });

  let state = Core.start();
  let showNames = true;
  let showStatement = false;
  let showExtra = true;
  let checked = false;

  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  // Objects are created once; render() only moves them, so focus survives.
  const triSides = [
    board.segment(state.A, state.B, "tri-side", shapes),
    board.segment(state.B, state.C, "tri-side", shapes),
    board.segment(state.C, state.A, "tri-side", shapes),
  ];
  const baseExtension = board.segment(state.B, state.H || state.B, "base-ext", guides);
  const medianAM = board.segment(state.A, state.M || state.A, "guide", guides);
  const perpendicularCL = board.segment(state.C, state.L || state.C, "guide", guides);
  const extraAL = board.segment(state.A, state.L || state.A, "guide faint", guides);
  const segmentMH = board.segment(state.M || state.A, state.H || state.A, "inner-line", shapes);
  const segmentCH = board.segment(state.C, state.H || state.C, "claim-line", shapes);
  const segmentAD = board.segment(state.A, state.D || state.A, "claim-line", shapes);
  const markH = board.rightAngle(state.A, state.A, state.B, 9, "right-mark small", marks);
  const markK = board.rightAngle(state.A, state.A, state.B, 15, "right-mark", marks);
  const dots = {
    M: board.point(state.A, "aux-dot", 4, marks),
    H: board.point(state.A, "aux-dot", 4, marks),
    D: board.point(state.A, "claim-dot", 5, marks),
    L: board.point(state.A, "aux-dot", 4, marks),
    K: board.point(state.A, "claim-dot", 5, marks),
  };
  const labels = {
    A: board.label(state.A, "A", "glabel", -19, -10, labelsLayer),
    B: board.label(state.B, "B", "glabel", -16, 22, labelsLayer),
    C: board.label(state.C, "C", "glabel", 8, 22, labelsLayer),
    M: board.label(state.A, "M", "glabel dim", 8, 20, labelsLayer),
    H: board.label(state.A, "H", "glabel dim", -19, -7, labelsLayer),
    D: board.label(state.A, "D", "glabel claim", 8, -8, labelsLayer),
    L: board.label(state.A, "L", "glabel dim", -18, 18, labelsLayer),
    K: board.label(state.A, "K", "glabel claim", 8, -8, labelsLayer),
  };

  const clampA = (p) => ({ x: state.A.x, y: inside(p).y });
  const clampBase = (p) => inside(p);
  const describe = (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`;

  const handleA = board.handle("A", state.A, {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: clampA,
    label: "Apex A. Drag, or focus and use the arrow keys to move it up or down",
    describe, onMove: (p) => move("A", p),
  });
  const handleB = board.handle("B", state.B, {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: clampBase,
    label: "Base corner B. Drag, or focus and use the arrow keys; C mirrors it",
    describe, onMove: (p) => move("B", p),
  });
  const handleC = board.handle("C", state.C, {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: clampBase,
    label: "Base corner C. Drag, or focus and use the arrow keys; B mirrors it",
    describe, onMove: (p) => move("C", p),
  });

  /**
   * Shows the line under the board. "done" means the claim has been checked;
   * that is also how the player's record sees an explored illustration.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.measurements(state);
    const g = m; // M, H, D, L and K all live on the measurements object

    triSides[0].set(state.A, state.B);
    triSides[1].set(state.B, state.C);
    triSides[2].set(state.C, state.A);
    baseExtension.set(state.B, g.H);
    medianAM.set(state.A, g.M);
    perpendicularCL.set(state.C, g.L);
    extraAL.set(state.A, g.L);
    segmentMH.set(g.M, g.H);
    segmentCH.set(state.C, g.H);
    segmentAD.set(state.A, g.D);

    medianAM.show(showExtra && !m.degenerate);
    perpendicularCL.show(showExtra && !m.degenerate);
    extraAL.show(showExtra && !m.degenerate);
    baseExtension.show(!m.degenerate);
    markH.show(!m.degenerate);
    markH.set(g.H, g.M, state.B, 9);
    const kOK = !m.degenerate && Number.isFinite(g.K.x) && Number.isFinite(g.K.y);
    markK.show(showStatement && kOK);
    if (kOK) markK.set(g.K, state.A, state.C, 15);

    const aux = { M: g.M, H: g.H, D: g.D, L: g.L, K: g.K };
    for (const name of Object.keys(dots)) {
      const visible = !m.degenerate &&
        (name === "K" ? showStatement && kOK : name === "L" ? showExtra : true);
      dots[name].show(visible);
      labels[name].show(visible && showNames);
      if (visible) {
        dots[name].set(aux[name]);
        labels[name].set(aux[name]);
      }
    }
    for (const name of ["A", "B", "C"]) labels[name].show(showNames);
    labels.A.set(state.A);
    labels.B.set(state.B);
    labels.C.set(state.C);
    handleA.set(state.A);
    handleB.set(state.B);
    handleC.set(state.C);

    if (m.degenerate) {
      say("Move the apex away from the base to make a triangle.", null);
    } else if (checked) {
      say("The right angle at K confirms it: AD is perpendicular to CH. Drag a point to try another shape.", "done");
    } else {
      say("The two coloured lines cross at K. Drag a point, or press Check the claim.", null);
    }
    if (window.Track) window.Track.state(state);
  }

  function move(name, p) {
    state = Core.withPoint(state, name, p);
    checked = false;
    render();
  }

  function toggle(button, get, set) {
    const next = !get();
    set(next);
    button.setAttribute("aria-pressed", String(next));
    render();
  }

  function checkClaim() {
    const cl = Core.claims(state);
    checked = Boolean(cl.ADperpCH && cl.rightAngleAtK);
    render();
    if (!checked) say("Make a triangle with a visible crossing, then check again.", null);
  }

  function reset() {
    state = Core.start();
    checked = false;
    render();
    handleA.node.focus();
  }

  newBtn.addEventListener("click", reset);
  const flipNames = () => toggle(namesBtn, () => showNames, (v) => { showNames = v; });
  const flipStatement = () => toggle(statementBtn, () => showStatement, (v) => { showStatement = v; });
  const flipExtra = () => toggle(extraBtn, () => showExtra, (v) => { showExtra = v; });
  namesBtn.addEventListener("click", flipNames);
  statementBtn.addEventListener("click", flipStatement);
  extraBtn.addEventListener("click", flipExtra);
  checkBtn.addEventListener("click", checkClaim);
  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLButtonElement) return;
    if (e.key === "r" || e.key === "R") reset();
    if (e.key === "s" || e.key === "S") flipStatement();
    if (e.key === "n" || e.key === "N") flipNames();
    if (e.key === "e" || e.key === "E") flipExtra();
  });

  board.onTheme(render);
  render();
})();
