"use strict";

/*
 * The page for Deco Symmetry 2: drawing and input only. The dissection, the
 * mirror image and the rotation of each piece all live in
 * deco-symmetry-2-core.js. The SVG holds the original triangle on the left of
 * a dotted mirror line and its reflected copy on the right; K, L and M are
 * draggable corners (arrow keys work too). "Move them" animates the three
 * pieces from the original into the mirror, exactly as the applet's
 * MoveThem()/run() do, but without real-time sleeps.
 */

(function () {
  const Core = DecoSymmetry2Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const moveBtn = document.getElementById("moveBtn");
  const hintBtn = document.getElementById("hintBtn");
  const namesBtn = document.getElementById("namesBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 14, view.x + view.width - 14),
    y: Geom.clamp(p.y, view.y + 14, view.y + view.height - 14),
  });

  let state = Core.start();
  let showHint = false;
  let showNames = false;
  let moving = false;
  let moved = false;
  let frame = 0;
  let animationShapes = null;

  /* Layers in paint order: mirror guides, coloured pieces, outlines, cuts,
     hint marks, names, moving copies, handles. Elements are created once and
     only their geometry changes, so a focused handle keeps focus on a redraw. */
  const mirrorGuide = board.layer("mirror-guide");
  const piecesLayer = board.layer("pieces");
  const ghostLayer = board.layer("ghosts");
  const outlines = board.layer("outlines");
  const cutsLayer = board.layer("cuts");
  const hintLayer = board.layer("hint");
  const textLayer = board.layer("text");
  const movingLayer = board.layer("moving");
  const handlesLayer = board.layer("handles");

  const pieces = [0, 1, 2].map((i) => board.polygon([], "piece-fill piece-" + i, piecesLayer));
  const ghosts = [0, 1, 2].map((i) => board.polygon([], "piece-ghost ghost-" + i, ghostLayer));
  const movingPieces = [0, 1, 2].map((i) => board.polygon([], "piece-fill piece-" + i, movingLayer));
  const triEdges = [0, 1, 2].map(() => board.segment(state.K, state.L, "triangle-edge", outlines));
  const mirrorEdges = [0, 1, 2].map(() => board.segment(state.K, state.L, "mirror-edge", mirrorGuide));
  const midLine = board.segment({ x: view.width / 2, y: 0 }, { x: view.width / 2, y: view.height }, "mirror-axis", mirrorGuide);
  const altitude = board.segment(state.K, state.K, "cut-solid", cutsLayer);
  const cuts = [0, 1].map(() => board.segment(state.K, state.K, "cut-dash", cutsLayer));
  const mirrorCuts = [0, 1].map(() => board.segment(state.K, state.K, "cut-dash mirror", cutsLayer));
  const rightMark = board.rightAngle(state.K, state.L, state.M, 12, "hint-mark", hintLayer);
  const hintLines = [0, 1, 2, 3, 4, 5].map(() => board.segment(state.K, state.K, "hint-line", hintLayer));

  const labels = {
    A: board.label(state.K, "A", "pt-label", -17, -10, textLayer),
    B: board.label(state.L, "B", "pt-label", 9, 18, textLayer),
    C: board.label(state.M, "C", "pt-label", 9, 18, textLayer),
    D: board.label(state.K, "D", "pt-label small", 7, 18, textLayer),
    E: board.label(state.K, "E", "pt-label small", -18, -7, textLayer),
    F: board.label(state.K, "F", "pt-label small", 7, -7, textLayer),
    Ap: board.label(state.K, "A′", "pt-label mirror-label", -20, -10, textLayer),
    Bp: board.label(state.L, "B′", "pt-label mirror-label", 9, 18, textLayer),
    Cp: board.label(state.M, "C′", "pt-label mirror-label", 9, 18, textLayer),
  };

  /**
   * The line under the game. "done" marks a finished exploration for the
   * player's record (assets/progress.js); this illustration has no win or
   * loss, so no other kind is ever used.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const c = Core.compute(state);
    const m = Core.measurements(state);

    pieces.forEach((shape, i) => shape.set(c.pieces[i]));
    ghosts.forEach((shape, i) => shape.set(c.targets[i]));
    movingPieces.forEach((shape, i) => {
      const visible = moving || moved;
      shape.show(visible);
      if (visible) shape.set(animationShapes ? animationShapes[i] : c.targets[i]);
    });

    [[c.A, c.B], [c.B, c.C], [c.C, c.A]].forEach((edge, i) => triEdges[i].set(edge[0], edge[1]));
    [[c.Ap, c.Bp], [c.Bp, c.Cp], [c.Cp, c.Ap]].forEach((edge, i) => mirrorEdges[i].set(edge[0], edge[1]));
    midLine.set({ x: view.width / 2, y: 0 }, { x: view.width / 2, y: view.height });
    altitude.set(c.A, c.D);
    cuts[0].set(c.D, c.E);
    cuts[1].set(c.D, c.F);
    mirrorCuts[0].set(c.Dp, c.Ep);
    mirrorCuts[1].set(c.Dp, c.Fp);

    rightMark.show(showHint);
    rightMark.set(c.D, c.B, c.A, 12);
    const hints = [
      [c.B, c.E], [c.A, c.E], [c.D, c.E],
      [c.C, c.F], [c.A, c.F], [c.D, c.F],
    ];
    hintLines.forEach((line, i) => {
      line.show(showHint);
      line.set(hints[i][0], hints[i][1]);
    });

    const named = {
      A: c.A, B: c.B, C: c.C, D: c.D, E: c.E, F: c.F,
      Ap: c.Ap, Bp: c.Bp, Cp: c.Cp,
    };
    for (const key in labels) {
      labels[key].show(showNames);
      labels[key].set(named[key]);
    }

    if (moving) {
      say("The three pieces are turning and sliding into the mirror image…");
    } else if (moved) {
      say("Two cuts, three pieces: every piece turned into place without a flip. Drag a corner to try another triangle.", "done");
    } else {
      say("The largest angle is at " + (c.A === state.K ? "K" : c.A === state.L ? "L" : "M") +
          ". Both cuts start at D and end at a midpoint; press Move them to see the mirror image.");
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
    return c;
  }

  function move(name, p) {
    if (moving) return;
    state = Core.withPoint(state, name, p);
    moved = false;
    animationShapes = null;
    render();
  }

  const clampCorner = (p) => inside(p);
  const handles = {
    K: board.handle("K", state.K, {
      r: 12, step: 4, shift: 16, layer: handlesLayer, clamp: clampCorner,
      label: "Corner K. Drag it, or focus it and use the arrow keys to move the triangle.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => move("K", p),
    }),
    L: board.handle("L", state.L, {
      r: 12, step: 4, shift: 16, layer: handlesLayer, clamp: clampCorner,
      label: "Corner L. Drag it, or focus it and use the arrow keys to reshape the triangle.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => move("L", p),
    }),
    M: board.handle("M", state.M, {
      r: 12, step: 4, shift: 16, layer: handlesLayer, clamp: clampCorner,
      label: "Corner M. Drag it, or focus it and use the arrow keys to reshape the triangle.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => move("M", p),
    }),
  };

  function syncHandles() {
    handles.K.set(state.K);
    handles.L.set(state.L);
    handles.M.set(state.M);
  }

  function stopMoving() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    moving = false;
    animationShapes = null;
    moveBtn.disabled = false;
    hintBtn.disabled = false;
    namesBtn.disabled = false;
  }

  function reset() {
    stopMoving();
    state = Core.start(state.width, state.height);
    moved = false;
    animationShapes = null;
    syncHandles();
    render();
    handles.K.node.focus();
  }

  /** The applet's Move them: three rotations plus translations, in 50 steps. */
  function moveThem() {
    if (moving) return;
    stopMoving();
    const c = Core.compute(state);
    moving = true;
    moved = false;
    animationShapes = c.pieces.map((p) => p.map((q) => ({ x: q.x, y: q.y })));
    moveBtn.disabled = true;
    hintBtn.disabled = true;
    namesBtn.disabled = true;

    const motions = c.pieces.map((p, i) => Core.motion(p, c.targets[i]));
    const started = performance.now();
    const duration = 600;

    function step(now) {
      const t = Geom.clamp((now - started) / duration, 0, 1);
      animationShapes = motions.map((m) => Core.place(m, t));
      render();
      if (t < 1) frame = requestAnimationFrame(step);
      else {
        frame = 0;
        moving = false;
        moved = true;
        animationShapes = null;
        moveBtn.disabled = false;
        hintBtn.disabled = false;
        namesBtn.disabled = false;
        render();
      }
    }
    frame = requestAnimationFrame(step);
  }

  function toggleHint() {
    showHint = !showHint;
    hintBtn.setAttribute("aria-pressed", String(showHint));
    hintBtn.textContent = showHint ? "Hide hint" : "Show hint";
    render();
  }

  function toggleNames() {
    showNames = !showNames;
    namesBtn.setAttribute("aria-pressed", String(showNames));
    namesBtn.textContent = showNames ? "Hide names" : "Show names";
    render();
  }

  resetBtn.addEventListener("click", reset);
  moveBtn.addEventListener("click", moveThem);
  hintBtn.addEventListener("click", toggleHint);
  namesBtn.addEventListener("click", toggleNames);
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = (e.target && e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    const k = e.key.toLowerCase();
    if (k === "r") reset();
    else if (k === "m") moveThem();
    else if (k === "h" && !hintBtn.disabled) toggleHint();
    else if (k === "n" && !namesBtn.disabled) toggleNames();
    else if (e.key === "Escape" && moving) {
      stopMoving();
      render();
    }
  });

  syncHandles();
  board.onTheme(render);
  render();
})();
