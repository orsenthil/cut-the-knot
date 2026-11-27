"use strict";

/*
 * The page for Euclid's Segment Division: drawing and input only; the exact
 * construction lives in euclids-segment-division-core.js. The board shows the
 * ray BA with its equal marks, the segment BC, the parallel lines through the
 * marks, and the crossings they make on BC. A, B and C are draggable handles;
 * B and C always stay level, as in the original applet.
 */

(function () {
  const Core = EuclidsSegmentDivisionCore;
  const MAX = Core.MAX_N;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const nOut = document.getElementById("nOut");
  const minusBtn = document.getElementById("minusBtn");
  const plusBtn = document.getElementById("plusBtn");
  const namesBox = document.getElementById("namesBox");
  const hintBox = document.getElementById("hintBox");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({ names: true, hint: true }); // the page's Show=1 applet

  /** The line under the board. "done" is how a demo tells the record it was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  // Paint order: infinite guide lines, construction, dots, hint ticks, labels, handles.
  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const dots = board.layer("dots");
  const ticksLayer = board.layer("ticks");
  const labels = board.layer("labels");
  const handleLayer = board.layer("handles");

  const origin = { x: 0, y: 0 };
  const lineAB = board.line(origin, origin, "guide", guides);
  const lineBC = board.line(origin, origin, "guide", guides);
  const segmentBC = board.segment(origin, origin, "segment", shapes);
  const joinBNC = board.segment(origin, origin, "join", shapes);

  const parallels = [], markDots = [], cutDots = [], markTicks = [], cutTicks = [];
  for (let i = 0; i < MAX; i++) {
    parallels.push(board.line(origin, origin, "parallel", guides));
    markDots.push(board.point(origin, "mark", 3.4, dots));
    cutDots.push(board.point(origin, "cut", 4, dots));
    markTicks.push(board.segment(origin, origin, "tick", ticksLayer));
    cutTicks.push(board.segment(origin, origin, "tick", ticksLayer));
  }

  const subDigits = "₀₁₂₃₄₅₆₇₈₉";
  const sub = (k) => String(k).split("").map((d) => subDigits[Number(d)] || "").join("");
  const labelB = board.label(origin, "B", "pt-label", -17, -9, labels);
  const labelC = board.label(origin, "C", "pt-label", 8, -9, labels);
  const markLabels = [], cutLabels = [];
  for (let i = 0; i < MAX; i++) {
    markLabels.push(board.label(origin, "B" + sub(i + 1), "mark-label", 6, 13, labels));
    cutLabels.push(board.label(origin, "D" + sub(i + 1), "mark-label", 6, -8, labels));
  }

  const clamp = (q) => ({
    x: Geom.clamp(q.x, 6, Core.WIDTH - 6),
    y: Geom.clamp(q.y, 6, Core.HEIGHT - 6),
  });
  const describe = (p) => `at board position ${Math.round(p.x)}, ${Math.round(p.y)}`;
  const onMove = (p, name) => apply({ type: "point", name, x: p.x, y: p.y });
  const label = (name, what) =>
    `Point ${name} ${what}. Drag it, or focus it and use the arrow keys (Shift for bigger steps)`;
  const A = board.handle("A", state.A, { step: 3, shift: 12, clamp, describe, onMove, layer: handleLayer, label: label("A", "on the sloping ray") });
  const B = board.handle("B", state.B, { step: 3, shift: 12, clamp, describe, onMove, layer: handleLayer, label: label("B", "at the start of the segment") });
  const Cc = board.handle("C", state.C, { step: 3, shift: 12, clamp, describe, onMove, layer: handleLayer, label: label("C", "at the end of the segment") });

  /** A short tick across the midpoint of a small segment, to mark equal lengths. */
  function tickAt(shape, p, q, size) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    const ux = (-dy / len) * size, uy = (dx / len) * size;
    shape.set({ x: mx - ux, y: my - uy }, { x: mx + ux, y: my + uy }).show(true);
  }

  function statusText(g) {
    if (!g.valid) return "A is on the line BC. Move it off the line: the parallels need a positive angle to cross BC.";
    const where = g.n <= 6
      ? Array.from({ length: g.n - 1 }, (_, i) => `${i + 1}/${g.n}`).join(", ")
      : `1/${g.n}, 2/${g.n}, …, ${g.n - 1}/${g.n}`;
    return `N = ${g.n}: BC is cut into ${g.parts} equal parts; the crossings are at ${where} of the way from B to C.`;
  }

  function render(note) {
    const g = Core.construct(state);
    lineAB.set(g.B, g.A);
    lineBC.set(g.B, g.C);
    segmentBC.set(g.B, g.C);
    joinBNC.set(g.marks[g.n], g.C);

    for (let i = 0; i < MAX; i++) {
      if (g.valid && i < g.parallels.length) {
        parallels[i].set(g.marks[i + 1], g.parallels[i]).show(true);
      } else {
        parallels[i].show(false);
      }
    }
    for (let i = 2; i <= g.n; i++) markDots[i - 2].set(g.marks[i]).show(true);
    for (let i = g.n - 1; i < MAX; i++) markDots[i].show(false);
    cutDots.forEach((d) => d.show(false));
    if (g.valid) for (let i = 1; i < g.n; i++) cutDots[i - 1].set(g.cuts[i]).show(true);

    if (state.hint && g.valid) {
      for (let i = 1; i <= g.n; i++) tickAt(markTicks[i - 1], g.marks[i - 1], g.marks[i], 4);
      for (let i = 1; i <= g.n; i++) tickAt(cutTicks[i - 1], g.cuts[i - 1], g.cuts[i], 3.5);
    } else {
      markTicks.forEach((s) => s.show(false));
      cutTicks.forEach((s) => s.show(false));
    }

    labelB.set(g.B);
    labelC.set(g.C);
    for (let i = 0; i < MAX; i++) {
      if (state.names && i < g.n) markLabels[i].set(g.marks[i + 1]).show(true);
      else markLabels[i].show(false);
      if (state.names && g.valid && i < g.n - 1) cutLabels[i].set(g.cuts[i + 1]).show(true);
      else cutLabels[i].show(false);
    }
    A.set(g.A);
    B.set(g.B);
    Cc.set(g.C);

    nOut.value = `${state.n} ${state.n === 1 ? "part" : "parts"}`;
    namesBox.checked = state.names;
    hintBox.checked = state.hint;
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state({
      A: g.A, B: g.B, C: g.C, n: state.n, parts: g.parts,
      cuts: g.cuts, valid: g.valid, names: state.names, hint: state.hint,
    });
    say(note || statusText(g), Core.result(state));
  }

  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) return false;
    state = next;
    render(note);
    return true;
  }

  minusBtn.addEventListener("click", () => {
    if (state.n <= Core.MIN_N) say("The applet allows 1 to 20 parts.");
    else apply({ type: "n", value: state.n - 1 });
  });
  plusBtn.addEventListener("click", () => {
    if (state.n >= Core.MAX_N) say("The applet allows 1 to 20 parts.");
    else apply({ type: "n", value: state.n + 1 });
  });
  namesBox.addEventListener("change", () => apply({ type: "names", value: namesBox.checked }));
  hintBox.addEventListener("change", () => apply({ type: "hint", value: hintBox.checked }));
  resetBtn.addEventListener("click", () => {
    apply({ type: "reset" });
    say("Back to the opening picture.", Core.result(state));
  });
  // Colours come from CSS tokens, but redraw on a theme flip all the same.
  board.onTheme(() => render());

  render();
})();
