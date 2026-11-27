"use strict";

/*
 * The page for the GLaD construction: drawing and input only. The construction
 * lives in glad-construction-core.js. The board shows the parallelogram ABCD,
 * both diagonals, the projection lines E_k P_k and the rays P_(k-1) D that
 * find the next diagonal crossing. A, B, C and D are draggable handles; the
 * applet's parallelogram constraints are applied by the core.
 */

(function () {
  const Core = GladConstructionCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const nOut = document.getElementById("nOut");
  const minusBtn = document.getElementById("minusBtn");
  const plusBtn = document.getElementById("plusBtn");
  const namesBox = document.getElementById("namesBox");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();

  /** The line under the board. "done" is how a demo tells the record it was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  // Paint order: parallelogram and guides, construction lines, dots, labels, handles.
  const sides = board.layer("sides");
  const guides = board.layer("guides");
  const lines = board.layer("lines");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const handleLayer = board.layer("handles");

  const origin = { x: 0, y: 0 };
  const sideAB = board.segment(origin, origin, "side", sides);
  const sideBC = board.segment(origin, origin, "side", sides);
  const sideCD = board.segment(origin, origin, "side", sides);
  const sideDA = board.segment(origin, origin, "side", sides);
  const diagAC = board.line(origin, origin, "diagonal", guides);
  const diagDB = board.line(origin, origin, "diagonal", guides);

  const MAX = Core.MAX_PARTS - 1;
  const stepShapes = [], rayShapes = [], eDots = [], pDots = [];
  const eLabels = [], pLabels = [];
  for (let i = 0; i < MAX; i++) {
    stepShapes.push(board.segment(origin, origin, "step", lines));
    rayShapes.push(board.segment(origin, origin, "ray", lines));
    eDots.push(board.point(origin, "e-dot", 4.2, dots));
    pDots.push(board.point(origin, "p-dot", 4.2, dots));
    eLabels.push(board.label(origin, "", "cross-label", -12, -7, labels));
    pLabels.push(board.label(origin, "", "cross-label", 6, 14, labels));
  }

  const labelA = board.label(origin, "A", "pt-label", -16, -8, labels);
  const labelB = board.label(origin, "B", "pt-label", 8, -8, labels);
  const labelC = board.label(origin, "C", "pt-label", 8, -8, labels);
  const labelD = board.label(origin, "D", "pt-label", -16, -8, labels);
  const subDigits = "₀₁₂₃₄₅₆₇₈₉";
  const sub = (k) => String(k).split("").map((d) => subDigits[Number(d)]).join("");

  const clamp = (q) => ({
    x: Geom.clamp(q.x, 0, Core.WIDTH), y: Geom.clamp(q.y, 0, Core.HEIGHT),
  });
  const describe = (p) => `at board position ${Math.round(p.x)}, ${Math.round(p.y)}`;
  const onMove = (p, name) => apply({ type: "point", name, x: p.x, y: p.y });
  const handles = {
    A: board.handle("A", state.A, { step: 3, shift: 12, clamp, describe, onMove, layer: handleLayer }),
    B: board.handle("B", state.B, { step: 3, shift: 12, clamp, describe, onMove, layer: handleLayer }),
    C: board.handle("C", state.C, { step: 3, shift: 12, clamp, describe, onMove, layer: handleLayer }),
    D: board.handle("D", state.D, { step: 3, shift: 12, clamp, describe, onMove, layer: handleLayer }),
  };

  function statusText(g) {
    return `N = ${g.n}: the last crossing is at 1/${g.n} of AB; the diagonal is cut in the same fractions.`;
  }

  function render() {
    const g = Core.construct(state);
    sideAB.set(g.A, g.B);
    sideBC.set(g.B, g.C);
    sideCD.set(g.C, g.D);
    sideDA.set(g.D, g.A);
    diagAC.set(g.A, g.C);
    diagDB.set(g.D, g.B);

    g.stepLines.forEach(([p, q], i) => stepShapes[i].set(p, q).show(true));
    for (let i = g.stepLines.length; i < MAX; i++) stepShapes[i].show(false);
    g.rayLines.forEach(([p, q], i) => rayShapes[i].set(p, q).show(true));
    for (let i = g.rayLines.length; i < MAX; i++) rayShapes[i].show(false);

    // As in ShowPoint/ShowNames, only the first few crossings get dots and
    // names, plus the final 1/N crossing. The lines are drawn for all of them.
    const shown = new Set([0, 1, 2, g.Es.length - 1]);
    g.Es.forEach((p, i) => {
      const on = shown.has(i);
      eDots[i].set(p).show(on);
      pDots[i].set(g.Ps[i]).show(on);
      eLabels[i].set(p, "E" + sub(i + 2)).show(on && state.names);
      pLabels[i].set(g.Ps[i], "P" + sub(i + 2)).show(on && state.names);
    });
    for (let i = g.Es.length; i < MAX; i++) {
      eDots[i].show(false);
      pDots[i].show(false);
      eLabels[i].show(false);
      pLabels[i].show(false);
    }

    labelA.set(g.A).show(state.names);
    labelB.set(g.B).show(state.names);
    labelC.set(g.C).show(state.names);
    labelD.set(g.D).show(state.names);
    for (const name of ["A", "B", "C", "D"]) handles[name].set(g[name]);

    nOut.value = `${state.n} parts`;
    namesBox.checked = state.names;
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state({
      A: g.A, B: g.B, C: g.C, D: g.D, n: state.n, names: state.names,
      crossings: g.Es, marks: g.Ps,
    });
    say(statusText(g), Core.result(state));
  }

  function apply(m) {
    const next = Core.move(state, m);
    if (!next) return false;
    state = next;
    render();
    return true;
  }

  minusBtn.addEventListener("click", () => {
    if (state.n <= Core.MIN_PARTS) say(`The applet allows ${Core.MIN_PARTS} to ${Core.MAX_PARTS} parts.`, Core.result(state));
    else apply({ type: "parts", value: state.n - 1 });
  });
  plusBtn.addEventListener("click", () => {
    if (state.n >= Core.MAX_PARTS) say(`The applet allows ${Core.MIN_PARTS} to ${Core.MAX_PARTS} parts.`, Core.result(state));
    else apply({ type: "parts", value: state.n + 1 });
  });
  namesBox.addEventListener("change", () => apply({ type: "names", value: namesBox.checked }));
  resetBtn.addEventListener("click", () => {
    apply({ type: "reset" });
    say("Back to the opening picture.", Core.result(state));
  });
  // Colours come from CSS tokens, but redraw on a theme flip all the same.
  board.onTheme(() => render());

  render();
})();
