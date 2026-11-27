"use strict";

/*
 * The page for Equilateral 345: drawing and input only. The geometry and the
 * page's claim live in equilateral-345-core.js. The board is the Java canvas:
 * A, B and C are draggable, the dial turns copies of the triangle about the
 * three corners from 0 to 65 degrees, and the two boxes show point names and
 * the lengths 3, 4 and 5. P stays where the applet's init() placed it.
 */

(function () {
  const Core = Equilateral345Core;
  const statusEl = document.getElementById("status");
  const readoutEl = document.getElementById("readout");
  const angleEl = document.getElementById("angle");
  const angleOut = document.getElementById("angleOut");
  const namesEl = document.getElementById("names");
  const lengthsEl = document.getElementById("lengths");
  const proofBtn = document.getElementById("proofBtn");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();

  const board = Geom.board(document.getElementById("board"));
  const guideLayer = board.layer("guide");
  const fillLayer = board.layer("fills");
  const shapeLayer = board.layer("shapes");
  const dotLayer = board.layer("dots");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const bigTriangle = board.polygon([], "copy-outline", guideLayer);
  const copyTriangles = [0, 1, 2].map(() => board.polygon([], "copy-outline", guideLayer));
  const equiFills = [0, 1, 2].map(() => board.polygon([], "equi-fill", fillLayer));
  const rightFills = [0, 1, 2].map(() => board.polygon([], "right-fill", fillLayer));
  const hexagon = board.polygon([], "hexagon", shapeLayer);
  const original = board.polygon([], "tri-outline", shapeLayer);
  const spokes = [0, 1, 2].map(() => board.segment(state.P, state.A, "spoke", shapeLayer));
  const pDot = board.point(state.P, "dot-p", 7, dotLayer);
  const imageDots = [0, 1, 2].map(() => board.point(state.P, "dot-image", 5, dotLayer));
  const cornerLabels = ["A", "B", "C"].map((s) => board.label(state.A, s, "point-label", 10, -12, labelLayer));
  const pLabel = board.label(state.P, "P", "point-label", 10, -12, labelLayer);
  const imageLabels = ["P around A", "P around B", "P around C"]
    .map((s) => board.label(state.P, "P", "point-label", 10, -10, labelLayer));
  const lengthLabels = ["3", "4", "5"]
    .map((s) => board.label(state.P, s, "length-label", 0, -8, labelLayer));

  /**
   * Shows a line under the board. This is an illustration with no win or loss,
   * so no "win", "lose" or "done" class is ever added here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const r = Core.compute(state);
    const { A, B, C, P } = state;
    const turned = state.angle > 0;
    const at60 = state.angle === 60;
    const corners = [A, B, C];
    const images = [r.Pc, r.Pa, r.Pb]; // P about A, about B, about C

    bigTriangle.set([r.Aq, r.Bq, r.Cq]).show(turned);
    copyTriangles[0].set([A, C, r.Cq]).show(turned);
    copyTriangles[1].set([B, A, r.Aq]).show(turned);
    copyTriangles[2].set([C, B, r.Bq]).show(turned);
    copyTriangles.forEach((t) => t.node.classList.toggle("proof", at60));

    // At 60° the six pieces of the page's hexagon appear. The equilateral
    // ones use the three lengths from P to the corners; the others are the
    // three right triangles with legs 3k and 4k.
    equiFills[0].set([A, P, r.Pc]).show(at60);
    equiFills[1].set([B, P, r.Pa]).show(at60);
    equiFills[2].set([C, P, r.Pb]).show(at60);
    rightFills[0].set([A, P, r.Pa]).show(at60);
    rightFills[1].set([B, P, r.Pb]).show(at60);
    rightFills[2].set([C, P, r.Pc]).show(at60);
    hexagon.set([A, r.Pa, B, r.Pb, C, r.Pc]).show(at60);

    original.set([A, B, C]);
    spokes.forEach((s, i) => s.set(P, corners[i]));
    pDot.set(P);
    imageDots.forEach((dot, i) => dot.set(images[i]).show(turned));
    cornerLabels.forEach((lab, i) => lab.set(corners[i]).show(state.showNames));
    pLabel.set(P).show(state.showNames);
    imageLabels.forEach((lab, i) => lab.set(images[i]).show(state.showNames && turned));
    lengthLabels.forEach((lab, i) => lab.set(Core.midpoint(P, corners[i])).show(state.showLengths));

    handleA.set(state.A);
    handleB.set(state.B);
    handleC.set(state.C);

    angleEl.value = String(state.angle);
    angleOut.textContent = state.angle + "°";
    namesEl.checked = state.showNames;
    lengthsEl.checked = state.showLengths;

    const m = Core.metrics(state);
    readoutEl.textContent = `side ${m.side.toFixed(0)} · AP ${m.lengths[0].toFixed(1)}, ` +
      `BP ${m.lengths[1].toFixed(1)}, CP ${m.lengths[2].toFixed(1)} ` +
      `· with lengths 3, 4, 5 the side is √${Core.FACTOR.toFixed(3)} ≈ ${Core.SOLUTION.toFixed(4)}`;

    if (state.angle === 0) {
      say("Turn the dial to swing copies of the triangle around its corners, or press Show the 60° proof.");
    } else if (at60) {
      say("At 60° the hexagon APcBPaCPb has twice the area of ABC, so a² = 25 + 12√3.");
    } else if (state.angle < 60) {
      say(`Copies turned ${state.angle}°. Keep going to 60° to make the proof's hexagon.`);
    } else {
      say(`Copies turned ${state.angle}°. Past 60° the pieces no longer make the proof's hexagon.`);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  const handleOpts = (name) => ({
    r: 16, step: 5, shift: 4, cls: "geom-handle vertex-handle", layer: handleLayer,
    label: `Point ${name}. Drag it, or focus it and move it with the arrow keys, to reshape the triangle.`,
    describe: (p) => `x ${Math.round(p.x)}, y ${Math.round(p.y)}`,
    clamp: (p) => ({
      x: Math.max(Core.APPLET.dragMargin, Math.min(Core.APPLET.canvas.width - Core.APPLET.dragMargin, p.x)),
      y: Math.max(Core.APPLET.dragMargin, Math.min(Core.APPLET.canvas.height - Core.APPLET.dragMargin, p.y)),
    }),
    onMove: (p) => { state = Core.withVertex(state, name, p); render(); },
  });
  const handleA = board.handle("A", state.A, handleOpts("A"));
  const handleB = board.handle("B", state.B, handleOpts("B"));
  const handleC = board.handle("C", state.C, handleOpts("C"));

  angleEl.addEventListener("input", () => {
    state = Core.withAngle(state, Number(angleEl.value));
    render();
  });
  namesEl.addEventListener("change", () => {
    state = Core.withFlag(state, "showNames", namesEl.checked);
    render();
  });
  lengthsEl.addEventListener("change", () => {
    state = Core.withFlag(state, "showLengths", lengthsEl.checked);
    render();
  });
  proofBtn.addEventListener("click", () => {
    state = Core.withAngle(state, 60);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.start();
    render();
  });

  // The same objects are used on a theme flip, because they are styled by CSS.
  board.onTheme(render);

  render();
})();
