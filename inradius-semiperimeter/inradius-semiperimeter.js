"use strict";

/*
 * The page for Inradius Semiperimeter: drawing and input only; all geometry is
 * in inradius-semiperimeter-core.js. One SVG holds the triangle, its six
 * coloured pieces, the incenter and its circle, and the s by r rectangle below.
 * The three corners are draggable handles (arrow keys work too); two buttons
 * play the applet's "Show hint" and "Move them" controls, and Reset restores
 * the starting triangle. "Move them" uses the core's 100 steps in a short
 * animation, or jumps straight to the end when reduced motion is requested.
 */

(function () {
  const Core = InradiusSemiperimeterCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const moveBtn = document.getElementById("moveBtn");
  const hintBtn = document.getElementById("hintBtn");
  const resetBtn = document.getElementById("resetBtn");

  // Everything lives in one world group so a stretched triangle can be scaled
  // down to fit; the handles are inside it and keep their keyboard focus.
  const world = board.el("g", { class: "world" }, null);
  const rectLayer = board.el("g", null, "layer-rect", world);
  const pieceLayer = board.el("g", null, "layer-pieces", world);
  const triLayer = board.el("g", null, "layer-triangle", world);
  const markLayer = board.el("g", null, "layer-marks", world);
  const handleLayer = board.el("g", null, "layer-handles", world);

  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(1) : "—");

  let state = Core.start({});
  let notice = "";
  let anim = null;
  let view = { k: 1, tx: 0, ty: 0 };

  const rect = board.polygon([Core.pt(0, 0), Core.pt(1, 0), Core.pt(1, 1), Core.pt(0, 1)], "rect-outline", rectLayer);
  const dividers = [
    board.segment(Core.pt(0, 0), Core.pt(0, 1), "divider", rectLayer),
    board.segment(Core.pt(0, 0), Core.pt(0, 1), "divider", rectLayer),
  ];
  const pieces = [0, 1, 2, 3, 4, 5].map((i) =>
    board.polygon([Core.pt(0, 0), Core.pt(1, 0), Core.pt(1, 1)], "piece piece-" + i % 3, pieceLayer));
  const outline = board.polygon([Core.pt(0, 0), Core.pt(1, 0), Core.pt(1, 1)], "tri-outline", triLayer);
  const incircle = board.circle(Core.pt(0, 0), 1, "incircle", markLayer);
  const centerDot = board.point(Core.pt(0, 0), "center-dot", 4, markLayer);
  const touchDots = [0, 1, 2].map(() => board.point(Core.pt(0, 0), "touch-dot", 3.5, markLayer));
  const vertexLabels = [
    board.label(Core.pt(0, 0), "A", "glabel", -18, -10, markLayer),
    board.label(Core.pt(0, 0), "B", "glabel", 8, -10, markLayer),
    board.label(Core.pt(0, 0), "C", "glabel", -18, 20, markLayer),
  ];
  const widthLabel = board.label(Core.pt(0, 0), "s", "glabel dim-label", 0, 16, markLayer);
  const heightLabel = board.label(Core.pt(0, 0), "r", "glabel dim-label", -14, 0, markLayer);

  /** Status line. "done" is how the player's record sees the demo is finished. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** Convert a pointer position in viewBox units back into world units. */
  function toWorld(p) {
    return Core.pt((p.x - view.tx) / view.k, (p.y - view.ty) / view.k);
  }
  const clampCorner = (p) => Core.pt(Core.clamp(p.x, 20, 480), Core.clamp(p.y, 20, 300));

  function render() {
    const m = Core.measurements(state);
    const k = m.degenerate ? 1 : Math.min(1, 450 / m.s);
    view = { k, tx: 250 * (1 - k), ty: 190 * (1 - k) };
    world.setAttribute("transform", `translate(${view.tx} ${view.ty}) scale(${k})`);

    const hasPieces = !m.degenerate;
    rect.show(hasPieces);
    dividers.forEach((d) => d.show(hasPieces));
    outline.show(hasPieces);
    incircle.show(hasPieces && state.hint);
    centerDot.show(hasPieces);
    touchDots.forEach((dot) => dot.show(hasPieces));
    widthLabel.show(hasPieces);
    heightLabel.show(hasPieces);

    if (hasPieces) {
      rect.set([m.L[0], m.L[3], m.U[3], m.U[0]]);
      dividers[0].set(m.L[1], m.U[1]);
      dividers[1].set(m.L[2], m.U[2]);
      outline.set([m.A, m.B, m.C]);
      incircle.set(m.O, m.r);
      centerDot.set(m.O);
      [m.D, m.E, m.F].forEach((p, i) => touchDots[i].set(p));
      [m.A, m.B, m.C].forEach((p, i) => vertexLabels[i].set(p));
      widthLabel.set(Core.pt((m.L[0].x + m.L[3].x) / 2, m.L[0].y));
      heightLabel.set(Core.pt(m.L[0].x, (m.L[0].y + m.U[0].y) / 2));
      const shapes = Core.piecesAt(m, state.progress);
      shapes.forEach((pts, i) => pieces[i].set(pts).show(true));
    } else {
      pieces.forEach((p) => p.show(false));
    }

    handles.A.set(state.A);
    handles.B.set(state.B);
    handles.C.set(state.C);

    hintBtn.setAttribute("aria-pressed", state.hint ? "true" : "false");
    hintBtn.textContent = state.hint ? "Hide hint" : "Show hint";
    moveBtn.textContent = anim ? "Stop" : "Move them";

    if (notice) say(notice, null);
    else if (m.degenerate) say("Move the corners apart to make a triangle.", null);
    else if (m.shortcut) say("That triangle is too thin: drag a corner to make it wider.", null);
    else if (state.explored) {
      say(`s ≈ ${fmt(m.s)}, r ≈ ${fmt(m.r)}. The six pieces fill a ${fmt(m.s)} by ${fmt(m.r)} rectangle: s × r = ${fmt(m.s * m.r)} = the triangle's area.`, "done");
    } else if (anim) {
      say(`Moving the pieces: ${Math.round(state.progress * 100)}%.`, null);
    } else {
      say(`s ≈ ${fmt(m.s)}, r ≈ ${fmt(m.r)}. Press Move them to see the triangle become a ${fmt(m.s)} by ${fmt(m.r)} rectangle.`, null);
    }

    // The player's record and the tutor read the saved position.
    if (window.Track) window.Track.state(state);
  }

  function stopAnim() {
    if (anim) cancelAnimationFrame(anim.raf);
    anim = null;
  }

  function frame(now) {
    if (!anim) return;
    const f = Math.min(1, (now - anim.started) / anim.duration);
    state = Core.move(state, { type: "animate", f });
    if (f >= 1) {
      anim = null;
      notice = "";
    }
    render();
    if (anim) anim.raf = requestAnimationFrame(frame);
  }

  function moveThem() {
    if (anim) {
      stopAnim();
      notice = "The pieces stopped part way. Press Move them to finish.";
      render();
      return;
    }
    notice = "";
    if (reduced || state.progress >= 1) {
      state = Core.move(state, { type: "animate", f: state.progress >= 1 ? 0 : 1 });
      if (reduced) state = Core.move(state, { type: "animate", f: 1 });
      render();
      return;
    }
    anim = { started: performance.now(), duration: Core.NSTEPS * 10, raf: 0 };
    anim.raf = requestAnimationFrame(frame);
    render();
  }

  function moved(point, name) {
    stopAnim();
    notice = "";
    state = Core.move(state, { type: "point", name, x: point.x, y: point.y });
    render();
  }

  const handles = {
    A: board.handle("A", state.A, {
      r: 9, step: 4, shift: 16, layer: handleLayer,
      label: "Corner A. Drag, or focus and use the arrow keys to move it.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => moved(toWorld(p), "A"),
    }),
    B: board.handle("B", state.B, {
      r: 9, step: 4, shift: 16, layer: handleLayer,
      label: "Corner B. Drag, or focus and use the arrow keys to move it.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => moved(toWorld(p), "B"),
    }),
    C: board.handle("C", state.C, {
      r: 9, step: 4, shift: 16, layer: handleLayer,
      label: "Corner C. Drag, or focus and use the arrow keys to move it.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => moved(toWorld(p), "C"),
    }),
  };

  // The clamp runs in world units after the pointer is mapped back through
  // the current scale; keyboard moves are mapped the same way by moved().
  for (const h of Object.values(handles)) h._clamp = clampCorner;

  moveBtn.addEventListener("click", moveThem);
  hintBtn.addEventListener("click", () => {
    state = Core.move(state, { type: "hint" });
    notice = state.hint ? "The incircle touches all three sides." : "The incircle is hidden.";
    render();
  });
  resetBtn.addEventListener("click", () => {
    stopAnim();
    state = Core.move(state, { type: "reset" });
    notice = "Back to the starting triangle.";
    render();
  });
  board.onTheme(() => render());

  render();
})();
