"use strict";

/*
 * The page for Al-Nayrizi's construction: drawing and input only; the exact
 * construction lives in al-nayrizi-construction-core.js. The board shows the
 * segment BC, the ray BA, the parallel line through C, the N marks on each,
 * the N joining lines and the cuts they make on BC. A, B and C are draggable
 * handles; B and C always stay level, as in the original applet.
 */

(function () {
  const Core = AlNayriziConstructionCore;
  const MAX = Core.MAX_MARKS;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const nOut = document.getElementById("nOut");
  const minusBtn = document.getElementById("minusBtn");
  const plusBtn = document.getElementById("plusBtn");
  const namesBox = document.getElementById("namesBox");
  const hintBox = document.getElementById("hintBox");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();

  /** The line under the board. "done" is how a demo tells the record it was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  // Paint order: guides, joining lines, ticks and dots, labels, draggable handles.
  const guides = board.layer("guides");
  const joining = board.layer("joining");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const handleLayer = board.layer("handles");

  const origin = { x: 0, y: 0 };
  const lineAB = board.line(origin, origin, "guide", guides);
  const lineBC = board.line(origin, origin, "guide", guides);
  const lineThroughC = board.line(origin, origin, "guide", guides);
  const segmentBC = board.segment(origin, origin, "segment", guides);

  const crosses = [], cuts = [];
  const marksB = [], marksC = [];
  const ticksB = [], ticksC = [], ticksBC = [];
  const labelsB = [], labelsC = [];
  for (let i = 0; i < MAX; i++) {
    crosses.push(board.segment(origin, origin, "cross", joining));
    ticksB.push(board.segment(origin, origin, "tick", joining));
    ticksC.push(board.segment(origin, origin, "tick", joining));
  }
  for (let i = 0; i <= MAX + 1; i++) cuts.push(board.point(origin, "cut", 4, dots));
  for (let i = 0; i <= MAX; i++) {
    marksB.push(board.point(origin, "mark", 3.2, dots));
    marksC.push(board.point(origin, "mark", 3.2, dots));
  }
  for (let i = 0; i <= MAX; i++) ticksBC.push(board.segment(origin, origin, "tick", joining));

  const labelA = board.label(origin, "A", "pt-label", 9, -8, labels);
  const labelB = board.label(origin, "B", "pt-label", -16, -9, labels);
  const labelC = board.label(origin, "C", "pt-label", 8, -9, labels);
  const subDigits = "₀₁₂₃₄₅₆₇₈₉";
  const sub = (k) => String(k).split("").map((d) => subDigits[Number(d)]).join("");
  for (let i = 1; i <= MAX; i++) {
    labelsB.push(board.label(origin, "B" + sub(i), "mark-label", 6, 13, labels));
    labelsC.push(board.label(origin, "C" + sub(i), "mark-label", 6, -7, labels));
  }

  const clamp = (q) => ({
    x: Geom.clamp(q.x, 6, Core.WIDTH - 6),
    y: Geom.clamp(q.y, 6, Core.HEIGHT - 6),
  });
  const describe = (p) => `at board position ${Math.round(p.x)}, ${Math.round(p.y)}`;
  const onMove = (p, name) => apply({ type: "point", name, x: p.x, y: p.y });
  const A = board.handle("A", state.A, { step: 3, shift: 12, clamp, describe, onMove, layer: handleLayer });
  const B = board.handle("B", state.B, { step: 3, shift: 12, clamp, describe, onMove, layer: handleLayer });
  const Cc = board.handle("C", state.C, { step: 3, shift: 12, clamp, describe, onMove, layer: handleLayer });

  /** A short tick across the midpoint of a small segment, to mark equal lengths. */
  function tickAt(shape, p, q, size) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    const ux = (-dy / len) * size, uy = (dx / len) * size;
    shape.set({ x: mx - ux, y: my - uy }, { x: mx + ux, y: my + uy }).show(true);
  }

  function statusText(g) {
    let where;
    if (g.n <= 6) where = Array.from({ length: g.n }, (_, i) => `${i + 1}/${g.parts}`).join(", ");
    else where = `1/${g.parts}, 2/${g.parts}, …, ${g.n}/${g.parts}`;
    return `N = ${g.n}: ${g.parts} equal parts of BC; the cuts are at ${where} of the way from B to C.`;
  }

  function render(note) {
    const g = Core.construct(state);
    lineAB.set(g.B, g.A);
    lineBC.set(g.B, g.C);
    lineThroughC.set(g.C, { x: g.C.x + g.dx, y: g.C.y + g.dy });
    segmentBC.set(g.B, g.C);

    for (let i = 0; i < MAX; i++) {
      if (i < g.n) crosses[i].set(g.crossLines[i][0], g.crossLines[i][1]).show(true);
      else crosses[i].show(false);
    }
    g.marksB.forEach((p, i) => marksB[i].set(p).show(true));
    g.marksC.forEach((p, i) => marksC[i].set(p).show(true));
    for (let i = g.marksB.length; i <= MAX; i++) { marksB[i].show(false); marksC[i].show(false); }
    g.cuts.forEach((p, i) => cuts[i].set(p).show(true));
    for (let i = g.cuts.length; i <= MAX + 1; i++) cuts[i].show(false);

    if (state.hint) {
      for (let i = 1; i <= g.n; i++) {
        tickAt(ticksB[i - 1], g.marksB[i - 1], g.marksB[i], 4);
        tickAt(ticksC[i - 1], g.marksC[i - 1], g.marksC[i], 4);
      }
      for (let i = 0; i <= g.n; i++) tickAt(ticksBC[i], g.cuts[i], g.cuts[i + 1], 3.5);
    } else {
      ticksB.forEach((s) => s.show(false));
      ticksC.forEach((s) => s.show(false));
      ticksBC.forEach((s) => s.show(false));
    }

    labelA.set(g.A);
    labelB.set(g.B);
    labelC.set(g.C);
    labelsB.forEach((s, i) => {
      if (state.names && i < g.n) s.set(g.marksB[i + 1]).show(true);
      else s.show(false);
    });
    labelsC.forEach((s, i) => {
      if (state.names && i < g.n) s.set(g.marksC[i + 1]).show(true);
      else s.show(false);
    });
    A.set(g.A);
    B.set(g.B);
    Cc.set(g.C);

    nOut.value = `${state.n} ${state.n === 1 ? "mark" : "marks"}`;
    namesBox.checked = state.names;
    hintBox.checked = state.hint;
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state({
      A: g.A, B: g.B, C: g.C, n: state.n, parts: g.parts,
      cuts: g.cuts, names: state.names, hint: state.hint,
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
    if (state.n <= Core.MIN_MARKS) say("The applet allows 1 to 20 marks.");
    else apply({ type: "marks", value: state.n - 1 });
  });
  plusBtn.addEventListener("click", () => {
    if (state.n >= Core.MAX_MARKS) say("The applet allows 1 to 20 marks.");
    else apply({ type: "marks", value: state.n + 1 });
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
