"use strict";

/*
 * Incircles In Quadri — the page: drawing and input only.
 *
 * The geometry lives in incircles-in-quadri-core.js.  A quadrilateral has four
 * draggable corners; the AC / BD buttons choose which diagonal the applet
 * draws and which pair of incircles it shows.  Shapes are created once and
 * only updated on a redraw, so a corner keeps keyboard focus after a move.
 */

(function () {
  const Core = IncirclesInQuadriCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const acBtn = document.getElementById("acBtn");
  const bdBtn = document.getElementById("bdBtn");
  const tangentialBtn = document.getElementById("tangentialBtn");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();

  /* Layers, back to front. */
  const guides = board.layer("guides");
  const diagonals = board.layer("diagonals");
  const circlesLayer = board.layer("circles");
  const dots = board.layer("dots");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const quad = board.polygon([state.A, state.B, state.C, state.D], "quad", guides);
  const diagonal = board.segment(state.A, state.C, "diagonal", diagonals);
  const circles = [0, 1].map(() => board.circle(state.A, 1, "incircle", circlesLayer));
  const centers = [0, 1].map(() => board.point(state.A, "center-dot", 3, dots));
  const feet = [0, 1].map(() => board.point(state.A, "foot-dot", 4, dots));

  const names = ["A", "B", "C", "D"];
  const offsets = { A: [-15, -10], B: [9, -9], C: [9, 18], D: [-15, 18] };
  const cornerLabels = {};
  for (const name of names) {
    const o = offsets[name];
    cornerLabels[name] = board.label(state.A, name, "point-label", o[0], o[1], labelsLayer);
  }
  const pairLabels = [0, 1].map(() => board.label(state.A, "", "pair-label", 7, -7, labelsLayer));

  const handles = {};
  for (const name of names) {
    handles[name] = board.handle(name, state[name], {
      r: 9, step: 5, shift: 15, layer: handlesLayer,
      label: `Corner ${name}. Drag it, or focus it and use the arrow keys to move the quadrilateral.`,
      clamp: (p) => Core.clamp(p),
      onMove: (p, key) => {
        state = Core.move(state, key, p);
        render();
      },
    });
  }

  function syncButtons() {
    acBtn.setAttribute("aria-pressed", String(state.options.diagonal === "ac"));
    bdBtn.setAttribute("aria-pressed", String(state.options.diagonal === "bd"));
  }

  /** The shared status line. "done" records that this illustration was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    syncButtons();
    const g = Core.geometry(state);
    for (const name of names) handles[name].set(state[name]);
    for (const name of names) cornerLabels[name].set(state[name]);

    if (!g) {
      quad.show(false);
      diagonal.show(false);
      for (const s of circles.concat(centers, feet, pairLabels)) s.show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state(Core.position(state));
      return;
    }

    quad.show(true).set([g.A, g.B, g.C, g.D]);
    const pair = state.options.diagonal === "bd" ? g.bd : g.ac;
    const ends = state.options.diagonal === "bd" ? [g.B, g.D] : [g.A, g.C];
    diagonal.show(true).set(ends[0], ends[1]);

    const incircles = [pair.first, pair.second];
    const namesForPair = state.options.diagonal === "bd" ? ["BCD", "BAD"] : ["ABC", "ADC"];
    for (let i = 0; i < 2; i++) {
      circles[i].show(true).set(incircles[i].center, incircles[i].radius);
      centers[i].show(true).set(incircles[i].center);
      feet[i].show(true).set(incircles[i].touch);
      feet[i].node.setAttribute("class", pair.touch ? "foot-dot touching" : "foot-dot");
      pairLabels[i].show(true).set(incircles[i].center, namesForPair[i]);
    }

    say(Core.describe(state), state.explored ? "done" : null);
    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  function selectDiagonal(diagonalName) {
    state = Core.setDiagonal(state, diagonalName);
    render();
  }

  acBtn.addEventListener("click", () => selectDiagonal("ac"));
  bdBtn.addEventListener("click", () => selectDiagonal("bd"));
  tangentialBtn.addEventListener("click", () => {
    state = Core.makeTangential(state);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  board.onTheme(render);
  render();
})();
