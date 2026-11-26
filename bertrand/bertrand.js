"use strict";

/*
 * The page for Bertrand's Paradox: drawing and input only. The random chords,
 * the three answers and the counting live in bertrand-core.js.
 *
 * The left of the SVG is the unit circle with an inscribed triangle, a dashed
 * circle at half the radius and three draggable points: the two ends of the
 * chord and its midpoint. On the right is the applet's cumulative graph of
 * chord lengths, with a marker at sqrt(3), the triangle's side. Buttons choose
 * one of the applet's four SHOULDFIX samples and draw one or a hundred chords.
 */

(function () {
  const Core = BertrandCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const modeButtons = [...document.querySelectorAll(".mode-btn")];
  const drawBtn = document.getElementById("drawBtn");
  const batchBtn = document.getElementById("batchBtn");
  const autoBtn = document.getElementById("autoBtn");
  const resetBtn = document.getElementById("resetBtn");

  const O = { x: 122, y: 150 };   // centre of the circle in board units
  const R = 100;                  // radius in board units
  const CHART = { x0: 272, x1: 508, top: 42, bottom: 238 };
  const chartW = CHART.x1 - CHART.x0, chartH = CHART.bottom - CHART.top;
  const toScreen = (p) => ({ x: O.x + p.x * R, y: O.y - p.y * R });
  const toUnit = (p) => ({ x: (p.x - O.x) / R, y: (O.y - p.y) / R });
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(2) : "—");

  let state = Core.start();
  let autoTimer = null;

  const grid = board.layer("grid");
  const trailLayer = board.layer("trail");
  const shapes = board.layer("shapes");
  const handlesLayer = board.layer("handles");

  /* The circle, the triangle whose side is sqrt(3), and the half-radius
   * circle inside which a midpoint makes a long chord. */
  board.circle(O, R, "main-circle", grid);
  board.circle(O, R / 2, "inner-circle", grid);
  const triangle = [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 + (4 * Math.PI) / 3]
    .map((a) => toScreen({ x: Math.cos(a), y: Math.sin(a) }));
  board.polygon(triangle, "triangle", grid);
  board.label({ x: O.x, y: O.y + R + 18 }, "circle of radius 1", "glabel caption", 0, 0, grid);

  /* The graph's axes and the red sqrt(3) line. */
  board.segment({ x: CHART.x0, y: CHART.bottom }, { x: CHART.x1, y: CHART.bottom }, "axis", grid);
  board.segment({ x: CHART.x0, y: CHART.top }, { x: CHART.x0, y: CHART.bottom }, "axis", grid);
  const cutoffBin = Math.floor(Core.BINS * Core.SIDE / 2);
  const cutoffX = CHART.x0 + (cutoffBin / (Core.BINS - 1)) * chartW;
  board.segment({ x: cutoffX, y: CHART.top }, { x: cutoffX, y: CHART.bottom }, "cutoff", grid);
  board.label({ x: cutoffX, y: CHART.top - 6 }, "√3", "glabel cutoff-label", -8, 0, grid);
  board.label({ x: CHART.x0, y: CHART.top - 6 }, "chance", "glabel chart-label", 0, 0, grid);
  board.label({ x: CHART.x0, y: CHART.bottom + 18 }, "short", "glabel caption", -10, 0, grid);
  board.label({ x: CHART.x1, y: CHART.bottom + 18 }, "long", "glabel caption", -20, 0, grid);
  board.label({ x: CHART.x0, y: CHART.top + 12 }, "1", "glabel caption", -14, 0, grid);
  board.label({ x: CHART.x0, y: CHART.bottom }, "0", "glabel caption", -14, 4, grid);

  /* One set of objects, updated in place so the focused handle keeps focus. */
  const radiusLine = board.segment(O, O, "radius-line", shapes);
  const chordLine = board.segment(O, O, "chord", shapes);
  const midDot = board.point(O, "mid-dot", 4.5, shapes);
  const midLabel = board.label(O, "M", "glabel mid-label", 9, -6, shapes);
  const cdfPath = board.el("path", null, "cdf", shapes);
  const past = [];
  for (let i = 0; i < 36; i++) past.push(board.segment(O, O, "past", trailLayer));

  const clampTo = (name) => (p) => {
    const unit = toUnit(p);
    return toScreen(name === "M" ? Core.snapToDisc(unit) : Core.snapToCircle(unit));
  };
  const handleOpts = (name, label) => ({
    r: 13, step: 4, shift: 16, layer: handlesLayer, clamp: clampTo(name),
    label,
    describe: () => `Chord length ${fmt(state.chord.length)} of 2`,
    onMove: (p) => { state = Core.withPoint(state, name, toUnit(p)); render(); },
  });
  const hA = board.handle("A", toScreen(state.chord.p1), handleOpts(
    "A", "End A. Drag it around the circle, or focus it and use the arrow keys"));
  const hB = board.handle("B", toScreen(state.chord.p2), handleOpts(
    "B", "End B. Drag it around the circle, or focus it and use the arrow keys"));
  const hM = board.handle("M", toScreen(state.chord.midpoint), handleOpts(
    "M", "Midpoint M. Drag it inside the circle, or focus it and use the arrow keys"));

  /**
   * Shows the status line. "done", "win" and "lose" are how the player's
   * record sees a finished play; this illustration has none, so `kind` stays
   * empty here. The parameter is kept so the line reads like the other ports.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const chord = state.chord;
    const a = toScreen(chord.p1), b = toScreen(chord.p2), m = toScreen(chord.midpoint);
    const long = Core.isLong(chord);

    radiusLine.set(O, m);
    chordLine.set(a, b);
    chordLine.node.setAttribute("class", "chord " + (long ? "long" : "short"));
    midDot.set(m);
    midLabel.set(m);
    hA.set(a);
    hB.set(b);
    hM.set(m);

    for (let i = 0; i < past.length; i++) {
      const item = state.trail[i];
      past[i].show(Boolean(item));
      if (!item) continue;
      past[i].set(toScreen(item.p1), toScreen(item.p2));
      past[i].node.setAttribute("class", "past " + (item.long ? "long" : "short"));
    }

    const graph = Core.cdf(state);
    cdfPath.style.display = state.total ? "" : "none";
    if (state.total) {
      let path = "";
      for (let i = 0; i < graph.values.length; i++) {
        const x = CHART.x0 + (i / (Core.BINS - 1)) * chartW;
        const y = CHART.bottom - graph.values[i] * chartH;
        path += (i ? " L " : "M ") + x.toFixed(2) + " " + y.toFixed(2);
      }
      cdfPath.setAttribute("d", path);
    }

    const info = Core.modeInfo(state.mode);
    const estimate = Core.estimate(state);
    const share = estimate === null ? "no chords yet" : `${(estimate * 100).toFixed(0)}%`;
    say(`${info.label}: ${state.total} ${state.total === 1 ? "chord" : "chords"}, ${state.favorable} longer than √3 (${share}). ` +
      `The page says ${info.text}. This chord is ${fmt(chord.length)} — ${long ? "longer" : "shorter"}.`, null);

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function selectMode(mode) {
    state = Core.withMode(state, mode);
    for (const btn of modeButtons) {
      btn.setAttribute("aria-pressed", String(Number(btn.dataset.mode) === state.mode));
    }
    render();
  }

  function drawOne() {
    state = Core.draw(state);
    render();
  }

  function drawBatch() {
    state = Core.runBatch(state, 100);
    render();
  }

  function reset() {
    state = Core.start({ mode: state.mode });
    render();
    hA.node.focus();
  }

  function toggleAuto() {
    if (autoTimer === null) {
      autoTimer = setInterval(drawOne, 100); // the applet's auto thread sleeps 100ms
    } else {
      clearInterval(autoTimer);
      autoTimer = null;
    }
    autoBtn.setAttribute("aria-pressed", String(autoTimer !== null));
    autoBtn.textContent = autoTimer === null ? "Auto" : "Stop auto";
    autoBtn.setAttribute("aria-label", autoTimer === null
      ? "Start drawing one chord every tenth of a second"
      : "Stop drawing chords automatically");
  }

  for (const btn of modeButtons) {
    btn.addEventListener("click", () => selectMode(Number(btn.dataset.mode)));
  }
  drawBtn.addEventListener("click", drawOne);
  batchBtn.addEventListener("click", drawBatch);
  autoBtn.addEventListener("click", toggleAuto);
  resetBtn.addEventListener("click", reset);
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key >= "1" && e.key <= "4") selectMode(Number(e.key) - 1);
    else if (e.key === "d" || e.key === "D") drawOne();
    else if (e.key === "b" || e.key === "B") drawBatch();
    else if (e.key === "r" || e.key === "R") reset();
    else if (e.key === "a" || e.key === "A") toggleAuto();
  });

  board.onTheme(render);
  render();
})();
