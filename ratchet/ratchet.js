"use strict";

/*
 * The page for Ratchet Effect: drawing and input only. The motion is in
 * ratchet-core.js. One canvas shows the two staircases sliding down the
 * slope and the ball they pass between them; the radio buttons below pick
 * which staircases move and how fast, and Go/Stop runs the animation.
 */

(function () {
  const Core = RatchetCore;
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const goBtn = document.getElementById("goBtn");
  const readout = document.getElementById("readout");

  let state = null;
  let timer = null;
  let climbed = 0; // ball's net rise since the last reset, in steps
  let lastY = 0;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function drawStair(st, fill, stroke) {
    const pts = Core.polygon(st, state.width, state.height);
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }

  function render() {
    ctx.fillStyle = css("--surface");
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // The applet draws S first, then T over it.
    if (state.S.visible) drawStair(state.S, css("--accent-soft"), css("--accent"));
    if (state.T.visible) drawStair(state.T, css("--board-b"), css("--ink"));
    const b = Core.ball(state);
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, 2 * Math.PI);
    ctx.fillStyle = css("--bad");
    ctx.fill();
    ctx.strokeStyle = css("--ink");
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = css("--border-strong");
    ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);

    const sign = climbed > 0.05 ? "up " : climbed < -0.05 ? "down " : "";
    readout.textContent = `Frame ${state.frame}. The ball has gone ${sign}${Math.abs(climbed).toFixed(1)} steps` +
      (state.mode === "both" ? `, carried by the ${Core.holder(state) === "S" ? "flashing" : "plain"} staircase.` : ".");

    if (window.Track) window.Track.state({ mode: state.mode, frame: state.frame, climbedSteps: Math.round(climbed * 10) / 10 });
  }

  function step() {
    state = Core.tick(state);
    const y = Core.ball(state).y;
    const Dy = Core.stepVector().y;
    let dy = y - lastY;
    // Off the edge, the staircase jumps back a whole number of steps: take those out.
    if (Math.abs(dy) >= 120) dy -= Math.round(dy / Dy) * Dy;
    climbed -= dy / Dy;
    lastY = y;
    render();
  }

  function mode() {
    return document.querySelector('input[name="show"]:checked').value;
  }
  function delay() {
    return Core.DELAY[document.querySelector('input[name="speed"]:checked').value];
  }

  function stop() {
    if (timer !== null) clearInterval(timer);
    timer = null;
    goBtn.textContent = "Go";
    goBtn.setAttribute("aria-pressed", "false");
  }

  function go() {
    if (timer !== null) clearInterval(timer);
    timer = setInterval(step, delay());
    goBtn.textContent = "Stop";
    goBtn.setAttribute("aria-pressed", "true");
  }

  const WORDS = {
    both: "Both staircases slide down; the flashing one also climbs and drops back, passing the ball each time.",
    regular: "The plain staircase slides steadily down, and the ball rides down with it.",
    flashing: "The flashing staircase climbs a step, then drops back further: the ball goes down on the whole.",
  };

  /** The applet resets the picture whenever an option changes, but keeps running. */
  function reset() {
    state = Core.start({ mode: mode() });
    climbed = 0;
    lastY = Core.ball(state).y;
    say(WORDS[state.mode]);
    if (timer !== null) go(); // the speed may have changed
    render();
  }

  goBtn.addEventListener("click", () => (timer === null ? go() : stop()));
  document.querySelectorAll('input[name="show"], input[name="speed"]').forEach((el) =>
    el.addEventListener("change", reset));
  window.addEventListener("themechange", render);

  reset();
})();
