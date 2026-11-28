"use strict";

/*
 * The page for Menelaus Bisector: drawing and input only. The geometry and
 * both theorems live in menelaus-bisector-core.js.
 *
 * The SVG holds a triangle with three draggable corners. Four checkboxes
 * reproduce the applet's "Angle bisector selection": 3 in / 0 out, 2 in /
 * 1 out, 1 in / 2 out and 0 in / 3 out. Internal bisectors are violet;
 * external ones are dashed. The outside feet get a green joining line in the
 * 0-in / 3-out picture and the inside feet get a red triangle in the 2-in /
 * 1-out picture, just as DrawBisectors paints them. Points that would be at
 * infinity are simply left off the picture.
 */

(function () {
  const Core = MenelausBisectorCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const view = board.viewBox;
  const boxIds = { I3E0: "mode3", I2E1: "mode2", I1E2: "mode1", I0E3: "mode0" };
  const boxes = {};
  for (const mode of Core.MODES) boxes[mode] = document.getElementById(boxIds[mode]);

  let state = Core.start({ width: view.width, height: view.height });

  const triangleLayer = board.layer("triangle");
  const bisectorLayer = board.layer("bisectors");
  const joinLayer = board.layer("join");
  const feetLayer = board.layer("feet");
  const centerLayer = board.layer("centers");
  const textLayer = board.layer("text");
  const handleLayer = board.layer("handles");

  const sides = [0, 1, 2].map(() => board.segment(state.corners.A, state.corners.B, "tri-side", triangleLayer));
  const insideLines = [0, 1, 2].map(() => board.line(state.corners.A, state.corners.B, "bis-in", bisectorLayer));
  const outsideLines = [0, 1, 2].map(() => board.line(state.corners.A, state.corners.B, "bis-ext", bisectorLayer));
  const joinLine = board.line(state.corners.A, state.corners.B, "collinear-line", joinLayer);
  const footTriangle = [0, 1, 2].map(() => board.segment(state.corners.A, state.corners.B, "foot-tri", joinLayer));
  const centerShapes = [0, 1, 2, 3].map(() => board.point(state.corners.A, "center-dot", 5.5, centerLayer));
  const centerLabels = [0, 1, 2, 3].map((i) =>
    board.label(state.corners.A, ["I", "Iₐ", "Iᵦ", "Ic"][i], "pt-label center-label", 10, -9, textLayer));
  const footShapes = [0, 1, 2, 3, 4, 5].map((i) =>
    board.point(state.corners.A, i < 3 ? "foot-dot ext-foot" : "foot-dot int-foot", 6, feetLayer));
  const vertexLabels = {};
  const labelOffset = { A: [-16, -12], B: [-16, 20], C: [10, -10] };
  for (const name of Core.NAMES) {
    const off = labelOffset[name];
    vertexLabels[name] = board.label(state.corners[name], name, "pt-label vertex-label", off[0], off[1], textLayer);
  }

  /**
   * The line under the picture. "done" tells the player's record that this
   * illustration has been explored; there is no win or loss here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const clamped = (p) => ({
    x: Geom.clamp(p.x, view.x + 12, view.x + view.width - 12),
    y: Geom.clamp(p.y, view.y + 12, view.y + view.height - 12),
  });

  function render() {
    const c = Core.compute(state);
    const v = Core.visible(state, c);

    for (let i = 0; i < 3; i++) {
      sides[i].set(c.sides[i][0], c.sides[i][1]);
      insideLines[i].set(c.internal[i][0], c.internal[i][1]).show(v.internalLines);
      outsideLines[i].set(c.external[i][0], c.external[i][1]).show(v.externalLines);
    }

    const join = v.externalLine && c.extFeet.every(Core.finite) &&
      c.extFeet[0] && c.extFeet[1];
    joinLine.show(Boolean(join));
    if (join) joinLine.set(c.extFeet[0], c.extFeet[1]);
    for (let i = 0; i < 3; i++) {
      const on = v.internalTriangle && c.intFeet.every(Core.finite);
      footTriangle[i].show(Boolean(on));
      if (on) footTriangle[i].set(c.intFeet[i], c.intFeet[(i + 1) % 3]);
    }

    const centers = [c.I, c.Ia, c.Ib, c.Ic];
    for (let i = 0; i < 4; i++) {
      const p = centers[i];
      const on = i < v.centers.length && Core.finite(p);
      centerShapes[i].show(Boolean(on));
      centerLabels[i].show(Boolean(on));
      if (on) {
        centerShapes[i].set(p);
        centerLabels[i].set(p);
      }
    }
    for (let i = 0; i < 6; i++) {
      const p = i < 3 ? c.extFeet[i] : c.intFeet[i - 3];
      const on = i < v.feet.length && Core.finite(p);
      footShapes[i].show(Boolean(on));
      if (on) footShapes[i].set(p);
    }

    for (const name of Core.NAMES) {
      const p = state.corners[name];
      vertexLabels[name].set(p);
      handles[name].set(p);
    }
    for (const mode of Core.MODES) {
      if (boxes[mode].checked !== state.modes[mode]) boxes[mode].checked = state.modes[mode];
    }

    const active = Core.MODES.filter((m) => state.modes[m]);
    say(Core.describe(state), active.length ? "done" : null);
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  const handles = {};
  for (const name of Core.NAMES) {
    handles[name] = board.handle(name, state.corners[name], {
      r: 10, step: 4, shift: 12, layer: handleLayer, cls: "geom-handle vertex-handle",
      clamp: clamped,
      label: "Vertex " + name + ". Drag it, or focus it and use the arrow keys to move the triangle.",
      describe: (p) => "at " + Math.round(p.x) + ", " + Math.round(p.y),
      onMove: (p) => { state = Core.moveCorner(state, name, p); render(); },
    });
  }

  function reset() {
    state = Core.start({ width: view.width, height: view.height });
    render();
    handles.A.node.focus();
  }

  document.getElementById("resetBtn").addEventListener("click", reset);
  for (const mode of Core.MODES) {
    boxes[mode].addEventListener("change", () => {
      state = Core.toggleMode(state, mode, boxes[mode].checked);
      render();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return;
    if (e.key.toLowerCase() === "r") { e.preventDefault(); reset(); }
  });

  board.onTheme(render);
  render();
})();
