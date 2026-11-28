"use strict";

/*
 * The page for Integer Sine: drawing and input only. Every plotted dot comes
 * from IntegerSineCore.draw, a transcription of the applet's own Draw method;
 * this file just turns those ints into one SVG path. A small cursor dot can be
 * dragged or moved with the arrow keys to inspect one integer. There is no win
 * and no loss here - the original is a picture, not a game.
 */

(function () {
  const Core = IntegerSineCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const sinBtn = document.getElementById("sinBtn");
  const tanBtn = document.getElementById("tanBtn");
  const modularBox = document.getElementById("modularBox");
  const scaleButtons = [...document.querySelectorAll("[data-scale]")];

  let state = Core.start({});

  /**
   * Shows a line under the picture. `kind` is "win", "lose", "done" or nothing;
   * only a finished play would use one of the first three. Here it is always
   * empty: a demo has nothing to win or lose.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Paint order: guides first, then the thousands of dots, then the cursor. */
  const guides = board.layer("guides");
  const plot = board.layer("plot");
  const cursor = board.layer("cursor");
  const midLine = board.segment({ x: 0, y: 150 }, { x: 400, y: 150 }, "axis", guides);
  const centreLine = board.segment({ x: 200, y: 0 }, { x: 200, y: 300 }, "axis-faint", guides);
  const upperLine = board.segment({ x: 0, y: 50 }, { x: 400, y: 50 }, "axis-faint", guides);
  const lowerLine = board.segment({ x: 0, y: 250 }, { x: 400, y: 250 }, "axis-faint", guides);
  const dots = board.el("path", null, "dots", plot);
  const cursorLine = board.segment({ x: 0, y: 0 }, { x: 0, y: 300 }, "cursor-line", guides);
  const cursorDot = board.point({ x: 0, y: 150 }, "cursor-dot", 4, cursor);
  const reading = board.label({ x: 0, y: 0 }, "", "cursor-label", 6, -8, cursor);

  /* Geom's handle gives pointer dragging, focus and arrow keys; the capture
     listener below turns the arrow keys into one integer at a time. */
  const handle = board.handle("sample", { x: 0, y: 150 }, {
    r: 10, step: 1, cls: "sample-handle", layer: cursor,
    label: "Sample cursor. Drag it, or focus it and use the left and right arrow keys to inspect the next integer.",
    onMove: (p) => {
      const j = Core.nearestSample(state, p.x);
      state = Object.assign({}, state, { sample: Core.shownPoints(state)[j].i });
      render();
    },
  });

  handle.node.addEventListener("keydown", (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: 10, ArrowDown: -10 }[e.key];
    if (step === undefined && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    e.stopImmediatePropagation(); // Geom's generic arrow movement would miss the dots
    if (e.key === "Home") state = Object.assign({}, state, { sample: 0 });
    else if (e.key === "End") {
      const pts = Core.shownPoints(state);
      state = Object.assign({}, state, { sample: pts[pts.length - 1].i });
    } else state = Core.stepSample(state, step);
    render();
    handle.node.focus(); // focus stays on the board after every key press
  }, true);

  /** One SVG path holds all the dots, so even 10240 of them redraw quickly. */
  function dotPath(points) {
    let d = "";
    for (const p of points) d += `M${p.x - 0.5} ${p.y - 0.5}h0.01`;
    return d;
  }

  function render() {
    const points = Core.shownPoints(state);
    dots.setAttribute("d", dotPath(points));
    // One applet pixel is very faint on a phone when only ten dots are shown.
    dots.style.strokeWidth = points.length <= 100 ? "3" : "1.8";
    const picked = points.find((p) => p.i === state.sample) || points[0] || { x: 0, y: 150, i: 0 };
    const px = picked.x - 0.5, py = picked.y - 0.5;
    cursorLine.set({ x: px, y: 0 }, { x: px, y: 300 });
    cursorDot.set({ x: px, y: py });
    handle.set({ x: px, y: py });
    reading.set({ x: Math.min(352, Math.max(6, px)), y: Math.max(14, py - 8) }, `n=${picked.i}`);

    midLine.show(state.sin);
    upperLine.show(state.sin);
    lowerLine.show(state.sin);
    centreLine.show(!state.sin);
    sinBtn.setAttribute("aria-pressed", String(state.sin));
    tanBtn.setAttribute("aria-pressed", String(!state.sin));
    modularBox.checked = state.modular;
    for (const btn of scaleButtons) {
      btn.setAttribute("aria-pressed", String(Number(btn.dataset.scale) === state.N));
    }

    say(Core.describe(state));

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function change(patch) {
    state = Core.setOptions(state, patch);
    render();
  }

  newBtn.addEventListener("click", () => {
    state = Core.start({});
    render();
  });
  sinBtn.addEventListener("click", () => change({ sin: true }));
  tanBtn.addEventListener("click", () => change({ sin: false }));
  modularBox.addEventListener("change", () => change({ modular: modularBox.checked }));
  for (const btn of scaleButtons) {
    btn.addEventListener("click", () => change({ N: Number(btn.dataset.scale) }));
  }

  board.onTheme(render);
  render();
})();
