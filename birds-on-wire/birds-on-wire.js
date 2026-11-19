"use strict";

/*
 * Page script for Birds on a Wire: drawing and input only. The simulation
 * lives in birds-on-wire-core.js.
 *
 * The play area is one canvas. Its top half is the wire from the latest trial:
 * a tick for each bird and a highlighted bar over every marked gap. Its bottom
 * half is the applet's scatter plot of average marked length against bird
 * count. The options are three real range sliders and the two applet buttons
 * Go/Stop and Repeat.
 */

(function () {
  const Core = BirdsOnWireCore;
  const stageEl = document.getElementById("stage");
  const canvas = document.getElementById("wire");
  const statusEl = document.getElementById("status");
  const readoutEl = document.getElementById("readout");
  const goBtn = document.getElementById("goBtn");
  const repeatBtn = document.getElementById("repeatBtn");
  const trialsInput = document.getElementById("trials");
  const minInput = document.getElementById("minBirds");
  const maxInput = document.getElementById("maxBirds");
  const trialsOut = document.getElementById("trialsOut");
  const minOut = document.getElementById("minOut");
  const maxOut = document.getElementById("maxOut");
  const ctx = canvas.getContext("2d");

  let state = null;
  let running = false;
  let frame = 0;
  const COLORS = {};

  /** Shows a line under the game. The three kinds are also how the player's
   *  record learns that a play has ended, so use them only when that is true. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function tokens() {
    const cs = getComputedStyle(document.documentElement);
    const get = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
    COLORS.stage = get("--stage", "#f3f5f8");
    COLORS.ink = get("--ink", "#1f2430");
    COLORS.muted = get("--muted", "#5d6472");
    COLORS.accent = get("--accent", "#5b4ee8");
    COLORS.highlight = get("--highlight", "rgba(255, 214, 10, 0.35)");
    COLORS.border = get("--border", "#e4e7ec");
  }

  function size() {
    const w = Math.max(280, Math.round(canvas.getBoundingClientRect().width) || 600);
    const h = 250;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { W: w, H: h };
  }

  /* A decorative wire for the untouched page, before the first run. */
  function sampleBirds() {
    return [0.05, 0.16, 0.19, 0.34, 0.51, 0.54, 0.7, 0.86, 0.88].map((x) => ({
      x,
      marked: false,
    }));
  }

  function draw() {
    tokens();
    const { W, H } = size();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = COLORS.stage;
    ctx.fillRect(0, 0, W, H);

    const x0 = 26;
    const x1 = W - 16;
    const wireY = 40;
    const px = (t) => x0 + t * (x1 - x0);

    // The wire, with 0 and 1 at its ends, as in the applet.
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, wireY);
    ctx.lineTo(x1, wireY);
    ctx.stroke();
    ctx.fillStyle = COLORS.muted;
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("0", x0, wireY - 12);
    ctx.fillText("1", x1, wireY - 12);

    const birds = state && state.last
      ? state.last.positions.map((x, i) => ({ x, marked: state.last.marked[i] }))
      : sampleBirds();

    // Highlighted bars: the gaps claimed by at least one of their birds.
    ctx.fillStyle = COLORS.highlight;
    for (let i = 0; i < birds.length - 1; i++) {
      if (birds[i].marked) {
        const a = px(birds[i].x);
        ctx.fillRect(a, wireY - 9, Math.max(2, px(birds[i + 1].x) - a), 18);
      }
    }
    // Birds: a small filled circle and a tick on the wire.
    ctx.fillStyle = COLORS.ink;
    for (const b of birds) {
      ctx.beginPath();
      ctx.arc(px(b.x), wireY, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(px(b.x) - 0.75, wireY - 7, 1.5, 14);
    }

    // The distribution plot: one dot per bird count, height = average.
    const top = 88;
    const bottom = H - 30;
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, top);
    ctx.lineTo(x0, bottom);
    ctx.lineTo(x1, bottom);
    ctx.stroke();
    ctx.fillStyle = COLORS.muted;
    ctx.textAlign = "left";
    ctx.fillText("average marked length", x0, top - 9);
    ctx.textAlign = "right";
    ctx.fillText("number of birds", x1, H - 9);

    const pts = state ? Core.accumulation(state) : [];
    const lo = state ? state.min : Core.BIRDS_DEFAULT;
    const hi = state ? state.max : Core.BIRDS_DEFAULT;
    ctx.fillStyle = COLORS.accent;
    for (const p of pts) {
      const cx = x0 + ((p.x - lo) / Math.max(1, hi - lo)) * (x1 - x0);
      const cy = bottom - Math.max(0, Math.min(1, p.y)) * (bottom - top);
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (pts.length === 1) {
      ctx.fillStyle = COLORS.muted;
      ctx.textAlign = "center";
      ctx.fillText(String(lo), (x0 + x1) / 2, bottom + 15);
    } else if (pts.length > 1) {
      ctx.textAlign = "left";
      ctx.fillText(String(lo), x0, bottom + 15);
      ctx.textAlign = "right";
      ctx.fillText(String(hi), x1, bottom + 15);
    }
  }

  function updateReadout() {
    const total = state ? Core.totalAccumulation(state) : 0;
    const last = state && state.last ? state.last.length : 0;
    readoutEl.textContent =
      "# of birds: " + (state ? state.birds : Core.BIRDS_DEFAULT) +
      "   # trials: " + (state ? state.count : 0) +
      "   Latest Average: " + (total ? total.toFixed(6) : "—") +
      "   Last wire: " + (last ? (last * 100).toFixed(1) + "% covered" : "—");
  }

  function render() {
    draw();
    updateReadout();
    // The position, for the player's record and the tutor. Plain JSON, as is.
    if (window.Track) window.Track.state(state);
  }

  function syncButtons() {
    goBtn.textContent = running ? "Stop" : "Go";
    goBtn.setAttribute("aria-label", running ? "Stop the simulation" : "Run the simulation");
    repeatBtn.disabled = running || !state || state.runs === 0;
  }

  function finish(message) {
    running = false;
    cancelAnimationFrame(frame);
    syncButtons();
    render();
    say(message, "done");
  }

  function tick() {
    if (!running) return;
    for (let i = 0; i < 12 && !Core.isFinished(state); i++) Core.newTrial(state);
    if (Core.isFinished(state)) {
      const avg = Core.totalAccumulation(state);
      finish(
        "Run finished with " + state.min + " to " + state.max + " birds: " +
        "the marked gaps cover about " + (avg * 100).toFixed(1) + " percent of the wire on average."
      );
      return;
    }
    render();
    frame = requestAnimationFrame(tick);
  }

  function startLoop() {
    running = true;
    syncButtons();
    say("Running " + state.trials + " trials for each bird count from " + state.min + " to " + state.max + ".");
    frame = requestAnimationFrame(tick);
  }

  function go() {
    if (running) {
      running = false;
      cancelAnimationFrame(frame);
      syncButtons();
      say("Stopped after " + state.runs + " trials. Press Repeat to add more, or Go to start again.");
      return;
    }
    state = Core.create(state.trials, state.min, state.max);
    say("");
    startLoop();
  }

  function repeat() {
    if (!state || state.runs === 0) return;
    Core.addExtra(state, state.extra);
    say("");
    startLoop();
  }

  function oneTrial() {
    if (running) return;
    if (Core.isFinished(state)) state = Core.reset(state);
    const trial = Core.newTrial(state);
    if (!trial) return;
    const n = state.birds;
    say("One trial: " + n + " birds landed and their marked gaps cover " +
      (trial.length * 100).toFixed(1) + " percent of the wire.");
    render();
    syncButtons();
  }

  function optionChanged(which, input, out) {
    if (running) {
      running = false;
      cancelAnimationFrame(frame);
    }
    // The trials slider shows scrollbar units (0..110); the core, like the
    // applet's SetTrials, takes the real number of trials (units times ten).
    const raw = Number(input.value);
    state = Core.applyOption(state, which, which === "trials" ? raw * Core.TRIALS_STEP : raw);
    const label = which === "trials" ? state.trials + " trials" : String(which === "min" ? state.min : state.max);
    out.textContent = label;
    if (which !== "trials") {
      // The applet keeps Min <= Max by dragging the other slider along.
      minInput.value = String(state.min);
      maxInput.value = String(state.max);
      minOut.textContent = String(state.min);
      maxOut.textContent = String(state.max);
    }
    say("Set to " + state.trials + " trials and " + state.min + " to " + state.max +
      " birds. Press Go to run.");
    syncButtons();
    render();
  }

  goBtn.addEventListener("click", go);
  repeatBtn.addEventListener("click", repeat);
  trialsInput.addEventListener("input", () => optionChanged("trials", trialsInput, trialsOut));
  minInput.addEventListener("input", () => optionChanged("min", minInput, minOut));
  maxInput.addEventListener("input", () => optionChanged("max", maxInput, maxOut));
  canvas.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      oneTrial();
    }
  });
  window.addEventListener("themechange", draw);
  window.addEventListener("resize", draw);

  state = Core.create(
    Number(trialsInput.value) * Core.TRIALS_STEP,
    Number(minInput.value),
    Number(maxInput.value)
  );
  trialsOut.textContent = state.trials + " trials";
  minOut.textContent = String(state.min);
  maxOut.textContent = String(state.max);
  syncButtons();
  render();
  say("Press Go to drop random birds on the wire and watch the average settle.");
})();
