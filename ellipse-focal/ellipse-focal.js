"use strict";

/*
 * Ellipse Focal: drawing and input only. The geometry lives in
 * ellipse-focal-core.js. The board is the applet's 400x300 canvas in SVG
 * units: a dashed rectangle holds the ellipse, its two foci are yellow dots,
 * and the broken bar A-S-B repeats the two focal distances as coloured pieces.
 * Four corner handles reshape the ellipse; the fifth handle is P. There is no
 * win and no loss - this is an illustration of the page's constancy claim.
 */

(() => {
  const Core = EllipseFocalCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");

  let state = Core.start();

  /** Shows a line under the picture. Demos use no kind: nothing is won. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Paint order: rectangle, curve and rays, dots and labels, then handles. */
  const guides = board.layer("guides");
  const curveLayer = board.layer("curve");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const handleLayer = board.layer("handles");

  const boxEdges = Array.from({ length: 4 }, () =>
    board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "box", guides));
  const ellipsePath = board.el("path", null, "ellipse", curveLayer);
  const rayOne = board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "ray ray-one", curveLayer);
  const rayTwo = board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "ray ray-two", curveLayer);
  const barOne = board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "bar bar-one", curveLayer);
  const barTwo = board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "bar bar-two", curveLayer);

  const focusDots = [0, 1].map(() => board.point({ x: 0, y: 0 }, "focus-dot", 4, marks));
  const barDots = [0, 1, 2].map(() => board.point({ x: 0, y: 0 }, "bar-dot", 3, marks));
  const labelF = board.label({ x: 0, y: 0 }, "F", "small-label", -14, -8, labels);
  const labelF2 = board.label({ x: 0, y: 0 }, "F\u2032", "small-label", 6, -8, labels);
  const labelP = board.label({ x: 0, y: 0 }, "P", "small-label", 9, -6, labels);
  const labelBarOne = board.label({ x: 0, y: 0 }, "PF", "small-label", 0, -7, labels);
  const labelBarTwo = board.label({ x: 0, y: 0 }, "PF\u2032", "small-label", 0, -7, labels);

  const clampBoard = (q, m) => ({
    x: Geom.clamp(q.x, m, Core.WIDTH - m),
    y: Geom.clamp(q.y, m, Core.HEIGHT - m),
  });

  const CORNER_NAMES = [
    "Bottom-left corner", "Bottom-right corner",
    "Top-right corner", "Top-left corner",
  ];

  /* A keyboard step that lands in the applet's forbidden middle square is
     refused, exactly as EllipseFocalCanvas.PointIsGood refuses a drag. */
  function clampCorner(q, name) {
    const index = Number(name.slice(-1));
    const held = clampBoard(q, 8);
    return Core.pointIsGood(held) ? held : { ...state.corners[index] };
  }

  const cornerHandles = CORNER_NAMES.map((name, i) => board.handle("corner" + i, state.corners[i], {
    r: 9, step: 4, shift: 12, cls: "geom-handle corner-handle", layer: handleLayer,
    label: name + " of the rectangle. Drag it, or focus it and use the arrow keys, to reshape the ellipse",
    describe: (p) => "at " + Math.round(p.x) + ", " + Math.round(p.y),
    clamp: clampCorner,
    onMove: (p, handleName) => {
      state = Core.moveCorner(state, Number(handleName.slice(-1)), p);
      render();
    },
  }));

  const pointHandle = board.handle("P", state.p, {
    r: 9, step: 4, shift: 12, cls: "geom-handle point-handle", layer: handleLayer,
    label: "Point P on the ellipse. Drag it, or focus it and use the arrow keys, to move along the curve",
    describe: (p) => "at " + Math.round(p.x) + ", " + Math.round(p.y),
    clamp: (q) => clampBoard(q, 8),
    onMove: (p) => {
      state = Core.movePoint(state, p);
      render();
    },
  });

  /** Closed SVG path for the ellipse, sampled the way CTKEllipse.DrawEllipse draws an oval. */
  function ellipsePathData(g) {
    let d = "";
    for (let i = 0; i <= 128; i++) {
      const p = Core.ellipseAt(g, (2 * Math.PI * i) / 128);
      d += (i ? " L " : "M ") + p.x.toFixed(2) + " " + p.y.toFixed(2);
    }
    return d + " Z";
  }

  function render() {
    const a = Core.analyse(state);
    const g = Core.geometry(state);

    state.corners.forEach((p, i) => boxEdges[i].set(p, state.corners[(i + 1) % 4]));
    ellipsePath.setAttribute("d", ellipsePathData(g));

    if (a) {
      [rayOne, rayTwo, barOne, barTwo].forEach((shape) => shape.show(true));
      focusDots.concat(barDots).forEach((dot) => dot.show(true));
      rayOne.set(state.p, a.foci[0]);
      rayTwo.set(state.p, a.foci[1]);
      barOne.set(a.bar.start, a.bar.join);
      barTwo.set(a.bar.join, a.bar.end);
      focusDots.forEach((dot, i) => dot.set(a.foci[i]));
      barDots[0].set(a.bar.start);
      barDots[1].set(a.bar.join);
      barDots[2].set(a.bar.end);
      labelF.set(a.foci[0]);
      labelF2.set(a.foci[1]);
      labelP.set(state.p);
      labelBarOne.set({ x: (a.bar.start.x + a.bar.join.x) / 2, y: a.bar.start.y });
      labelBarTwo.set({ x: (a.bar.join.x + a.bar.end.x) / 2, y: a.bar.join.y });
      say(Core.describe(state));
    } else {
      [rayOne, rayTwo, barOne, barTwo].forEach((shape) => shape.show(false));
      focusDots.concat(barDots).forEach((dot) => dot.show(false));
      say("The ellipse is too small to measure.");
    }

    cornerHandles.forEach((h, i) => h.set(state.corners[i]));
    pointHandle.set(state.p);

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  newBtn.addEventListener("click", () => {
    state = Core.start();
    render();
  });

  /* The SVG is class-styled, but redraw once when the site theme flips so
     anything computed here stays in step with the tokens. */
  board.onTheme(() => render());
  render();
})();
