"use strict";

/*
 * The page for Circle Square Circle: drawing and input only. The geometry is
 * in circle-square-circle-core.js. Two boards share this page: the Gothic
 * cupola from the linked cut-the-knot article (drag A, B, G or O), and the
 * applet's own turning-square picture (drag its centre, A2 or B0, or slide the
 * angle). Every point is a focusable handle, so a player can drag with a
 * pointer or nudge with the arrow keys. Shapes are updated in place so a
 * handle keeps its keyboard focus across a redraw.
 */

(function () {
  const Core = CircleSquareCircleCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const fitBtn = document.getElementById("fitBtn");
  const resetCupolaBtn = document.getElementById("resetCupolaBtn");
  const angleInput = document.getElementById("angleInput");
  const angleOut = document.getElementById("angleOut");
  const angle45Btn = document.getElementById("angle45Btn");
  const resetAppletBtn = document.getElementById("resetAppletBtn");

  let cupola = Core.cupolaStart({});
  let applet = Core.appletStart({});

  /* --------------------------------------------------------- the cupola ---- */
  const cupolaBoard = Geom.board(document.getElementById("cupolaBoard"));
  const cGuides = cupolaBoard.layer("guides");
  const cShapes = cupolaBoard.layer("shapes");
  const cLabels = cupolaBoard.layer("labels");
  const cHandles = cupolaBoard.layer("handles");

  const arcLeft = cupolaBoard.arc({ x: 0, y: 0 }, 1, -Math.PI / 2, 0, "quarter-arc", cGuides);
  const arcRight = cupolaBoard.arc({ x: 0, y: 0 }, 1, Math.PI, 3 * Math.PI / 2, "quarter-arc", cGuides);
  const baseline = cupolaBoard.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "base-line", cGuides);
  const guideG = cupolaBoard.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "guide", cGuides);
  const guideO = cupolaBoard.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "guide", cGuides);
  const bigSquare = cupolaBoard.polygon([{ x: 0, y: 0 }], "big-square", cShapes);
  const smallSquare = cupolaBoard.polygon([{ x: 0, y: 0 }], "small-square", cShapes);
  const cupolaCircle = cupolaBoard.circle({ x: 0, y: 0 }, 1, "cupola-circle", cShapes);
  const labelA = cupolaBoard.label({ x: 0, y: 0 }, "A", "point-label", 6, 16, cLabels);
  const labelB = cupolaBoard.label({ x: 0, y: 0 }, "B", "point-label", -18, 16, cLabels);
  const labelG = cupolaBoard.label({ x: 0, y: 0 }, "G", "point-label", 8, -8, cLabels);
  const labelO = cupolaBoard.label({ x: 0, y: 0 }, "O", "point-label", 6, -8, cLabels);

  const handleA = cupolaBoard.handle("A", { x: cupola.left, y: cupola.baseY }, {
    r: 9, step: 2, shift: 10, layer: cHandles,
    label: "A, the lower left corner of the big square. Drag it, or focus it and use the arrow keys, to move the whole picture.",
    clamp: (q) => ({ x: Geom.clamp(q.x, 6, 120), y: Geom.clamp(q.y, cupola.side + 12, 256) }),
    onMove: (p) => { cupola = Core.translate(cupola, p); render(); },
  });
  const handleB = cupolaBoard.handle("B", { x: cupola.left + cupola.side, y: cupola.baseY }, {
    r: 9, step: 2, shift: 10, layer: cHandles,
    label: "B, the lower right corner. Drag it, or use the arrow keys, to change the size of the big square.",
    clamp: (q) => ({ x: Geom.clamp(q.x, cupola.left + 60, Math.min(350, cupola.left + 320)), y: cupola.baseY }),
    onMove: (p) => { cupola = Core.resize(cupola, p.x - cupola.left); render(); },
  });
  const handleG = cupolaBoard.handle("G", { x: cupola.left + (cupola.side + cupola.x) / 2, y: cupola.baseY - cupola.x }, {
    r: 9, step: 2, shift: 10, layer: cHandles,
    label: "G, the upper right corner of the small square. Drag it, or use the arrow keys, to make that square bigger or smaller.",
    clamp: (q) => ({ x: Geom.clamp(q.x, cupola.left + cupola.side / 2, cupola.left + cupola.side - 6), y: q.y }),
    onMove: (p) => { cupola = Core.moveCorner(cupola, p); render(); },
  });
  const handleO = cupolaBoard.handle("O", { x: cupola.left + cupola.side / 2, y: cupola.baseY - cupola.x - cupola.r }, {
    r: 9, step: 2, shift: 10, cls: "geom-handle circle-handle", layer: cHandles,
    label: "O, the centre of the circle. Drag it, or use the arrow keys, to change the circle's radius.",
    clamp: (q) => ({ x: cupola.left + cupola.side / 2, y: Geom.clamp(q.y, 6, cupola.baseY - cupola.x - 1) }),
    onMove: (p) => { cupola = Core.moveCircle(cupola, p); render(); },
  });

  function renderCupola() {
    const p = Core.cupolaPoints(cupola);
    arcLeft.set(p.A, cupola.side, -Math.PI / 2, 0);
    arcRight.set(p.B, cupola.side, Math.PI, 3 * Math.PI / 2);
    baseline.set(p.A, p.B);
    guideG.set(p.A, p.G);
    guideO.set(p.A, p.O);
    bigSquare.set([p.A, p.B, p.TR, p.TL]);
    smallSquare.set(p.square);
    cupolaCircle.set(p.O, cupola.r);
    labelA.set(p.A, "A", 6, 16);
    labelB.set(p.B, "B", -18, 16);
    labelG.set(p.G, "G", 8, -8);
    labelO.set(p.O, "O", 6, -8);
    handleA.set(p.A);
    handleB.set(p.B);
    handleG.set(p.G);
    handleO.set(p.O);
  }

  /* --------------------------------------------------- the applet's board -- */
  const aBoard = Geom.board(document.getElementById("appletBoard"));
  const aGuides = aBoard.layer("guides");
  const aShapes = aBoard.layer("shapes");
  const aLabels = aBoard.layer("labels");
  const aHandles = aBoard.layer("handles");
  const crossH = aBoard.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "axis", aGuides);
  const crossV = aBoard.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "axis", aGuides);
  const fixedSquare = aBoard.polygon([{ x: 0, y: 0 }], "ap-square-a", aShapes);
  const outerCircle = aBoard.circle({ x: 0, y: 0 }, 1, "ap-circle-c", aShapes);
  const turningSquare = aBoard.polygon([{ x: 0, y: 0 }], "ap-square-b", aShapes);
  const innerCircle = aBoard.circle({ x: 0, y: 0 }, 1, "ap-circle-c2", aShapes);
  const labelCentre = aBoard.label({ x: 0, y: 0 }, "O", "point-label", 8, -8, aLabels);

  const centreHandle = aBoard.handle("O", { x: applet.cx, y: applet.cy }, {
    r: 9, step: 2, shift: 10, layer: aHandles,
    label: "O, the common centre. Drag it, or use the arrow keys, to move the whole drawing.",
    clamp: (q) => ({ x: Geom.clamp(q.x, 40, 320), y: Geom.clamp(q.y, 40, 220) }),
    onMove: (p) => { applet = Core.moveCentre(applet, p); render(); },
  });
  const fixedHandle = aBoard.handle("A2", Core.appletA(applet)[2], {
    r: 9, step: 2, shift: 10, layer: aHandles,
    label: "A2, a corner of the fixed square. Drag it, or use the arrow keys, to resize both circles.",
    clamp: (q) => ({
      x: Geom.clamp(q.x, applet.cx + 25, applet.cx + applet.height / 2 - 14),
      y: Geom.clamp(q.y, applet.cy + 25, applet.cy + applet.height / 2 - 14),
    }),
    onMove: (p) => { applet = Core.resizeApplet(applet, p, 2); render(); },
  });
  const turnHandle = aBoard.handle("B0", Core.appletB(applet)[0], {
    r: 9, step: 2, shift: 10, cls: "geom-handle turn-handle", layer: aHandles,
    label: "B, a corner of the turning square. Drag it, or use the arrow keys, to turn that square; the slider does the same.",
    onMove: (p) => {
      applet = Object.assign({}, applet, { angle: Core.angleFromPoint(applet, p) });
      angleInput.value = String(applet.angle);
      render();
    },
  });

  function renderApplet() {
    const A = Core.appletA(applet);
    const M = Core.appletM(applet);
    const B = Core.appletB(applet);
    const circles = Core.appletCircles(applet);
    fixedSquare.set(A);
    outerCircle.set(circles.outer.center, circles.outer.radius);
    turningSquare.set(B);
    innerCircle.set(circles.inner.center, circles.inner.radius);
    crossH.set(M[0], M[2]);
    crossV.set(M[1], M[3]);
    crossH.show(applet.angle === 45);
    crossV.show(applet.angle === 45);
    labelCentre.set(circles.inner.center, "O", 8, -8);
    centreHandle.set(circles.inner.center);
    fixedHandle.set(A[2]);
    turnHandle.set(B[0]);
    angleOut.textContent = applet.angle + "°";
  }

  /* ---------------------------------------------------------- status ------- */

  /**
   * The shared status line. "done" tells the player's record that a play has
   * ended; this is a picture with no win or loss, so the text is just a report.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    renderCupola();
    renderApplet();
    const err = Core.cupolaErrors(cupola);
    const fits = Math.abs(err.corner) < 0.5 && Math.abs(err.tangent) < 0.5;
    const line = fits
      ? "The cupola fits exactly: the small square is 3/5 of the big one and the circle's radius is 39/320."
      : "The cupola does not fit yet: drag G or O, or press Show exact fit.";
    say(line + " On the other board, every side of the turning square touches the small circle.");
    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(cupola, applet));
  }

  fitBtn.addEventListener("click", () => { cupola = Core.makeFit(cupola); render(); });
  resetCupolaBtn.addEventListener("click", () => { cupola = Core.cupolaStart({}); render(); });
  angleInput.addEventListener("input", () => {
    applet = Object.assign({}, applet, { angle: Number(angleInput.value) });
    render();
  });
  angle45Btn.addEventListener("click", () => {
    applet = Object.assign({}, applet, { angle: 45 });
    angleInput.value = "45";
    render();
  });
  resetAppletBtn.addEventListener("click", () => {
    applet = Core.appletStart({});
    angleInput.value = String(applet.angle);
    render();
  });

  cupolaBoard.onTheme(() => render());
  aBoard.onTheme(() => render());
  render();
})();
