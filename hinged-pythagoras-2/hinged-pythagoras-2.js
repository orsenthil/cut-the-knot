"use strict";

/*
 * The page for Hinged Pythagoras 2: drawing and input only. The geometry is in
 * hinged-pythagoras-2-core.js. The left picture is the applet's square c with
 * four triangles and a small square cut out; the right picture is the same
 * pieces slid across, with the two triangles on the marked corners swinging
 * by the Rotation slider. Drag the gold cut point to change the triangle
 * shape, or drag the swinging tip to rotate; both are also arrow-key handles.
 * The two sliders keep the applet's own ranges (0..275 and 30..95 degrees).
 */

(() => {
  const Core = HingedPythagoras2Core;
  const statusEl = document.getElementById("status");
  const readoutEl = document.getElementById("readout");
  const rotationRange = document.getElementById("rotation");
  const betaRange = document.getElementById("beta");
  const rotationOut = document.getElementById("rotationOut");
  const betaOut = document.getElementById("betaOut");
  const endBtn = document.getElementById("endBtn");
  const resetBtn = document.getElementById("resetBtn");

  const L = Core.DEFAULT_LAYOUT;
  const round = (n) => n.toFixed(1);
  let state = Core.start();

  const board = Geom.board(document.getElementById("board"));
  const outlines = board.layer("outlines");
  const leftLayer = board.layer("left");
  const rightLayer = board.layer("right");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const leftSquare = board.polygon([], "outline", outlines);
  const rightSquare = board.polygon([], "outline", outlines);
  const leftTriangles = [0, 1, 2, 3].map(() => board.polygon([], "piece-left", leftLayer));
  const leftHole = board.polygon([], "hole-left", leftLayer);
  const leftCuts = [0, 1, 2, 3].map(() => board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "cut", marks));
  const rightHole = board.polygon([], "hole-right", rightLayer);
  const rightTriangles = [0, 1, 2, 3].map((i) =>
    board.polygon([], i < 2 ? "piece-right-fixed" : "piece-right-swing", rightLayer));
  const dashed = board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "dash", marks);
  const hingeDots = [0, 1].map(() => board.point({ x: 0, y: 0 }, "hinge", 7, marks));
  const leftCaption = board.label({ x: L.leftX, y: L.y - 22 }, "cut square", "caption", 0, 0, labels);
  const rightCaption = board.label({ x: L.rightX, y: L.y - 22 }, "hinged copy", "caption", 0, 0, labels);

  /**
   * The status line is also how the player's record reads a finished demo;
   * this illustration has nothing to win or lose, so no kind is passed.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    const id = Core.identity(state.beta);
    const left = g.left, right = g.right;

    leftSquare.set(left.corners);
    rightSquare.set(right.corners);
    leftTriangles.forEach((shape, i) => shape.set(left.triangles[i]));
    leftHole.set(left.inner);
    leftCuts.forEach((line, i) => line.set(left.cuts[i][0], left.cuts[i][1]));

    rightHole.set(right.inner).show(true);
    rightHole.node.setAttribute("class", right.showInset ? "hole-right hole-right-filled" : "hole-right");
    rightTriangles.forEach((shape, i) => shape.set(right.triangles[i]));
    dashed.set(right.dashed[0], right.dashed[1]).show(right.showInset);
    right.hinges.forEach((p, i) => hingeDots[i].set(p));
    leftCaption.set({ x: L.leftX + 10, y: L.y - 18 }, "cut square", 0, 0);
    rightCaption.set({ x: L.rightX + 10, y: L.y - 18 }, "hinged copy", 0, 0);

    shapeHandle.set(left.ends[0]);
    turnHandle.set(right.triangles[2][2]);

    rotationRange.value = String(state.angle);
    betaRange.value = String(state.beta);
    rotationOut.textContent = `${state.angle}°`;
    betaOut.textContent = `${state.beta}°`;

    readoutEl.textContent = state.beta > 90
      ? `Shape ${state.beta}°: a = ${round(id.a)}, b = ${round(id.b)}, c = ${round(id.c)} — past 90° the cuts leave the square.`
      : `a = ${round(id.a)}, b = ${round(id.b)}, c = ${round(id.c)}  ·  small square ${round(id.hole)}  ·  ${round(id.a)}² + ${round(id.b)}² = ${round(id.c)}²`;

    if (state.beta > 90) {
      say("Past 90° the swung pieces no longer fit inside the square. The original slider allowed this too.");
    } else if (Core.rad(state.angle) > Core.APPLET.thresholdAngle) {
      say("The last part of the swing: the applet fills the middle square and draws a dashed guide line.");
    } else {
      say("Four triangles hold their shape while two of them swing about the orange hinges.");
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  /* The cut point sits at L0 + c*(cos B, -sin B), so its bearing gives B. */
  function betaFromHandle(p) {
    const origin = Core.corners().L[0];
    const degrees = (Math.atan2(origin.y - p.y, p.x - origin.x) * 180) / Math.PI;
    state = Core.withBeta(state, degrees);
    render();
  }

  /* The swinging tip is the fixed tip turned by the Rotation angle. */
  function angleFromHandle(p) {
    const base = Core.rightDissection({ angle: 0, beta: state.beta });
    const hinge = base.hinges[1];
    const reference = base.triangles[2][2];
    const bearing = (q) => Math.atan2(q.y - hinge.y, q.x - hinge.x) * 180 / Math.PI;
    let degrees = bearing(p) - bearing(reference);
    degrees = ((degrees % 360) + 360) % 360;
    state = Core.withAngle(state, degrees);
    render();
  }

  const shapeHandle = board.handle("cut", Core.leftDissection(state.beta).ends[0], {
    r: 15, step: 4, shift: 4, layer: handlesLayer, cls: "geom-handle shape-handle",
    label: "Gold cut point. Drag it, or focus it and use the arrow keys, to change the triangle shape from 30 to 95 degrees.",
    describe: (p) => `${Math.round(Core.withBeta(state,
      Math.atan2(Core.corners().L[0].y - p.y, p.x - Core.corners().L[0].x) * 180 / Math.PI).beta)} degrees`,
    clamp: (p) => ({ x: Core.clamp(p.x, Core.corners().L[0].x + 1, Core.corners().L[1].x),
      y: Core.clamp(p.y, Core.corners().L[2].y, Core.corners().L[0].y) }),
    onMove: betaFromHandle,
  });
  const turnHandle = board.handle("turn", Core.rightDissection(state).triangles[2][2], {
    r: 15, step: 4, shift: 4, layer: handlesLayer, cls: "geom-handle turn-handle",
    label: "Gold swinging tip. Drag it, or focus it and use the arrow keys, to turn the hinged triangles from 0 to 275 degrees.",
    describe: () => `rotation ${state.angle} degrees`,
    clamp: (p) => ({ x: Core.clamp(p.x, 120, 680), y: Core.clamp(p.y, -60, 490) }),
    onMove: angleFromHandle,
  });

  rotationRange.addEventListener("input", () => {
    state = Core.withAngle(state, rotationRange.value);
    render();
  });
  betaRange.addEventListener("input", () => {
    state = Core.withBeta(state, betaRange.value);
    render();
  });
  endBtn.addEventListener("click", () => {
    state = Core.withAngle(state, Core.LIMITS.angleMax);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.start();
    render();
  });

  board.onTheme(render);
  render();
})();
