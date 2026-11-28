"use strict";

/*
 * Browser UI for midpoints. The geometry is in midpoints-core.js; this file
 * only draws it and takes input.
 *
 * The 400 by 350 SVG board matches the applet's canvas. In Place points mode a
 * click on the board (or Enter on the focused cursor, or the "Place midpoint at
 * cursor" button) adds a dot, snapped to the applet's 2-unit grid. In Drag
 * mouse mode the cursor handle follows a pointer or the arrow keys and the
 * chain of reflections is drawn from it through every dot. The three red rings
 * mark the midpoint of the cursor and the chain's last vertex. Shapes are
 * created once and only their attributes change, so the cursor keeps keyboard
 * focus across a redraw.
 */

(() => {
  const C = MidpointsCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const placeBtn = document.getElementById("placeBtn");
  const dragBtn = document.getElementById("dragBtn");
  const addBtn = document.getElementById("addBtn");
  const resetBtn = document.getElementById("resetBtn");

  const fill = board.layer("fill");
  const chainLayer = board.layer("chain");
  const targetLayer = board.layer("target");
  const dotsLayer = board.layer("dots");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = C.start();

  /** #status is how the player's record learns that the illustration was used. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const polygon = board.polygon([state.cursor, state.cursor, state.cursor], "solution-poly", fill);
  const closing = board.segment(state.cursor, state.cursor, "closing-seg", chainLayer);
  const segments = [];
  const rings = [2, 4, 6].map((r) => board.circle(state.cursor, r, "target-ring", targetLayer));
  const targetDot = board.point(state.cursor, "target-dot", 2.6, targetLayer);
  const midDots = [];
  const midLabels = [];

  const cursor = board.handle("cursor", state.cursor, {
    r: 9,
    step: C.STEP,
    shift: 10,
    layer: handlesLayer,
    cls: "geom-handle cursor-handle",
    label: "Cursor, the first vertex. Drag it, or focus it and use the arrow keys to move it.",
    describe: (p) => "at x " + Math.round(p.x) + ", y " + Math.round(p.y) + " in the drawing",
    clamp: (p) => C.clamp(p),
    onMove: (p) => {
      state = C.moveCursor(state, p);
      render();
    },
  });

  /* The applet had no way to place a point with the keyboard: aiming the
     cursor with the arrow keys and pressing Enter is the accessible version. */
  cursor.node.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (state.mode !== "place") return;
    e.preventDefault();
    state = C.addPoint(state, state.cursor);
    render();
  });

  function ensureShapes(n) {
    while (segments.length < n) {
      segments.push(board.segment(state.cursor, state.cursor, "chain-seg", chainLayer));
    }
    while (midDots.length < n) {
      midDots.push(board.point(state.cursor, "mid-dot", 4.5, dotsLayer));
      midLabels.push(board.label(state.cursor, "", "point-label", 7, -8, labelsLayer));
    }
  }

  function render() {
    const g = C.geometry(state);
    ensureShapes(g.n);
    cursor.set(state.cursor);

    for (let i = 0; i < midDots.length; i++) {
      const on = i < g.n;
      if (on) {
        midDots[i].set(state.points[i]);
        midLabels[i].set(state.points[i], "O" + (i + 1));
      }
      midDots[i].show(on);
      midLabels[i].show(on && g.n <= 12);
    }

    const drawing = state.mode === "drag" && g.n > 0;
    for (let i = 0; i < segments.length; i++) {
      const on = drawing && i < g.n;
      if (on) segments[i].set(g.segments[i][0], g.segments[i][1]);
      segments[i].show(on);
    }
    closing.set(g.end, state.cursor);
    closing.show(drawing);
    closing.node.setAttribute("class", g.finished ? "closing-seg closed" : "closing-seg");

    for (const ring of rings) ring.set(g.target);
    for (const ring of rings) ring.show(drawing);
    targetDot.set(g.target);
    targetDot.show(drawing);

    const closed = drawing && g.finished && g.n >= 3;
    if (closed) polygon.set(g.vertices.slice(0, g.n));
    polygon.show(closed);

    placeBtn.setAttribute("aria-pressed", String(state.mode === "place"));
    dragBtn.setAttribute("aria-pressed", String(state.mode === "drag"));

    say(C.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        points: state.points,
        cursor: state.cursor,
        mode: state.mode,
        n: g.n,
        parity: g.parity,
        target: g.target,
        finished: g.finished,
      });
    }
  }

  placeBtn.addEventListener("click", () => {
    state = C.setMode(state, "place");
    render();
  });
  dragBtn.addEventListener("click", () => {
    state = C.setMode(state, "drag");
    render();
  });
  addBtn.addEventListener("click", () => {
    state = C.addPoint(state, state.cursor);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = C.reset(state);
    render();
  });

  /* In Place points mode a click on empty board adds a dot, as in the applet.
     toLocal maps a phone-sized board back into the 400 by 350 viewBox. */
  board.root.addEventListener("click", (e) => {
    if (state.mode !== "place") return;
    if (e.target !== board.root && e.target.closest(".geom-handle")) return;
    const p = board.toLocal(e.clientX, e.clientY);
    state = C.addPoint(state, p);
    render();
  });

  board.onTheme(render);
  render();
})();
