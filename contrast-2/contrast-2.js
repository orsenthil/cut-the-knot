"use strict";

/*
 * The page for Contrast 2: drawing and input only. All the geometry and the
 * invariant live in contrast-2-core.js; this file owns the SVG, the five
 * scrollbar sliders and the words under the picture.
 *
 * The play area is a 400-by-300 Geom board. Six wide bands are laid across it;
 * six short gray patches sit on them in two columns. Two focusable sample
 * dots let a player (or a screen reader) step between the patches and hear
 * which band each one is on. Nothing is won or lost.
 */

(function () {
  const Core = Contrast2Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const bandsLayer = board.layer("bands");
  const patchesLayer = board.layer("patches");
  const marksLayer = board.layer("marks");
  const handlesLayer = board.layer("handles");

  const sliders = {
    W: document.getElementById("wRange"),
    H: document.getElementById("hRange"),
    gray: document.getElementById("grayRange"),
    min: document.getElementById("minRange"),
    max: document.getElementById("maxRange"),
  };
  const outputs = {
    W: document.getElementById("wValue"),
    H: document.getElementById("hValue"),
    gray: document.getElementById("grayValue"),
    min: document.getElementById("minValue"),
    max: document.getElementById("maxValue"),
  };
  const resetBtn = document.getElementById("resetBtn");

  /* The left column occupies bands 0, 2, 4; the right column 1, 3, 5. */
  const ROWS = { left: [0, 2, 4], right: [1, 3, 5] };
  let state = { ...Core.start({}), sampleLeft: 0, sampleRight: 1 };
  let view = Core.analyze(state);

  const bandShapes = Array.from({ length: Core.N }, () =>
    board.polygon(Core.corners(view.bands[0]), "band", bandsLayer));
  const patchShapes = Array.from({ length: Core.N }, () =>
    board.polygon(Core.corners(view.patches[0]), "patch", patchesLayer));

  board.polygon([
    { x: 0.5, y: 0.5 }, { x: view.settings.width - 0.5, y: 0.5 },
    { x: view.settings.width - 0.5, y: view.settings.height - 0.5 },
    { x: 0.5, y: view.settings.height - 0.5 },
  ], "frame", marksLayer);

  function rectangle(rects, shapes) {
    for (let i = 0; i < shapes.length; i++) {
      shapes[i].show(Boolean(rects[i]));
      if (rects[i]) shapes[i].set(Core.corners(rects[i]));
    }
  }

  function samplePoint(column, row) {
    const p = view.patches[row];
    return { x: p.x + p.width / 2, y: p.y + p.height / 2 };
  }

  function nearestRow(column, point) {
    let best = ROWS[column][0];
    for (const row of ROWS[column]) {
      const p = samplePoint(column, row);
      if (Math.abs(p.y - point.y) < Math.abs(samplePoint(column, best).y - point.y)) best = row;
    }
    return best;
  }

  /** The line under the board; a demo never ends in a win or a loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function describeSample(column) {
    const row = state[column === "left" ? "sampleLeft" : "sampleRight"];
    const band = view.bands[row];
    return `${column} dot: patch ${row + 1} of 6 on a ${band.band === "min" ? "dark" : "light"} band, shade ${band.shadeByte} behind, ${view.shades.gray} in the patch.`;
  }

  function describe() {
    let text = `All six gray patches are painted the same shade (${view.shades.gray} of 255). ` +
      `Three sit on dark bands and three on light bands. Bands are ${view.bandHeight} units tall; ` +
      `patches are ${view.patches[0].width} units wide. ${describeSample("left")} ${describeSample("right")}`;
    if (view.outOfRange.gray || view.outOfRange.min || view.outOfRange.max) {
      text += " The old applet's colors stop at 100%; above that it stopped drawing. Here the shade stays white.";
    }
    return text;
  }

  function render() {
    view = Core.analyze(state);

    board.root.style.setProperty("--band-min", `rgb(${view.shades.min}, ${view.shades.min}, ${view.shades.min})`);
    board.root.style.setProperty("--band-max", `rgb(${view.shades.max}, ${view.shades.max}, ${view.shades.max})`);
    board.root.style.setProperty("--patch-gray", `rgb(${view.shades.gray}, ${view.shades.gray}, ${view.shades.gray})`);

    rectangle(view.bands, bandShapes);
    rectangle(view.patches, patchShapes);

    for (const key of Object.keys(sliders)) {
      sliders[key].value = String(state[key]);
      outputs[key].textContent = `${state[key]}%`;
    }

    leftHandle.set(samplePoint("left", state.sampleLeft));
    rightHandle.set(samplePoint("right", state.sampleRight));

    say(describe(), null);
    if (window.Track) window.Track.state(state);
  }

  const handleOptions = (column) => ({
    r: 8,
    step: 1,
    layer: handlesLayer,
    label: `Sample dot on the ${column}. Drag it, or focus it and use the up and down arrow keys to move between the gray patches`,
    describe: () => describeSample(column),
    clamp: (point) => samplePoint(column, nearestRow(column, point)),
    onMove: (point) => {
      state = {
        ...state,
        [column === "left" ? "sampleLeft" : "sampleRight"]: nearestRow(column, point),
      };
      render();
    },
  });

  const leftHandle = board.handle("Left sample", samplePoint("left", state.sampleLeft),
    handleOptions("left"));
  const rightHandle = board.handle("Right sample", samplePoint("right", state.sampleRight),
    handleOptions("right"));

  /* Geom's own arrow keys move one SVG unit; here an arrow moves one patch. */
  board.root.addEventListener("keydown", (event) => {
    const column = event.target === leftHandle.node ? "left"
      : event.target === rightHandle.node ? "right" : null;
    if (!column) return;
    const key = event.key;
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) return;
    event.preventDefault();
    event.stopPropagation();
    const rows = ROWS[column];
    let at = rows.indexOf(state[column === "left" ? "sampleLeft" : "sampleRight"]);
    at = key === "ArrowUp" || key === "ArrowLeft"
      ? Math.max(0, at - 1) : Math.min(rows.length - 1, at + 1);
    state = { ...state, [column === "left" ? "sampleLeft" : "sampleRight"]: rows[at] };
    render();
    (column === "left" ? leftHandle : rightHandle).node.focus();
  }, true);

  for (const key of Object.keys(sliders)) {
    sliders[key].addEventListener("input", () => {
      state = Core.withSetting(state, key, Number(sliders[key].value));
      render();
    });
  }

  resetBtn.addEventListener("click", () => {
    state = { ...Core.reset(state), sampleLeft: 0, sampleRight: 1 };
    render();
    resetBtn.focus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "r" || event.key === "R") {
      state = { ...Core.reset(state), sampleLeft: 0, sampleRight: 1 };
      render();
    }
  });

  board.onTheme(render);
  render();
})();
