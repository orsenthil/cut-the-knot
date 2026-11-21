"use strict";

/*
 * The page for Cycloids: drawing and input only; the geometry is in
 * cycloids-core.js. One canvas (390 by 350, scaled by CSS) shows the ground line
 * or the fixed circle, the rolling disc and the trails of the marks fixed to it.
 * Click the picture, or press one of the "Add mark" buttons, to fix a mark to
 * the disc; Start rolls it (one step every 50 ms, as the applet) and Step moves
 * it one step by hand. The r / h / e buttons choose a disc rolling along a line,
 * inside a circle or outside it.
 */

(function () {
  const Core = CycloidsCore;
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const startBtn = document.getElementById("startBtn");
  const stepBtn = document.getElementById("stepBtn");
  const resetBtn = document.getElementById("resetBtn");
  const kindInputs = [...document.querySelectorAll('input[name="kind"]')];
  const speedLess = document.getElementById("speedLess");
  const speedMore = document.getElementById("speedMore");
  const speedOut = document.getElementById("speedOut");
  const ratioLess = document.getElementById("ratioLess");
  const ratioMore = document.getElementById("ratioMore");
  const ratioOut = document.getElementById("ratioOut");
  const radiusIn = document.getElementById("radiusIn");
  const curvesBox = document.getElementById("curvesBox");
  const formulaBox = document.getElementById("formulaBox");
  const markRim = document.getElementById("markRim");
  const markIn = document.getElementById("markIn");
  const markOut = document.getElementById("markOut");
  const W = Core.W, H = Core.H;
  const TRAIL = 720; // steps of trail drawn for a disc going round and round

  let state = Core.start();
  let running = false;
  let timer = null;
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const colour = (styles, name, fallback) => styles.getPropertyValue(name).trim() || fallback;
  const HUES = [0, 30, 55, 120, 160, 190, 220, 260, 290, 320];
  const markColour = (i) => `hsl(${HUES[i % HUES.length] + Math.floor(i / HUES.length) * 7}, 70%, 48%)`;

  function draw() {
    const styles = getComputedStyle(document.documentElement);
    const stage = colour(styles, "--stage", "#f3f5f8"), ink = colour(styles, "--ink", "#1f2430"), muted = colour(styles, "--muted", "#5d6472"), accent = colour(styles, "--accent", "#5b4ee8");
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = stage;
    ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = 2;
    ctx.strokeStyle = ink;
    if (state.kind === "regular") {
      ctx.beginPath(); ctx.moveTo(Core.MARGIN, H - Core.MARGIN); ctx.lineTo(W - Core.MARGIN, H - Core.MARGIN); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(W / 2, H / 2, Core.FIXED_RADIUS, 0, 2 * Math.PI); ctx.stroke();
    }
    // trails
    ctx.lineWidth = 1.6;
    state.marks.forEach((m, i) => {
      const from = Math.max(m.t0, state.time - TRAIL);
      ctx.strokeStyle = markColour(i);
      ctx.beginPath();
      for (let t = from; t <= state.time; t++) {
        const p = Core.markAt(state, m, t);
        if (t === from) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    });
    // the disc and the marks fixed to it
    const c = Core.centreAt(state, state.time);
    const r = Core.discRadius(state);
    if (!state.curvesOnly) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, 2 * Math.PI); ctx.stroke();
      ctx.fillStyle = muted;
      ctx.beginPath(); ctx.arc(c.x, c.y, 2.5, 0, 2 * Math.PI); ctx.fill();
    }
    state.marks.forEach((m, i) => {
      const p = Core.markAt(state, m, state.time);
      if (!state.curvesOnly) {
        ctx.strokeStyle = muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      }
      ctx.fillStyle = markColour(i);
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI); ctx.fill();
    });
  }

  function updateControls() {
    for (const k of kindInputs) { k.checked = k.value === state.kind; k.disabled = running; }
    speedOut.textContent = Core.speedText(state.speed);
    speedLess.disabled = running || state.speed <= Core.MIN_SPEED;
    speedMore.disabled = running || state.speed >= Core.MAX_SPEED;
    ratioOut.textContent = state.kind === "regular" ? "–" : String(state.ratio);
    ratioLess.disabled = running || state.kind === "regular" || state.ratio <= Core.minRatio(state.kind);
    ratioMore.disabled = running || state.kind === "regular" || state.ratio >= Core.MAX_RATIO;
    radiusIn.disabled = running || state.kind !== "regular";
    radiusIn.value = String(state.r);
    curvesBox.checked = state.curvesOnly;
    formulaBox.checked = state.formula;
    formulaBox.disabled = running;
    resetBtn.disabled = running;
    stepBtn.disabled = running;
    startBtn.textContent = running ? "Stop" : "Start";
    const full = state.marks.length >= Core.MAX_POINTS;
    for (const b of [markRim, markIn, markOut]) b.disabled = full;
  }

  function render() {
    draw();
    updateControls();
    if (window.Track) window.Track.state({ ...state, running });
  }

  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) return false;
    state = next;
    render();
    const kind = Core.result(state);
    say(kind ? `${state.marks.length} mark${state.marks.length === 1 ? " has" : "s have"} drawn a trail. Try a mark inside, on the rim and outside the disc and compare.` : note || "", kind);
    return true;
  }

  function offEdge() {
    return state.kind === "regular" && Core.centreAt(state, state.time).x > W - Core.MARGIN - Core.discRadius(state);
  }

  function tick() {
    if (offEdge()) { stop(); say("The disc reached the end of the line. Press Reset to roll again.", Core.result(state)); return; }
    apply({ type: "step" }, "");
  }

  function stop() {
    running = false;
    clearInterval(timer);
    timer = null;
    render();
  }

  function start() {
    if (offEdge()) { say("The disc is at the end of the line. Press Reset first."); return; }
    running = true;
    clearInterval(timer);
    timer = setInterval(tick, Core.TICK_MS);
    render();
    say("Rolling.");
  }

  startBtn.addEventListener("click", () => (running ? (stop(), say("Stopped.", Core.result(state))) : start()));
  stepBtn.addEventListener("click", () => { if (offEdge()) { say("The disc is at the end of the line. Press Reset first."); return; } apply({ type: "step", count: 5 }, "Five steps."); });
  resetBtn.addEventListener("click", () => { state = Core.move(state, { type: "reset" }); render(); say("Back to the start."); });
  for (const k of kindInputs) k.addEventListener("change", () => { if (k.checked) apply({ type: "kind", value: k.value }, { regular: "A disc rolling along a line.", hypo: "A disc rolling inside a circle.", epi: "A disc rolling outside a circle." }[k.value]); });
  speedLess.addEventListener("click", () => apply({ type: "speed", dir: -1 }, "Spin " + Core.speedText(state.speed - 1) + ": the disc's own spin against true rolling (1 is rolling without slipping)."));
  speedMore.addEventListener("click", () => apply({ type: "speed", dir: 1 }, "Spin " + Core.speedText(state.speed + 1) + "."));
  ratioLess.addEventListener("click", () => apply({ type: "ratio", dir: -1 }, "Fixed circle to rolling disc: " + (state.ratio - 1) + " to 1."));
  ratioMore.addEventListener("click", () => apply({ type: "ratio", dir: 1 }, "Fixed circle to rolling disc: " + (state.ratio + 1) + " to 1."));
  radiusIn.addEventListener("change", () => { if (!apply({ type: "radius", value: Math.trunc(Number(radiusIn.value)) }, "The disc's radius changed; the marks were cleared.")) say("The radius is a whole number from 5 to 60."); updateControls(); });
  curvesBox.addEventListener("change", () => apply({ type: "curves", value: curvesBox.checked }, curvesBox.checked ? "Only the curves are drawn." : "The disc is drawn too."));
  formulaBox.addEventListener("change", () => apply({ type: "formula", value: formulaBox.checked }, formulaBox.checked ? "Marks are placed by formula." : "Marks are rotated step by step."));

  /** A mark on the disc at the given distance (in disc radii) and a direction that changes with each mark. */
  function addAt(radii) {
    const c = Core.centreAt(state, state.time), r = Core.discRadius(state);
    const dir = (state.marks.length * 2.399963) % (2 * Math.PI); // golden angle: marks spread round the disc
    if (!apply({ type: "mark", x: c.x + radii * r * Math.cos(dir), y: c.y + radii * r * Math.sin(dir) }, `Mark ${state.marks.length + 1} added (${radii < 1 ? "inside the disc" : radii === 1 ? "on the rim" : "outside the disc"}).`)) say("No more marks can be added.");
  }
  markRim.addEventListener("click", () => addAt(1));
  markIn.addEventListener("click", () => addAt(0.5));
  markOut.addEventListener("click", () => addAt(1.6));
  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * W) / rect.width, y = ((e.clientY - rect.top) * H) / rect.height;
    if (!apply({ type: "mark", x, y }, `Mark ${state.marks.length + 1} added where you pressed.`)) say(state.marks.length >= Core.MAX_POINTS ? "No more marks can be added." : "Press away from the disc's centre to fix a mark to the disc.");
  });
  canvas.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); running ? (stop(), say("Stopped.", Core.result(state))) : start(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); if (!running) apply({ type: "step", count: 5 }, ""); }
  });
  window.addEventListener("themechange", render);
  document.addEventListener("visibilitychange", () => { if (document.hidden && running) { stop(); say("Stopped while the page was hidden."); } });

  render();
  if (reduced) say("Press Start, or Step, to roll the disc. Marks are added with the buttons or by pressing the picture.");
})();
