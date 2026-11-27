"use strict";

/*
 * The page for Deco Symmetry 3: drawing and input only. The geometry is in
 * deco-symmetry-3-core.js. A 400 by 250 SVG board shows the original triangle,
 * its mirror across a vertical line, and the three kites. Drag A, B or C with
 * a pointer, or focus a dot and use the arrow keys. "Move them" turns each
 * kite onto the matching kite in the mirror; "Show names" and "Show hint"
 * are the applet's two checkboxes.
 */

(function () {
  const Core = DecoSymmetry3Core;
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("namesBox");
  const hintBox = document.getElementById("hintBox");
  const moveBtn = document.getElementById("moveBtn");
  const resetBtn = document.getElementById("resetBtn");
  const pt = (x, y) => ({ x, y });

  const board = Geom.board(document.getElementById("board"));
  const guides = board.layer("guides");
  const mirrorLayer = board.layer("mirror");
  const kiteLayer = board.layer("kites");
  const cutLayer = board.layer("cuts");
  const edgeLayer = board.layer("edges");
  const dotLayer = board.layer("dots");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  let state = Core.start();
  let frame = 0;

  /**
   * Shows a line under the board. The "done" class is how the player's record
   * hears that this demonstration has been explored; there is no win or loss.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const mirrorAxis = board.segment(pt(Core.WIDTH / 2, 0), pt(Core.WIDTH / 2, Core.HEIGHT),
    "mirror-line", guides);
  const incircle = board.circle(pt(0, 0), 1, "incircle", guides);

  const edges = [board.segment(state.A, state.B, "tri-edge", edgeLayer),
    board.segment(state.B, state.C, "tri-edge", edgeLayer),
    board.segment(state.C, state.A, "tri-edge", edgeLayer)];
  const mirrorEdges = [board.segment(state.A, state.B, "mirror-edge", mirrorLayer),
    board.segment(state.B, state.C, "mirror-edge", mirrorLayer),
    board.segment(state.C, state.A, "mirror-edge", mirrorLayer)];
  const cuts = [board.segment(state.A, state.A, "cut", cutLayer),
    board.segment(state.A, state.A, "cut", cutLayer),
    board.segment(state.A, state.A, "cut", cutLayer)];
  const rightAngles = [board.rightAngle(state.A, state.B, state.C, 9, "right-mark", guides),
    board.rightAngle(state.A, state.B, state.C, 9, "right-mark", guides),
    board.rightAngle(state.A, state.B, state.C, 9, "right-mark", guides)];
  const kites = Core.compute(Core.start()).pieces.map((p, i) =>
    board.polygon(p.initial, "kite kite-" + i, kiteLayer));

  const dots = {};
  for (const name of ["O", "D", "E", "F", "Op", "Dp", "Ep", "Fp"]) {
    dots[name] = board.point(state.A, name.startsWith("O") ? "center-dot" : "foot-dot", 3.5, dotLayer);
  }
  const labels = {};
  const offsets = {
    A: [-14, -8], B: [-15, 14], C: [7, 14],
    Ap: [7, -8], Bp: [7, 14], Cp: [7, 14],
    O: [6, -7], D: [-15, -8], E: [6, 15], F: [7, -8],
  };
  for (const name of Object.keys(offsets)) {
    labels[name] = board.label(state.A, name.length === 2 && name[1] === "p"
      ? name[0] + "\u2032" : name, "point-label",
    offsets[name][0], offsets[name][1], labelLayer);
  }
  const allShapes = [mirrorAxis, incircle, ...edges, ...mirrorEdges, ...cuts,
    ...rightAngles, ...kites, ...Object.values(dots), ...Object.values(labels)];

  const handles = {};
  for (const name of ["A", "B", "C"]) {
    handles[name] = board.handle(name, state[name], {
      r: 8,
      step: 2,
      shift: 10,
      cls: "geom-handle vertex-handle",
      label: "Point " + name + " of the triangle. Drag it, or focus it and use the arrow keys.",
      clamp: (q) => Core.clampPoint(q),
      onMove: (p, which) => {
        stop();
        state = Core.move(state, which, p);
        render();
      },
      layer: handleLayer,
    });
  }

  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  function render() {
    const f = Core.compute(state);
    for (const name of ["A", "B", "C"]) handles[name].set(state[name]);
    namesBox.checked = state.showNames;
    hintBox.checked = state.showHint;
    moveBtn.disabled = state.moving || !f.valid;
    namesBox.disabled = state.moving;
    hintBox.disabled = state.moving;

    if (!f.valid) {
      for (const shape of allShapes) shape.show(false);
      say(Core.describe(f, state), Core.result(state));
      if (window.Track) window.Track.state(state);
      return;
    }

    const t = state.step / Core.NSteps;
    const pose = f.pieces.map((p) => Core.pose(p, t));
    const original = [f.A, f.B, f.C, f.A];
    const mirrored = [f.Ap, f.Bp, f.Cp, f.Ap];

    mirrorAxis.show(true).set(pt(Core.WIDTH / 2, 0), pt(Core.WIDTH / 2, Core.HEIGHT));
    incircle.show(state.showHint).set(f.O, f.hintRadius);
    for (let i = 0; i < 3; i++) {
      edges[i].show(true).set(original[i], original[i + 1]);
      mirrorEdges[i].show(true).set(mirrored[i], mirrored[i + 1]);
      kites[i].show(true).set(pose[i]);
      cuts[i].show(state.step < Core.NSteps).set(f.O, f.pieces[i].feet[0]);
      const foot = f.pieces[i].feet[0];
      const other = f.pieces[i].feet[1];
      const vertex = f.pieces[i].initial[2];
      rightAngles[i].show(state.showHint).set(foot, vertex, other, 9);
    }
    const at = {
      O: f.O, D: f.D, E: f.E, F: f.F,
      Op: f.Op, Dp: f.Dp, Ep: f.Ep, Fp: f.Fp,
    };
    for (const name in at) {
      dots[name].show(state.showNames).set(at[name]);
    }
    const named = {
      A: f.A, B: f.B, C: f.C, Ap: f.Ap, Bp: f.Bp, Cp: f.Cp,
      O: f.O, D: f.D, E: f.E, F: f.F,
    };
    for (const name in named) {
      labels[name].show(state.showNames).set(named[name]);
    }

    say(Core.describe(f, state), Core.result(state));
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function moveThem() {
    if (state.moving || !Core.compute(state).valid) return;
    state = Core.startMove(state);
    render();
    const started = performance.now();
    const duration = 750;
    const tick = (now) => {
      if (!state.moving) return; // the player changed the triangle meanwhile
      const progress = Math.min(1, (now - started) / duration);
      if (progress >= 1) {
        state = Object.assign({}, state, { step: Core.NSteps - 1, moving: true });
        state = Core.advance(state);
        frame = 0;
      } else {
        state = Object.assign({}, state, { step: Math.floor(progress * Core.NSteps) });
        frame = requestAnimationFrame(tick);
      }
      render();
    };
    frame = requestAnimationFrame(tick);
  }

  moveBtn.addEventListener("click", moveThem);
  resetBtn.addEventListener("click", () => {
    stop();
    state = Core.start();
    render();
  });
  for (const [box, key] of [[namesBox, "showNames"], [hintBox, "showHint"]]) {
    box.addEventListener("change", () => {
      stop();
      state = Core.option(state, key, box.checked);
      render();
    });
  }

  board.onTheme(render);
  render();
})();
