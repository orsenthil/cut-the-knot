"use strict";

/*
 * The page for Close To Hilbert: drawing and input only. The word-building and
 * the turtle geometry are in close-to-hilbert-core.js. The stage is one SVG: a
 * faint square marks the region the approximations approach, one path element
 * per semicircle or tent draws the current curve, and a small slider sets the
 * level. Clicking the picture, pressing Next, or moving the slider all ask the
 * core for one of the applet's levels; there is no win or loss.
 */

(function () {
  const Core = CloseToHilbertCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const nextBtn = document.getElementById("nextBtn");
  const resetBtn = document.getElementById("resetBtn");
  const semiBtn = document.getElementById("semiBtn");
  const tentBtn = document.getElementById("tentBtn");

  const options = { width: 320, height: 320, side: 128 };
  let state = Core.start(options);

  /** The line under the picture. A demo has no win or loss to announce. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Paint order: the target square, the curve, its ends, then the slider. */
  const guides = board.layer("guides");
  const drawing = board.layer("curve");
  const marks = board.layer("marks");
  const slider = board.layer("slider");
  const tops = board.layer("handles");

  const frame = board.el("rect", null, "frame", guides);
  const track = board.segment({ x: 32, y: 292 }, { x: 288, y: 292 },
    "slider-part slider-track", slider);
  const endA = board.point(state.origin, "endpoint", 3, marks);
  const endB = board.point(state.origin, "endpoint", 3, marks);
  const sliderLabel = board.label({ x: 32, y: 312 }, "", "hint", 0, 0, slider);
  sliderLabel.node.classList.add("slider-part");

  /** How many levels the applet can show before the step would round to 1. */
  function maxLevel(side) {
    let n = 1;
    while (side / Math.pow(2, n) >= Core.MIN_STEP) n++;
    return n;
  }
  const trackLeft = 32, trackRight = 288;
  const spacing = (trackRight - trackLeft) / (maxLevel(options.side) - 1);
  const levelX = (level) => trackLeft + (level - 1) * spacing;
  const levelFromX = (x) => Math.min(maxLevel(options.side),
    Math.max(1, Math.round((x - trackLeft) / spacing) + 1));

  /* The ticks stay put; only the handle moves along them. */
  for (let level = 1; level <= maxLevel(options.side); level++) {
    const p = { x: levelX(level), y: 292 };
    board.point(p, "slider-part tick", 2, slider);
  }

  const levelHandle = board.handle("level", { x: levelX(1), y: 292 }, {
    r: 12, step: spacing, cls: "geom-handle", layer: tops,
    label: "Step slider. Drag it, or focus it and use the arrow keys to choose a step.",
    describe: (p) => `step ${levelFromX(p.x)} of ${maxLevel(options.side)}`,
    clamp: (p) => ({ x: levelX(levelFromX(p.x)), y: 292 }),
    onMove: (p) => { state = withLevel(levelFromX(p.x)); render(); },
  });

  function withLevel(level) {
    return Core.start({ width: options.width, height: options.height,
      side: options.side, level: level, variant: state.variant });
  }
  function withVariant(variant) {
    return Core.start({ width: options.width, height: options.height,
      side: options.side, level: state.level, variant: variant });
  }

  function render() {
    frame.setAttribute("x", state.origin.x);
    frame.setAttribute("y", state.origin.y);
    frame.setAttribute("width", state.side);
    frame.setAttribute("height", state.side);

    board.clear(drawing);
    const parts = Core.pieces(state);
    for (const p of parts) {
      if (state.variant === "semicircles") {
        board.arc(p.center, p.radius, p.a0, p.a1, "curve", drawing);
      } else {
        board.segment(p.from, p.apex, "curve", drawing);
        board.segment(p.apex, p.to, "curve", drawing);
      }
    }
    endA.set(state.origin, 3);
    endB.set(parts[parts.length - 1].to, 3);
    levelHandle.set({ x: levelX(state.level), y: 292 });
    sliderLabel.set({ x: trackRight - 76, y: 312 },
      `${state.level}/${maxLevel(options.side)}`);

    semiBtn.setAttribute("aria-pressed", String(state.variant === "semicircles"));
    tentBtn.setAttribute("aria-pressed", String(state.variant === "tents"));
    say(Core.describe(state));

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function deepen() {
    state = Core.advance(state);
    render();
  }

  nextBtn.addEventListener("click", deepen);
  resetBtn.addEventListener("click", () => {
    state = Core.start({ width: options.width, height: options.height,
      side: options.side, variant: state.variant });
    render();
  });
  semiBtn.addEventListener("click", () => { state = withVariant("semicircles"); render(); });
  tentBtn.addEventListener("click", () => { state = withVariant("tents"); render(); });

  // The applet advanced a level on a click anywhere in the picture.
  board.root.addEventListener("click", (e) => {
    if (e.target.closest && e.target.closest(".geom-handle, .slider-part")) return;
    deepen();
  });
  board.root.addEventListener("keydown", (e) => {
    if (e.target !== board.root) return;
    if (e.key === "Enter" || e.key === " " || e.key === "+" || e.key === "=") {
      e.preventDefault();
      deepen();
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      state = withLevel(state.level - 1);
      render();
    }
  });

  board.onTheme(render);
  render();
})();
