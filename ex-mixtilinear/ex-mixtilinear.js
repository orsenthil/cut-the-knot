"use strict";

/*
 * The page for Ex Mixtilinear: drawing and input only. Every rule and every
 * geometric construction lives in ex-mixtilinear-core.js. The board shows the
 * triangle, its circumcircle, the two circles tangent to AK, BC and the
 * circumcircle, and the chord through each circle's two touching points.
 * A, B, C and K are focusable handles; each can be dragged or nudged with the
 * arrow keys. Shapes are created once and re-set on every redraw, so focus
 * stays on the handle the player is using.
 */

(function () {
  const Core = ExMixtilinearCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const namesChk = document.getElementById("namesChk");
  const hintChk = document.getElementById("hintChk");
  const snapBtn = document.getElementById("snapBtn");
  const resetBtn = document.getElementById("resetBtn");
  const board = Geom.board(document.getElementById("board"));
  const { clamp, mid } = Geom;

  const INITIAL = {
    A: { x: 200, y: 30 }, B: { x: 140, y: 280 }, C: { x: 260, y: 280 },
    K: { x: 176, y: 280 }, showNames: true, showHint: false,
  };
  let state = { ...INITIAL };

  const layers = ["guides", "circles", "chords", "dots", "labels", "handles"]
    .map((name) => board.layer(name));
  const [guides, circles, chords, dots, labels, handleLayer] = layers;

  const tri = board.polygon([INITIAL.A, INITIAL.B, INITIAL.C], "tri", guides);
  const circum = board.circle(INITIAL.A, 1, "circum", guides);
  const incircle = board.circle(INITIAL.A, 1, "incircle", guides);
  const excircle = board.circle(INITIAL.A, 1, "excircle", guides);
  const cut = board.line(INITIAL.A, INITIAL.K, "cut", guides);
  const cB = board.circle(INITIAL.A, 1, "tangent-circle b", circles);
  const cC = board.circle(INITIAL.A, 1, "tangent-circle c", circles);
  const chordB = board.line(INITIAL.K, INITIAL.K, "chord", chords);
  const chordC = board.line(INITIAL.K, INITIAL.K, "chord", chords);
  const centerLine = board.line(INITIAL.K, INITIAL.K, "centres", chords);
  const hintLine = board.line(INITIAL.K, INITIAL.K, "hint-line", chords);
  const hintSeg = board.segment(INITIAL.K, INITIAL.K, "hint-seg", chords);
  const eDot = board.point(INITIAL.K, "excenter-dot", 5, dots);
  const aiDot = board.point(INITIAL.K, "contact-dot", 4, dots);
  const vDot = board.point(INITIAL.K, "hint-dot", 3.5, dots);
  const wDot = board.point(INITIAL.K, "hint-dot", 3.5, dots);
  const hDot = board.point(INITIAL.K, "hint-dot", 3.5, dots);
  const oDot = board.point(INITIAL.K, "hint-dot", 4.5, dots);
  const bDot = board.point(INITIAL.K, "tangent-dot", 3.5, dots);
  const cDot = board.point(INITIAL.K, "tangent-dot", 3.5, dots);
  const labelsById = {};
  ["A", "B", "C", "K", "E", "Ai", "V", "W", "H", "O", "M", "L"].forEach((key) => {
    labelsById[key] = board.label(INITIAL.A, key, "point-label", 6, -7, labels);
  });

  /**
   * The shared status line. "done" tells the player's record that this
   * illustration has reached the special equal-radius position; there is no
   * win or loss in the applet.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const placeLabel = (key, p, text, dx, dy) => {
    const label = labelsById[key];
    if (p) {
      label.show(true);
      label.set(p, text, dx, dy);
    } else label.show(false);
  };

  function render() {
    const fig = Core.figure(state);
    const [first, second] = fig.circles;

    tri.set([state.A, state.B, state.C]);
    if (fig.circumcircle) {
      circum.show(true).set(fig.circumcircle.center, fig.circumcircle.radius);
    } else circum.show(false);
    if (fig.incenter) {
      const I = fig.incenter;
      incircle.show(true).set(I, Math.min(Core.distToLine(I, state.A, state.B),
        Core.distToLine(I, state.B, state.C), Core.distToLine(I, state.C, state.A)));
    } else incircle.show(false);
    if (state.showHint && fig.excenter) {
      excircle.show(true).set(fig.excenter, fig.exradius);
    } else excircle.show(false);
    cut.set(state.A, state.K);

    cB.show(!!first);
    cC.show(!!second);
    if (first) cB.set(first.center, first.radius);
    if (second) cC.set(second.center, second.radius);
    chordB.show(!!first && !!fig.excenter);
    chordC.show(!!second && !!fig.excenter);
    if (first) chordB.set(first.bc, first.ak);
    if (second) chordC.set(second.bc, second.ak);

    const showHint = !!state.showHint && !!first && !!fig.excenter && !!fig.H;
    centerLine.show(showHint);
    hintLine.show(showHint);
    hintSeg.show(showHint);
    if (showHint) {
      centerLine.set(first.center, second ? second.center : first.center);
      hintLine.set(fig.W, fig.H);
      hintSeg.set(fig.O, first.bc);
    }

    eDot.show(!!fig.excenter).set(fig.excenter || state.K);
    aiDot.show(!!fig.incircleTouch).set(fig.incircleTouch || state.K);
    for (const [shape, point] of [[vDot, fig.V], [wDot, fig.W], [hDot, fig.H], [oDot, fig.O]]) {
      shape.show(showHint && !!point).set(point || state.K);
    }
    bDot.show(showHint && !!first).set(first ? first.bc : state.K);
    cDot.show(showHint && !!first).set(first ? first.ak : state.K);

    const names = !!state.showNames;
    placeLabel("A", names ? state.A : null, "A", 7, -7);
    placeLabel("B", names ? state.B : null, "B", -14, 14);
    placeLabel("C", names ? state.C : null, "C", 7, 14);
    placeLabel("K", names ? state.K : null, "K", 6, 15);
    placeLabel("E", names ? fig.excenter : null, "E", 7, -7);
    placeLabel("Ai", names && !showHint ? fig.incircleTouch : null, "touch", 8, 14);
    placeLabel("V", showHint ? fig.V : null, "V", 7, -7);
    placeLabel("W", showHint ? fig.W : null, "W", 7, -7);
    placeLabel("H", showHint ? fig.H : null, "H", 7, 14);
    placeLabel("O", showHint ? fig.O : null, "O", 7, -7);
    placeLabel("M", showHint && first ? first.bc : null, "M", 7, 14);
    placeLabel("L", showHint && first ? first.ak : null, "L", 7, -7);

    handles.forEach((h, i) => h.set([state.A, state.B, state.C, state.K][i]));

    const ra = fig.exradius;
    const report = first && second && ra
      ? `Circle radii: ${first.radius.toFixed(1)} and ${second.radius.toFixed(1)}. ` +
        `The A-excircle radius is ${ra.toFixed(1)}.`
      : "Move the points apart a little: two circles need room to exist.";
    if (fig.finished) say(report + " Both circles now match the excircle.", "done");
    else if (state.showHint) say(report + " The two touch-chords and the centres meet at E.");
    else say(report + " Press Find equal circles to see the special position.");

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  function update(point, q) {
    const next = Core.move(state, { point, x: q.x, y: q.y });
    if (next) {
      state = next;
      render();
    }
  }

  const clampToBoard = (q) => ({ x: clamp(q.x, 16, 384), y: clamp(q.y, 16, 404) });
  const clampK = (q) => {
    const dx = state.C.x - state.B.x, dy = state.C.y - state.B.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = clamp(((q.x - state.B.x) * dx + (q.y - state.B.y) * dy) / len2, 0.02, 0.98);
    return { x: state.B.x + t * dx, y: state.B.y + t * dy };
  };
  const handles = [];
  ["A", "B", "C", "K"].forEach((name, i) => {
    handles.push(board.handle(name, [state.A, state.B, state.C, state.K][i], {
      r: 9, step: 3, shift: 12, layer: handleLayer,
      cls: "geom-handle " + (name === "K" ? "k-handle" : "corner-handle"),
      label: name === "K"
        ? "Point K on side BC. Drag it along BC, or focus it and use the left and right arrow keys."
        : "Point " + name + " of the triangle. Drag it, or focus it and use the arrow keys to move it.",
      clamp: name === "K" ? clampK : clampToBoard,
      onMove: (p) => update(name, p),
    }));
  });

  snapBtn.addEventListener("click", () => {
    state = Core.snapToIncircle(state);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = { ...INITIAL, showNames: namesChk.checked, showHint: hintChk.checked };
    render();
  });
  namesChk.addEventListener("change", () => {
    state = { ...state, showNames: namesChk.checked };
    render();
  });
  hintChk.addEventListener("change", () => {
    state = { ...state, showHint: hintChk.checked };
    render();
  });

  board.onTheme(() => render());
  render();
})();
