"use strict";

/*
 * The page for Dancing Squares: drawing and input only. The tessellation and
 * the hinge geometry live in dancing-squares-core.js.
 *
 * The SVG holds the squares of as many of the applet's sixteen layers as the
 * Layers control asks for. A, B and C are real focusable handles; D is the
 * fourth hinge corner. Nothing is won or lost: the status line reports the
 * hinge angle and how much of one repeat the squares cover.
 */

(function () {
  const Core = DancingSquaresCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const view = board.viewBox;

  const layersInput = document.getElementById("layersInput");
  const oneColor = document.getElementById("oneColor");
  const colorLayers = document.getElementById("colorLayers");
  const showNames = document.getElementById("showNames");
  const lockHinges = document.getElementById("lockHinges");
  const openBtn = document.getElementById("openBtn");
  const closeBtn = document.getElementById("closeBtn");
  const newBtn = document.getElementById("newBtn");

  let state = Core.start();

  const tilesLayer = board.layer("tiles");
  const guidesLayer = board.layer("guides");
  const handlesLayer = board.layer("handles");

  /* Objects are created once; render() only changes their geometry. */
  const ring = [
    board.segment(state.A, state.B, "ring-edge", guidesLayer),
    board.segment(state.B, state.C, "ring-edge", guidesLayer),
    board.segment(state.C, state.A, "ring-edge", guidesLayer),
  ];
  const diagonals = [
    board.segment(state.A, state.C, "ring-diagonal", guidesLayer),
    board.segment(state.B, state.C, "ring-diagonal", guidesLayer),
  ];
  const dDot = board.point(state.A, "d-dot", 6, guidesLayer);
  const labels = [
    board.label(state.A, "A", "point-label", -20, -12, guidesLayer),
    board.label(state.B, "B", "point-label", 12, -12, guidesLayer),
    board.label(state.C, "C", "point-label", -20, 22, guidesLayer),
    board.label(state.A, "D", "point-label", 12, 22, guidesLayer),
  ];
  const pool = [];

  /** Show a line under the board. "done" marks the checkerboard milestone. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** A tile matters only if it can touch the visible part of the board. */
  function onScreen(square) {
    const xs = square.V.map((p) => p.x);
    const ys = square.V.map((p) => p.y);
    const pad = 8;
    return Math.max(...xs) >= view.x - pad && Math.min(...xs) <= view.x + view.width + pad &&
      Math.max(...ys) >= view.y - pad && Math.min(...ys) <= view.y + view.height + pad;
  }

  function render() {
    const m = Core.tessellate(state);
    const lattice = Core.lattice(state);
    const D = m.D;

    let used = 0;
    const limit = Math.min(state.layers, m.layers.length);
    for (let li = 0; li < limit; li++) {
      for (const square of m.layers[li]) {
        if (!onScreen(square)) continue;
        let poly = pool[used];
        if (!poly) {
          poly = board.polygon(square.V, "tile", tilesLayer);
          pool.push(poly);
        }
        poly.node.setAttribute("class", state.colorLayers ? "tile tile-c" + (li % 10) : "tile tile-one");
        poly.set(square.V);
        poly.show(true);
        used++;
      }
    }
    for (let i = used; i < pool.length; i++) pool[i].show(false);

    const corners = [state.A, state.B, state.C];
    for (let i = 0; i < 3; i++) ring[i].set(corners[i], corners[(i + 1) % 3]);
    diagonals[0].set(state.A, state.C);
    diagonals[1].set(state.B, D);
    dDot.set(D);
    for (let i = 0; i < 4; i++) {
      labels[i].set([state.A, state.B, state.C, D][i]);
      labels[i].show(state.showNames);
    }

    hA.set(state.A);
    hB.set(state.B);
    hC.set(state.C);

    if (String(layersInput.value) !== String(state.layers)) layersInput.value = String(state.layers);

    const angle = Math.round(lattice.hingeAngle * 180 / Math.PI);
    const fill = lattice.density == null ? "—" : (100 * lattice.density).toFixed(0) + "%";
    const unit = state.layers === 1 ? "layer" : "layers";
    const checkerboard = Math.abs(lattice.hingeAngle - Math.PI / 2) < 0.02;
    say(`${state.layers} ${unit} shown (${used} squares on screen). The hinge is open ${angle}° and the squares fill ` +
      `${fill} of one repeat. Drag A, B or C, or press Open hinge.` +
      (checkerboard ? "  Checkerboard: half the places are filled." : ""), checkerboard ? "done" : null);

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function movePoint(name, p) {
    state = Core.withPoint(state, name, p);
    render();
  }

  const clampPoint = (p, name) => Core.constrainPoint(state, name, p);
  const describe = (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`;

  const hA = board.handle("A", state.A, {
    r: 10, step: 4, shift: 16, layer: handlesLayer, clamp: clampPoint,
    label: "Point A. Drag, or focus it and use the arrow keys to move the hinge.",
    describe: describe, onMove: (p) => movePoint("A", p),
  });
  const hB = board.handle("B", state.B, {
    r: 10, step: 4, shift: 16, layer: handlesLayer, clamp: clampPoint,
    label: "Point B. Drag, or focus it and use the arrow keys to move the hinge.",
    describe: describe, onMove: (p) => movePoint("B", p),
  });
  const hC = board.handle("C", state.C, {
    r: 10, step: 4, shift: 16, layer: handlesLayer, clamp: clampPoint,
    label: "Point C. Drag, or focus it and use the arrow keys to move the hinge.",
    describe: describe, onMove: (p) => movePoint("C", p),
  });

  function reset() {
    const opts = {
      layers: state.layers, colorLayers: state.colorLayers,
      showNames: state.showNames, loose: state.loose,
      width: state.width, height: state.height,
    };
    state = Core.start(opts);
    render();
    hA.node.focus();
  }

  function turn(degrees) {
    // The core's argument is a change in HALF the hinge angle; a button press
    // advances the hinge angle itself by `degrees`.
    state = Core.openHinge(state, degrees / 2);
    render();
  }

  layersInput.addEventListener("input", () => {
    state = Core.withOption(state, "layers", Number(layersInput.value));
    render();
  });
  oneColor.addEventListener("change", () => {
    if (oneColor.checked) { state = Core.withOption(state, "colorLayers", false); render(); }
  });
  colorLayers.addEventListener("change", () => {
    if (colorLayers.checked) { state = Core.withOption(state, "colorLayers", true); render(); }
  });
  showNames.addEventListener("change", () => {
    state = Core.withOption(state, "showNames", showNames.checked);
    render();
  });
  lockHinges.addEventListener("change", () => {
    state = Core.withOption(state, "loose", !lockHinges.checked);
    render();
  });
  openBtn.addEventListener("click", () => turn(5));
  closeBtn.addEventListener("click", () => turn(-5));
  newBtn.addEventListener("click", reset);
  document.addEventListener("keydown", (e) => {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === "r" || e.key === "R") reset();
    if (e.key === "+" || e.key === "=") turn(5);
    if (e.key === "-" || e.key === "_") turn(-5);
  });

  board.onTheme(render);
  render();
})();
