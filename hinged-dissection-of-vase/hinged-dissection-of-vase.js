"use strict";

/*
 * Browser view of the Hinged Dissection of a Vase. All the geometry lives in
 * hinged-dissection-of-vase-core.js; this file only draws it and takes input.
 *
 * The SVG shows the vase at the left of the slider's range: a bowl, a neck
 * made of three quarter-circle arcs, and three coloured quarter-disks. Moving
 * the scroll bar (or the red hinge) turns those three pieces; at 180 degrees
 * they sit in three corners of the side-2R square drawn by DrawRadius.
 */

(() => {
  const C = HingedDissectionOfVaseCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const range = document.getElementById("angleRange");
  const angleOut = document.getElementById("angleOut");
  const startBtn = document.getElementById("startBtn");
  const halfBtn = document.getElementById("halfBtn");
  const squareBtn = document.getElementById("squareBtn");

  let state = C.start({ angle: Number(range.value) });

  // Back to front: guides, the coloured pieces, the outline, then the hinge
  // that stays focusable through every redraw.
  const guides = board.layer("guides");
  const pieces = board.layer("pieces");
  const outline = board.layer("outline");
  const top = board.layer("handles");

  const centre = { x: state.cx, y: state.cy };
  const guideCircle = board.circle(centre, state.R, "guide-circle", guides);
  const diameters = [-Math.PI / 4, Math.PI / 4].map(() => board.segment(centre, centre, "diameter", guides));
  const bowl = [0, 1, 2].map(() => board.arc(centre, state.R, 0, 0, "bowl", outline));
  const neck = ["right", "left", "top"].map((name) => board.arc(centre, state.R, 0, 0, "neck", outline));
  const wedges = ["red", "blue", "green"].map((name) => board.el("path", null, "piece " + name, pieces));
  const squareEdges = [0, 1, 2, 3].map(() => board.segment(centre, centre, "square-edge", outline));

  const RAD = Math.PI / 180;
  const svgAngle = (javaDegrees) => -javaDegrees * RAD;
  const at = (c, r, a) => ({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });

  /** A filled quarter-disk, from the applet's Java drawArc start angle. */
  function wedgePath(center, r, startJavaDeg, extentJavaDeg) {
    const a0 = svgAngle(startJavaDeg);
    const a1 = svgAngle(startJavaDeg + extentJavaDeg);
    const p0 = at(center, r, a0);
    const p1 = at(center, r, a1);
    const sweep = a1 < a0 ? 0 : 1; // Java angles increase up the screen, SVG down
    return `M ${center.x} ${center.y} L ${p0.x} ${p0.y} A ${r} ${r} 0 0 ${sweep} ${p1.x} ${p1.y} Z`;
  }

  function setJavaArc(shape, arc, show) {
    shape.set(arc.c, arc.r, svgAngle(arc.start), svgAngle(arc.start + arc.extent)).show(show);
  }

  /** Dragging the red hinge chooses the nearest of the scroll bar's 181 stops. */
  function angleFromPoint(p) {
    let best = state.angle, bestD = Infinity;
    for (let a = C.ANGLE_MIN; a <= C.ANGLE_MAX; a++) {
      const c = C.sectors(C.start({ width: state.width, height: state.height, angle: a }))[0].c;
      const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
      if (d < bestD) { bestD = d; best = a; }
    }
    return best;
  }

  const hinge = board.handle("Hinge", C.sectors(state)[0].c, {
    r: 8, step: 3, shift: 12, layer: top,
    label: "Red hinge. Drag it, or focus it and use the arrow keys, to set the angle from 0 to 180 degrees.",
    onMove: (p) => setAngle(angleFromPoint(p)),
  });

  /**
   * Shows a line under the picture. "done" is how the player's record sees
   * that this illustration has been explored; there is no win or loss here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = C.geometry(state);
    const parts = C.sectors(state);

    guideCircle.set({ x: g.cx, y: g.cy }, g.R).show(g.guides);
    for (const d of [-Math.PI / 4, Math.PI / 4]) {
      const a = { x: g.cx + g.R * Math.cos(d), y: g.cy + g.R * Math.sin(d) };
      const b = { x: g.cx - g.R * Math.cos(d), y: g.cy - g.R * Math.sin(d) };
      diameters[(d < 0 ? 0 : 1)].set(a, b).show(g.guides);
    }
    for (let k = 0; k < 3; k++) {
      setJavaArc(bowl[k], { c: g.bowl.c, r: g.bowl.r, start: g.bowl.start + k * 90, extent: 90 }, g.bowlVisible);
      setJavaArc(neck[k], g.neck[k], g.neckVisible);
      wedges[k].setAttribute("d", wedgePath(parts[k].c, g.R, parts[k].start, parts[k].extent));
    }
    for (let k = 0; k < 4; k++) {
      squareEdges[k].set(g.diamond[k], g.diamond[(k + 1) % 4]).show(g.squareVisible);
    }
    hinge.set(parts[0].c);

    range.value = String(state.angle);
    angleOut.textContent = state.angle + "\u00b0";
    const words = state.angle === 0
      ? "The three coloured quarters fill the bottom of the vase. Turn the hinge or slide the bar to carry them into the square."
      : state.angle === C.ANGLE_MAX
        ? "At 180 degrees the quarters fill three corners of the square. Its sides are 2R, so its area is 4R\u00b2, the same as the vase."
        : `At ${state.angle} degrees the three quarters swing on their hinges. The dotted circle shows where the vase's bottom began.`;
    say(words, state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(C.snapshot(state));
  }

  function setAngle(value) {
    const next = C.move(state, { type: "angle", value });
    if (next === state) return;
    state = next;
    render();
  }

  range.addEventListener("input", () => setAngle(Number(range.value)));
  startBtn.addEventListener("click", () => setAngle(0));
  halfBtn.addEventListener("click", () => setAngle(90));
  squareBtn.addEventListener("click", () => setAngle(C.ANGLE_MAX));

  // The picture itself is a keyboard control too; focus stays on it.
  document.getElementById("board").addEventListener("keydown", (e) => {
    if (e.target !== e.currentTarget) return; // the hinge handles its own arrows
    const step = e.shiftKey ? 10 : C.ANGLE_STEP;
    const delta = {
      ArrowLeft: -step, ArrowDown: -step,
      ArrowRight: step, ArrowUp: step,
      PageDown: -10, PageUp: 10,
      Home: C.ANGLE_MIN - state.angle,
      End: C.ANGLE_MAX - state.angle,
    }[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    setAngle(state.angle + delta);
    document.getElementById("board").focus();
  });

  board.onTheme(() => render(), false); // colours come from tokens; redraw to stay in sync
  render();
})();
