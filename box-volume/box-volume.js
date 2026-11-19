"use strict";

/*
 * Browser view of Box Volume. All the mathematics and the option limits are in
 * box-volume-core.js; this file only draws and takes input.
 *
 * The play area has two pictures of the same sheet. On the left is the flat
 * card: a rectangle with a square marked at each corner (the pieces we cut
 * away) and the base in the middle. On the right is the graph of the volume
 * against the cut length: a hump that starts at zero, peaks, and comes back to
 * zero at the largest possible cut. The coloured dot is the current cut; the
 * small green dot is the best one.
 */

(function () {
  const Core = BoxVolumeCore;
  const canvas = document.getElementById("boxCanvas");
  const ctx = canvas.getContext("2d");
  const boxEl = document.getElementById("canvasBox");
  const aInput = document.getElementById("aInput");
  const bInput = document.getElementById("bInput");
  const xInput = document.getElementById("xInput");
  const aOut = document.getElementById("aOut");
  const bOut = document.getElementById("bOut");
  const xOut = document.getElementById("xOut");
  const findBtn = document.getElementById("findBtn");
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
      good: get("--good"),
      highlight: get("--highlight"),
      border: get("--border"),
    };
  }

  /** Shows a line under the picture. "done" marks the demo as explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function statusText() {
    const e = Core.evaluate(state);
    const base = `${Core.format(e.baseA, 1)} by ${Core.format(e.baseB, 1)}`;
    if (state.found) {
      return `The best cut is ${Core.format(e.bestX, 2)}. That leaves a ${base} base and makes a box of ` +
        `${Core.format(e.bestVolume, 2)} cubic units — the biggest box this sheet can make.`;
    }
    return `The sheet is ${Core.format(e.a, 1)} by ${Core.format(e.b, 1)}. A cut of ${Core.format(e.x, 2)} ` +
      `leaves a ${base} base, so the box holds ${Core.format(e.volume, 2)} cubic units. ` +
      `Slide the cut to see the volume change.`;
  }

  /* ---------------------------------------------------------------- drawing */

  function drawSheet(panelX, panelY, w, h, e) {
    const pad = 30;
    const scale = Math.min((w - 2 * pad) / e.a, (h - 2 * pad) / e.b);
    const rw = e.a * scale;
    const rh = e.b * scale;
    const x0 = panelX + (w - rw) / 2;
    const y0 = panelY + (h - rh) / 2;
    const cut = e.x * scale;

    ctx.fillStyle = tokens.boardA;
    ctx.fillRect(x0, y0, rw, rh);
    ctx.strokeStyle = tokens.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, y0, rw, rh);

    // The base that survives the cuts.
    ctx.fillStyle = tokens.soft;
    ctx.fillRect(x0 + cut, y0 + cut, rw - 2 * cut, rh - 2 * cut);
    ctx.strokeStyle = tokens.accent;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0 + cut, y0 + cut, rw - 2 * cut, rh - 2 * cut);

    // The four equal squares that are cut away.
    ctx.fillStyle = tokens.highlight;
    ctx.strokeStyle = tokens.muted;
    ctx.lineWidth = 1;
    const corners = [
      [x0, y0], [x0 + rw - cut, y0], [x0, y0 + rh - cut], [x0 + rw - cut, y0 + rh - cut],
    ];
    for (const [sx, sy] of corners) {
      ctx.fillRect(sx, sy, cut, cut);
      ctx.strokeRect(sx, sy, cut, cut);
    }

    ctx.fillStyle = tokens.muted;
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`a = ${Core.format(e.a, 1)}`, x0 + rw / 2, y0 + rh + 20);
    ctx.fillText(`x = ${Core.format(e.x, 2)}`, x0 + rw / 2, y0 - 8);
    ctx.save();
    ctx.translate(panelX + 12, y0 + rh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`b = ${Core.format(e.b, 1)}`, 0, 0);
    ctx.restore();
  }

  function drawGraph(panelX, panelY, w, h, e) {
    const left = panelX + 44;
    const right = panelX + w - 14;
    const top = panelY + 20;
    const bottom = panelY + h - 32;
    const pw = right - left;
    const ph = bottom - top;
    if (pw <= 10 || ph <= 10) return;

    const xmax = Math.max(e.domainMax, 1e-6);
    const ymax = Math.max(e.bestVolume * 1.18, 1e-6);
    const px = (x) => left + (x / xmax) * pw;
    const py = (v) => bottom - Math.max(0, v) / ymax * ph;

    ctx.fillStyle = tokens.stage;
    ctx.fillRect(panelX, panelY, w, h);
    ctx.strokeStyle = tokens.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, bottom);
    ctx.lineTo(right, bottom);
    ctx.stroke();

    ctx.strokeStyle = tokens.accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= 160; i++) {
      const x = (xmax * i) / 160;
      const sx = px(x);
      const sy = py(Core.volume(x, e.a, e.b));
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // The best cut: a small green dot with a dashed guide.
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = tokens.good;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px(e.bestX), bottom);
    ctx.lineTo(px(e.bestX), py(e.bestVolume));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = tokens.good;
    ctx.beginPath();
    ctx.arc(px(e.bestX), py(e.bestVolume), 4, 0, 2 * Math.PI);
    ctx.fill();

    // The player's cut.
    const cx = px(e.x);
    const cy = py(e.volume);
    ctx.fillStyle = tokens.highlight;
    ctx.strokeStyle = tokens.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = tokens.muted;
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("0", left, bottom + 16);
    ctx.fillText(Core.format(e.domainMax, 1), right, bottom + 16);
    ctx.fillText("cut length x", (left + right) / 2, bottom + 30);
    ctx.save();
    ctx.translate(panelX + 13, (top + bottom) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("volume v", 0, 0);
    ctx.restore();
    ctx.textAlign = "left";
    ctx.fillStyle = tokens.good;
    ctx.fillText("best", px(e.bestX) + 7, py(e.bestVolume) - 6);
  }

  function draw() {
    const cssWidth = Math.max(260, Math.min(660, Math.floor(boxEl.getBoundingClientRect().width)));
    const twoCol = cssWidth >= 540;
    const panelW = twoCol ? (cssWidth - 16) / 2 : cssWidth;
    const panelH = twoCol ? 290 : 225;
    const cssHeight = twoCol ? panelH : panelH * 2 + 22;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.height = `${cssHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = tokens.stage;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    const e = Core.evaluate(state);
    if (twoCol) {
      drawSheet(0, 0, panelW, panelH, e);
      drawGraph(panelW + 16, 0, panelW, panelH, e);
    } else {
      drawSheet(0, 0, panelW, panelH, e);
      drawGraph(0, panelH + 22, panelW, panelH, e);
    }
  }

  /* -------------------------------------------------------------- behaviour */

  function render() {
    aInput.value = String(state.a);
    bInput.value = String(state.b);
    xInput.value = String(state.x);
    xInput.max = String(Math.min(Core.MAX_CUT, Core.domainMax(state.a, state.b)));
    aOut.textContent = Core.format(state.a, 1);
    bOut.textContent = Core.format(state.b, 1);
    xOut.textContent = Core.format(state.x, 2);
    say(statusText(), state.found ? "done" : null);
    draw();

    if (window.Track) window.Track.state({ a: state.a, b: state.b, x: state.x, found: state.found });
  }

  function change(fn) {
    state = fn(state);
    render();
  }

  aInput.addEventListener("input", () => change((s) => Core.setA(s, Number(aInput.value))));
  bInput.addEventListener("input", () => change((s) => Core.setB(s, Number(bInput.value))));
  xInput.addEventListener("input", () => change((s) => Core.setX(s, Number(xInput.value))));
  findBtn.addEventListener("click", () => change((s) => Core.findBest(s)));
  resetBtn.addEventListener("click", () => {
    state = Core.start({});
    render();
  });

  // The canvas is focusable: arrows nudge the cut, Up/Down the two sides.
  canvas.addEventListener("keydown", (event) => {
    let next = null;
    switch (event.key) {
      case "ArrowLeft": next = (s) => Core.setX(s, s.x - Core.CUT_STEP); break;
      case "ArrowRight": next = (s) => Core.setX(s, s.x + Core.CUT_STEP); break;
      case "ArrowDown": next = (s) => (event.shiftKey ? Core.setA(s, s.a - Core.SIDE_STEP) : Core.setB(s, s.b - Core.SIDE_STEP)); break;
      case "ArrowUp": next = (s) => (event.shiftKey ? Core.setA(s, s.a + Core.SIDE_STEP) : Core.setB(s, s.b + Core.SIDE_STEP)); break;
      case "Home": next = (s) => Core.setX(s, 0); break;
      case "End": next = (s) => Core.setX(s, Core.domainMax(s.a, s.b)); break;
      default: return;
    }
    event.preventDefault();
    if (next) change(next);
  });

  window.addEventListener("themechange", () => {
    refreshTokens();
    draw();
  });
  window.addEventListener("resize", draw);

  refreshTokens();
  state = Core.start({});
  render();
})();
