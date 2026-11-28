"use strict";

/*
 * The page for Harmonic Mean: drawing, sliders and the race animation. All
 * the arithmetic (the harmonic mean, the leg times and the two teams) lives
 * in harmonic-mean-core.js.
 *
 * The upper panel is the applet's set of vertical leg sliders. In "T vs V"
 * their widths are the leg times, so a slow leg is wider; in "Dist vs V" all
 * legs are equally wide. Drag the selected bar's handle (or use its arrow
 * keys) to change that leg's speed; releasing snaps to a whole number just
 * as VSlider.SnapToNearest does. The lower panel plots distance against
 * time: the relay team's broken line and the twins' straight line end at the
 * same point. There is no winner - a run simply finishes.
 */

(function () {
  const Core = HarmonicMeanCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const raceBtn = document.getElementById("raceBtn");
  const resetBtn = document.getElementById("newBtn");
  const slowerBtn = document.getElementById("slowerBtn");
  const fasterBtn = document.getElementById("fasterBtn");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const vsTimeBtn = document.getElementById("vsTimeBtn");
  const vsDistBtn = document.getElementById("vsDistBtn");
  const legsInput = document.getElementById("legsInput");
  const legsDown = document.getElementById("legsDown");
  const legsUp = document.getElementById("legsUp");

  const X0 = 36, X1 = 408;          // speed bars
  const TOP = 30, BASE = 122;       // speed axis, y grows downwards
  const GX0 = 36, GX1 = 408;        // distance/time graph
  const GY0 = 164, GY1 = 252;
  const MAX_BARS = Core.MAX_N;
  const RACE_SECONDS = 3.2;

  let state = Core.start({ random: Math.random });
  let frameId = 0;
  let lastFrame = 0;

  /* Layers in paint order: guides, bars, graph, teams and the one handle. */
  const guides = board.layer("guides");
  const barsLayer = board.layer("bars");
  const graph = board.layer("graph");
  const teams = board.layer("teams");
  const tops = board.layer("handles");

  const fmt = (v) => {
    if (!Number.isFinite(v)) return "—";
    const r = Math.round(v * 100) / 100;
    return Number.isInteger(r) ? String(r) : r.toFixed(2);
  };
  const speedY = (v) => BASE - (v - state.min) / (state.max - state.min) * (BASE - TOP);
  const speedFromY = (y) => state.min + (BASE - Geom.clamp(y, TOP, BASE)) / (BASE - TOP) * (state.max - state.min);

  for (const v of [state.max, Math.round((state.max + state.min) / 2), state.min]) {
    const y = speedY(v);
    board.segment({ x: X0, y: y }, { x: X1, y: y }, "guide", guides);
    board.label({ x: X0 - 7, y: y + 4 }, String(v), "axis-label", 0, 0, guides);
  }
  board.segment({ x: X0, y: BASE }, { x: X1, y: BASE }, "axis", guides);
  board.segment({ x: GX0, y: GY1 }, { x: GX1, y: GY1 }, "axis", graph);
  board.segment({ x: GX0, y: GY0 }, { x: GX0, y: GY1 }, "axis", graph);
  board.label({ x: GX1 + 2, y: GY1 + 5 }, "T", "axis-label", 0, 0, graph);
  board.label({ x: GX0 - 4, y: GY0 - 7 }, "Dist", "axis-label", 0, 0, graph);
  const graphLabel = board.label({ x: GX0 + 4, y: GY0 + 10 }, "", "graph-label", 0, 0, graph);

  const barNodes = [];
  const barLabels = [];
  for (let i = 0; i < MAX_BARS; i++) {
    const rect = board.el("rect", { x: 0, y: 0, width: 0, height: 0 }, "speed-bar", barsLayer);
    barNodes.push(rect);
    barLabels.push(board.label({ x: 0, y: 0 }, "", "bar-label", 0, 0, barsLayer));
  }
  const outline = board.el("rect", { x: 0, y: 0, width: 0, height: 0 }, "selected-bar", barsLayer);
  const relay = board.el("polyline", { points: "" }, "relay-line", graph);
  const twinLine = board.segment({ x: GX0, y: GY1 }, { x: GX0, y: GY1 }, "twin-line", graph);
  const bugDot = board.point({ x: GX0, y: GY1 }, "bug-dot", 6, teams);
  const twinDot = board.point({ x: GX0, y: GY1 }, "twin-dot", 6, teams);
  const bugLabel = board.label({ x: GX0, y: GY1 }, "relay", "team-label", 0, 0, teams);
  const twinLabel = board.label({ x: GX0, y: GY1 }, "twins", "team-label", 0, 0, teams);

  /**
   * The line under the game. "done" marks a finished run for the player's
   * record; an illustration has no win or loss.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const handle = board.handle("speed", { x: X0, y: BASE }, {
    r: 11, step: 10, shift: 30, layer: tops,
    cls: "geom-handle speed-handle",
    label: "Selected leg's speed. Drag up or down, or use the up and down arrow keys",
    describe: (p) => `Speed ${fmt(speedFromY(p.y))} of ${state.max}.`,
    clamp: (q) => ({ x: handle.point.x, y: Geom.clamp(q.y, TOP, BASE) }),
    onMove: (p) => {
      const k = state.selected;
      const v = speedFromY(p.y);
      state = Core.setSpeed(state, k, v, false);
      render();
    },
  });

  function drawBars(widths, e) {
    let x = X0;
    for (let i = 0; i < MAX_BARS; i++) {
      const node = barNodes[i];
      const text = barLabels[i];
      if (i >= state.speeds.length) {
        node.setAttribute("width", 0);
        text.show(false);
        continue;
      }
      const v = state.speeds[i];
      const w = Math.max(1, (X1 - X0) * widths[i]);
      const y = speedY(v);
      node.setAttribute("x", x);
      node.setAttribute("y", y);
      node.setAttribute("width", w);
      node.setAttribute("height", Math.max(1, BASE - y));
      node.setAttribute("class", "speed-bar speed-s" + Core.snap(v, state.min, state.max));
      const centre = x + w / 2;
      text.set({ x: centre, y: Math.max(TOP - 9, y - 6) }, String(fmt(v)));
      text.show(state.n <= 20 || i % 2 === 0);
      if (i === state.selected) {
        outline.setAttribute("x", x);
        outline.setAttribute("y", y - 2);
        outline.setAttribute("width", w);
        outline.setAttribute("height", Math.max(2, BASE - y + 2));
      }
      x += w;
    }
    handle.set({ x: X0 + (X1 - X0) * (widths.reduce((sum, w, i) => sum + (i < state.selected ? w : 0), 0) +
                   widths[state.selected] / 2), y: speedY(state.speeds[state.selected]) });
  }

  function drawGraph(e) {
    const px = (t) => GX0 + (e.totalTime > 0 ? t / e.totalTime : 0) * (GX1 - GX0);
    const py = (d) => GY1 - (d / state.n) * (GY1 - GY0);
    const points = [[px(0), py(0)]];
    e.legTimes.forEach((t, i) => points.push([px(t), py(i + 1)]));
    points.push([px(e.totalTime), py(state.n)]);
    relay.setAttribute("points", points.map((p) => `${p[0]},${p[1]}`).join(" "));
    twinLine.set({ x: px(0), y: py(0) }, { x: px(e.totalTime), y: py(state.n) });
    graphLabel.set({ x: GX0 + 4, y: GY0 + 10 },
      `Leg ${state.selected + 1}: ${fmt(state.speeds[state.selected])} mph`);

    const racing = state.race.running || Core.result(state) === "done";
    bugDot.show(racing);
    twinDot.show(racing);
    bugLabel.show(racing);
    twinLabel.show(racing);
    if (racing) {
      const pos = Core.teamsAt(state, state.race.time);
      const bug = { x: px(state.race.time), y: py(pos.bug) };
      const twin = { x: px(state.race.time), y: py(pos.twin) };
      bugDot.set(bug);
      twinDot.set(twin);
      bugLabel.set(bug, "relay", -36, -10);
      twinLabel.set(twin, "twins", -36, 17);
    }
  }

  function render() {
    const e = Core.evaluate(state);
    const widths = Core.barWidths(state);
    drawBars(widths, e);
    drawGraph(e);

    const running = state.race.running;
    raceBtn.textContent = running ? "Stop race" : "Race!";
    raceBtn.setAttribute("aria-label", running ? "Stop the race" : "Start the race");
    const disabled = running ? "true" : "false";
    for (const el of [vsTimeBtn, vsDistBtn, legsInput, legsDown, legsUp, resetBtn]) {
      el.disabled = running;
    }
    legsInput.value = String(state.n);
    vsTimeBtn.setAttribute("aria-pressed", state.mode === "time" ? "true" : "false");
    vsDistBtn.setAttribute("aria-pressed", state.mode === "distance" ? "true" : "false");
    slowerBtn.disabled = state.speeds[state.selected] <= state.min;
    fasterBtn.disabled = state.speeds[state.selected] >= state.max;
    prevBtn.disabled = state.selected === 0;
    nextBtn.disabled = state.selected === state.n - 1;

    if (running) {
      say(`They are running: the relay is on leg ${Math.min(state.n, Core.teamsAt(state, state.race.time).leg + 1)} of ${state.n}.`);
    } else if (Core.result(state) === "done") {
      say(`Both teams finished together. Average speed equals ${fmt(e.mean)} mph.`, "done");
    } else {
      const hint = state.mode === "time"
        ? "Wider bars take more time."
        : "Every bar covers the same distance.";
      say(`Average speed equals ${fmt(e.mean)} mph. ${hint} Drag the highlighted bar, then press Race!`);
    }

    // The position, for the player's record and the tutor (board units).
    if (window.Track) window.Track.state(Core.position(state));
  }

  function stopFrame() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    lastFrame = 0;
  }

  function frame(now) {
    if (!state.race.running) { stopFrame(); return; }
    if (!lastFrame) lastFrame = now;
    const e = Core.evaluate(state);
    const dt = Math.min(0.1, (now - lastFrame) / 1000) * e.totalTime / RACE_SECONDS;
    lastFrame = now;
    state = Core.advance(state, dt);
    render();
    if (state.race.running) frameId = requestAnimationFrame(frame);
    else stopFrame();
  }

  function toggleRace() {
    if (state.race.running) {
      state = Core.stopRace(state);
      stopFrame();
      render();
      return;
    }
    state = Core.startRace(state); // a finished run simply starts again
    render();
    lastFrame = 0;
    frameId = requestAnimationFrame(frame);
  }

  function changeCount(n) {
    stopFrame();
    state = Core.setCount(state, n, Math.random);
    render();
  }

  function setMode(mode) {
    state = Core.setMode(state, mode);
    render();
  }

  function selectLeg(k) {
    state = Core.select(state, k);
    render();
    handle.node.focus();
  }

  raceBtn.addEventListener("click", toggleRace);
  resetBtn.addEventListener("click", () => changeCount(state.n));
  slowerBtn.addEventListener("click", () => {
    state = Core.setSpeed(state, state.selected, state.speeds[state.selected] - 1, true);
    render();
  });
  fasterBtn.addEventListener("click", () => {
    state = Core.setSpeed(state, state.selected, state.speeds[state.selected] + 1, true);
    render();
  });
  prevBtn.addEventListener("click", () => selectLeg(state.selected - 1));
  nextBtn.addEventListener("click", () => selectLeg(state.selected + 1));
  vsTimeBtn.addEventListener("click", () => setMode("time"));
  vsDistBtn.addEventListener("click", () => setMode("distance"));
  legsDown.addEventListener("click", () => changeCount(Number(legsInput.value) - 1));
  legsUp.addEventListener("click", () => changeCount(Number(legsInput.value) + 1));
  legsInput.addEventListener("change", () => changeCount(Number(legsInput.value)));

  /* Pressing a bar selects that leg; coordinates go through the viewBox. */
  barsLayer.addEventListener("pointerdown", (e) => {
    if (state.race.running) return;
    const p = board.toLocal(e.clientX, e.clientY);
    if (p.y < TOP - 12 || p.y > BASE + 4) return;
    const widths = Core.barWidths(state);
    let x = X0;
    for (let i = 0; i < state.speeds.length; i++) {
      const w = (X1 - X0) * widths[i];
      if (p.x >= x && p.x <= x + w) { selectLeg(i); return; }
      x += w;
    }
  });
  /* A released drag snaps to a whole-number speed, as the applet does. */
  board.root.addEventListener("pointerup", () => {
    const v = state.speeds[state.selected];
    if (!Number.isInteger(v)) {
      state = Core.setSpeed(state, state.selected, v, true);
      render();
    }
  });
  handle.node.addEventListener("keyup", () => {
    const v = state.speeds[state.selected];
    if (!Number.isInteger(v)) {
      state = Core.setSpeed(state, state.selected, v, true);
      render();
    }
  });
  board.onTheme(render);

  render();
})();
