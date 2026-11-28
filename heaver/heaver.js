"use strict";

/*
 * The page for Heaver: drawing and input only. The geometry — the four kinds
 * of covering pieces, the five turning shapes, the 200-step rotation and the
 * opening slider — lives in heaver-core.js.
 *
 * The SVG keeps the applet's own 500 by 300 coordinates: the covering pieces
 * are drawn first, the turning shape over them (so it is seen only through the
 * opening), and a focusable handle on a guide circle lets a player scrub the
 * turning step with a pointer or the arrow keys. Pause, Step and the step
 * slider are additions to the Java panel, which always ran its animation.
 */

(function () {
  const Core = HeaverCore;
  const statusEl = document.getElementById("status");
  const playBtn = document.getElementById("playBtn");
  const stepBtn = document.getElementById("stepBtn");
  const resetBtn = document.getElementById("resetBtn");
  const gapRange = document.getElementById("gapRange");
  const speedRange = document.getElementById("speedRange");
  const opacityRange = document.getElementById("opacityRange");
  const frameRange = document.getElementById("frameRange");
  const gapOut = document.getElementById("gapOut");
  const speedOut = document.getElementById("speedOut");
  const opacityOut = document.getElementById("opacityOut");
  const frameOut = document.getElementById("frameOut");
  const occlusionRadios = [...document.querySelectorAll('input[name="occlusion"]')];
  const objectRadios = [...document.querySelectorAll('input[name="object"]')];

  const board = Geom.board(document.getElementById("board"));
  /* Paint order matters: the applet draws the turning shape first and the
     covers on top of it, so only the opening lets the green shape through. */
  const spinLayer = board.layer("spin");
  const coverLayer = board.layer("covers");
  const guideLayer = board.layer("guides");
  const handleLayer = board.layer("handles");
  const spinner = board.polygon([], "spinner", spinLayer);
  const covers = Array.from({ length: 6 }, () => board.polygon([], "cover", coverLayer));
  const orbit = board.circle({ x: 0, y: 0 }, 1, "orbit", guideLayer);
  const scrub = board.handle("Turning step", { x: 0, y: 0 }, {
    r: 8,
    step: 5,
    shift: 20,
    layer: handleLayer,
    label: "Turning step. Drag around the circle, or focus this handle and use the arrow keys to scrub the animation.",
  });
  const ORBIT = 0.38 * Core.HEIGHT;

  let state = Core.start();
  let playing = !window.matchMedia || !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let frameId = 0;
  let lastTime = 0;
  let owed = 0;

  /**
   * Shows a line under the board. `kind` is "win", "lose", "done" or nothing;
   * the shared record only reads those three classes. This is a demo: no
   * shape ever wins or loses, so no kind is ever set here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state, Core.WIDTH, Core.HEIGHT);
    covers.forEach((shape, i) => {
      shape.show(i < g.fixed.length);
      if (i < g.fixed.length) shape.set(g.fixed[i]);
    });
    spinner.set(g.spinning);
    orbit.set(g.center, ORBIT);
    const a = state.frame * Math.PI * 2 / Core.N;
    scrub.set({ x: g.center.x + ORBIT * Math.cos(a), y: g.center.y + ORBIT * Math.sin(a) });

    board.root.style.setProperty("--cover-opacity", String(state.opacity / 255));
    for (const radio of occlusionRadios) radio.checked = Number(radio.value) === state.fix;
    for (const radio of objectRadios) radio.checked = Number(radio.value) === state.rot;
    gapRange.value = String(state.gap);
    speedRange.value = String(state.speed);
    opacityRange.value = String(state.opacity);
    frameRange.value = String(state.frame);
    gapOut.textContent = String(Core.holeSize(state));
    speedOut.textContent = String(Math.max(1, state.speed));
    opacityOut.textContent = String(state.opacity);
    frameOut.textContent = String(state.frame);
    playBtn.textContent = playing ? "Pause" : "Play";
    playBtn.setAttribute("aria-label", playing ? "Pause the animation" : "Play the animation");

    say(Core.describe(state, Core.WIDTH, Core.HEIGHT));
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function stop() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    lastTime = 0;
    owed = 0;
  }

  function tick(now) {
    if (!playing) { frameId = 0; return; }
    if (!lastTime) lastTime = now;
    owed += now - lastTime;
    lastTime = now;
    const delay = Math.max(1, state.speed);
    const steps = Math.min(10, Math.floor(owed / delay));
    if (steps > 0) {
      owed -= steps * delay;
      for (let i = 0; i < steps; i++) state = Core.advance(state);
      render();
    }
    frameId = requestAnimationFrame(tick);
  }

  function start() {
    stop();
    if (!playing) return;
    frameId = requestAnimationFrame(tick);
  }

  function pause() {
    playing = false;
    stop();
    render();
  }

  for (const radio of occlusionRadios) {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      state = Core.option(state, "fix", Number(radio.value));
      render();
    });
  }
  for (const radio of objectRadios) {
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      state = Core.option(state, "rot", Number(radio.value));
      render();
    });
  }

  for (const [input, key] of [[gapRange, "gap"], [speedRange, "speed"],
    [opacityRange, "opacity"]]) {
    input.addEventListener("input", () => {
      state = Core.option(state, key, Number(input.value));
      start();
      render();
    });
  }
  frameRange.addEventListener("input", () => {
    const frame = Number(frameRange.value); // read before pause() re-renders
    pause();
    state = Core.option(state, "frame", frame);
    render();
  });

  scrub.onMove((point) => {
    pause();
    const g = Core.geometry(state, Core.WIDTH, Core.HEIGHT);
    state = Core.option(state, "frame", Core.frameFromPoint(point, g.center));
    render();
  });

  playBtn.addEventListener("click", () => {
    playing = !playing;
    if (playing) start(); else stop();
    render();
  });
  stepBtn.addEventListener("click", () => {
    pause();
    state = Core.advance(state);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.start();
    start();
    render();
  });

  board.onTheme(render);
  render();
  start();
})();
