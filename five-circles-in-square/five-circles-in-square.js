"use strict";

/*
 * The page for Five Incircles in Square: drawing and input only. The geometry
 * is in five-circles-in-square-core.js. The board is the applet's 400 by 400
 * square: four triangles sit on its sides, their points E, F, G, H form the
 * inner square, and E is the one draggable handle, sliding on the circle with
 * diameter AD. Everything is drawn once and updated in place, so a handle
 * keeps its keyboard focus after every move.
 */

(function () {
  const Core = FiveCirclesInSquareCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const namesChk = document.getElementById("namesChk");
  const statementChk = document.getElementById("statementChk");
  const hintChk = document.getElementById("hintChk");
  const equalBtn = document.getElementById("equalBtn");
  const resetBtn = document.getElementById("resetBtn");
  const board = Geom.board(document.getElementById("board"));

  const guides = board.layer("guides");
  const fills = board.layer("fills");
  const circlesLayer = board.layer("circles");
  const hints = board.layer("hints");
  const labels = board.layer("labels");
  const handles = board.layer("handles");

  let state = Core.start({});

  const guideCircle = board.circle({ x: 0, y: 0 }, 1, "guide-circle", guides);
  const outerSquare = board.polygon([], "outer-square", fills);
  const innerSquare = board.polygon([], "inner-square", fills);
  const triangles = [0, 1, 2, 3].map(() => board.polygon([], "triangle", fills));
  const incircles = [0, 1, 2, 3].map(() => board.circle({ x: 0, y: 0 }, 1, "incircle", circlesLayer));
  const central = board.circle({ x: 0, y: 0 }, 1, "incircle central-circle", circlesLayer);
  const hintLines = [0, 1, 2, 3].map(() => board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "hint-line", hints));

  const pointNames = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const pointLabels = pointNames.map((name) => board.label({ x: 0, y: 0 }, name, "point-label", 6, -6, labels));
  const angleLabels = pointNames.map(() => board.label({ x: 0, y: 0 }, "", "angle-label", 7, 7, labels));

  /**
   * The shared status line. "done" is the applet's Finished state: the record
   * sees that the diagram was explored. This picture has no win and no loss.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** Keep E on its circle and on the part of it the applet lets you drag. */
  function clampE(q) {
    const center = { x: state.cx - state.R, y: state.cy };
    const dx = q.x - center.x, dy = q.y - center.y;
    const angle = Math.hypot(dx, dy) < 1e-6
      ? state.angle : Math.atan2(dy, dx);
    return Core.pointE(Core.setAngle(state, Core.clampAngle(state, angle)));
  }

  const eHandle = board.handle("E", Core.pointE(state), {
    r: 8, step: 2, shift: 10, cls: "geom-handle e-handle", layer: handles,
    label: "Point E. Drag it around the dashed circle, or focus it and use the arrow keys. Shift makes bigger steps.",
    clamp: clampE,
    onMove: (p) => {
      const center = { x: state.cx - state.R, y: state.cy };
      state = Core.setAngle(state, Math.atan2(p.y - center.y, p.x - center.x));
      render();
    },
  });

  function render() {
    const g = Core.geometry(state);
    const p = g.points;
    const matched = Core.finished(state);
    const corners = [g.corners.A, g.corners.B, g.corners.C, g.corners.D];
    const ring = [p.E, p.F, p.G, p.H];

    guideCircle.set({ x: state.cx - state.R, y: state.cy }, state.R);
    outerSquare.set(corners);
    innerSquare.set(ring);
    for (let i = 0; i < 4; i++) triangles[i].set(g.triangles[i]);
    for (let i = 0; i < 4; i++) incircles[i].set(g.incircles[i].center, g.incircles[i].radius);
    central.set(g.central.center, g.central.radius);

    const hintPairs = [[g.corners.A, p.E], [g.corners.B, p.F],
      [g.corners.C, p.G], [g.corners.D, p.H]];
    for (let i = 0; i < 4; i++) {
      hintLines[i].set(hintPairs[i][0], hintPairs[i][1]);
      hintLines[i].show(matched && state.showHint);
    }

    const positions = corners.concat(ring);
    for (let i = 0; i < 8; i++) {
      pointLabels[i].set(positions[i]);
      pointLabels[i].show(state.showNames);
    }

    // At the answer the triangle's other two angles are 30 and 60 degrees.
    const acute = Math.asin(Geom.clamp(g.sides.b / g.sides.c, 0, 1)) * 180 / Math.PI;
    const other = 90 - acute;
    const texts = [acute.toFixed(0) + "\u00b0", other.toFixed(0) + "\u00b0",
      acute.toFixed(0) + "\u00b0", other.toFixed(0) + "\u00b0",
      "90\u00b0", "90\u00b0", "90\u00b0", "90\u00b0"];
    for (let i = 0; i < 8; i++) {
      angleLabels[i].set(positions[i], matched && state.showStatement ? texts[i] : "");
      angleLabels[i].show(matched && state.showStatement);
    }

    eHandle.set(p.E);
    statementChk.disabled = !matched;
    hintChk.disabled = !matched;

    const radii = Core.radii(state);
    if (matched) {
      say("All five circles have radius " + radii[4].toFixed(1) +
        ". Then c = 2b, so the triangle's angles are 30\u00b0 and 60\u00b0.", "done");
    } else {
      say("Triangle circles: " + radii.slice(0, 4).map((r) => r.toFixed(1)).join(", ") +
        "; inner circle: " + radii[4].toFixed(1) + ". Move E until all five match.");
    }

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  namesChk.addEventListener("change", () => {
    state = Core.option(state, "showNames", namesChk.checked);
    render();
  });
  statementChk.addEventListener("change", () => {
    state = Core.option(state, "showStatement", statementChk.checked);
    render();
  });
  hintChk.addEventListener("change", () => {
    state = Core.option(state, "showHint", hintChk.checked);
    render();
  });
  equalBtn.addEventListener("click", () => {
    state = Core.makeEqual(state);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.start({
      width: state.width, height: state.height,
      showNames: state.showNames, showStatement: state.showStatement, showHint: state.showHint,
    });
    render();
  });

  board.onTheme(() => render());
  render();
})();
