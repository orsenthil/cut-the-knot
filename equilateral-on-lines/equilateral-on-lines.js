"use strict";

/*
 * Equilateral On Lines — drawing and input only; all the geometry is in
 * equilateral-on-lines-core.js. Three horizontal lines carry the handles C,
 * C1 and C2. A pointer drag on a line slides it up or down; a drag on a point
 * slides it along its line. The two buttons per line do the same from the
 * keyboard. "Show hint" draws the two 60-degree rotations from the article,
 * and the Rotation slider draws line 1 turned through the chosen angle about
 * C, exactly as the old applet's scrollbar did (0..65 degrees).
 */

(function () {
  const Core = EquilateralOnLinesCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const angleInput = document.getElementById("angle");
  const angleValue = document.getElementById("angleValue");
  const hintBox = document.getElementById("hint");
  const namesBox = document.getElementById("names");
  const resetBtn = document.getElementById("resetBtn");
  const shuffleBtn = document.getElementById("shuffleBtn");
  const P = Core.point;

  let state = Core.start({});

  /* Layers, back to front. The invisible lines catch pointer drags; handles
   * sit on top so they keep their own pointer and keyboard focus. */
  const back = board.layer("back");
  const hits = board.layer("hits");
  const guides = board.layer("guides");
  const hintLayer = board.layer("hint");
  const triangleLayer = board.layer("triangle");
  const labelsLayer = board.layer("labels");
  const top = board.layer("handles");

  const baseLines = [0, 1, 2].map(() => board.segment(P(10, 0), P(390, 0), "base-line", back));
  const lineHits = [0, 1, 2].map((i) => {
    const h = board.line(P(10, 0), P(390, 0), "line-hit", hits);
    h.node.setAttribute("data-line", String(i));
    return h;
  });
  const lineLabels = [0, 1, 2].map((i) =>
    board.label(P(10, 0), ["L", "L1", "L2"][i], "line-label", 6, -9, labelsLayer));

  const rotatedLines = [0, 1].map(() => board.line(P(0, 0), P(1, 0), "rotated-line", guides));
  const feet = [0, 1].map(() => board.segment(P(0, 0), P(0, 0), "foot", guides));
  const footDots = [0, 1].map(() => board.point(P(0, 0), "foot-dot", 4, guides));
  const imageDots = [0, 1].map(() => board.point(P(0, 0), "image-dot", 4, guides));

  const hintSides = [0, 1].map((i) =>
    [0, 1, 2].map(() => board.segment(P(0, 0), P(0, 0),
      i === 0 ? "hint-side hint-one" : "hint-side hint-two", hintLayer)));
  const hintDots = [0, 1].map((i) =>
    [0, 1].map(() => board.point(P(0, 0),
      i === 0 ? "hint-dot hint-one" : "hint-dot hint-two", 4.5, hintLayer)));

  const sides = [0, 1, 2].map(() => board.segment(P(0, 0), P(0, 0), "side", triangleLayer));
  const names = ["C", "C1", "C2"].map((text, i) =>
    board.label(P(0, 0), text, "point-label", i === 0 ? -9 : 8, -11, labelsLayer));
  const hintNames = [0, 1].map((i) => [0, 1].map((j) =>
    board.label(P(0, 0), j === 0 ? "A" : "B", "point-label hint-label", 8, -9, labelsLayer)));

  const handles = [0, 1, 2].map((i) => board.handle(["C", "C1", "C2"][i], state.points[i], {
    step: 5, shift: 15, r: 9, layer: top,
    label: `Point ${["C", "C1", "C2"][i]}. Drag it along its line, or focus it and use the arrow keys.`,
    clamp: (p) => P(Core.clampX(p.x), state.lines[i]),
    onMove: (p) => {
      state = Core.movePoint(state, i, p);
      render();
    },
  }));

  /** The status line is also how the player's record sees a finished picture. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);

    for (let i = 0; i < 3; i++) {
      const y = state.lines[i];
      baseLines[i].set(P(Core.LEFT, y), P(Core.RIGHT, y));
      lineHits[i].set(P(Core.LEFT, y), P(Core.RIGHT, y));
      lineLabels[i].set(P(Core.LEFT, y));
      handles[i].set(state.points[i]);
      names[i].set(state.points[i]);
      names[i].show(state.names);
    }

    // The old canvas draws the blue rotated line only for a nonzero slider.
    for (let i = 0; i < 2; i++) {
      const sol = g.solutions[i];
      rotatedLines[i].set(sol.rotated.a, sol.rotated.b);
      rotatedLines[i].show(state.angle > 0);
      feet[i].set(g.points[0], sol.foot);
      feet[i].show(state.angle > 0);
      footDots[i].set(sol.foot);
      footDots[i].show(state.angle > 0);
      imageDots[i].set(sol.image);
      imageDots[i].show(state.angle > 0);
    }

    // Two differently oriented solutions, shown in red in the original.
    for (let i = 0; i < 2; i++) {
      const sol = g.solutions[i];
      const pts = [g.points[0], sol.A, sol.B];
      for (let k = 0; k < 3; k++) {
        hintSides[i][k].set(pts[k], pts[(k + 1) % 3]);
        hintSides[i][k].show(state.hint);
      }
      [sol.A, sol.B].forEach((p, k) => {
        hintDots[i][k].set(p);
        hintDots[i][k].show(state.hint);
        hintNames[i][k].set(p);
        hintNames[i][k].show(state.hint && state.names);
      });
    }

    // The canvas hides the grey triangle once a solution is found, unless the
    // hint is showing. Keep that behaviour: the status line says when it fits.
    const showSides = !(state.finished && !state.hint);
    const pts = g.points;
    for (let k = 0; k < 3; k++) {
      sides[k].set(pts[k], pts[(k + 1) % 3]);
      sides[k].show(showSides);
    }

    angleValue.textContent = state.angle + "°";
    say(Core.describe(state), state.finished ? "done" : null);

    // The position in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        lines: state.lines.slice(), coef: state.coef.slice(),
        points: g.points, angle: state.angle,
        hint: state.hint, names: state.names,
        solutions: g.solutions.map((s) => ({ A: s.A, B: s.B, foot: s.foot, image: s.image })),
        finished: state.finished,
      });
    }
  }

  /* Dragging a line: remember the starting y and the state it began from, so
   * every pointermove uses the total offset rather than accumulating steps. */
  let lineDrag = null;
  board.root.addEventListener("pointerdown", (e) => {
    const cls = (e.target.getAttribute("class") || "").split(/\s+/);
    if (cls.indexOf("line-hit") < 0) return;
    const i = Number(e.target.getAttribute("data-line"));
    if (!Number.isInteger(i) || i < 0 || i > 2) return;
    const q = board.toLocal(e.clientX, e.clientY);
    lineDrag = { i: i, y: q.y, base: state };
    if (board.root.setPointerCapture) board.root.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  board.root.addEventListener("pointermove", (e) => {
    if (!lineDrag) return;
    const q = board.toLocal(e.clientX, e.clientY);
    state = Core.moveLine(lineDrag.base, lineDrag.i, q.y - lineDrag.y);
    render();
    e.preventDefault();
  });
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) {
    board.root.addEventListener(ev, () => { lineDrag = null; });
  }

  document.querySelectorAll("[data-line-btn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-line-btn"));
      const dir = Number(btn.getAttribute("data-dir"));
      state = Core.moveLine(state, i, dir * 10);
      render();
    });
  });

  angleInput.addEventListener("input", () => {
    state = Core.setAngle(state, Number(angleInput.value));
    render();
  });
  hintBox.addEventListener("change", () => {
    state = Core.setOption(state, "hint", hintBox.checked);
    render();
  });
  namesBox.addEventListener("change", () => {
    state = Core.setOption(state, "names", namesBox.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });
  shuffleBtn.addEventListener("click", () => {
    state = Core.shuffle(state);
    render();
  });

  // SVG colours are CSS classes, so this only keeps Geom's theme hook alive.
  board.onTheme(render);
  render();
})();
