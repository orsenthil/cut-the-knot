"use strict";

/*
 * The page for Cosine Law: drawing and input only. cosine-law-core.js holds
 * the geometry. The left diagram is the applet's folded construction (the two
 * outward squares plus the three parallelograms); the right one is its
 * translated, unfolded copy. Dragging A, B or C recomputes both pictures, and
 * the coloured pieces show the two ways to cut the same heptagon.
 */

(function () {
  const Core = CosineLawCore;
  const statusEl = document.getElementById("status");
  const readoutEl = document.getElementById("readout");
  const colorsChk = document.getElementById("colorsChk");
  const namesChk = document.getElementById("namesChk");
  const resetBtn = document.getElementById("resetBtn");

  const BOARD = { width: 600, height: 440 };
  const BOUNDS = { minX: 40, maxX: 330, minY: 60, maxY: 390 };
  const pt = Core.pt;
  const clamp = Core.clamp;

  let state = Core.start(BOARD);

  const board = Geom.board(document.getElementById("board"));
  const fills = board.layer("fills");
  const outlines = board.layer("outlines");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const poly = (cls, layer) => board.polygon([], cls, layer);
  const seg = (cls, layer) => board.segment(pt(0, 0), pt(0, 0), cls, layer);

  // Coloured pieces, following Draw1() and Draw2() in the applet.
  const foldedRed1 = poly("piece piece-red", fills);   // P C R
  const foldedRed2 = poly("piece piece-red", fills);   // P C T
  const foldedYellow1 = poly("piece piece-yellow", fills); // C A S T
  const foldedYellow2 = poly("piece piece-yellow", fills); // C B Q R
  const foldedPar1 = poly("piece piece-yellow", fills); // S T P M
  const foldedPar2 = poly("piece piece-yellow", fills); // Q R P N
  const foldedBlue = poly("piece piece-blue", fills);   // A B C
  const unfoldRed1 = poly("piece piece-red", fills);    // Ap Sp Mp
  const unfoldRed2 = poly("piece piece-red", fills);    // Bp Np Qp
  const unfoldYellow = poly("piece piece-yellow", fills); // Ap Bp Np Mp
  const unfoldPar1 = poly("piece piece-yellow", fills); // Mp Sp Tp Pp
  const unfoldPar2 = poly("piece piece-yellow", fills); // Np Qp Rp Pp
  const unfoldBlue = poly("piece piece-blue", fills);   // Mp Pp Np

  const squareA = poly("square", outlines);
  const squareB = poly("square", outlines);
  const heptagon = poly("heptagon", outlines);
  const cutTP = seg("cut", outlines), cutPR = seg("cut", outlines);
  const cutCP = seg("cp", outlines), cutAB = seg("side", outlines);
  const cutMP = seg("cut", outlines), cutNP = seg("cut", outlines);
  const cutSM = seg("cut", outlines), cutNQ = seg("cut", outlines);
  const switchLines = [
    seg("switch-line", outlines), seg("switch-line", outlines),
    seg("switch-line", outlines), seg("switch-line", outlines),
    seg("switch-line", outlines), seg("switch-line", outlines),
    seg("switch-line", outlines),
  ];
  const unfoldLines = [];
  for (let i = 0; i < 10; i++) unfoldLines.push(seg("unfold-line", outlines));
  const unfoldExtra = [];
  for (let i = 0; i < 4; i++) unfoldExtra.push(seg("unfold-line", outlines));
  const rightMark = board.rightAngle(pt(0, 0), pt(0, 0), pt(1, 0), 11, "right-mark", marks);

  const pointNames = ["A", "B", "C", "T", "R", "S", "Q", "P", "M", "N"];
  const pointLabels = pointNames.map((name) => board.label(pt(0, 0), name, "point-name", 5, -6, labels));

  /**
   * Shows the line under the board. This is a demonstration with no win or
   * loss, so no "win", "lose" or "done" class is ever set.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function fmt(n) {
    return Number.isFinite(n) ? n.toFixed(1) : "—";
  }

  function render() {
    const d = Core.figure(state);
    const m = Core.measure(state, d);
    const { A, B, C } = state;
    const colors = state.showColors;
    const names = state.showNames;

    foldedRed1.set([d.P, C, d.R]).show(colors);
    foldedRed2.set([d.P, C, d.T]).show(colors);
    foldedYellow1.set([C, A, d.S, d.T]).show(colors);
    foldedYellow2.set([C, B, d.Q, d.R]).show(colors);
    foldedPar1.set([d.S, d.T, d.P, d.M]).show(colors && !d.switchParas);
    foldedPar2.set([d.Q, d.R, d.P, d.N]).show(colors && !d.switchParas);
    foldedBlue.set([A, B, C]).show(colors);

    unfoldRed1.set([d.Ap, d.Sp, d.Mp]).show(colors);
    unfoldRed2.set([d.Bp, d.Np, d.Qp]).show(colors);
    unfoldYellow.set([d.Ap, d.Bp, d.Np, d.Mp]).show(colors);
    unfoldPar1.set([d.Mp, d.Sp, d.Tp, d.Pp]).show(colors && d.switchParas);
    unfoldPar2.set([d.Np, d.Qp, d.Rp, d.Pp]).show(colors && d.switchParas);
    unfoldBlue.set([d.Mp, d.Pp, d.Np]).show(colors);

    squareA.set([C, A, d.S, d.T]);
    squareB.set([C, B, d.Q, d.R]);
    heptagon.set([A, B, d.Q, d.N, d.P, d.M, d.S]);

    cutTP.set(d.T, d.P);
    cutPR.set(d.P, d.R);
    cutCP.set(C, d.P);
    cutAB.set(A, B);
    const showParLines = !d.switchParas;
    cutMP.set(d.M, d.P).show(showParLines);
    cutNP.set(d.N, d.P).show(showParLines);
    cutSM.set(d.S, d.M).show(showParLines);
    cutNQ.set(d.N, d.Q).show(showParLines);

    const extra = [
      [d.M, d.P], [d.M, d.S], [d.N, d.P], [d.N, d.Q],
      [A, d.M], [d.M, d.N], [d.N, B],
    ];
    switchLines.forEach((line, i) => {
      line.set(extra[i][0], extra[i][1]).show(d.switchParas && names);
    });

    const uLines = [
      [d.Ap, d.Bp], [d.Ap, d.Mp], [d.Bp, d.Np], [d.Ap, d.Sp],
      [d.Bp, d.Qp], [d.Mp, d.Np], [d.Mp, d.Pp], [d.Np, d.Pp],
      [d.Sp, d.Mp], [d.Np, d.Qp],
    ];
    unfoldLines.forEach((line, i) => line.set(uLines[i][0], uLines[i][1]));
    const uExtra = [[d.Tp, d.Pp], [d.Tp, d.Sp], [d.Pp, d.Rp], [d.Qp, d.Rp]];
    unfoldExtra.forEach((line, i) => line.set(uExtra[i][0], uExtra[i][1]).show(d.switchParas));

    // CP crosses AB at a right angle. The marker sits at that crossing.
    const cross = Geom.lineIntersection(C, d.P, A, B);
    if (cross) rightMark.set(cross, C, B, 11).show(true);
    else rightMark.show(false);

    const positions = { A, B, C, T: d.T, R: d.R, S: d.S, Q: d.Q, P: d.P, M: d.M, N: d.N };
    pointNames.forEach((name, i) => {
      pointLabels[i].set(positions[name], name).show(names);
    });

    aHandle.set(state.A);
    bHandle.set(state.B);
    cHandle.set(state.C);

    const deg = Math.round((m.angle * 180) / Math.PI);
    readoutEl.textContent =
      `a = ${fmt(m.a)}   b = ${fmt(m.b)}   c = ${fmt(m.c)}   ·   ` +
      `c² = a² + b² − 2ab·cos C = ${fmt(m.left)}   ·   both cuttings: ${fmt(m.heptagonArea)}`;
    if (!colors) {
      say(`Angle at C is ${deg}°. Drag the three points; switch on colors to see the two cuttings.`);
    } else {
      say(`Angle at C is ${deg}° (${m.acute ? "acute" : "obtuse"}). ` +
        `CP is ${fmt(m.cp)} long, just like AB, and it meets AB at a right angle.`);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function movePoint(name, point) {
    const q = pt(clamp(point.x, BOUNDS.minX, BOUNDS.maxX),
      clamp(point.y, BOUNDS.minY, BOUNDS.maxY));
    const others = ["A", "B", "C"].filter((n) => n !== name).map((n) => state[n]);
    if (others.some((p) => Core.distance(q, p) < 8)) return;
    state = Core.withPoint(state, name, q);
    render();
  }

  const handleOptions = (name) => ({
    r: 24, step: 4, shift: 4, cls: "geom-handle vertex-handle",
    label: `Point ${name}. Drag it, or focus it and use the arrow keys, to reshape the triangle.`,
    describe: (p) => `x ${Math.round(p.x)}, y ${Math.round(p.y)}`,
    clamp: (p) => pt(clamp(p.x, BOUNDS.minX, BOUNDS.maxX),
      clamp(p.y, BOUNDS.minY, BOUNDS.maxY)),
    layer: handlesLayer,
    onMove: (p, which) => movePoint(which, p),
  });
  const aHandle = board.handle("A", state.A, handleOptions("A"));
  const bHandle = board.handle("B", state.B, handleOptions("B"));
  const cHandle = board.handle("C", state.C, handleOptions("C"));

  colorsChk.addEventListener("change", () => {
    state = Core.withOption(state, "showColors", colorsChk.checked);
    render();
  });
  namesChk.addEventListener("change", () => {
    state = Core.withOption(state, "showNames", namesChk.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.start(BOARD);
    colorsChk.checked = state.showColors;
    namesChk.checked = state.showNames;
    render();
  });

  board.onTheme(render);
  render();
})();
