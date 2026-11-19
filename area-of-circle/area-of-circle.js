"use strict";

/*
 * Browser view of Area of a Circle. All the geometry and the option range are
 * in area-of-circle-core.js; this file only draws the picture and takes input.
 *
 * The play area holds two pictures of the same disk: on top the circle cut into
 * N equal slices, below those slices slid into a row, alternating up and down.
 * Changing N (the applet's only option) redraws both at once.
 */

(function () {
  const Core = AreaOfCircleCore;
  const canvas = document.getElementById("aocCanvas");
  const ctx = canvas.getContext("2d");
  const box = document.getElementById("canvasBox");
  const sectorsInput = document.getElementById("sectorsInput");
  const sectorsOut = document.getElementById("sectorsOut");
  const lessBtn = document.getElementById("lessBtn");
  const moreBtn = document.getElementById("moreBtn");
  const resetBtn = document.getElementById("resetBtn");
  const statusEl = document.getElementById("status");

  let state = null;
  let tokens = {};

  function refreshTokens() {
    const cs = getComputedStyle(document.documentElement);
    const get = (name) => cs.getPropertyValue(name).trim();
    tokens = {
      stage: get("--stage"),
      ink: get("--ink"),
      muted: get("--muted"),
      accent: get("--accent"),
      soft: get("--accent-soft"),
      boardA: get("--board-a"),
      boardB: get("--board-b"),
      highlight: get("--highlight"),
    };
  }

  /** Shows a line under the picture. "done" marks a demo as explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function draw() {
    const cssWidth = Math.max(220, Math.round(box.getBoundingClientRect().width));
    const radius = Math.max(22, Math.min(100, (cssWidth - 36) / 3.3));
    const g = Core.geometry(state, radius);

    const circleY = radius + 16;
    const stripTop = circleY + radius + 30;
    const cssHeight = Math.ceil(stripTop + g.height + 18);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.height = `${cssHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = tokens.stage;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    const cx = cssWidth / 2;

    // The circle, split into N equal slices.
    for (let i = 0; i < g.sectors; i++) {
      const a0 = (2 * Math.PI * i) / g.sectors - Math.PI / 2;
      const a1 = (2 * Math.PI * (i + 1)) / g.sectors - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, circleY);
      ctx.arc(cx, circleY, radius, a0, a1);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? tokens.soft : "rgba(0,0,0,0)";
      ctx.fill();
      ctx.strokeStyle = tokens.muted;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, circleY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = tokens.ink;
    ctx.lineWidth = 2;
    ctx.stroke();

    // The same slices, slid into a row. Each tip is one step along; odd slices
    // are turned over so they fit between their neighbours.
    const x0 = (cssWidth - (g.width + g.step)) / 2 + g.step;
    for (let i = 0; i < g.sectors; i++) {
      const t = Core.tip(i, g);
      const px = x0 + t.x;
      const py = stripTop + t.y;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.arc(px, py, radius, t.arcStart, t.arcEnd);
      ctx.closePath();
      ctx.fillStyle = t.up ? tokens.boardA : tokens.boardB;
      ctx.fill();
      ctx.strokeStyle = tokens.ink;
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Trace the curved edge in the accent colour: the two runs of arcs are
      // the two bases whose lengths add to exactly one circumference.
      ctx.beginPath();
      ctx.arc(px, py, radius, t.arcStart, t.arcEnd);
      ctx.strokeStyle = t.up ? tokens.accent : tokens.muted;
      ctx.lineWidth = 2.4;
      ctx.stroke();
    }

    // A short bracket under the row marks its base, the near-pi*r edge.
    const y = stripTop + g.height + 6;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + g.width, y);
    ctx.strokeStyle = tokens.highlight;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  function render() {
    sectorsInput.value = String(state.sectors);
    sectorsOut.value = String(state.sectors);
    lessBtn.disabled = state.sectors <= Core.MIN_SECTORS;
    moreBtn.disabled = state.sectors >= Core.MAX_SECTORS;

    const g = Core.geometry(state, 1);
    say(`${state.sectors} slices: the two wavy edges add to one full turn around the circle ` +
      `(2πr); the row is ${g.width.toFixed(2)}r wide and ${g.height.toFixed(2)}r tall, ` +
      `heading for πr by r.`, "done");
    draw();

    if (window.Track) window.Track.state({ sectors: state.sectors });
  }

  function setSectors(value) {
    const next = Core.setSectors(state, value);
    if (next.sectors === state.sectors) return;
    state = next;
    render();
  }

  sectorsInput.addEventListener("input", () => setSectors(Number(sectorsInput.value)));
  lessBtn.addEventListener("click", () => setSectors(state.sectors - 1));
  moreBtn.addEventListener("click", () => setSectors(state.sectors + 1));
  resetBtn.addEventListener("click", () => {
    state = Core.start({ sectors: Core.DEFAULT_SECTORS });
    render();
  });
  window.addEventListener("themechange", refreshTokens);
  window.addEventListener("resize", draw);

  refreshTokens();
  state = Core.start({ sectors: Number(sectorsInput.value) });
  render();
})();
