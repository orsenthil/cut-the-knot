"use strict";

/*
 * The page for Continuous Line Illusion: drawing and input only. The path and
 * all three scrollbar ranges live in continuous-curve-core.js.
 *
 * The 400 by 400 SVG holds a layer of straight legs, one highlighted leg, a
 * "start" label and a tracing dot. The dot is a Geom handle: drag it to the
 * nearest corner, or focus it and press an arrow key to follow the line one
 * leg at a time. Nothing is rebuilt on a redraw, so focus survives.
 */

(() => {
  const C = ContinuousCurveCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const marginInput = document.getElementById("marginInput");
  const spreadInput = document.getElementById("spreadInput");
  const legsInput = document.getElementById("legsInput");
  const marginOut = document.getElementById("marginOut");
  const spreadOut = document.getElementById("spreadOut");
  const legsOut = document.getElementById("legsOut");
  const nextBtn = document.getElementById("nextBtn");
  const resetBtn = document.getElementById("resetBtn");

  let state = C.start();
  let current = C.geometry(state);

  /** Write the line under the picture. An illustration has no win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Layers in paint order: the path, the current leg, labels, the trace dot. */
  const paths = board.layer("paths");
  const trails = board.layer("trails");
  const labels = board.layer("labels");
  const tops = board.layer("handles");

  const legs = Array.from({ length: C.MAX_LEGS }, () =>
    board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "curve-leg", paths));
  const activeLeg = board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "curve-active", trails);
  const startDot = board.point(current.center, "start-dot", 3, labels);
  const startLabel = board.label(current.center, "start", "pt-label", 8, -8, labels);

  function nearest(q) {
    let best = 0, distance = Infinity;
    for (let i = 0; i <= current.drawn; i++) {
      const v = current.vertices[i];
      const d = (q.x - v.x) ** 2 + (q.y - v.y) ** 2;
      if (d < distance) { distance = d; best = i; }
    }
    return best;
  }

  const tracer = board.handle("trace", current.center, {
    r: 8, layer: tops,
    label: "Tracing dot. Drag it onto the line, or focus it and use the arrow keys to follow one leg at a time.",
    describe: (p) => `on the drawing at ${Math.round(p.x)} across, ${Math.round(p.y)} down`,
    clamp: (q) => current.vertices[nearest(q)],
    onMove: (p) => {
      state = C.setTrace(state, nearest(p));
      render();
    },
  });

  /* The arrow keys follow the path, not the page's x and y axes: the pen
     turns at every corner. Capture keeps Geom's own arrow nudge from running
     first, and the handle's node is never replaced, so focus stays put. */
  tracer.node.addEventListener("keydown", (e) => {
    let next = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = state.trace + 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = state.trace - 1;
    else if (e.key === "PageDown") next = state.trace + 5;
    else if (e.key === "PageUp") next = state.trace - 5;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = current.drawn;
    if (next === null) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    state = C.setTrace(state, next);
    render();
    tracer.node.focus();
  }, true);

  function render() {
    current = C.geometry(state);

    for (let i = 0; i < legs.length; i++) {
      if (i < current.drawn) {
        legs[i].set(current.vertices[i], current.vertices[i + 1]).show(true);
      } else {
        legs[i].show(false);
      }
    }
    const i = Math.max(0, Math.min(current.drawn, state.trace));
    if (current.drawn) {
      // At the last corner there is no next leg: highlight the one just walked.
      const a = current.vertices[Math.max(0, Math.min(i, current.drawn - 1))];
      const b = current.vertices[Math.min(i + 1, current.drawn)];
      activeLeg.set(a, b).show(true);
    } else {
      activeLeg.show(false);
    }
    startDot.set(current.center);
    startLabel.set(current.center, "start");
    tracer.set(current.vertices[i]);

    marginInput.value = String(state.margin);
    spreadInput.value = String(state.spread);
    legsInput.value = String(state.legs);
    marginOut.textContent = String(state.margin);
    spreadOut.textContent = String(state.spread);
    legsOut.textContent = String(state.legs);

    say(C.status(state, current, i));

    // The position, for the player's record and the tutor (board units).
    if (window.Track) {
      window.Track.state({ ...state, trace: i, drawn: current.drawn, point: current.vertices[i] });
    }
  }

  const options = [[marginInput, "margin"], [spreadInput, "spread"], [legsInput, "legs"]];
  for (const [input, name] of options) {
    input.addEventListener("input", () => {
      state = C.setOption(state, name, Number(input.value));
      render();
    });
  }
  nextBtn.addEventListener("click", () => { state = C.nextTrace(state); render(); });
  resetBtn.addEventListener("click", () => { state = C.start(); render(); });

  board.onTheme(render);
  render();
})();
