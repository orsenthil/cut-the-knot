"use strict";

/*
 * The page for Fixed Point: drawing, buttons and input only. The rotations and
 * the geometry live in fixed-point-core.js. The SVG uses the applet's own
 * 500-by-400 board units, so its starting triangle is the same one GetPoint
 * makes. Dragging a corner clears the turning line and starts again.
 */

(function () {
  const Core = FixedPointCore;
  const statusEl = document.getElementById("status");
  const goBtn = document.getElementById("goBtn");
  const hintBtn = document.getElementById("hintBtn");
  const resetBtn = document.getElementById("resetBtn");

  const board = Geom.board(document.getElementById("board"));
  const pivotLayer = board.layer("pivot");
  const triangleLayer = board.layer("triangle");
  const hintLayer = board.layer("hint");
  const dotsLayer = board.layer("dots");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const pivotLine = board.line({ x: 0, y: 0 }, { x: 1, y: 0 }, "pivot-line", pivotLayer);
  const triangleFill = board.polygon([], "triangle-fill", triangleLayer);
  const sideAB = board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "side", triangleLayer);
  const sideBC = board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "side", triangleLayer);
  const sideCA = board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "side", triangleLayer);
  const incircle = board.circle({ x: 0, y: 0 }, 1, "incircle", hintLayer);
  const midDot = board.point({ x: 0, y: 0 }, "mid-dot", 6, dotsLayer);
  const fixedDot = board.point({ x: 0, y: 0 }, "fixed-dot", 7, hintLayer);
  const tracked = [0, 1, 2, 3].map(() => board.point({ x: 0, y: 0 }, "tracked-dot", 4, dotsLayer));
  const aLabel = board.label({ x: 0, y: 0 }, "A", "pt-label", 12, -12, labelsLayer);
  const bLabel = board.label({ x: 0, y: 0 }, "B", "pt-label", -22, 18, labelsLayer);
  const cLabel = board.label({ x: 0, y: 0 }, "C", "pt-label", 12, -12, labelsLayer);
  const midLabel = board.label({ x: 0, y: 0 }, "mid-point", "mid-label", -26, -14, labelsLayer);
  const fixedLabel = board.label({ x: 0, y: 0 }, "fixed point", "fixed-label", -30, 24, labelsLayer);

  let state = Core.start();
  let showHint = false;
  let anim = null; // { last } while the line is turning, one bytecode step per 50ms

  /**
   * Shows a line under the game. `kind` is "win", "lose", "done" or nothing;
   * these three classes are how the record sees a finished play. This applet
   * has no win or loss, so no kind is ever used here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const s = state;
    const mid = Core.midpoint(s.A, s.B);
    const tan = Core.tangentLengths(s.A, s.B, s.C);
    const centre = Core.incenter(s.A, s.B, s.C);
    const radius = Core.dist(centre, Core.foot(centre, s.A, s.B));
    const hintOn = showHint && Core.valid(s);

    triangleFill.set([s.A, s.B, s.C]);
    sideAB.set(s.A, s.B);
    sideBC.set(s.B, s.C);
    sideCA.set(s.C, s.A);
    midDot.set(mid);
    incircle.set(centre, radius).show(hintOn);
    fixedDot.set(tan.touchAB).show(hintOn);
    fixedLabel.set(tan.touchAB).show(hintOn);

    const pts = s.pts || [];
    pivotLine.set(pts[0] || s.A, pts[1] || s.B).show(pts.length >= 2);
    tracked.forEach((dot, i) => dot.set(pts[i] || mid).show(i < pts.length));
    aLabel.set(s.A);
    bLabel.set(s.B);
    cLabel.set(s.C);
    midLabel.set(mid);

    handleA.set(s.A);
    handleB.set(s.B);
    handleC.set(s.C);

    goBtn.disabled = !Core.valid(s) || s.phase !== Core.IDLE;
    hintBtn.disabled = s.phase !== Core.IDLE;
    hintBtn.textContent = showHint ? "Hint: showing" : "Hint: off";
    hintBtn.setAttribute("aria-pressed", showHint ? "true" : "false");

    if (!Core.valid(s)) {
      say("The three corners are in a straight line. Move one so the triangle is not flat.");
    } else if (s.phase === 0) {
      say("Turning the line around A.");
    } else if (s.phase === 1) {
      say("Turning the line around C.");
    } else if (s.phase === 2) {
      say("Turning the line around B.");
    } else if (s.trips === 0) {
      say("The line starts along AB. Press Go to turn it around the triangle.");
    } else if (s.trips % 2 === 1) {
      const moved = pts[2] && Core.dist(pts[2], mid) > 0.5;
      say("One trip: the line is back on AB but faces the other way. " +
        (moved ? "The mid-point of AB moved." : "The mid-point of AB stayed exactly where it was."));
    } else {
      say("Two trips: every point of the line is back where it started, even the mid-point of AB.");
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function clampPoint(p) {
    return {
      x: Math.min(499, Math.max(3, p.x)),
      y: Math.min(397, Math.max(1, p.y)),
    };
  }

  function vertexMoved(point, name) {
    if (state.phase !== Core.IDLE) return;
    state = Core.withVertex(state, name, point);
    render();
  }

  const handleOpts = (label) => ({
    r: 22, step: 5, shift: 5, layer: handlesLayer,
    clamp: clampPoint, onMove: vertexMoved,
    label,
    describe: (p) => `at x ${Math.round(p.x)} and y ${Math.round(p.y)}`,
  });
  const handleA = board.handle("A", state.A, handleOpts(
    "Point A. Drag it, or focus it and use the arrow keys, to move corner A of the triangle."));
  const handleB = board.handle("B", state.B, handleOpts(
    "Point B. Drag it, or focus it and use the arrow keys, to move corner B of the triangle."));
  const handleC = board.handle("C", state.C, handleOpts(
    "Point C. Drag it, or focus it and use the arrow keys, to move corner C of the triangle."));

  function tick(now) {
    if (!anim) return;
    if (now - anim.last >= 50) {
      state = Core.stepOnce(state);
      anim.last = now;
    }
    if (state.phase === Core.IDLE) {
      anim = null;
      render();
      return;
    }
    render();
    anim.raf = requestAnimationFrame(tick);
  }

  goBtn.addEventListener("click", () => {
    if (anim || state.phase !== Core.IDLE || !Core.valid(state)) return;
    state = Core.beginTrip(state);
    render();
    anim = { last: performance.now(), raf: 0 };
    anim.raf = requestAnimationFrame(tick);
  });

  hintBtn.addEventListener("click", () => {
    if (anim) return;
    showHint = !showHint;
    render();
  });

  resetBtn.addEventListener("click", () => {
    if (anim) {
      cancelAnimationFrame(anim.raf);
      anim = null;
    }
    state = Core.start();
    showHint = false;
    render();
  });

  board.onTheme(render);
  render();
})();
