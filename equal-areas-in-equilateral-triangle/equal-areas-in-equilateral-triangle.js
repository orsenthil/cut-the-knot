"use strict";

/*
 * The page for Equal Areas in Equilateral Triangle: drawing and input only.
 * The geometry (the pedal points, the six areas and the two equal triples)
 * lives in equal-areas-in-equilateral-triangle-core.js. The board holds the
 * big triangle, six coloured pieces, the two area bars and one draggable
 * point M. This is an illustration: it has no win, loss or closing message.
 */

(function () {
  const Core = EqualAreasInEquilateralTriangleCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("namesBox");
  const hintBox = document.getElementById("hintBox");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});

  /** The line under the board. An illustration never reports a win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Layers are created in paint order: fills, proof lines, frame, spokes,
     marks, labels and finally the handle. */
  const fills = board.layer("fills");
  const barsLayer = board.layer("bars");
  const guides = board.layer("guides");
  const frame = board.layer("frame");
  const spokes = board.layer("spokes");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const tops = board.layer("handles");

  const pieces = [];
  for (let i = 0; i < 6; i++) {
    pieces.push(board.polygon([state.A, state.B, state.C], `piece piece-${i}`, fills));
  }
  const bars = [];
  for (let i = 0; i < 6; i++) {
    bars.push(board.el("rect", null, `bar bar-${i}`, barsLayer));
  }
  const outline = board.polygon([state.A, state.B, state.C], "triangle-outline", frame);

  const spoke = [];
  for (let i = 0; i < 6; i++) spoke.push(board.segment(state.M, state.A, "spoke", spokes));
  const hintLines = [
    board.segment(state.A, state.B, "hint-line", guides),
    board.segment(state.B, state.C, "hint-line", guides),
    board.segment(state.C, state.A, "hint-line", guides),
  ];
  const feet = [
    board.point(state.A, "foot", 4, marks),
    board.point(state.B, "foot", 4, marks),
    board.point(state.C, "foot", 4, marks),
  ];
  const hintDots = [];
  for (let i = 0; i < 6; i++) hintDots.push(board.point(state.A, "hint-dot", 3, marks));
  const rightMarks = [];
  for (let i = 0; i < 6; i++) rightMarks.push(board.rightAngle(state.A, state.B, state.C, 8, "right-mark", marks));

  const named = [
    board.label(state.A, "A", "pt-label", -14, -8, labels),
    board.label(state.B, "B", "pt-label", 6, -8, labels),
    board.label(state.C, "C", "pt-label", -4, -14, labels),
    board.label(state.M, "M", "pt-label", 10, -10, labels),
    board.label(state.A, "A\u2032", "pt-label", -18, 18, labels),
    board.label(state.B, "B\u2032", "pt-label", 8, 18, labels),
    board.label(state.C, "C\u2032", "pt-label", -8, -12, labels),
  ];
  const smallNames = [];
  for (let i = 0; i < 6; i++) smallNames.push(board.label(state.A, "", "small-label", 0, 0, labels));

  /* The clamp mirrors Canvas.DoDraw: M cannot leave the triangle, so the
     six pieces stay a partition of it. */
  const mHandle = board.handle("M", state.M, {
    r: 11, step: 4, shift: 12, cls: "geom-handle", layer: tops,
    label: "Point M. Drag it inside the triangle, or focus it and use the arrow keys.",
    describe: (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`,
    clamp: (p) => (Core.inside(state, p) ? p : mHandle.point),
    onMove: (p) => { state = Core.moveM(state, p); render(); },
  });

  /** Draws `state`, then speaks the result and saves the position. */
  function render() {
    const g = Core.geometry(state);
    const s = Core.sums(state);

    outline.set([state.A, state.B, state.C]);
    const tri = g.triangles;
    for (let i = 0; i < 6; i++) pieces[i].set(tri[i]);
    for (let i = 0; i < 6; i++) spoke[i].set(state.M, [state.A, state.B, state.C,
      g.Ap, g.Bp, g.Cp][i]);

    /* Canvas.DrawTubes: scale the six products so they fill the canvas
       width, then stack the two equal triples in two bars of height 15. */
    const scale = state.width / s.all;
    const x0 = (state.width - (s.all - s.left) * scale) / 2;
    const top = state.height - 45;
    let xEven = x0, xOdd = x0;
    for (let i = 0; i < 6; i++) {
      const w = g.W[i] * scale;
      if (i % 2 === 0) {
        bars[i].setAttribute("x", xEven);
        bars[i].setAttribute("y", top);
        xEven += w;
      } else {
        bars[i].setAttribute("x", xOdd);
        bars[i].setAttribute("y", top + 15);
        xOdd += w;
      }
      bars[i].setAttribute("width", w);
      bars[i].setAttribute("height", 15);
    }

    const parallelEnds = [[g.Ab, g.Ac], [g.Ba, g.Bc], [g.Ca, g.Cb]];
    for (let i = 0; i < 3; i++) hintLines[i].set(parallelEnds[i][0], parallelEnds[i][1]);
    const parallelPts = [g.Ab, g.Ac, g.Ba, g.Bc, g.Ca, g.Cb];
    const rightPairs = [
      [g.Ap, state.M, state.B], [g.Ap, state.M, state.C],
      [g.Bp, state.M, state.C], [g.Bp, state.M, state.A],
      [g.Cp, state.M, state.A], [g.Cp, state.M, state.B],
    ];
    const nearPairs = [[g.Ap, g.Cb], [g.Bp, g.Ac], [g.Cp, g.Ba]];
    for (let i = 0; i < 3; i++) feet[i].set([g.Ap, g.Bp, g.Cp][i], 4);
    for (let i = 0; i < 6; i++) {
      hintDots[i].set(parallelPts[i], 3);
      rightMarks[i].set(rightPairs[i][0], rightPairs[i][1], rightPairs[i][2], 8);
      smallNames[i].set(parallelPts[i], ["Aᵇ", "Aᶜ", "Bᵃ", "Bᶜ", "Cᵃ", "Cᵇ"][i]);
    }

    const showHint = state.hint;
    hintLines.forEach((el) => el.show(showHint));
    hintDots.forEach((el) => el.show(showHint));
    rightMarks.forEach((el) => el.show(showHint));
    const roomForNames = Math.min(
      Core.distance(state.M, state.A),
      Core.distance(state.M, state.B),
      Core.distance(state.M, state.C),
    ) > 50;
    smallNames.forEach((el, i) => el.show(showHint && roomForNames &&
      Core.distance(parallelPts[i], nearPairs[Math.floor(i / 2)][0]) > 40));

    const showNames = state.showNames;
    named[0].set(state.A, "A");
    named[1].set(state.B, "B");
    named[2].set(state.C, "C");
    named[3].set(state.M, "M");
    named[4].set(g.Ap, "A\u2032");
    named[5].set(g.Bp, "B\u2032");
    named[6].set(g.Cp, "C\u2032");
    named.forEach((el) => el.show(showNames));
    mHandle.set(state.M);
    mHandle.show(true);

    say(Core.status(state));
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  namesBox.addEventListener("change", () => {
    if (namesBox.checked !== state.showNames) state = Core.toggle(state, "showNames");
    render();
  });
  hintBox.addEventListener("change", () => {
    if (hintBox.checked !== state.hint) state = Core.toggle(state, "hint");
    render();
  });
  resetBtn.addEventListener("click", () => { state = Core.reset(state); render(); });

  board.onTheme(render);
  render();
})();
