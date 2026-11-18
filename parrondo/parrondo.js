"use strict";

/*
 * Parrondo's Paradox page: sliders and a codes field set the applet's
 * parameters; Go runs the trials and draws average capital vs game number on
 * a canvas. Stop aborts a long run; Repeat adds another batch of trials.
 */

(function () {
  const Core = ParrondoCore;
  const canvas = document.getElementById("chart");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const legendEl = document.getElementById("legend");
  const codesInput = document.getElementById("codes");
  const goBtn = document.getElementById("goBtn");
  const repeatBtn = document.getElementById("repeatBtn");
  const resetBtn = document.getElementById("resetBtn");

  const SERIES_COLORS = [
    "var(--bad)",
    "var(--accent)",
    "var(--good)",
    "#d9910a",
    "#c45c26",
    "#2a9d8f",
    "#6c5ce7",
    "#e17055",
    "#636e72",
  ];

  const sliderIds = {
    epsilon: "epsilon",
    pA: "pA",
    pB1: "pB1",
    pB2: "pB2",
    games: "games",
    trials: "trials",
    modulus: "modulus",
  };

  let result = null;
  let running = false;
  let stopFlag = false;
  // Actual win probabilities used by the games. The applet sets these to
  // base − epsilon at start; later P / P1 / P2 scrolls overwrite with the
  // raw base, and the Epsilon scroll does not recompute them.
  let playPA = Core.DEFAULTS.pA;
  let playPB1 = Core.DEFAULTS.pB1;
  let playPB2 = Core.DEFAULTS.pB2;

  function cssColor(name) {
    // Resolve CSS variables against the canvas element for strokeStyle.
    const probe = document.createElement("div");
    probe.style.color = name;
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function readOptions() {
    const scroll = Core.SCROLL;
    return Core.clampOptions({
      epsilon: scroll.epsilon.toValue(+document.getElementById("epsilon").value),
      pA: playPA,
      pB1: playPB1,
      pB2: playPB2,
      games: scroll.games.toValue(+document.getElementById("games").value),
      trials: scroll.trials.toValue(+document.getElementById("trials").value),
      modulus: scroll.modulus.toValue(+document.getElementById("modulus").value),
      codes: codesInput.value,
    });
  }

  function syncLabels() {
    const scroll = Core.SCROLL;
    document.getElementById("epsilonVal").textContent = String(scroll.epsilon.toValue(+document.getElementById("epsilon").value));
    document.getElementById("pAVal").textContent = String(scroll.pA.toValue(+document.getElementById("pA").value));
    document.getElementById("pB1Val").textContent = String(scroll.pB1.toValue(+document.getElementById("pB1").value));
    document.getElementById("pB2Val").textContent = String(scroll.pB2.toValue(+document.getElementById("pB2").value));
    document.getElementById("gamesVal").textContent = String(scroll.games.toValue(+document.getElementById("games").value));
    document.getElementById("trialsVal").textContent = String(scroll.trials.toValue(+document.getElementById("trials").value));
    document.getElementById("modulusVal").textContent = String(scroll.modulus.toValue(+document.getElementById("modulus").value));
  }

  function setDefaults() {
    const d = Core.DEFAULTS;
    const s = Core.SCROLL;
    document.getElementById("epsilon").value = s.epsilon.fromValue(d.epsilon);
    document.getElementById("pA").value = s.pA.fromValue(0.5);
    document.getElementById("pB1").value = s.pB1.fromValue(0.1);
    document.getElementById("pB2").value = s.pB2.fromValue(0.75);
    document.getElementById("games").value = s.games.fromValue(d.games);
    document.getElementById("trials").value = s.trials.fromValue(d.trials);
    document.getElementById("modulus").value = s.modulus.fromValue(d.modulus);
    playPA = d.pA;
    playPB1 = d.pB1;
    playPB2 = d.pB2;
    codesInput.value = d.codes;
    syncLabels();
  }

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ink = cssColor("var(--ink)");
    const muted = cssColor("var(--muted)");
    const border = cssColor("var(--border)");
    const stage = cssColor("var(--stage)");

    ctx.fillStyle = stage;
    ctx.fillRect(0, 0, w, h);

    const padL = 48 * dpr;
    const padR = 16 * dpr;
    const padT = 16 * dpr;
    const padB = 28 * dpr;
    const left = padL;
    const right = w - padR;
    const top = padT;
    const bottom = h - padB;

    ctx.strokeStyle = border;
    ctx.lineWidth = dpr;
    ctx.beginPath();
    ctx.moveTo(left, (top + bottom) / 2);
    ctx.lineTo(right, (top + bottom) / 2);
    ctx.moveTo(left, top);
    ctx.lineTo(left, bottom);
    ctx.stroke();

    if (!result || !result.series.length || result.games === 0) {
      ctx.fillStyle = muted;
      ctx.font = `${12 * dpr}px system-ui, sans-serif`;
      ctx.fillText("Press Go to run the trials.", left + 8 * dpr, (top + bottom) / 2 - 8 * dpr);
      return;
    }

    let maxAbs = 1;
    for (const s of result.series) {
      if (s.maxAbs > maxAbs) maxAbs = s.maxAbs;
    }
    // Match the applet's axis label: round(max) + 1 style headroom.
    const yMax = Math.max(1, Math.round(maxAbs) + 1);

    ctx.fillStyle = muted;
    ctx.font = `${11 * dpr}px system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(String(yMax), left - 6 * dpr, top + 10 * dpr);
    ctx.fillText(String(-yMax), left - 6 * dpr, bottom);
    ctx.fillText("0", left - 6 * dpr, (top + bottom) / 2 + 4 * dpr);
    ctx.textAlign = "left";
    ctx.fillText(`games →  (${result.trials} trials)`, left + 4 * dpr, h - 8 * dpr);

    const xOf = (i) => left + (i / Math.max(1, result.games - 1 || 1)) * (right - left);
    const yOf = (v) => (top + bottom) / 2 - (v / yMax) * ((bottom - top) / 2);

    result.series.forEach((series, idx) => {
      const color = cssColor(SERIES_COLORS[idx % SERIES_COLORS.length]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      series.averages.forEach((v, i) => {
        const x = xOf(i);
        const y = yOf(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    legendEl.replaceChildren();
    result.series.forEach((series, idx) => {
      const item = document.createElement("span");
      item.className = "legend-item";
      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = SERIES_COLORS[idx % SERIES_COLORS.length];
      item.appendChild(swatch);
      item.appendChild(document.createTextNode(
        `${series.name}: ${series.finalAverage.toFixed(2)}`,
      ));
      legendEl.appendChild(item);
    });
  }

  function trackState() {
    if (!window.Track) return;
    if (!result) {
      window.Track.state({ ready: false });
      return;
    }
    window.Track.state({
      ready: true,
      trials: result.trials,
      games: result.games,
      options: result.options,
      finals: result.finals,
    });
  }

  function render() {
    draw();
    trackState();
  }

  function setRunning(isRunning) {
    running = isRunning;
    goBtn.textContent = isRunning ? "Stop" : "Go";
    goBtn.setAttribute("aria-label", isRunning ? "Stop the run" : "Run the trials");
    repeatBtn.disabled = isRunning || !result;
    for (const id of Object.values(sliderIds)) document.getElementById(id).disabled = isRunning;
    codesInput.disabled = isRunning;
    resetBtn.disabled = isRunning;
  }

  /** Run trials in chunks so Stop can interrupt and the chart can refresh. */
  async function runFresh() {
    if (running) {
      stopFlag = true;
      return;
    }
    stopFlag = false;
    setRunning(true);
    say("Running…");
    const opts = readOptions();
    const chunk = Math.max(25, Math.min(100, Math.floor(opts.trials / 10) || 25));
    let doneTrials = 0;
    result = null;
    while (doneTrials < opts.trials && !stopFlag) {
      const n = Math.min(chunk, opts.trials - doneTrials);
      if (!result) {
        result = Core.simulate({ ...opts, trials: n });
      } else {
        result = Core.continueSimulate(result, n);
      }
      // Keep the player's chosen trial count in options; chunking only affects
      // how many paths were added in this slice.
      result = { ...result, options: { ...result.options, trials: opts.trials } };
      doneTrials = result.trials;
      say(`Running… ${doneTrials} / ${opts.trials} trials`);
      render();
      await new Promise((r) => requestAnimationFrame(r));
    }
    setRunning(false);
    if (stopFlag) {
      say(`Stopped after ${result ? result.trials : 0} trials.`);
    } else {
      const best = result.series.slice().sort((a, b) => b.finalAverage - a.finalAverage)[0];
      say(`Done. Best average capital: ${best.name} at ${best.finalAverage.toFixed(2)}.`, "done");
    }
    render();
  }

  async function runRepeat() {
    if (running || !result) return;
    stopFlag = false;
    setRunning(true);
    const extra = result.options.trials;
    const target = result.trials + extra;
    const chunk = Math.max(25, Math.min(100, Math.floor(extra / 10) || 25));
    say(`Repeating… ${result.trials} trials so far`);
    while (result.trials < target && !stopFlag) {
      const n = Math.min(chunk, target - result.trials);
      result = Core.continueSimulate(result, n);
      say(`Repeating… ${result.trials} trials`);
      render();
      await new Promise((r) => requestAnimationFrame(r));
    }
    setRunning(false);
    const best = result.series.slice().sort((a, b) => b.finalAverage - a.finalAverage)[0];
    say(`Done. Best average capital: ${best.name} at ${best.finalAverage.toFixed(2)}.`, "done");
    render();
  }

  function onParamChange(event) {
    const id = event.target && event.target.id;
    const scroll = Core.SCROLL;
    // Epsilon updates the label only (ParrondoPanel → SetEpsilon); P / P1 / P2
    // overwrite the live probabilities with the raw scroll value.
    if (id === "pA") playPA = scroll.pA.toValue(+event.target.value);
    if (id === "pB1") playPB1 = scroll.pB1.toValue(+event.target.value);
    if (id === "pB2") playPB2 = scroll.pB2.toValue(+event.target.value);
    syncLabels();
    result = null;
    repeatBtn.disabled = true;
    say("Parameters changed — press Go.");
    render();
  }

  goBtn.addEventListener("click", () => { runFresh(); });
  repeatBtn.addEventListener("click", () => { runRepeat(); });
  resetBtn.addEventListener("click", () => {
    setDefaults();
    result = null;
    repeatBtn.disabled = true;
    say("Reset to the applet defaults. Press Go.");
    render();
  });
  codesInput.addEventListener("change", onParamChange);
  for (const id of Object.values(sliderIds)) {
    document.getElementById(id).addEventListener("input", onParamChange);
  }

  window.addEventListener("themechange", render);
  window.addEventListener("resize", render);

  document.addEventListener("keydown", (event) => {
    if (event.target && (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA")) return;
    if (event.key === "Enter" || event.key === "g" || event.key === "G") {
      event.preventDefault();
      runFresh();
    } else if ((event.key === "r" || event.key === "R") && !running && result) {
      event.preventDefault();
      runRepeat();
    }
  });

  setDefaults();
  repeatBtn.disabled = true;
  say("Press Go to compare games A, B and your mixes.");
  render();
})();
