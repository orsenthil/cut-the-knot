"use strict";

/*
 * The page for Deco Symmetry: drawing and input only; the construction is in
 * deco-symmetry-core.js. The SVG has the applet's 400 by 250 board: the original
 * triangle on the left, its automatic mirror image on the right, and the
 * coloured pieces between them. Drag a corner (or the whole triangle), tick the
 * three applet boxes, then press Move them to watch the pieces turn and slide
 * into place. Nothing can be won or lost.
 */

(function () {
  const Core = DecoSymmetryCore;
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("namesBox");
  const hintBox = document.getElementById("hintBox");
  const acuteBox = document.getElementById("acuteBox");
  const moveBtn = document.getElementById("moveBtn");
  const resetBtn = document.getElementById("resetBtn");

  const board = Geom.board(document.getElementById("board"));
  const guideLayer = board.layer("guides");
  const pieceLayer = board.layer("pieces");
  const outlineLayer = board.layer("outlines");
  const hintLayer = board.layer("hints");
  const dotLayer = board.layer("dots");
  const labelLayer = board.layer("labels");
  const movingLayer = board.layer("moving");
  const dragLayer = board.layer("drag");
  const handleLayer = board.layer("handles");

  let state = Core.start();
  let frameId = 0;
  let movingShapes = [];
  let dragging = null;

  /**
   * Shows a line under the board. `kind` is "win", "lose", "done" or nothing;
   * the shared record only reads the three special classes. This is a demo,
   * so only "done" is ever used, when the pieces have arrived.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const axis = board.line(Core.pt(200, 0), Core.pt(200, 250), "axis", guideLayer);
  const edges = [0, 1, 2].map(() => board.segment(state.K, state.L, "edge", outlineLayer));
  const mirrors = [0, 1, 2].map(() => board.segment(state.K, state.L, "edge mirror-edge", outlineLayer));
  const fills = [0, 1, 2, 3].map((i) => board.polygon([state.K, state.L, state.M], "piece piece-" + i, pieceLayer));
  const dots = ["D", "E", "F", "O"].map((n) => board.point(state.K, "aux-dot", 3.5, dotLayer));
  const rightD1 = board.rightAngle(state.K, state.L, state.M, 9, "right-mark", hintLayer);
  const rightD2 = board.rightAngle(state.K, state.L, state.M, 9, "right-mark", hintLayer);
  const radii = [0, 1, 2].map(() => board.segment(state.K, state.L, "radius", hintLayer));
  const ticks = [0, 1, 2, 3, 4, 5].map(() => board.segment(state.K, state.L, "tick", hintLayer));

  const names = ["A", "B", "C", "D", "E", "F", "O", "Ap", "Bp", "Cp", "Op"];
  const labels = {};
  for (const n of names) labels[n] = board.label(state.K, n, "point-label", 6, -6, labelLayer);

  function tickMark(p, q) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const x = (p.x + q.x) / 2, y = (p.y + q.y) / 2;
    const ux = (-dy / len) * 5, uy = (dx / len) * 5;
    return [Core.pt(x - ux, y - uy), Core.pt(x + ux, y + uy)];
  }

  function clearMoving() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    movingShapes = [];
    board.clear(movingLayer);
  }

  const handles = {};
  for (const name of ["K", "L", "M"]) {
    handles[name] = board.handle(name, state[name], {
      r: 8,
      step: 2,
      shift: 10,
      label: "Corner " + name + ". Drag it, or focus it and use the arrow keys.",
      layer: handleLayer,
      onMove(point) {
        clearMoving();
        state = Core.move(state, name, point);
        render();
      },
    });
  }

  /* The applet also lets the whole triangle be dragged. A transparent polygon
     over the board does the same job, and is focusable for arrow-key nudges. */
  const dragShape = board.polygon([state.K, state.L, state.M], "drag-shape", dragLayer);
  dragShape.node.setAttribute("tabindex", "0");
  dragShape.node.setAttribute("role", "button");
  dragShape.node.setAttribute("aria-label",
    "Move the whole triangle. Drag it, or focus it and use the arrow keys.");
  dragShape.node.addEventListener("pointerdown", (e) => {
    if (state.moving) return;
    dragging = { at: board.toLocal(e.clientX, e.clientY) };
    if (board.root.setPointerCapture) board.root.setPointerCapture(e.pointerId);
    dragShape.node.focus();
    e.preventDefault();
  });
  dragShape.node.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d || state.moving) return;
    e.preventDefault();
    const step = e.shiftKey ? 10 : 2;
    clearMoving();
    state = Core.move(state, "all", { dx: d[0] * step, dy: d[1] * step });
    render();
    dragShape.node.focus();
  });
  board.root.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const at = board.toLocal(e.clientX, e.clientY);
    clearMoving();
    state = Core.move(state, "all", { dx: at.x - dragging.at.x, dy: at.y - dragging.at.y });
    render();
    e.preventDefault();
  });
  const stopDrag = () => { dragging = null; };
  board.root.addEventListener("pointerup", stopDrag);
  board.root.addEventListener("pointercancel", stopDrag);
  board.root.addEventListener("lostpointercapture", stopDrag);

  function render() {
    const f = Core.compute(state);
    const settled = state.done || state.moving;

    fills.forEach((shape, i) => {
      const piece = f.pieces[i];
      shape.show(!!piece && !settled);
      if (piece) shape.set(piece.from);
    });

    const original = [f.A, f.B, f.C], mirrored = [f.Ap, f.Bp, f.Cp];
    edges.forEach((seg, i) => seg.set(original[i], original[(i + 1) % 3]));
    mirrors.forEach((seg, i) => seg.set(mirrored[i], mirrored[(i + 1) % 3]));
    axis.set(Core.pt(200, 0), Core.pt(200, 250));

    const aux = { D: f.D, E: f.E, F: f.F, O: f.O };
    ["D", "E", "F", "O"].forEach((n, i) => {
      dots[i].show(!!aux[n] && !state.moving && (n !== "O" || f.specialAcute));
      if (aux[n]) dots[i].set(aux[n]);
    });

    const showMarks = state.showHint && !state.moving;
    rightD1.show(showMarks && !!f.D).set(f.D || f.A, f.B, f.A, 9);
    rightD2.show(showMarks && !!f.D).set(f.D || f.A, f.A, f.C, 9);
    radii.forEach((seg, i) => {
      const on = showMarks && f.specialAcute;
      const centre = f.O || f.A;
      const vertex = [f.A, f.B, f.C][i];
      seg.show(on).set(centre, vertex);
    });
    const tickPairs = f.specialAcute
      ? [[f.A, f.B], [f.B, f.C], [f.C, f.A], [f.Ap, f.Bp], [f.Bp, f.Cp], [f.Cp, f.Ap]]
      : [[f.B, f.E], [f.E, f.A], [f.C, f.F], [f.F, f.A], [f.D, f.E], [f.D, f.F]];
    ticks.forEach((seg, i) => {
      const pair = tickPairs[i];
      if (!pair || !pair[0] || !pair[1]) { seg.show(false); return; }
      const ends = tickMark(pair[0], pair[1]);
      seg.show(showMarks).set(ends[0], ends[1]);
    });

    const at = {
      A: [f.A, -14, -9], B: [f.B, -14, 17], C: [f.C, 8, 15],
      D: [f.D || f.A, 7, -8], E: [f.E || f.A, -15, -8], F: [f.F || f.A, 7, -8],
      O: [f.O || f.A, 7, 15],
      Ap: [f.Ap, 7, -9], Bp: [f.Bp, 7, -9], Cp: [f.Cp, 7, 15], Op: [f.Op || f.Ap, 7, 15],
    };
    for (const n of names) {
      const [p, dx, dy] = at[n];
      const used = (n === "D" || n === "E" || n === "F") ? !f.specialAcute
        : n === "O" || n === "Op" ? f.specialAcute : true;
      labels[n].show(state.showNames && used && !!p).set(p, n === "A" || n === "B" || n === "C" ? n
        : n.length === 2 ? n[0] + "\u2032" : n, dx, dy);
    }

    dragShape.set([f.K, f.L, f.M]);
    for (const n of ["K", "L", "M"]) handles[n].set(state[n]);

    namesBox.checked = state.showNames;
    hintBox.checked = state.showHint;
    acuteBox.checked = state.specialAcute;
    acuteBox.disabled = !f.acute || state.moving;
    hintBox.disabled = state.moving;
    namesBox.disabled = state.moving;
    moveBtn.disabled = state.moving;
    moveBtn.textContent = state.moving ? "Moving\u2026" : "Move them";

    say(Core.describe(f, state), state.done ? "done" : null);
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function startMove() {
    if (state.moving) return;
    const f = Core.compute(state);
    clearMoving();
    state = Core.option(state, "moving", true);
    movingShapes = f.pieces.map((piece, i) => board.polygon(piece.from, "piece piece-" + i, movingLayer));
    const began = performance.now();
    const tick = (now) => {
      const step = Math.min(Core.NSTEPS, Math.floor((now - began) / 12));
      const t = step / Core.NSTEPS;
      f.pieces.forEach((piece, i) => movingShapes[i].set(Core.frame(piece, t)));
      render();
      if (step < Core.NSTEPS) frameId = requestAnimationFrame(tick);
      else {
        frameId = 0;
        state = Core.option(Core.option(state, "moving", false), "done", true);
        render();
      }
    };
    render();
    frameId = requestAnimationFrame(tick);
  }

  for (const [box, key] of [[namesBox, "showNames"], [hintBox, "showHint"], [acuteBox, "specialAcute"]]) {
    box.addEventListener("change", () => {
      if (state.moving) return;
      clearMoving();
      state = Core.option(state, key, box.checked);
      render();
    });
  }

  moveBtn.addEventListener("click", startMove);
  resetBtn.addEventListener("click", () => {
    clearMoving();
    state = Core.start();
    render();
  });

  board.onTheme(render);
  render();
})();
