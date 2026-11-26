"use strict";

/*
 * The page for Barygon: drawing and input only; the mathematics is in
 * barygon-core.js. The SVG holds the draggable polygon, every averaging stage
 * and the final polygon. The number canvases of the applet are ordinary
 * labelled inputs here; changing the vertex count resets the vertices, as the
 * applet's Reset did, while changing the average or the iteration count keeps
 * them. The Help checkbox became a button that shows the centre instead of
 * aiming at the sum of the vertices (which lies outside the applet's canvas).
 */

(function () {
  const Core = BarygonCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const checkBtn = document.getElementById("checkBtn");
  const centreBtn = document.getElementById("centreBtn");
  const nInput = document.getElementById("nInput");
  const naInput = document.getElementById("naInput");
  const niInput = document.getElementById("niInput");

  const MAX_N = Core.RANGES.N[1];
  const MAX_STEPS = Core.RANGES.NI[1];
  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 10, view.x + view.width - 10),
    y: Geom.clamp(p.y, view.y + 10, view.y + view.height - 10),
  });
  const fmt = (v) => (Number.isFinite(v) ? (v > 0 && v < 0.001 ? v.toExponential(1) : v.toFixed(3)) : "—");

  let state = Core.start();
  let checked = false;
  let showCentre = false;

  /* Every element is made once and only its geometry changes on a redraw. */
  const stagesLayer = board.layer("stages");
  const linksLayer = board.layer("links");
  const marksLayer = board.layer("marks");
  const handlesLayer = board.layer("handles");

  const polys = [];
  for (let t = 0; t <= MAX_STEPS; t++) {
    polys.push(board.polygon(state.points, "stage-poly", stagesLayer));
  }
  const spokes = [];
  for (let i = 0; i < MAX_N; i++) {
    spokes.push(board.segment(state.points[0], state.points[0], "centre-spoke", linksLayer));
  }
  const centreDot = board.point(state.points[0], "centre-dot", 5, marksLayer);
  const centreLabel = board.label(state.points[0], "centre", "centre-label", 9, -8, marksLayer);
  const labels = [];
  for (let i = 0; i < MAX_N; i++) {
    labels.push(board.label(state.points[0], `P${i + 1}`, "vlabel", 9, -8, marksLayer));
  }

  /**
   * Shows the line under the game. `kind` is "done" once a claim has been
   * checked; an illustration has no win or loss. The record reads the class.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function describe(cl) {
    const last = `${state.NI} round${state.NI === 1 ? "" : "s"}`;
    if (!cl.even) {
      return `${state.N} vertices, average over ${state.NA}, ${last}. ` +
        "An odd number of vertices has no opposite sides, so it cannot be a paragon. Try an even number.";
    }
    if (cl.allDivides) {
      return `${state.N} vertices, average over ${state.NA}, ${last}. ` +
        "Every vertex is now the centre point: a flat paragon. Try averaging 3 times half the vertices for a larger one.";
    }
    if (cl.halfDivides) {
      return `${state.N} vertices, average over ${state.NA}, ${last}. ` +
        "Opposite sides match after the first averaging: a paragon. More iterations keep it a paragon but shrink it toward the centre.";
    }
    return `${state.N} vertices, average over ${state.NA}, ${last}. ` +
      `Opposite sides still differ (defect ${fmt(Math.sqrt(cl.defect))}). Each averaging brings them closer, but this setting never matches exactly.`;
  }

  function render() {
    const seq = Core.sequence(state);
    const cl = Core.claims(state);
    const final = seq[seq.length - 1];

    for (let t = 0; t < polys.length; t++) {
      const poly = polys[t];
      const on = t < seq.length;
      poly.show(on);
      if (!on) continue;
      poly.set(seq[t]);
      poly.node.setAttribute("class",
        t === 0 ? "stage-poly original" : t === seq.length - 1 ? "stage-poly final" : "stage-poly intermediate");
    }

    const centre = state.points.reduce((a, p) => ({ x: a.x + p.x / state.N, y: a.y + p.y / state.N }), { x: 0, y: 0 });
    centreDot.show(showCentre);
    centreLabel.show(showCentre);
    centreDot.set(centre);
    centreLabel.set(centre);
    for (let i = 0; i < spokes.length; i++) {
      const on = showCentre && i < final.length;
      spokes[i].show(on);
      if (on) spokes[i].set(final[i], centre);
    }

    for (let i = 0; i < labels.length; i++) {
      const on = i < state.points.length;
      labels[i].show(on);
      if (on) labels[i].set(state.points[i]);
    }
    for (let i = 0; i < handles.length; i++) {
      const on = i < state.points.length;
      handles[i].show(on);
      if (on) handles[i].set(state.points[i]);
    }

    if (checked) {
      const answer = cl.even && cl.halfDivides
        ? "Yes: a paragon appears after the first averaging."
        : cl.even
          ? "No: this averaging only approaches a paragon; it never reaches one."
          : "There is no paragon test for an odd number of vertices.";
      say(`${answer} ${describe(cl)}`, "done");
    } else {
      say(describe(cl));
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function change() {
    checked = false;
    render();
  }

  function moveVertex(index, p) {
    state = Core.withPoint(state, index, inside(p));
    change();
  }

  const handles = [];
  for (let i = 0; i < MAX_N; i++) {
    handles.push(board.handle(`P${i + 1}`, state.points[i] || { x: 0, y: 0 }, {
      r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: inside,
      label: `Vertex ${i + 1}. Drag, or focus it and use the arrow keys to move it`,
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => moveVertex(i, p),
    }));
  }

  function newGame() {
    state = Core.start({ N: state.N, NA: state.NA, NI: state.NI });
    nInput.value = String(state.N);
    naInput.value = String(state.NA);
    niInput.value = String(state.NI);
    checked = false;
    render();
    const first = handles[0];
    if (first && first.node.isConnected) first.node.focus();
  }

  function setOption(name, input) {
    const value = Core.clampOption(name, input.value);
    input.value = String(value);
    state = Core.withOptions(state, { [name]: value });
    change();
  }

  function checkClaims() {
    checked = true;
    render();
  }

  newBtn.addEventListener("click", newGame);
  checkBtn.addEventListener("click", checkClaims);
  centreBtn.addEventListener("click", () => {
    showCentre = !showCentre;
    centreBtn.setAttribute("aria-pressed", String(showCentre));
    centreBtn.textContent = showCentre ? "Hide centre" : "Show centre";
    render();
  });
  nInput.addEventListener("change", () => setOption("N", nInput));
  naInput.addEventListener("change", () => setOption("NA", naInput));
  niInput.addEventListener("change", () => setOption("NI", niInput));
  document.addEventListener("keydown", (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === "r" || e.key === "R") newGame();
    if (e.key === "c" || e.key === "C") checkClaims();
  });

  board.onTheme(render);
  render();
})();
