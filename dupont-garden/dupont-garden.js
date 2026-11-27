"use strict";

/*
 * The page for Dupont Garden: drawing and input only. DupontGardenCore holds
 * the physics, the six jet schedules and the drop positions. The SVG uses the
 * applet's 600 by 300 canvas as its viewBox (with a little margin below for
 * the ground). The two handles are reading probes on the visible flight path;
 * they never change the water. The Run/Stop button, #Drops and Delay follow
 * the applet's controls and ranges.
 */

(function () {
  const Core = DupontGardenCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const runBtn = document.getElementById("runBtn");
  const replayBtn = document.getElementById("replayBtn");
  const dropsInput = document.getElementById("dropsInput");
  const delayInput = document.getElementById("delayInput");
  const scheduleSel = document.getElementById("scheduleSel");
  const minusDrops = document.getElementById("minusDrops");
  const plusDrops = document.getElementById("plusDrops");
  const minusDelay = document.getElementById("minusDelay");
  const plusDelay = document.getElementById("plusDelay");
  const aLeft = document.getElementById("aLeft");
  const aRight = document.getElementById("aRight");
  const bLeft = document.getElementById("bLeft");
  const bRight = document.getElementById("bRight");

  let state = Core.start({ schedule: "auto" });
  let announced = false;
  let restartTimer = null;
  let clock = null;

  /* Paint order: background, flight paths, water drops, guides, labels, probes. */
  const backdrop = board.layer("backdrop");
  const paths = board.layer("paths");
  const water = board.layer("water");
  const guides = board.layer("guides");
  const labels = board.layer("labels");
  const tops = board.layer("handles");

  const ground = board.segment({ x: 0, y: Core.HEIGHT }, { x: Core.WIDTH, y: Core.HEIGHT }, "ground", backdrop);
  const axis = board.segment({ x: 0, y: 0 }, { x: 0, y: Core.HEIGHT }, "axis", backdrop);
  const verticalA = board.segment({ x: 0, y: 0 }, { x: 0, y: Core.HEIGHT }, "component", guides);
  const horizontalA = board.segment({ x: 0, y: 0 }, { x: 0, y: Core.HEIGHT }, "component", guides);
  const verticalB = board.segment({ x: 0, y: 0 }, { x: 0, y: Core.HEIGHT }, "component", guides);
  const horizontalB = board.segment({ x: 0, y: 0 }, { x: 0, y: Core.HEIGHT }, "component", guides);
  const tagA = board.label({ x: 0, y: 0 }, "A", "probe-label", 8, -8, labels);
  const tagB = board.label({ x: 0, y: 0 }, "B", "probe-label", 8, -8, labels);
  const reading = board.label({ x: 0, y: 0 }, "", "flight-note", 10, 18, labels);

  let flightNodes = [];
  let dropNodes = [];

  function describe(p) {
    return `across ${Math.round(p.x)}, up ${Math.round(Core.HEIGHT - p.y)} on the picture`;
  }
  const clampProbe = (q, name) => {
    const jet = Core.activeStream(state);
    const x = Core.setProbe(state, name, q.x).probe[name === "B" ? "B" : "A"];
    return Core.pointOnFlight(jet, x);
  };
  const probeA = board.handle("A", { x: 0, y: 0 }, {
    r: 12, step: 6, cls: "geom-handle probe-handle", layer: tops,
    label: "Probe A. Drag along a flight path, or focus it and use the arrow keys to read the height.",
    describe: describe, clamp: clampProbe,
    onMove: (p, name) => { state = Core.setProbe(state, name, p.x); render(); },
  });
  const probeB = board.handle("B", { x: 0, y: 0 }, {
    r: 12, step: 6, cls: "geom-handle probe-handle", layer: tops,
    label: "Probe B. Drag along a flight path, or focus it and use the arrow keys to read the height.",
    describe: describe, clamp: clampProbe,
    onMove: (p, name) => { state = Core.setProbe(state, name, p.x); render(); },
  });

  /** Build the faint flight curves and enough drop circles for this schedule. */
  function rebuild() {
    board.clear(paths);
    board.clear(water);
    flightNodes = state.streams.map((jet) => {
      const d = Core.flightPoints(jet, 48)
        .map((p, i) => (i ? "L" : "M") + " " + p.x.toFixed(2) + " " + p.y.toFixed(2)).join(" ");
      return board.el("path", { d: d }, "flight", paths);
    });
    const needed = state.streams.reduce((sum, jet) => sum + jet.n, 0);
    dropNodes = [];
    for (let i = 0; i < needed; i++) {
      const dot = board.point({ x: -20, y: -20 }, "drop", Core.RADIUS, water);
      dot.show(false);
      dropNodes.push(dot);
    }
  }

  /** The line under the game. Not a win or loss: this is an illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function message() {
    if (state.complete) return "Every jet has landed. Starting another round.";
    if (!state.running) return "Press Run to send the water up. Drag A or B along a curve to read its height.";
    if (state.streams[0].n !== state.drops) return `Set to ${state.drops} drops. Press Replay to use them.`;
    const jet = Core.activeStream(state);
    return `${state.streams.length} jets in this round; the active one climbs about ${Math.round(Core.maxHeight(jet))} units high.`;
  }

  function render() {
    ground.set({ x: 0, y: Core.HEIGHT }, { x: Core.WIDTH, y: Core.HEIGHT });
    axis.set({ x: 0, y: 0 }, { x: 0, y: Core.HEIGHT });
    const active = Core.activeStream(state);
    flightNodes.forEach((node, i) => {
      node.setAttribute("class", i === state.streams.indexOf(active) ? "flight active" : "flight");
    });

    let index = 0;
    for (const jet of state.streams) {
      if (Core.isFinished(jet) || jet.start >= state.tick) continue;
      for (const p of Core.dropsAt(jet)) {
        if (index >= dropNodes.length) break;
        dropNodes[index].set(p, Core.RADIUS).show(true);
        index++;
      }
    }
    for (; index < dropNodes.length; index++) dropNodes[index].show(false);

    const aAt = Core.pointOnFlight(active, state.probe.A);
    const bAt = Core.pointOnFlight(active, state.probe.B);
    verticalA.set({ x: aAt.x, y: aAt.y }, { x: aAt.x, y: Core.HEIGHT });
    horizontalA.set({ x: 0, y: aAt.y }, aAt);
    verticalB.set({ x: bAt.x, y: bAt.y }, { x: bAt.x, y: Core.HEIGHT });
    horizontalB.set({ x: 0, y: bAt.y }, bAt);
    probeA.set(aAt);
    probeB.set(bAt);
    tagA.set(aAt, "A");
    tagB.set(bAt, "B");
    reading.set({ x: 0, y: 0 }, `up ${Math.round(Core.HEIGHT - aAt.y)} at A \u00b7 ${Math.round(Core.HEIGHT - bAt.y)} at B`);

    runBtn.textContent = state.running ? "Stop" : "Run";
    runBtn.setAttribute("aria-label", state.running ? "Stop the jumping water" : "Run the jumping water");
    dropsInput.value = String(state.drops);
    delayInput.value = String(state.delay);
    if (scheduleSel.value !== state.schedule) scheduleSel.value = state.schedule;

    say(message(), state.complete && !announced ? "done" : null);
    if (state.complete && !announced) {
      announced = true; // one end-of-round note, like the applet's auto restart
      stopClock();
      restartTimer = setTimeout(() => {
        restartTimer = null;
        state = Core.reset(state);
        announced = false;
        rebuild();
        render();
        syncClock();
      }, 700);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function stopClock() {
    if (clock !== null) { clearInterval(clock); clock = null; }
  }
  function syncClock() {
    stopClock();
    if (state.running && !state.complete) {
      clock = setInterval(() => { state = Core.step(state); render(); }, state.delay);
    }
  }

  function restart() {
    if (restartTimer !== null) { clearTimeout(restartTimer); restartTimer = null; }
    announced = false;
    state = Core.reset(state);
    rebuild();
    render();
    syncClock();
  }

  runBtn.addEventListener("click", () => {
    if (state.running) state = Core.stop(state);
    else { state = Core.run(state); rebuild(); }
    render();
    syncClock();
  });
  replayBtn.addEventListener("click", restart);
  minusDrops.addEventListener("click", () => { state = Core.setDrops(state, state.drops - 1); render(); });
  plusDrops.addEventListener("click", () => { state = Core.setDrops(state, state.drops + 1); render(); });
  minusDelay.addEventListener("click", () => { state = Core.setDelay(state, state.delay - 10); rebuild(); render(); syncClock(); });
  plusDelay.addEventListener("click", () => { state = Core.setDelay(state, state.delay + 10); rebuild(); render(); syncClock(); });
  dropsInput.addEventListener("change", () => { state = Core.setDrops(state, dropsInput.value); render(); });
  delayInput.addEventListener("change", () => {
    state = Core.setDelay(state, delayInput.value);
    rebuild(); render(); syncClock();
  });
  scheduleSel.addEventListener("change", () => {
    if (restartTimer !== null) { clearTimeout(restartTimer); restartTimer = null; }
    announced = false;
    state = Core.setSchedule(state, scheduleSel.value);
    rebuild(); render(); syncClock();
  });
  const nudge = (name, delta) => {
    state = Core.setProbe(state, name, state.probe[name] + delta);
    render();
  };
  aLeft.addEventListener("click", () => nudge("A", -12));
  aRight.addEventListener("click", () => nudge("A", 12));
  bLeft.addEventListener("click", () => nudge("B", -12));
  bRight.addEventListener("click", () => nudge("B", 12));

  board.onTheme(render);
  rebuild();
  render();
})();
