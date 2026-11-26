"use strict";

/*
 * The page for Besteman's construction: drawing and input only; the geometry is
 * in besteman-core.js. An SVG shows the segment AB with two draggable ends, the
 * point C on its extension, the two circles, their chord DE, the crossing P and
 * the N equal marks. A and B always stay level, as in the original applet.
 */

(function () {
  const Core = BestemanCore;
  const MAX = Core.MAX_N;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const nOut = document.getElementById("nOut");
  const minusBtn = document.getElementById("minusBtn");
  const plusBtn = document.getElementById("plusBtn");
  const namesBox = document.getElementById("namesBox");
  const hintBox = document.getElementById("hintBox");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();

  /**
   * Shows the line under the board. "done" is how an illustration tells the
   * player's record it has been explored; nothing is won or lost here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  // Paint order: guides, circles and lines, dots, labels, draggable handles.
  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const handleLayer = board.layer("handles");

  const origin = { x: 0, y: 0 };
  const axis = board.line(origin, origin, "axis", guides);
  const hintLines = [
    board.segment(origin, origin, "hint", guides),
    board.segment(origin, origin, "hint", guides),
    board.segment(origin, origin, "hint", guides),
  ];
  const segmentAB = board.segment(origin, origin, "segment", shapes);
  const circleA = board.circle(origin, 1, "construction", shapes);
  const circleC = board.circle(origin, 1, "construction", shapes);
  const divider = board.segment(origin, origin, "divider", shapes);

  const halfMarks = [], divisions = [];
  for (let i = 0; i < MAX; i++) {
    halfMarks.push(board.point(origin, "mark", 3, dots));
    divisions.push(board.point(origin, "answer-dot", 3.5, dots));
  }
  const dotD = board.point(origin, "dot", 4.5, dots);
  const dotE = board.point(origin, "dot", 4.5, dots);
  const dotQ = board.point(origin, "dot", 4, dots);
  const dotP = board.point(origin, "answer-dot", 5.5, dots);

  const labelAt = (text, cls, dx, dy) => board.label(origin, text, cls, dx, dy, labels);
  const labelA = labelAt("A", "pt-label", -18, 22);
  const labelB = labelAt("B", "pt-label", 8, 22);
  const labelC = labelAt("C", "pt-label", 8, -10);
  const labelM = labelAt("M", "pt-label", -7, 22);
  const labelQ = labelAt("Q", "pt-label", -17, -9);
  const labelP = labelAt("P", "pt-label good", 7, 22);
  const labelE = labelAt("E", "pt-label", 8, -8);
  const labelD = labelAt("D", "pt-label", 8, 18);

  const view = board.viewBox;
  const clamp = (q) => ({
    x: Geom.clamp(q.x, view.x + 6, view.x + view.width - 6),
    y: Geom.clamp(q.y, view.y + 6, view.y + view.height - 6),
  });
  const describe = (p) => `at board position ${Math.round(p.x)}, ${Math.round(p.y)}`;
  const onMove = (p, name) => apply({ type: "point", name, x: p.x, y: p.y });
  const handleA = board.handle("A", state.A, {
    r: 9, step: 3, shift: 12, clamp, describe, onMove, layer: handleLayer,
    label: "Point A. Drag, or focus and use the arrow keys to move it.",
  });
  const handleB = board.handle("B", state.B, {
    r: 9, step: 3, shift: 12, clamp, describe, onMove, layer: handleLayer,
    label: "Point B. Drag, or focus and use the arrow keys to move it.",
  });

  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(2) : "—");

  function statusText(g) {
    if (g.degenerate) return "Move B away from A: the two circles need a segment to work with.";
    if (!g.P) return "The chord and the line AB are parallel here; move A or B a little.";
    let text = `N = ${g.n}: AB = ${fmt(g.AB)}, AC = ${fmt(g.AC)}. ` +
      `The chord cuts off AP = ${fmt(g.AP)} = AB/${g.n}.`;
    if (g.C.x > view.x + view.width || g.C.x < view.x || g.C.y < view.y || g.C.y > view.y + view.height) {
      text += " C is outside the picture; drag B closer to A to bring it in.";
    }
    return text;
  }

  function render() {
    const g = Core.construct(state);

    axis.set(g.A, g.C);
    segmentAB.set(g.A, g.B);
    circleA.set(g.A, g.AB);
    circleC.set(g.C, g.AC);
    circleA.show(!g.degenerate);
    circleC.show(!g.degenerate);

    const ready = !g.degenerate && Boolean(g.P);
    divider.show(ready);
    if (ready) divider.set(g.D, g.E);
    dotD.show(ready);
    dotE.show(ready);
    dotQ.show(ready && state.hint);
    dotP.show(ready);
    if (ready) {
      dotD.set(g.D);
      dotE.set(g.E);
      dotQ.set(g.Q);
      dotP.set(g.P);
    }

    g.halfMarks.forEach((p, i) => halfMarks[i].set(p).show(true));
    for (let i = g.halfMarks.length; i < MAX; i++) halfMarks[i].show(false);
    g.divisions.forEach((p, i) => divisions[i].set(p).show(true));
    for (let i = g.divisions.length; i < MAX; i++) divisions[i].show(false);

    hintLines.forEach((line, i) => {
      const ends = g.hintSegments && g.hintSegments[i];
      line.show(ready && state.hint && Boolean(ends));
      if (ends) line.set(ends[0], ends[1]);
    });

    const labelsShown = [
      [labelA, g.A, state.names, -18, 22],
      [labelB, g.B, state.names, 8, 22],
      [labelC, g.C, ready && state.names, 8, -10],
      [labelM, g.M, state.names, -7, 22],
      [labelQ, g.Q, ready && state.hint && state.names, -17, -9],
      [labelP, g.P, ready, 7, 22],
      [labelE, g.E, ready && state.names, 8, -8],
      [labelD, g.D, ready && state.names, 8, 18],
    ];
    labelsShown.forEach(([shape, p, on, dx, dy]) => {
      shape.show(Boolean(on));
      if (on) shape.set(p, undefined, dx, dy);
    });

    handleA.set(g.A);
    handleB.set(g.B);

    nOut.value = `N = ${g.n}`;
    namesBox.checked = state.names;
    hintBox.checked = state.hint;

    // The position, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, M: g.M, D: g.D, E: g.E, P: g.P, Q: g.Q,
        n: g.n, AB: g.AB, AC: g.AC, AP: g.AP,
        names: state.names, hint: state.hint,
      });
    }
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
    if (state.n <= Core.MIN_N) say(`N can be ${Core.MIN_N} to ${Core.MAX_N}.`, Core.result(state));
    else apply({ type: "n", value: state.n - 1 });
  });
  plusBtn.addEventListener("click", () => {
    if (state.n >= Core.MAX_N) say(`N can be ${Core.MIN_N} to ${Core.MAX_N}.`, Core.result(state));
    else apply({ type: "n", value: state.n + 1 });
  });
  namesBox.addEventListener("change", () => apply({ type: "names", value: namesBox.checked }));
  hintBox.addEventListener("change", () => apply({ type: "hint", value: hintBox.checked }));
  resetBtn.addEventListener("click", () => {
    apply({ type: "reset" });
    say("Back to the opening picture.", Core.result(state));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") apply({ type: "reset" });
  });
  board.onTheme(() => render());

  render();
})();
