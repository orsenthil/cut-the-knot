"use strict";

/*
 * Max Common Chord 6 — drawing and input only. The construction is in
 * max-common-chord-6-core.js. The board keeps four focusable handles (P, Q,
 * A and B) and redraws the auxiliary circles and points through .set(), so a
 * keyboard focus ring survives every change. Dragging A or B slides the chord
 * along the two circles; the "circles" option instead lets the drag reshape a
 * circle, exactly as in the applet. The best-chord button is a reading aid: it
 * places A and B where the core says AP×PB is largest.
 */

(function () {
  const Core = MaxCommonChord6Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const modeRadios = Array.from(document.querySelectorAll('input[name="mode"]'));
  const namesBox = document.getElementById("names");
  const bestBtn = document.getElementById("bestBtn");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});

  /* Back to front: guides, chord, derived points, labels, draggable handles. */
  const guides = board.layer("guides");
  const chordLayer = board.layer("chord");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const top = board.layer("handles");

  const circleE = board.circle(state.P, 1, "circle-e", guides);
  const circleF = board.circle(state.Q, 1, "circle-f", guides);
  const circleO = board.circle(state.P, 1, "circle-o", guides);
  const circleEQF = board.circle(state.P, 1, "circle-eqf", guides);
  const circleAB = board.circle(state.P, 1, "circle-ab", guides);
  const linePQ = board.line(state.P, state.Q, "line-pq", guides);
  const lineSN = board.line(state.P, state.Q, "line-sn", guides);
  const chord = board.segment(state.A, state.B, "chord-ab", chordLayer);

  const dotNames = ["L", "M", "R", "S", "U", "T", "N", "W"];
  const dotOffsets = {
    L: [-22, -10], M: [8, -10], R: [8, -8], S: [8, -12],
    U: [-20, 20], T: [8, 18], N: [-12, 22], W: [8, 20],
  };
  const dots = {};
  const names = {};
  for (const key of dotNames) {
    dots[key] = board.point(state.P, "aux-dot", 4, marks);
    names[key] = board.label(state.P, key, "point-label",
      dotOffsets[key][0], dotOffsets[key][1], labels);
  }
  const handleNames = ["P", "Q", "A", "B"];
  const handleOffsets = { P: [-22, -12], Q: [-22, 20], A: [-22, -12], B: [8, -12] };
  const handleLabels = {};
  for (const key of handleNames) {
    handleLabels[key] = board.label(state[key], key, "point-label",
      handleOffsets[key][0], handleOffsets[key][1], labels);
  }
  const angleLeft = board.angleArc(state.P, state.A, state.A, 24, "angle-arc", marks);
  const angleRight = board.angleArc(state.P, state.B, state.B, 32, "angle-arc", marks);
  const rightA = board.rightAngle(state.A, state.P, state.P, 12, "right-mark", marks);
  const rightB = board.rightAngle(state.B, state.P, state.P, 12, "right-mark", marks);
  const midDot = board.point(state.P, "mid-dot", 5, marks);

  const handles = {};
  for (const key of handleNames) {
    handles[key] = board.handle(key, state[key], {
      r: 12, step: 3, shift: 15, layer: top,
      clamp: (p) => Core.geom.clampToBoard(p),
      label: `Point ${key}. Drag it, or focus it and use the arrow keys to move it.`,
      onMove: (p, name) => {
        state = Core.drag(state, name, p);
        render();
      },
    });
  }

  /** Announcements on the shared status line; no win or loss in a drawing. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.compute(state);
    for (const key of handleNames) {
      handles[key].set(state[key]);
      handleLabels[key].set(state[key]);
      handleLabels[key].show(state.showNames);
    }

    const shapes = [circleE, circleF, circleO, circleEQF, circleAB, linePQ, lineSN,
      chord, angleLeft, angleRight, rightA, rightB, midDot];
    for (const shape of shapes) shape.show(g.valid);
    for (const key of dotNames) dots[key].show(g.valid);
    for (const key of dotNames) names[key].show(g.valid && state.showNames);

    if (g.valid) {
      circleE.set(g.E, g.E.r);
      circleF.set(g.F, g.F.r);
      circleO.set(g.EQF, g.EQF.r);
      circleEQF.set(g.EQF, g.EQF.r);
      circleAB.set(g.AB, g.AB.r);
      linePQ.set(state.P, state.Q);
      lineSN.set(g.S, g.perp);
      chord.set(state.A, state.B);

      for (const key of dotNames) {
        dots[key].set(g[key]);
        names[key].set(g[key]);
      }
      midDot.set(g.W);
      angleLeft.show(g.finished).set(state.P, g.E, state.A, 24);
      angleRight.show(g.finished).set(state.P, g.F, state.B, 32);
      rightA.show(g.finished).set(state.A, g.W, g.E, 12);
      rightB.show(g.finished).set(state.B, g.W, g.F, 12);
    }

    say(Core.describe(state));

    // The picture, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        P: state.P, Q: state.Q, A: state.A, B: state.B,
        S: g.valid ? g.S : null, W: g.valid ? g.W : null,
        mode: state.mode, showNames: state.showNames,
        finished: g.valid && g.finished,
        product: g.valid ? g.product : null,
      });
    }
  }

  function syncControls() {
    modeRadios.forEach((r) => { r.checked = r.value === state.mode; });
    namesBox.checked = state.showNames;
  }

  for (const radio of modeRadios) {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      state = Core.setOption(state, "mode", radio.value);
      render();
    });
  }
  namesBox.addEventListener("change", () => {
    state = Core.setOption(state, "showNames", namesBox.checked);
    render();
  });
  bestBtn.addEventListener("click", () => {
    const next = Core.optimal(state);
    if (next) state = next;
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    syncControls();
    render();
  });

  // SVG colours are classes, so a theme flip needs no recompute; redraw anyway
  // to keep the shared Geom helper's hook.
  board.onTheme(render);
  syncControls();
  render();
})();
