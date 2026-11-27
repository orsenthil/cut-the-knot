"use strict";

/*
 * Focus and Directrix of Ellipse: drawing and input only. The geometry lives
 * in ellipse-focus-directrix-core.js. The board is the applet's 400x300
 * canvas: four draggable rectangle corners define the ellipse, and the point
 * P slides along it. Red measures PF, blue measures the distance to the
 * directrix, and the little triangle in a corner repeats those two lengths.
 * There is no win and no loss: dragging is the whole illustration.
 */

(() => {
  const Core = EllipseFocusDirectrixCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const ratioOut = document.getElementById("ratioOut");

  let state = Core.start({});
  let last = Core.compute(state); // kept when the applet's near-circle early return fires

  /* Paint order: box, directrices, ellipse, measuring lines, dots, labels, handles. */
  const guides = board.layer("guides");
  const curveLayer = board.layer("curve");
  const measureLayer = board.layer("measure");
  const dotLayer = board.layer("dots");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const frame = [];
  for (let i = 0; i < 4; i++) frame.push(board.segment(state.corners[i], state.corners[(i + 1) % 4], "frame", guides));
  const ellipseNode = board.el("ellipse", {}, "ellipse-shape", curveLayer);
  const directrix = board.line({ x: 0, y: 0 }, { x: 1, y: 1 }, "directrix", guides);
  const otherLine = board.line({ x: 0, y: 0 }, { x: 1, y: 1 }, "directrix other", guides);
  const focusSeg = board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "measure focus", measureLayer);
  const directSeg = board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "measure direct", measureLayer);
  const triangleA = board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "triangle grey", measureLayer);
  const triangleB = board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "triangle focus", measureLayer);
  const triangleC = board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "triangle direct", measureLayer);
  const focusDots = [board.point({ x: 0, y: 0 }, "focus-dot", 4, dotLayer),
    board.point({ x: 0, y: 0 }, "focus-dot", 4, dotLayer)];
  const footDot = board.point({ x: 0, y: 0 }, "foot-dot", 3.5, dotLayer);
  const pDot = board.point({ x: 0, y: 0 }, "p-dot", 4, dotLayer);
  const labelF = board.label({ x: 0, y: 0 }, "F", "small-label", 7, -8, labelLayer);
  const labelD = board.label({ x: 0, y: 0 }, "d", "small-label", 5, 12, labelLayer);
  const labelN = board.label({ x: 0, y: 0 }, "N", "small-label", 6, 14, labelLayer);
  const labelP = board.label({ x: 0, y: 0 }, "P", "small-label", 8, -8, labelLayer);

  const insideBoard = (q) => ({
    x: Geom.clamp(q.x, 8, Core.WIDTH - 8),
    y: Geom.clamp(q.y, 8, Core.HEIGHT - 8),
  });

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** Show a line under the game. `kind` is never a win or a loss here. */
  function render() {
    const fresh = Core.compute(state);
    if (fresh) last = fresh;
    const r = fresh || last;
    const foci = Core.foci(state) || r.foci;
    const h = Core.halfAxes(state);
    const P = Core.pointAt(state);

    for (let i = 0; i < 4; i++) frame[i].set(state.corners[i], state.corners[(i + 1) % 4]);
    ellipseNode.setAttribute("cx", state.center.x);
    ellipseNode.setAttribute("cy", state.center.y);
    ellipseNode.setAttribute("rx", Math.abs(h.a));
    ellipseNode.setAttribute("ry", Math.abs(h.b));
    directrix.set(r.directrix[0], r.directrix[1]);
    focusSeg.set(P, r.focus);
    directSeg.set(P, r.foot);
    triangleA.set(r.A, r.B);
    triangleB.set(r.A, r.S);
    triangleC.set(r.S, r.B);
    foci.forEach((f, i) => {
      focusDots[i].set(f);
      focusDots[i].node.setAttribute("class", Geom.distance(f, r.focus) < 1e-6 ? "focus-dot chosen" : "focus-dot");
    });
    footDot.set(r.foot);
    pDot.set(P);
    labelF.set(r.focus, "F");
    labelN.set(r.foot, "N");
    labelP.set(P, "P");
    const verticalLine = nearY(r.directrix[0].y, r.directrix[1].y);
    labelD.set(verticalLine
      ? { x: 14, y: r.directrix[0].y } : { x: r.directrix[0].x, y: 16 }, "d");

    /* The page says every ellipse has two pairs; offer the other one as a guide. */
    const pairs = Core.pairs(state);
    const chosen = pairs.find((p) => Geom.distance(p.focus, r.focus) < 1e-6);
    const other = pairs.find((p) => p !== chosen);
    if (state.showOther && other) {
      otherLine.show(true);
      otherLine.set(other.directrix[0], other.directrix[1]);
    } else {
      otherLine.show(false);
    }

    for (let i = 0; i < 4; i++) cornerHandles[i].set(state.corners[i]);
    pHandle.set(P);

    const info = Core.describe(state, fresh);
    say(info.text, null);
    ratioOut.textContent = fresh ? fresh.ratio.toFixed(3) : "—";
    otherBtn.setAttribute("aria-pressed", String(state.showOther));
    otherBtn.textContent = state.showOther ? "Hide the other pair" : "Show the other pair";
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  const nearY = (a, b) => Math.abs(a - b) < 1e-9;

  const cornerHandles = state.corners.map((corner, i) => board.handle("corner" + (i + 1), corner, {
    r: 11, step: 5, shift: 15, cls: "geom-handle corner-handle", layer: handleLayer,
    label: "Corner " + (i + 1) + " of the rectangle. Drag it, or focus it and use the arrow keys, to reshape the ellipse",
    describe: (q) => `at ${Math.round(q.x)}, ${Math.round(q.y)}`,
    clamp: insideBoard,
    onMove: (q) => {
      state = Core.moveCorner(state, i, q);
      render();
    },
  }));

  const pHandle = board.handle("P", Core.pointAt(state), {
    r: 12, step: 5, shift: 15, cls: "geom-handle p-handle", layer: handleLayer,
    label: "Point P on the ellipse. Drag it, or focus it and use the arrow keys, to slide around the curve",
    describe: () => `PF over PD is ${Core.compute(state) ? Core.compute(state).ratio.toFixed(3) : "unchanged"}`,
    clamp: insideBoard,
    onMove: (q) => {
      state = Core.setPoint(state, q);
      render();
    },
  });

  document.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state = Core.preset(state, btn.dataset.preset);
      render();
    });
  });
  const otherBtn = document.getElementById("otherBtn");
  otherBtn.addEventListener("click", () => {
    state = Core.toggleOther(state);
    render();
  });
  document.getElementById("newBtn").addEventListener("click", () => {
    state = Core.preset(state, "initial");
    render();
  });

  board.onTheme(render);
  render();
})();
