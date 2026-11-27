"use strict";

/*
 * The page for Equichordal: drawing and input only; the geometry is in
 * equichordal-core.js. The 640x460 board is the applet's own canvas. A is at
 * t=0 and B at t=pi on the sine curve; dragging either one puts the other at
 * the far end of a chord of the applet's fixed length through the centre O.
 * The "Sine formula" checkbox draws the curve itself, as the applet's
 * checkbox does, and Clear restores the curve's two starting points.
 */

(function () {
  const C = EquichordalCore;
  const Geom = window.Geom;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const powerEl = document.getElementById("powerRange");
  const shiftEl = document.getElementById("shiftRange");
  const freqEl = document.getElementById("freqRange");
  const powerOut = document.getElementById("powerOut");
  const shiftOut = document.getElementById("shiftOut");
  const freqOut = document.getElementById("freqOut");
  const formulaChk = document.getElementById("formulaChk");
  const clearBtn = document.getElementById("clearBtn");

  const curveLayer = board.layer("curve");
  const traceLayer = board.layer("trace");
  const chordLayer = board.layer("chord");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const curve = board.polygon([], "eq-curve", curveLayer);
  const traceA = board.polygon([], "eq-trace", traceLayer);
  const traceB = board.polygon([], "eq-trace", traceLayer);
  const chord = board.segment({ x: 0, y: 0 }, { x: 1, y: 1 }, "eq-chord", chordLayer);
  const centre = board.point(C.CENTER, "eq-centre", C.MARK_RADIUS, chordLayer);
  const labelO = board.label({ x: C.CENTER.x, y: C.CENTER.y }, "O", "eq-label", -18, -10, labelLayer);
  const labelA = board.label({ x: 0, y: 0 }, "A", "eq-label", 10, -12, labelLayer);
  const labelB = board.label({ x: 0, y: 0 }, "B", "eq-label", -22, -12, labelLayer);

  const chosen = () => ({
    power: Number(powerEl.value),
    shift: Number(shiftEl.value),
    freq: Number(freqEl.value),
    standard: formulaChk.checked,
  });
  let state = C.start(chosen());
  let curveKey = "";
  let curvePoints = [];

  /**
   * The shared status line. `kind` is "win", "lose" or "done" and tells the
   * player's record that a play ended. This is a demonstration with no win
   * or loss, so it reports the chord and passes no kind.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const clampPoint = (q) => ({
    x: Geom.clamp(q.x, 0, C.WIDTH),
    y: Geom.clamp(q.y, 0, C.HEIGHT),
  });

  const aHandle = board.handle("A", state.A, {
    r: 19, step: 4, shift: 20, layer: handleLayer,
    cls: "geom-handle eq-handle-a",
    label: "Point A, one end of the chord. Drag it, or focus it and press the arrow keys; B follows to keep the chord the same length. Hold Shift for bigger steps.",
    clamp: clampPoint,
    onMove: (p) => { state = C.drag(state, "A", p); render(); },
  });
  const bHandle = board.handle("B", state.B, {
    r: 19, step: 4, shift: 20, layer: handleLayer,
    cls: "geom-handle eq-handle-b",
    label: "Point B, one end of the chord. Drag it, or focus it and press the arrow keys; A follows to keep the chord the same length. Hold Shift for bigger steps.",
    clamp: clampPoint,
    onMove: (p) => { state = C.drag(state, "B", p); render(); },
  });

  function render() {
    const g = C.geometry(state);
    const key = state.power + "/" + state.shift + "/" + state.freq;
    if (key !== curveKey) {
      curvePoints = C.standardPoints(state);
      curveKey = key;
    }
    curve.set(curvePoints);
    curve.show(state.standard);

    // The applet keeps every traced mouse position; the drawing shows the
    // latest 400 so a long drag cannot bloat the SVG.
    traceA.set(state.traceA.slice(-400));
    traceB.set(state.traceB.slice(-400));
    traceA.show(state.traceA.length > 2);
    traceB.show(state.traceB.length > 2);

    chord.set(g.A, g.B);
    centre.set(g.center, g.markRadius);
    labelO.set(g.center, "O");
    labelA.set(g.A, "A");
    labelB.set(g.B, "B");
    aHandle.set(g.A);
    bHandle.set(g.B);

    say("Chord AB " + g.chord.toFixed(1) + " board units; a dragged chord stays " +
      g.segLen.toFixed(0) + ". Shift " + Number(shiftEl.value).toFixed(1) +
      " reads " + state.shift.toFixed(2) + " after the applet's slider snapping. " +
      (state.standard ? "The sine curve is drawn." : "The sine curve is hidden."));

    // The position, in board units, for the player's record and the tutor.
    if (typeof Track !== "undefined" && Track.state) Track.state(C.position(state));
  }

  function readOptions() {
    powerOut.textContent = String(state.power);
    shiftOut.textContent = Number(shiftEl.value).toFixed(1);
    freqOut.textContent = String(state.freq);
  }

  [powerEl, shiftEl, freqEl].forEach((el) => {
    el.addEventListener("input", () => {
      state = C.withOptions(state, chosen());
      readOptions();
      render();
    });
  });
  formulaChk.addEventListener("change", () => {
    state = C.withOptions(state, { standard: formulaChk.checked });
    render();
  });
  clearBtn.addEventListener("click", () => {
    state = C.start(chosen());
    readOptions();
    render();
  });
  board.onTheme(() => render());

  readOptions();
  render();
})();
