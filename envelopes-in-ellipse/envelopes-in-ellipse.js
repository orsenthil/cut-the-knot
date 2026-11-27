"use strict";

/*
 * The page for Envelopes in Ellipse: drawing and input only; all geometry is
 * in envelopes-in-ellipse-core.js. The 400 by 300 SVG holds the mirror ellipse,
 * its four draggable rectangle corners, the two draggable ray points T1 and T2,
 * the successive bounce pieces (drawn as segments or clipped extended lines),
 * the two foci and the optional reflected-focus proof. The buttons keep the
 * applet's Add / Add 10 / Add 100 / Remove last / Remove all / Reset actions;
 * the three Show boxes keep its names, extended lines and proof construction.
 */

(() => {
  const C = EnvelopesInEllipseCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const ui = {
    add: document.getElementById("addBtn"),
    add10: document.getElementById("add10Btn"),
    add100: document.getElementById("add100Btn"),
    remove: document.getElementById("removeBtn"),
    removeAll: document.getElementById("removeAllBtn"),
    reset: document.getElementById("resetBtn"),
    names: document.getElementById("namesBox"),
    extended: document.getElementById("extendedBox"),
    proof: document.getElementById("proofBox"),
  };
  const MAX_PIECES = 105; // 100 reflections + room for the two starting points

  let state = C.start();

  /** The status line; "done" is this illustration's only possible result. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const guides = board.layer("guides");
  const pieces = board.layer("pieces");
  const proofLayer = board.layer("proof");
  const labels = board.layer("labels");
  const handles = board.layer("handles");

  const mirror = board.el("ellipse", { cx: 200, cy: 150, rx: 1, ry: 1 }, "mirror", guides);
  const focalSegment = board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "focal", guides);
  const focusDots = [board.point({ x: 0, y: 0 }, "focus", 4, guides),
                     board.point({ x: 0, y: 0 }, "focus", 4, guides)];
  const focusLabels = [board.label({ x: 0, y: 0 }, "F1", "pt-label", 7, -7, labels),
                       board.label({ x: 0, y: 0 }, "F2", "pt-label", 7, -7, labels)];

  const rayPieces = [], extendedPieces = [], rayDots = [];
  for (let i = 0; i < MAX_PIECES; i++) {
    rayPieces.push(board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "ray", pieces));
    extendedPieces.push(board.line({ x: 0, y: 0 }, { x: 0, y: 0 }, "ray-ext", pieces));
    rayDots.push(board.point({ x: 0, y: 0 }, "ray-dot", 2.8, pieces));
  }
  const rayLabels = [board.label({ x: 0, y: 0 }, "T1", "pt-label", 7, -8, labels),
                     board.label({ x: 0, y: 0 }, "T2", "pt-label", 7, -8, labels),
                     board.label({ x: 0, y: 0 }, "T3", "pt-label", 7, -8, labels)];

  const proofLines = [board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "proof-line", proofLayer),
                      board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "proof-line", proofLayer),
                      board.line({ x: 0, y: 0 }, { x: 0, y: 0 }, "proof-tangent", proofLayer)];
  const proofDots = [board.point({ x: 0, y: 0 }, "proof-dot", 4, proofLayer),
                     board.point({ x: 0, y: 0 }, "proof-dot", 4, proofLayer)];
  const proofLabels = [board.label({ x: 0, y: 0 }, "F1'", "pt-label", 7, -8, labels),
                       board.label({ x: 0, y: 0 }, "F2'", "pt-label", 7, -8, labels)];

  const clampToBoard = (q) => ({
    x: Math.max(8, Math.min(state.width - 8, q.x)),
    y: Math.max(8, Math.min(state.height - 8, q.y)),
  });
  const onEllipse = (q) => C.keepOnEllipse(C.ellipseOf(state.corners), q) || state.T;

  const cornerHandles = [0, 1, 2, 3].map((i) => board.handle(`corner-${i}`, state.corners[i], {
    r: 6, step: 3, layer: handles,
    label: `Corner ${i + 1} of the mirror rectangle. Drag it to resize the ellipse, or use the arrow keys.`,
    describe: (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`,
    clamp: clampToBoard,
    onMove: (q) => { state = C.setCorner(state, i, q); render(); },
  }));
  const rayHandles = [board.handle("T1", state.S, {
    r: 7, step: 3, layer: handles,
    label: "T1, the starting point of the light ray. Drag it around the ellipse, or use the arrow keys.",
    describe: (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`,
    clamp: onEllipse,
    onMove: (q) => { state = C.setRayPoint(state, 0, q); render(); },
  }), board.handle("T2", state.T, {
    r: 7, step: 3, layer: handles,
    label: "T2, the first bounce point. Drag it around the ellipse, or use the arrow keys.",
    describe: (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`,
    clamp: onEllipse,
    onMove: (q) => { state = C.setRayPoint(state, 1, q); render(); },
  })];

  function render() {
    const e = C.ellipseOf(state.corners);
    mirror.setAttribute("cx", e.center.x);
    mirror.setAttribute("cy", e.center.y);
    mirror.setAttribute("rx", Math.abs(e.a));
    mirror.setAttribute("ry", Math.abs(e.b));

    const g = C.geometry(state);
    focalSegment.set(g.foci[0], g.foci[1]);
    g.foci.forEach((f, i) => {
      focusDots[i].set(f);
      focusLabels[i].set(f).show(state.showNames);
    });

    const segs = C.segments(state);
    for (let i = 0; i < MAX_PIECES; i++) {
      const active = i < segs.length;
      rayDots[i].set(active ? segs[i][1] : { x: -20, y: -20 }).show(active);
      if (active) {
        rayPieces[i].set(segs[i][0], segs[i][1]);
        extendedPieces[i].set(segs[i][0], segs[i][1]);
      }
      rayPieces[i].show(active && !state.showExtended);
      extendedPieces[i].show(active && state.showExtended);
    }
    rayLabels.forEach((label, i) => label.set(state.points[i] || { x: -20, y: -20 })
      .show(state.showNames && i < state.points.length));

    const pf = state.showReflection ? C.proof(state) : null;
    proofLines.forEach((line) => line.show(Boolean(pf)));
    proofDots.forEach((dot) => dot.show(Boolean(pf)));
    proofLabels.forEach((label) => label.show(Boolean(pf) && state.showNames));
    if (pf) {
      proofLines[0].set(pf.f1, pf.f2p);
      proofLines[1].set(pf.f2, pf.f1p);
      if (pf.tangent) proofLines[2].set(pf.tangent.m1, pf.tangent.m2);
      else proofLines[2].show(false);
      proofDots[0].set(pf.f1p);
      proofDots[1].set(pf.f2p);
      proofLabels[0].set(pf.f1p);
      proofLabels[1].set(pf.f2p);
    }

    cornerHandles.forEach((h, i) => h.set(state.corners[i]));
    rayHandles[0].set(state.S);
    rayHandles[1].set(state.T);

    ui.names.checked = state.showNames;
    ui.extended.checked = state.showExtended;
    ui.proof.checked = state.showReflection;
    const ready = C.controlsEnabled(state);
    ui.remove.disabled = !ready;
    ui.removeAll.disabled = !ready;
    ui.proof.disabled = !ready;

    say(C.status(state), C.result(state));
    // The position, for the player's record and the tutor (board units).
    if (window.Track) window.Track.state(state);
  }

  ui.add.addEventListener("click", () => { state = C.add(state, 1); render(); });
  ui.add10.addEventListener("click", () => { state = C.add(state, 10); render(); });
  ui.add100.addEventListener("click", () => { state = C.add(state, 100); render(); });
  ui.remove.addEventListener("click", () => { state = C.removeLast(state); render(); });
  ui.removeAll.addEventListener("click", () => { state = C.removeAll(state); render(); });
  ui.reset.addEventListener("click", () => { state = C.reset(); render(); });
  ui.names.addEventListener("change", () => { state = C.withFlag(state, "showNames", ui.names.checked); render(); });
  ui.extended.addEventListener("change", () => { state = C.withFlag(state, "showExtended", ui.extended.checked); render(); });
  ui.proof.addEventListener("change", () => { state = C.withFlag(state, "showReflection", ui.proof.checked); render(); });

  board.onTheme(render);
  render();
})();
