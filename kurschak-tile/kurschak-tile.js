"use strict";

/*
 * The page for Kürschak's Tile: drawing and input only; the geometry and the
 * 30-step rearrangement live in kurschak-tile-core.js. The SVG shows the
 * twelve-pointed star in the square, the nine pieces that travel into three
 * corners, the optional point names and hint lines, and a draggable step
 * handle so the rearrangement can be inspected one frame at a time.
 */

(function () {
  const Core = KurschakTileCore;
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("namesBox");
  const hintBox = document.getElementById("hintBox");
  const moveBtn = document.getElementById("moveBtn");
  const resetBtn = document.getElementById("resetBtn");
  const stepValue = document.getElementById("stepValue");
  const board = Geom.board("board");

  const layers = {
    fills: board.layer("fills"),
    moving: board.layer("moving"),
    hints: board.layer("hints"),
    outlines: board.layer("outlines"),
    labels: board.layer("labels"),
    track: board.layer("track"),
    handles: board.layer("handles"),
  };

  let state = Core.start({ width: 500, height: 450 });
  let geometry = Core.geometry(state);
  let timer = 0;

  /** Say what the picture shows. A demo has no winner: never win or lose. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function statusText() {
    if (state.step >= Core.STEPS) {
      return "Done: nine pieces fill three corners. The coloured part is 3/4 of the square, so a dodecagon in a unit circle has area 3.";
    }
    if (state.step > 0) {
      return `Moving nine triangles into three corners — step ${state.step} of ${Core.STEPS}.`;
    }
    return "24 red triangles and 12 blue ones tile the dodecagon. Press Move them to see three quarters of the square filled.";
  }

  // Every element is created once and only re-set on a redraw, so focus on
  // the step handle survives a move or a theme change.
  const staticPieces = [];
  for (let i = 0; i < 36; i++) {
    staticPieces.push(board.polygon(geometry.iso[0],
      i < 24 ? "piece piece-thin" : "piece piece-regular", layers.fills));
  }
  const copies = [];
  for (const spec of Core.movingSpecs(geometry)) {
    copies.push({
      spec,
      node: board.polygon(spec.final,
        spec.kind === "iso" ? "piece piece-thin" : "piece piece-regular", layers.moving),
    });
  }
  const squareSides = [], dodecagonSides = [], cornerRays = [];
  for (let j = 0; j < 4; j++) {
    squareSides.push(board.segment(geometry.U[j], geometry.U[(j + 1) % 4], "square-side", layers.outlines));
  }
  for (let i = 0; i < Core.SIDES; i++) {
    dodecagonSides.push(board.segment(geometry.V[i], geometry.V[(i + 1) % Core.SIDES],
      "dodecagon-side", layers.outlines));
  }
  for (let j = 0; j < 4; j++) {
    cornerRays.push(board.segment(geometry.U[j], geometry.V[3 * j + 1], "corner-ray", layers.outlines));
    cornerRays.push(board.segment(geometry.U[j], geometry.V[3 * j + 2], "corner-ray", layers.outlines));
  }
  const hintLines = Core.hints(geometry).map((line, i) => board.segment(line[0], line[1],
    i >= 56 ? "hint-line hint-spoke" : "hint-line", layers.hints));
  const names = Core.labels(geometry).map((item) => board.label(item.point, item.name,
    "point-label", 5, -9, layers.labels));
  const track = board.segment({ x: 40, y: 450 }, { x: 460, y: 450 }, "step-track", layers.track);
  const scrub = board.handle("Step", { x: 40, y: 450 }, {
    r: 11,
    step: 14, // 420 board units / 30 steps: one arrow press is one step
    shift: 70,
    cls: "step-handle",
    layer: layers.handles,
    label: "Rearrangement step. Drag, or focus and use the arrow keys, to look at steps 0 to 30.",
    describe: (p) => `step ${Math.round((p.x - 40) / 14)} of ${Core.STEPS}`,
    clamp: (q) => ({
      x: Math.max(40, Math.min(460, q.x)),
      y: 450,
    }),
    onMove: (p) => {
      stop();
      apply({ type: "step", value: Math.round((p.x - 40) / 14) });
    },
  });

  function draw() {
    const pieces = Core.positions(state);
    for (let i = 0; i < staticPieces.length; i++) {
      staticPieces[i].set(pieces[i].points).show(!pieces[i].hidden);
    }
    const moving = pieces.filter((p) => p.moving);
    for (let i = 0; i < copies.length; i++) {
      // At step 0 the copies sit on the originals and are not drawn yet.
      if (moving[i]) copies[i].node.set(moving[i].points);
      copies[i].node.show(state.step > 0);
    }
    const showHint = state.showHint;
    for (const line of hintLines) line.show(showHint);
    for (const label of names) label.show(state.showNames);
    scrub.set({ x: 40 + (state.step / Core.STEPS) * 420, y: 450 });
    stepValue.textContent = `${state.step} / ${Core.STEPS}`;
  }

  /** Redraw, speak the picture, and save the position for record and tutor. */
  function render() {
    geometry = Core.geometry(state);
    draw();
    say(statusText(), Core.result(state));
    moveBtn.disabled = state.moving;
    namesBox.disabled = state.moving;
    hintBox.disabled = state.moving;
    if (namesBox.checked !== state.showNames) namesBox.checked = state.showNames;
    if (hintBox.checked !== state.showHint) hintBox.checked = state.showHint;
    if (window.Track) window.Track.state(state);
  }

  function apply(action) {
    const next = Core.move(state, action);
    if (!next) return false;
    state = next;
    render();
    return true;
  }

  function stop() {
    if (timer) cancelAnimationFrame(timer);
    timer = 0;
  }

  function animate() {
    timer = requestAnimationFrame(() => {
      const next = Core.move(state, { type: "advance" });
      timer = 0;
      if (!next) return;
      state = next;
      render();
      if (state.moving) animate();
    });
  }

  moveBtn.addEventListener("click", () => {
    stop();
    apply({ type: "reset" });
    apply({ type: "move" });
    animate();
  });
  resetBtn.addEventListener("click", () => {
    stop();
    apply({ type: "reset" });
  });
  namesBox.addEventListener("change", () => apply({ type: "option", key: "showNames", value: namesBox.checked }));
  hintBox.addEventListener("change", () => apply({ type: "option", key: "showHint", value: hintBox.checked }));

  // The colours are CSS classes, so a theme flip needs no new coordinates.
  board.onTheme(() => draw());

  render();
})();
