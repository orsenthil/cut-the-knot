"use strict";

/*
 * The page for Simultaneous Diameters in Concurrent Circles: drawing and input
 * only. The geometry is in diameters-in-concurrent-circles-core.js. Four dots
 * (O, P, Q, R) can be dragged or nudged with the arrow keys; the three circles
 * through O, the chords through the other intersections and the six named
 * points are rebuilt from the core on every redraw. The three eye marks echo
 * the original droodle: they open when all three diameters are found.
 */

(function () {
  const Core = DiametersInConcurrentCirclesCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("names");
  const extraBox = document.getElementById("extra");
  const newBtn = document.getElementById("newBtn");
  const board = Geom.board(document.getElementById("board"));

  const circlesLayer = board.layer("circles");
  const chordsLayer = board.layer("chords");
  const hintLayer = board.layer("hint");
  const marksLayer = board.layer("marks");
  const labelLayer = board.layer("labels");
  const eyeLayer = board.layer("eyes");
  const handlesLayer = board.layer("handles");

  let state = Core.start({});
  let pointer = null;

  const circleShapes = ["cP", "cQ", "cR"].map((cls) =>
    board.circle(state.O, 1, "cc-circle " + cls, circlesLayer));
  const chordShapes = ["chordA", "chordB", "chordC"].map((cls) =>
    board.line(state.O, state.O, "chord " + cls, chordsLayer));
  const markShapes = ["A", "B", "C", "D", "E", "F"].map((name) =>
    board.point(state.O, "derived mark-" + name, 3, marksLayer));
  const nameShapes = ["A", "B", "C", "D", "E", "F", "O"].map((name) =>
    board.label(state.O, name, "point-label", 7, -7, labelLayer));
  const centreLabels = ["P", "Q", "R"].map((name) =>
    board.label(state.O, name, "centre-label", 8, -8, labelLayer));
  const hintShape = board.polygon([state.O, state.O, state.O], "hint-triangle", hintLayer);

  // The applet's three little eye trackers, in its own canvas coordinates.
  const eyePlaces = [
    { x: 70, y: 50 }, { x: 315, y: 40 }, { x: 165, y: 70 },
  ];
  const eyeShapes = eyePlaces.map((p) => board.point(p, "eye", 6, eyeLayer));
  const pupilShapes = eyePlaces.map((p) => board.point(p, "pupil", 2.5, eyeLayer));

  const handles = ["O", "P", "Q", "R"].map((name) => board.handle(name, state[name], {
    r: 8, step: 2, shift: 10, layer: handlesLayer,
    label: "Point " + name + ". Drag it, or focus it and use the arrow keys to move it.",
    describe: (p) => "at " + Math.round(p.x) + ", " + Math.round(p.y),
    clamp: (q) => ({
      x: Geom.clamp(q.x, Core.EDGE, state.width - Core.EDGE),
      y: Geom.clamp(q.y, Core.EDGE, state.height - Core.EDGE),
    }),
    onMove: (point, moved) => {
      state = Core.movePoint(state, moved, point);
      render();
    },
  }));

  /**
   * The shared status line. A demo has no win or loss, so no status class is
   * set: the record counts the picture as explored. `kind` is kept so the
   * shape of say(text, kind) is the same on every port.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.compute(state);
    const circles = [g.cP, g.cQ, g.cR];
    for (let i = 0; i < 3; i++) {
      circleShapes[i].show(!!circles[i]);
      if (circles[i]) circleShapes[i].set(circles[i].center, circles[i].radius);
      chordShapes[i].show(!!g[["A", "B", "C"][i]] && !!g[["D", "E", "F"][i]]);
      if (g[["A", "B", "C"][i]] && g[["D", "E", "F"][i]]) {
        chordShapes[i].set(g[["A", "B", "C"][i]], g[["D", "E", "F"][i]]);
      }
      handles[i + 1].set(state[["P", "Q", "R"][i]]);
      centreLabels[i].set(state[["P", "Q", "R"][i]]);
    }
    handles[0].set(state.O);

    const derived = [g.A, g.B, g.C, g.D, g.E, g.F];
    for (let i = 0; i < derived.length; i++) {
      markShapes[i].show(g.valid && !!derived[i]);
      nameShapes[i].show(g.valid && !!derived[i] && namesBox.checked);
      if (derived[i]) {
        markShapes[i].set(derived[i]);
        nameShapes[i].set(derived[i]);
      }
    }
    nameShapes[6].show(namesBox.checked);
    nameShapes[6].set(state.O);

    hintShape.show(extraBox.checked && g.valid &&
      !!(g.A && g.B && g.C));
    if (g.A && g.B && g.C) hintShape.set([g.A, g.B, g.C]);

    for (let i = 0; i < eyePlaces.length; i++) {
      let p = pointer || { x: eyePlaces[i].x, y: eyePlaces[i].y };
      let dx = p.x - eyePlaces[i].x, dy = p.y - eyePlaces[i].y;
      const d = Math.hypot(dx, dy) || 1;
      const r = Math.min(3.5, d);
      pupilShapes[i].set({
        x: eyePlaces[i].x + dx / d * r,
        y: eyePlaces[i].y + dy / d * r,
      });
      pupilShapes[i].node.setAttribute("class", g.all ? "pupil awake" : "pupil");
      eyeShapes[i].node.setAttribute("class", g.all ? "eye awake" : "eye");
    }

    const lit = [g.pok, g.qok, g.rok].filter(Boolean).length;
    let message;
    if (!g.valid) {
      message = "Move P, Q or R away from O to draw the circles.";
    } else if (g.all) {
      message = "OA, OB and OC are all diameters. The three eyes are wide awake!";
    } else {
      const parts = [];
      if (!g.pok) parts.push("OA");
      if (!g.qok) parts.push("OB");
      if (!g.rok) parts.push("OC");
      message = lit + " of 3 diameters found; " + parts.join(", ") +
        (parts.length === 1 ? " is" : " are") + " not a diameter yet. " +
        "Drag a dot, or focus it and press the arrow keys.";
    }
    say(message, "");

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  newBtn.addEventListener("click", () => {
    state = Core.reset(state);
    pointer = null;
    render();
  });
  namesBox.addEventListener("change", render);
  extraBox.addEventListener("change", render);
  board.root.addEventListener("pointermove", (e) => {
    pointer = board.toLocal(e.clientX, e.clientY);
    render();
  });
  board.root.addEventListener("pointerleave", () => {
    pointer = null;
    render();
  });

  board.onTheme(() => render());
  render();
})();
