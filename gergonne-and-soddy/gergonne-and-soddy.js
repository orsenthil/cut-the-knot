"use strict";

/*
 * The page for Gergonne and Soddy: drawing and input only. All the geometry is
 * in gergonne-and-soddy-core.js. The board has three focusable corner handles;
 * the touch points, cevians, Nobbs points, the two long lines, the inversion
 * circles and the right-angle marks are made once and set() on every redraw,
 * so keyboard focus survives. There is no win or loss: this is a theorem that
 * stays true however the corners are dragged.
 */

(function () {
  const Core = GergonneAndSoddyCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const board = Geom.board(document.getElementById("board"));

  const invLayer = board.layer("inversions");
  const shapeLayer = board.layer("shapes");
  const lineLayer = board.layer("lines");
  const dotLayer = board.layer("dots");
  const markLayer = board.layer("marks");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  let state = Core.start({});

  const triangle = [0, 1, 2].map(() => board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "side", shapeLayer));
  const chords = [0, 1, 2].map(() => board.line({ x: 0, y: 0 }, { x: 1, y: 1 }, "chord", shapeLayer));
  const cevians = [0, 1, 2].map(() => board.line({ x: 0, y: 0 }, { x: 1, y: 1 }, "cevian", shapeLayer));
  const incircle = board.circle({ x: 0, y: 0 }, 1, "incircle", shapeLayer);
  const gLine = board.line({ x: 0, y: 0 }, { x: 1, y: 1 }, "gergonne-line", lineLayer);
  const sLine = board.line({ x: 0, y: 0 }, { x: 1, y: 1 }, "soddy-line", lineLayer);
  const invCircles = [0, 1, 2, 3, 4, 5, 6].map(() =>
    board.circle({ x: 0, y: 0 }, 1, "inversion-circle", invLayer));

  const dotKeys = ["A1", "B1", "C1", "A2", "B2", "C2", "Ge", "I", "S"];
  const dots = dotKeys.map((key) =>
    board.point({ x: 0, y: 0 }, "dot dot-" + key, key === "I" ? 6 : 4.5, dotLayer));
  const marks = [0, 1, 2].map(() =>
    board.rightAngle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, 14, "right-mark", markLayer));

  const labelKeys = ["A", "B", "C", "A1", "B1", "C1", "A2", "B2", "C2", "I", "Ge", "S"];
  const labelText = { A1: "A₁", B1: "B₁", C1: "C₁", A2: "A₂", B2: "B₂", C2: "C₂", Ge: "Ge" };
  const labels = labelKeys.map((key) =>
    board.label({ x: 0, y: 0 }, labelText[key] || key, "point-label", 7, -7, labelLayer));

  const names = ["A", "B", "C"];
  const handles = names.map((name) => board.handle(name, state[name], {
    r: 12, step: 3, shift: 15, layer: handleLayer,
    label: "Vertex " + name + ". Drag it, or focus it and use the arrow keys to move it.",
    clamp: (q) => ({
      x: Geom.clamp(q.x, Core.MARGIN, state.width - Core.MARGIN),
      y: Geom.clamp(q.y, Core.MARGIN, state.height - Core.MARGIN),
    }),
    onMove: (point) => {
      state = Core.setPoint(state, name, point);
      render();
    },
  }));

  /** The shared status line. An illustration has no win or loss to report. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const geom = Core.geometry(state);
    const opts = ["names", "premises", "statement", "inversion"];
    for (const key of opts) {
      const btn = document.getElementById(key + "Btn");
      btn.setAttribute("aria-pressed", String(state[key]));
    }

    if (!geom.valid) {
      for (const shape of triangle.concat(chords, cevians, [incircle, gLine, sLine],
        invCircles, dots, marks, labels)) shape.show(false);
      say("Move a corner so the three dots make a triangle.");
      if (window.Track) window.Track.state(Core.position(state));
      return;
    }

    for (let i = 0; i < 3; i++) {
      handles[i].set(state[names[i]]);
      triangle[i].set(state[names[i]], state[names[(i + 1) % 3]]).show(true);
    }
    const l = geom.lines;
    const lineSets = [
      [chords[0], l.A1B1], [chords[1], l.B1C1], [chords[2], l.C1A1],
    ];
    for (const [shape, seg] of lineSets) shape.set(seg.p, seg.q).show(true);
    for (const [shape, seg] of [[cevians[0], l.AA], [cevians[1], l.BB], [cevians[2], l.CC]]) {
      shape.set(seg.p, seg.q).show(state.premises);
    }
    incircle.set(geom.I, geom.r).show(state.premises);

    gLine.set(l.GL.p, l.GL.q).show(true);
    sLine.set(l.SL ? l.SL.p : { x: 0, y: 0 }, l.SL ? l.SL.q : { x: 1, y: 1 })
      .show(Boolean(l.SL));

    for (let i = 0; i < invCircles.length; i++) {
      const image = geom.inversions[i];
      if (image.kind === "circle") {
        invCircles[i].set(image.c, image.r);
      } else {
        // The applet draws a line unchanged when it passes within 0.1 of I.
        invCircles[i].set(image.line.p, 0.001);
      }
      invCircles[i].show(state.inversion && image.kind === "circle" && image.r < 1500);
    }

    const points = {
      A1: geom.A1, B1: geom.B1, C1: geom.C1,
      A2: geom.A2, B2: geom.B2, C2: geom.C2,
      Ge: geom.Ge, I: geom.I, S: geom.S || { x: -100, y: -100 },
    };
    for (let i = 0; i < dotKeys.length; i++) {
      const key = dotKeys[i];
      dots[i].set(points[key]).show(key !== "S" || Boolean(geom.S));
    }
    for (let i = 0; i < marks.length; i++) {
      if (state.statement && geom.S && geom.marks[i]) {
        marks[i].set(geom.S, geom.I, geom.marks[i], 14).show(true);
      } else {
        marks[i].show(false);
      }
    }

    const labelPoints = [state.A, state.B, state.C, geom.A1, geom.B1, geom.C1,
      geom.A2, geom.B2, geom.C2, geom.I, geom.Ge, geom.S || { x: -100, y: -100 }];
    for (let i = 0; i < labels.length; i++) {
      labels[i].set(labelPoints[i], labelText[labelKeys[i]] || labelKeys[i]).show(state.names);
    }

    if (geom.soddyDefined && geom.angle !== null) {
      say("The Gergonne line and the Soddy line cross at " + geom.angle.toFixed(1) +
        "° — a right angle, wherever you put the corners.");
    } else {
      say("I and Ge are the same point here, so the Soddy line is not defined.");
    }

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  for (const key of ["names", "premises", "statement", "inversion"]) {
    document.getElementById(key + "Btn").addEventListener("click", () => {
      state = Core.setOption(state, key, !state[key]);
      render();
    });
  }
  document.getElementById("resetBtn").addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  board.onTheme(() => render());
  render();
})();
