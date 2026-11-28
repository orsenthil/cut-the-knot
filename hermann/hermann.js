"use strict";

/*
 * The page for Hermann: drawing and input only. The grid arithmetic and the
 * gap locations live in hermann-core.js. The SVG viewBox is the Java applet's
 * 360 x 440 canvas; the draggable gaze dot acts out the page's claim that a
 * blob disappears when you look directly at it. There is no win or loss.
 */

(function () {
  const W = 360;
  const H = 440;
  const MAX_FIGURES = 12 * 12;
  const Core = HermannCore;
  const svg = document.getElementById("board");
  const board = Geom.board(svg);
  const statusEl = document.getElementById("status");
  const nInput = document.getElementById("nInput");
  const partInput = document.getElementById("partInput");
  const nOut = document.getElementById("nOut");
  const partOut = document.getElementById("partOut");
  const rectBtn = document.getElementById("rectBtn");
  const ovalBtn = document.getElementById("ovalBtn");
  const switchBtn = document.getElementById("switchBtn");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});

  /** The line under the game. An illustration has no win or loss to report. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Layers are created in paint order: canvas, figures, gaze ring, gaze dot. */
  board.layer("canvas");
  const figuresLayer = board.layer("figures");
  const marksLayer = board.layer("marks");
  const handlesLayer = board.layer("handles");

  board.polygon([{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }],
    "canvas-bg", board.layer("canvas"));

  /* Reuse every shape: a redraw only changes attributes, never the focus. */
  const rects = [];
  const ovals = [];
  const square = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  for (let i = 0; i < MAX_FIGURES; i++) {
    rects.push(board.polygon(square, "figure", figuresLayer));
    ovals.push(board.point({ x: 0, y: 0 }, "figure", 0, figuresLayer));
    rects[i].show(false);
    ovals[i].show(false);
  }
  const halo = board.circle({ x: 0, y: 0 }, 22, "blob-halo", marksLayer);
  halo.show(false);

  const gaze = board.handle("gaze", state.gaze, {
    r: 10, step: 5, shift: 10, layer: handlesLayer,
    label: "Gaze dot. Drag it, or focus it and use the arrow keys, to look straight at a gap.",
    clamp: (p) => ({
      x: Math.min(W - 6, Math.max(6, p.x)),
      y: Math.min(H - 6, Math.max(6, p.y)),
    }),
    describe: (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`,
    onMove: (p) => { state = Core.setGaze(state, p); render(); },
  });

  function render() {
    const geometry = Core.layout(W, H, state);
    const looked = Core.lookedAt(geometry, state);
    const nearGap = Core.nearestOpenGap(geometry, state, 90);

    for (let i = 0; i < MAX_FIGURES; i++) {
      const fig = geometry.figures[i];
      if (!fig || fig.side <= 0) {
        rects[i].show(false);
        ovals[i].show(false);
        continue;
      }
      if (state.shape === "rect") {
        rects[i].set([
          { x: fig.x, y: fig.y },
          { x: fig.x + fig.side, y: fig.y },
          { x: fig.x + fig.side, y: fig.y + fig.side },
          { x: fig.x, y: fig.y + fig.side },
        ]).show(true);
        ovals[i].show(false);
      } else {
        ovals[i].set({ x: fig.x + fig.side / 2, y: fig.y + fig.side / 2 }, fig.side / 2).show(true);
        rects[i].show(false);
      }
    }

    // A faint halo stands in for the blob your eye supplies off to one side.
    // Looking straight at it makes the halo go away; no figure is ever changed.
    if (nearGap && looked < 0) halo.set(nearGap.point, 22).show(true);
    else halo.show(false);
    svg.classList.toggle("flipped", state.flipped);
    gaze.set(state.gaze);

    nInput.value = String(state.n);
    partInput.value = String(state.part);
    nOut.textContent = String(state.n);
    partOut.textContent = `${state.part}%`;
    rectBtn.setAttribute("aria-pressed", String(state.shape === "rect"));
    ovalBtn.setAttribute("aria-pressed", String(state.shape === "oval"));
    switchBtn.setAttribute("aria-pressed", String(state.flipped));
    say(Core.describe(geometry, state) +
      (looked >= 0 ? " Looking straight at a gap: the blob is gone." : ""));

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  nInput.addEventListener("input", () => {
    state = Core.setOption(state, "n", nInput.value);
    render();
  });
  partInput.addEventListener("input", () => {
    state = Core.setOption(state, "part", partInput.value);
    render();
  });
  rectBtn.addEventListener("click", () => { state = Core.setOption(state, "shape", "rect"); render(); });
  ovalBtn.addEventListener("click", () => { state = Core.setOption(state, "shape", "oval"); render(); });
  switchBtn.addEventListener("click", () => {
    state = Core.setOption(state, "flipped", !state.flipped);
    render();
  });
  resetBtn.addEventListener("click", () => { state = Core.start({}); render(); });

  board.onTheme(render);
  render();
})();
