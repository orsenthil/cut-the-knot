"use strict";

/*
 * The page for Five Concyclic Points: drawing and input only; the geometry is
 * in five-concyclic-points-core.js. The board shows the two crossing lines,
 * the four grey auxiliary circles, circle (O) through M1,M2,N1,N2 and the
 * green five-point circle. Six focusable handles (M, N, P, Q and the two line
 * directions) can be dragged or moved with the arrow keys; all shapes are
 * updated in place so keyboard focus stays where it was.
 */

(function () {
  const Core = FiveConcyclicPointsCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const exampleBtn = document.getElementById("exampleBtn");
  const namesChk = document.getElementById("namesChk");
  const board = Geom.board(document.getElementById("board"));

  const guides = board.layer("guides");
  const aux = board.layer("aux");
  const circles = board.layer("circles");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const handlesLayer = board.layer("handles");

  // A second arrangement, used by the "Other arrangement" button.
  const EXAMPLE = {
    M: { x: 350, y: 330 }, N: { x: 130, y: 90 },
    P: { x: 330, y: 140 }, Q: { x: 120, y: 300 },
    Lm: { x: 430, y: 60 }, Ln: { x: 270, y: 90 },
  };

  let state = Core.start();
  const first = Core.geometry(state);
  const firstState = state;

  const lineMN = board.line(firstState.M, firstState.N, "base-line", guides);
  const linePQ = board.line(firstState.P, firstState.Q, "base-line", guides);
  const lineM = board.line(firstState.Q, firstState.Lm, "secant", guides);
  const lineN = board.line(firstState.Q, firstState.Ln, "secant", guides);

  const auxMPX = board.circle(first.MPX.center, first.MPX.radius, "aux-circle", aux);
  const auxNPX = board.circle(first.NPX.center, first.NPX.radius, "aux-circle", aux);
  const auxMQX = board.circle(first.MQX.center, first.MQX.radius, "aux-circle", aux);
  const auxNQX = board.circle(first.NQX.center, first.NQX.radius, "aux-circle", aux);
  const circleO = board.circle(first.CircleO.center, first.CircleO.radius, "circle-o", circles);
  const circleQ = board.circle(first.CircleQ.center, first.CircleQ.radius, "circle-five", circles);

  const dotX = board.point(first.X, "cross-dot", 4, dots);
  const dotsM = [board.point(first.Mm[0], "aux-dot", 3.5, dots),
                 board.point(first.Mm[1], "aux-dot", 3.5, dots)];
  const dotsN = [board.point(first.Nn[0], "aux-dot", 3.5, dots),
                 board.point(first.Nn[1], "aux-dot", 3.5, dots)];
  const dotM3 = board.point(first.M3, "claim-dot", 5, dots);
  const dotN3 = board.point(first.N3, "claim-dot", 5, dots);
  const dotM4 = board.point(first.M4, "claim-dot", 5, dots);
  const dotN4 = board.point(first.N4, "claim-dot", 5, dots);
  const dotY = board.point(first.Y, "axis-dot", 3, dots);
  const dotZ = board.point(first.Z, "axis-dot", 3, dots);

  const labelFor = (p, text, dx, dy) => board.label(p, text, "point-label", dx, dy, labels);
  const allLabels = [
    labelFor(firstState.M, "M", -14, -7),
    labelFor(firstState.N, "N", -14, -7),
    labelFor(firstState.P, "P", -14, -7),
    labelFor(first.X, "X", 6, 14),
    labelFor(firstState.Lm, "line m", 8, -6),
    labelFor(firstState.Ln, "line n", 8, 14),
    labelFor(first.M3, "M3", -22, -8),
    labelFor(first.N3, "N3", 6, 14),
    labelFor(first.M4, "M4", 6, -8),
    labelFor(first.N4, "N4", 6, 14),
  ];
  const labelQ = labelFor(firstState.Q, "Q", 7, 18);
  const labelY = labelFor(first.Y, "Y", -16, 16);
  const labelZ = labelFor(first.Z, "Z", 6, -8);
  allLabels.push(labelQ, labelY, labelZ);

  const handleNames = {
    M: "Point M on line L1. Drag it, or focus it and use the arrow keys to move it.",
    N: "Point N on line L1. Drag it, or focus it and use the arrow keys to move it.",
    P: "Point P on line L2. Drag it, or focus it and use the arrow keys to move it.",
    Q: "Point Q on line L2 and on both secants. Drag it, or focus it and use the arrow keys to move it.",
    Lm: "Direction point for the line through Q called m. Drag it, or focus it and use the arrow keys.",
    Ln: "Direction point for the line through Q called n. Drag it, or focus it and use the arrow keys.",
  };
  const handles = {};
  for (const name of Core.NAMES) {
    handles[name] = board.handle(name, firstState[name], {
      r: 11, step: 4, shift: 20, layer: handlesLayer,
      cls: name === "Q" ? "geom-handle claim-handle" : "geom-handle",
      label: handleNames[name],
      describe: (p) => `x ${Math.round(p.x)}, y ${Math.round(p.y)}`,
      clamp: (p) => Core.clampPoint(p),
      onMove: (p, whom) => {
        state = Core.setPoint(state, whom, p);
        render();
      },
    });
  }

  /**
   * The shared status line. `kind` is "win", "lose" or "done" and tells the
   * player's record a play ended; this is a picture with no win or loss, so
   * no kind is ever passed.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

  function setCircle(shape, c) {
    if (c && finite(c.center) && Number.isFinite(c.radius) && c.radius < 5000) {
      shape.set(c.center, c.radius).show(true);
    } else {
      shape.show(false);
    }
  }

  function setDot(shape, p) {
    if (finite(p)) shape.set(p).show(true);
    else shape.show(false);
  }

  function render() {
    const g = Core.geometry(state);
    const s = state;

    lineMN.set(s.M, s.N);
    linePQ.set(s.P, s.Q);
    lineM.set(s.Q, s.Lm);
    lineN.set(s.Q, s.Ln);

    setCircle(auxMPX, g.MPX);
    setCircle(auxNPX, g.NPX);
    setCircle(auxMQX, g.MQX);
    setCircle(auxNQX, g.NQX);
    setCircle(circleO, g.CircleO);
    setCircle(circleQ, g.CircleQ);

    setDot(dotX, g.X);
    if (g.Mm) g.Mm.forEach((p, i) => setDot(dotsM[i], p)); else dotsM.forEach((d) => d.show(false));
    if (g.Nn) g.Nn.forEach((p, i) => setDot(dotsN[i], p)); else dotsN.forEach((d) => d.show(false));
    setDot(dotM3, g.M3);
    setDot(dotN3, g.N3);
    setDot(dotM4, g.M4);
    setDot(dotN4, g.N4);
    setDot(dotY, g.Y);
    setDot(dotZ, g.Z);

    allLabels[0].set(s.M, "M", -14, -7);
    allLabels[1].set(s.N, "N", -14, -7);
    allLabels[2].set(s.P, "P", -14, -7);
    allLabels[3].set(g.X, "X", 6, 14);
    allLabels[4].set(s.Lm, "line m", 8, -6);
    allLabels[5].set(s.Ln, "line n", 8, 14);
    allLabels[6].set(g.M3, "M3", -22, -8);
    allLabels[7].set(g.N3, "N3", 6, 14);
    allLabels[8].set(g.M4, "M4", 6, -8);
    allLabels[9].set(g.N4, "N4", 6, 14);
    labelQ.set(s.Q, "Q", 7, 18);
    labelY.set(g.Y, "Y", -16, 16);
    labelZ.set(g.Z, "Z", 6, -8);
    for (const lab of allLabels) lab.show(namesChk.checked);
    for (const name of Core.NAMES) handles[name].set(s[name]);

    if (!g.valid) {
      say("The lines or circles no longer meet. Move a handle back to see the five-point circle.");
    } else {
      say("Q, M3, N3, M4 and N4 sit on the green circle (largest gap " +
        g.gap.toExponential(1) + "); M1, M2, N1, N2 sit on the dashed one.");
    }
    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  function copyExample() {
    state = {};
    for (const name of Core.NAMES) state[name] = { x: EXAMPLE[name].x, y: EXAMPLE[name].y };
    render();
  }

  resetBtn.addEventListener("click", () => {
    state = Core.start();
    say("");
    render();
  });
  exampleBtn.addEventListener("click", () => {
    copyExample();
  });
  namesChk.addEventListener("change", render);
  board.onTheme(() => render());

  render();
})();
