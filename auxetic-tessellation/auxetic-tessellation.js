"use strict";

/*
 * The page for Auxetic Tessellation: drawing and input only. The rectangles,
 * their lattice and the density are computed in auxetic-tessellation-core.js.
 *
 * The SVG holds the four-tile ring on the hinge rhombus A-B-C-D and as many
 * translated rings as the Layers control asks for. A, B and C are real
 * focusable handles; D is computed. Nothing is won or lost here: the status
 * line reports what stretching does to the pattern.
 */

(function () {
  const Core = AuxeticTessellationCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const view = board.viewBox;

  const alphaInput = document.getElementById("alphaInput");
  const gammaInput = document.getElementById("gammaInput");
  const layersInput = document.getElementById("layersInput");
  const alphaOut = document.getElementById("alphaOut");
  const gammaOut = document.getElementById("gammaOut");
  const oneColor = document.getElementById("oneColor");
  const colorLayers = document.getElementById("colorLayers");
  const lockHinges = document.getElementById("lockHinges");
  const stretchBtn = document.getElementById("stretchBtn");
  const relaxBtn = document.getElementById("relaxBtn");
  const newBtn = document.getElementById("newBtn");

  let state = Core.start();
  let shown = 0;

  const tilesLayer = board.layer("tiles");
  const guidesLayer = board.layer("guides");
  const handlesLayer = board.layer("handles");

  /* Objects are created once; render() only changes their geometry. */
  const ring = [
    board.segment(state.A, state.B, "ring-edge", guidesLayer),
    board.segment(state.B, state.C, "ring-edge", guidesLayer),
    board.segment(state.C, state.D || state.C, "ring-edge", guidesLayer),
    board.segment(state.C, state.A, "ring-edge", guidesLayer),
  ];
  const diagonals = [
    board.segment(state.A, state.C, "ring-diagonal", guidesLayer),
    board.segment(state.B, state.D || state.B, "ring-diagonal", guidesLayer),
  ];
  const dDot = board.point(state.A, "d-dot", 6, guidesLayer);
  const labels = [
    board.label(state.A, "A", "point-label", -20, -12, guidesLayer),
    board.label(state.B, "B", "point-label", 12, -12, guidesLayer),
    board.label(state.C, "C", "point-label", -20, 22, guidesLayer),
    board.label(state.A, "D", "point-label", -20, 22, guidesLayer),
  ];
  const pool = [];

  /** Show a line under the board. "done" is used when a claim has been checked. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(3) : "—");

  /** A tile matters only if it can touch the visible part of the board. */
  function onScreen(rect) {
    const xs = rect.V.map((p) => p.x);
    const ys = rect.V.map((p) => p.y);
    const pad = 8;
    return Math.max(...xs) >= view.x - pad && Math.min(...xs) <= view.x + view.width + pad &&
      Math.max(...ys) >= view.y - pad && Math.min(...ys) <= view.y + view.height + pad;
  }

  function render() {
    const m = Core.tessellate(state);
    const D = m.D;

    let used = 0;
    const limit = Math.min(state.layers, m.layers.length);
    for (let li = 0; li < limit; li++) {
      for (const rect of m.layers[li]) {
        if (!onScreen(rect)) continue;
        let poly = pool[used];
        if (!poly) {
          poly = board.polygon(rect.V, "tile", tilesLayer);
          pool.push(poly);
        }
        poly.node.setAttribute("class", state.colorLayers ? "tile tile-c" + (li % 10) : "tile tile-one");
        poly.set(rect.V);
        poly.show(true);
        used++;
      }
    }
    for (let i = used; i < pool.length; i++) pool[i].show(false);
    shown = used;

    const corners = [state.A, state.B, state.C, D];
    for (let i = 0; i < 4; i++) ring[i].set(corners[i], corners[(i + 1) % 4]);
    diagonals[0].set(state.A, state.C);
    diagonals[1].set(state.B, D);
    dDot.set(D);
    labels[0].set(state.A);
    labels[1].set(state.B);
    labels[2].set(state.C);
    labels[3].set(D);

    hA.set(state.A);
    hB.set(state.B);
    hC.set(state.C);

    alphaOut.textContent = fmt(state.alpha);
    gammaOut.textContent = fmt(state.gamma);
    if (String(layersInput.value) !== String(state.layers)) layersInput.value = String(state.layers);

    const fill = m.density == null ? "—" : (100 * m.density).toFixed(1) + "%";
    const unit = state.layers === 1 ? "layer" : "layers";
    say(`${state.layers} ${unit} shown (${shown} rectangles on screen). One repeat of the pattern is ` +
      `${(m.cellArea / 1000).toFixed(1)}k square units and the rectangles fill ${fill} of it. ` +
      `Drag A, B or C, or press Stretch to open the hinge.`);

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
      alpha: state.alpha, gamma: state.gamma, layers: state.layers,
      colorLayers: state.colorLayers, loose: state.loose,
      width: state.width, height: state.height,
    };
    state = Core.start(opts);
    render();
    hA.node.focus();
  }

  function stretch(degrees, kind) {
    state = Core.openHinge(state, degrees);
    render();
    if (kind) say(statusEl.textContent + "  The hinge opened: the repeat grew and the fill fell.", kind);
  }

  alphaInput.addEventListener("input", () => {
    state = Core.withOption(state, "alpha", Number(alphaInput.value) / 10);
    render();
  });
  gammaInput.addEventListener("input", () => {
    state = Core.withOption(state, "gamma", Number(gammaInput.value) / 10);
    render();
  });
  layersInput.addEventListener("input", () => {
    state = Core.withOption(state, "layers", Number(layersInput.value) || 1);
    render();
  });
  oneColor.addEventListener("change", () => {
    if (oneColor.checked) { state = Core.withOption(state, "colorLayers", false); render(); }
  });
  colorLayers.addEventListener("change", () => {
    if (colorLayers.checked) { state = Core.withOption(state, "colorLayers", true); render(); }
  });
  lockHinges.addEventListener("change", () => {
    state = Core.withOption(state, "loose", !lockHinges.checked);
    render();
  });
  stretchBtn.addEventListener("click", () => stretch(6));
  relaxBtn.addEventListener("click", () => stretch(-6));
  newBtn.addEventListener("click", reset);
  document.addEventListener("keydown", (e) => {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === "r" || e.key === "R") reset();
    if (e.key === "+" || e.key === "=") stretch(6);
    if (e.key === "-" || e.key === "_") stretch(-6);
  });

  board.onTheme(render);
  render();
})();
