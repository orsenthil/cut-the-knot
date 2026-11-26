"use strict";

/*
 * The page for Brick Wall: drawing and input only; the geometry is in
 * brick-wall-core.js. An SVG holds the wall of alternating bricks and the
 * horizontal mortar lines. Two draggable dots along the tracks underneath set
 * the shift and the mortar thickness; the five sliders set the same quantities
 * as the applet's five scrollbars, with the same ranges.
 */

(function () {
  const Core = BrickWallCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const CANVAS = { width: 400, height: 280 };
  const TRACK = { x0: 84, x1: 376, shiftY: 300, mortarY: 326 };

  const wall = board.layer("wall");
  const guides = board.layer("guides");
  const handlesLayer = board.layer("handles");

  const brickPool = [];
  const mortarPool = [];
  const inputs = {
    widthPct: document.getElementById("widthPct"),
    heightPct: document.getElementById("heightPct"),
    shiftPct: document.getElementById("shiftPct"),
    shadeDiff: document.getElementById("shadeDiff"),
    separation: document.getElementById("separation"),
  };
  const outputs = {
    widthPct: document.getElementById("widthPctVal"),
    heightPct: document.getElementById("heightPctVal"),
    shiftPct: document.getElementById("shiftPctVal"),
    shadeDiff: document.getElementById("shadeDiffVal"),
    separation: document.getElementById("separationVal"),
  };

  let state = Core.start();

  /** The status line never announces a win or a loss: this is an illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const trackX = (value, lo, hi) => TRACK.x0 + ((value - lo) / (hi - lo)) * (TRACK.x1 - TRACK.x0);
  const fromTrackX = (x, lo, hi) => {
    const t = (Geom.clamp(x, TRACK.x0, TRACK.x1) - TRACK.x0) / (TRACK.x1 - TRACK.x0);
    return Math.round(lo + t * (hi - lo));
  };

  function render() {
    const L = Core.layout(state, CANVAS);

    for (let i = 0; i < L.bricks.length; i++) {
      const b = L.bricks[i];
      if (!brickPool[i]) brickPool[i] = board.polygon([b], "brick", wall);
      brickPool[i].node.setAttribute("class", "brick " + (b.light ? "light" : "dark"));
      brickPool[i].set([
        { x: b.x, y: b.y }, { x: b.x + b.w, y: b.y },
        { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h },
      ]).show(true);
    }
    for (let i = L.bricks.length; i < brickPool.length; i++) brickPool[i].show(false);

    for (let i = 0; i < L.mortar.length; i++) {
      const band = L.mortar[i];
      if (!mortarPool[i]) mortarPool[i] = board.segment({ x: 0, y: band.center }, { x: CANVAS.width, y: band.center }, "mortar", wall);
      mortarPool[i].set({ x: 0, y: band.center }, { x: CANVAS.width, y: band.center }).show(true);
    }
    for (let i = L.mortar.length; i < mortarPool.length; i++) mortarPool[i].show(false);

    /* The core's grey levels and mortar width, painted with theme tokens. */
    board.root.style.setProperty("--light-mix", Math.round((L.light / 255) * 100) + "%");
    board.root.style.setProperty("--dark-mix", Math.round((1 - L.dark / 127) * 100) + "%");
    board.root.style.setProperty("--mortar-w", L.thickness);

    for (const name of Object.keys(inputs)) {
      inputs[name].value = String(state[name]);
      outputs[name].textContent = name === "shiftPct" || name === "widthPct" || name === "heightPct"
        ? state[name] + "%" : String(state[name]);
    }
    shiftHandle.set({ x: trackX(state.shiftPct, 0, 99), y: TRACK.shiftY });
    mortarHandle.set({ x: trackX(state.separation, 0, 10), y: TRACK.mortarY });

    if (Core.crosses(state, CANVAS)) {
      say(`Shift ${state.shiftPct}%, mortar ${state.separation}: the horizontal mortar lines are parallel, but the brick joints cross them.`);
    } else {
      say(`Shift ${state.shiftPct}%, mortar ${state.separation}: the joints line up from row to row. Drag Shift to misalign them.`);
    }
    if (window.Track) window.Track.state(state);
  }

  board.segment({ x: TRACK.x0, y: TRACK.shiftY }, { x: TRACK.x1, y: TRACK.shiftY }, "track", guides);
  board.segment({ x: TRACK.x0, y: TRACK.mortarY }, { x: TRACK.x1, y: TRACK.mortarY }, "track", guides);
  board.label({ x: 4, y: TRACK.shiftY + 5 }, "Shift", "ctrl-label", 0, 0, guides);
  board.label({ x: 4, y: TRACK.mortarY + 5 }, "Mortar", "ctrl-label", 0, 0, guides);

  const shiftHandle = board.handle("Shift", { x: trackX(0, 0, 99), y: TRACK.shiftY }, {
    r: 12, step: 6, shift: 24, layer: handlesLayer, cls: "geom-handle track-handle",
    label: "Shift. Drag along the top track, or focus and use the arrow keys, to slide alternate rows.",
    clamp: (p) => ({ x: Geom.clamp(p.x, TRACK.x0, TRACK.x1), y: TRACK.shiftY }),
    onMove: (p) => { state = Core.withSetting(state, "shiftPct", fromTrackX(p.x, 0, 99)); render(); },
  });
  const mortarHandle = board.handle("Mortar", { x: trackX(0, 0, 10), y: TRACK.mortarY }, {
    r: 12, step: 6, shift: 24, layer: handlesLayer, cls: "geom-handle track-handle",
    label: "Mortar. Drag along the bottom track, or focus and use the arrow keys, to change the gap between rows.",
    clamp: (p) => ({ x: Geom.clamp(p.x, TRACK.x0, TRACK.x1), y: TRACK.mortarY }),
    onMove: (p) => { state = Core.withSetting(state, "separation", fromTrackX(p.x, 0, 10)); render(); },
  });

  for (const name of Object.keys(inputs)) {
    inputs[name].addEventListener("input", () => {
      state = Core.withSetting(state, name, inputs[name].value);
      render();
    });
  }
  document.getElementById("newBtn").addEventListener("click", () => {
    state = Core.start();
    render();
    shiftHandle.node.focus();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") {
      state = Core.start();
      render();
    }
  });

  board.onTheme(render);
  render();
})();
