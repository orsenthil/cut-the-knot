"use strict";

/*
 * The drawing and input for Four Crossing Circles.  All the geometry is in
 * four-crossing-circles-core.js; this file only puts the four circles, the two
 * crossing lines, the chords they cut off and the five draggable points on an
 * SVG board.  The two checkboxes reproduce the applet's "names" and "hint"
 * options; Reset restores its starting figure.
 */

(function () {
  const Core = FourCrossingCirclesCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("names");
  const hintBox = document.getElementById("hint");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});

  /* Back to front: hint strokes, the four circles, the crossing lines, the
   * chords, small dots, names, then the handles that keep keyboard focus. */
  const hints = board.layer("hints");
  const circles = board.layer("circles");
  const lines = board.layer("lines");
  const chords = board.layer("chords");
  const dots = board.layer("dots");
  const names = board.layer("names");
  const top = board.layer("handles");

  const hintLines = Array.from({ length: 7 }, () =>
    board.line({ x: 0, y: 0 }, { x: 0, y: 0 }, "hint", hints));
  const circleShapes = {
    c1: board.circle({ x: 0, y: 0 }, 1, "circle circle-one", circles),
    c2: board.circle({ x: 0, y: 0 }, 1, "circle circle-two", circles),
    ca: board.circle({ x: 0, y: 0 }, 1, "circle circle-a", circles),
    cb: board.circle({ x: 0, y: 0 }, 1, "circle circle-b", circles),
  };
  const secants = [
    board.line({ x: 0, y: 0 }, { x: 0, y: 0 }, "secant", lines),
    board.line({ x: 0, y: 0 }, { x: 0, y: 0 }, "secant", lines),
  ];
  const chordShapes = ["chord-a", "chord-a", "chord-b", "chord-b"].map((cls) =>
    board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "chord " + cls, chords));

  const dotKeys = ["A1", "A2", "B1", "B2", "Aq1a", "Aq1b", "Aq2a", "Aq2b",
                   "Bq1a", "Bq1b", "Bq2a", "Bq2b", "O1", "O2"];
  const dotClass = (key) => key.startsWith("A") ? "dot dot-a" :
    key.startsWith("B") ? "dot dot-b" : "dot dot-centre";
  const dotShapes = {};
  for (const key of dotKeys) {
    dotShapes[key] = board.point({ x: 0, y: 0 }, dotClass(key), key.startsWith("O") ? 3 : 3.5, dots);
  }

  const labelText = {
    A: "A", B: "B", O: "O", A1: "A₁", A2: "A₂", B1: "B₁", B2: "B₂",
    O1: "O₁", O2: "O₂",
  };
  const labelOffsets = {
    A: [-14, -9], B: [-14, 19], O: [7, 5],
    A1: [7, -8], A2: [7, -8], B1: [7, 18], B2: [7, 18],
    O1: [-18, -9], O2: [7, -9],
  };
  const labels = {};
  for (const key of Object.keys(labelText)) {
    labels[key] = board.label({ x: 0, y: 0 }, labelText[key], "point-label",
      labelOffsets[key][0], labelOffsets[key][1], names);
  }

  const handleLabel = {
    A: "Point A, one of the two crossings of the first pair of circles",
    B: "Point B, the other crossing of the first pair of circles",
    C: "Point C, a point on the first circle through A and B",
    D: "Point D, a point on the second circle through A and B",
    O: "Point O, the shared centre of the two inner circles",
  };
  const handleOpts = (name) => ({
    label: handleLabel[name],
    r: 8, step: 5, shift: 15, layer: top,
    clamp: (q) => Core.project(state, name, q),
    describe: (p) => "at x " + Math.round(p.x) + ", y " + Math.round(p.y),
    onMove: (p) => { state = Core.move(state, name, p); render(); },
  });
  const handles = {};
  for (const name of Core.legalMoves(state)) {
    handles[name] = board.handle(name, state[name], handleOpts(name));
  }

  /** `#status` is how the player's record sees a finished exploration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function showAll(shapes, on) {
    for (const shape of shapes) shape.show(on);
  }

  function render() {
    const g = Core.geometry(state);
    const valid = !!g;

    for (const name of Object.keys(handles)) handles[name].set(state[name]);
    showAll(Object.values(circleShapes), valid);
    showAll(secants, valid);
    showAll(chordShapes, valid);
    showAll(Object.values(dotShapes), valid);
    showAll(Object.values(labels), valid && state.options.names);

    if (valid) {
      circleShapes.c1.set(g.circle1.c, g.circle1.r);
      circleShapes.c2.set(g.circle2.c, g.circle2.r);
      circleShapes.ca.set(g.circleA.c, g.circleA.r);
      circleShapes.cb.set(g.circleB.c, g.circleB.r);
      secants[0].set(g.A1, g.B1);
      secants[1].set(g.A2, g.B2);
      const chordPairs = [g.Aq1, g.Aq2, g.Bq1, g.Bq2];
      chordPairs.forEach((pair, i) => chordShapes[i].set(pair[0], pair[1]));

      const at = {
        A1: g.A1, A2: g.A2, B1: g.B1, B2: g.B2,
        Aq1a: g.Aq1[0], Aq1b: g.Aq1[1], Aq2a: g.Aq2[0], Aq2b: g.Aq2[1],
        Bq1a: g.Bq1[0], Bq1b: g.Bq1[1], Bq2a: g.Bq2[0], Bq2b: g.Bq2[1],
        O1: g.circle1.c, O2: g.circle2.c,
      };
      for (const key of dotKeys) {
        dotShapes[key].set(at[key]);
        dotShapes[key].show(key.startsWith("O") ? state.options.hint : true);
      }
      const where = Object.assign({}, at, { A: g.A, B: g.B, O: g.O });
      for (const key of Object.keys(labels)) {
        labels[key].set(where[key]);
        labels[key].show(state.options.names &&
          (key !== "O1" && key !== "O2" ? true : state.options.hint));
      }

      // The applet's hint: A1A, B1B, A2A, B2B, AB and the two radii to O1, O2.
      const hintPairs = [
        [g.A1, g.A], [g.B1, g.B], [g.A2, g.A], [g.B2, g.B],
        [g.A, g.B], [g.O, g.circle1.c], [g.O, g.circle2.c],
      ];
      hintPairs.forEach(([p, q], i) => hintLines[i].set(p, q));
      showAll(hintLines, state.options.hint);
    } else {
      showAll(hintLines, false);
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: state.A, B: state.B, C: state.C, D: state.D, O: state.O,
        circles: valid ? { O1: g.circle1, O2: g.circle2, Oa: g.circleA, Ob: g.circleB } : null,
        points: valid ? { A1: g.A1, A2: g.A2, B1: g.B1, B2: g.B2 } : null,
        Ra: valid ? g.Ra : null, Rb: valid ? g.Rb : null,
        chordA: valid ? [g.chordA1, g.chordA2] : null,
        chordB: valid ? [g.chordB1, g.chordB2] : null,
        options: state.options,
      });
    }
  }

  function toggle(name, box) {
    box.addEventListener("change", () => {
      state = Core.setOption(state, name, box.checked);
      render();
    });
  }
  toggle("names", namesBox);
  toggle("hint", hintBox);

  resetBtn.addEventListener("click", () => { state = Core.reset(state); render(); });

  board.onTheme(render);
  render();
})();
