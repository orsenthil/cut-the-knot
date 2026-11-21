"use strict";

/*
 * The page for Common Multiples: drawing and input only; the arithmetic lives
 * in common-multiples-core.js. The stage holds one canvas: a number line with
 * P's red multiples above it, Q's red multiples below it, blue common
 * multiples on the line, and two hollow dots that can be dragged (or moved
 * with the arrow keys) to change P and Q. Two number boxes offer the same
 * control without a pointer. Every change is reported in words in #status.
 */

(function () {
  const Core = CommonMultiplesCore;
  const board = document.getElementById("board");
  const ctx = board.getContext("2d");
  const statusEl = document.getElementById("status");
  const pInput = document.getElementById("pInput");
  const qInput = document.getElementById("qInput");
  const newBtn = document.getElementById("newBtn");

  const RED = "#d4565a"; // the applet's red dots: a fixed colour of their own
  const BLUE = "#4c9be0"; // and its blue dots on the line

  let state = Core.start({});
  let selected = "p";
  let drag = null;
  let frozenMax = null; // keeps the scale steady while a dot is dragged
  let W = 600;
  let H = 280;

  /** A line under the game. "done" is how the record learns a demo was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function colour(styles, name, fallback) {
    return styles.getPropertyValue(name).trim() || fallback;
  }

  /** Size the canvas in CSS pixels so its text stays readable on a phone. */
  function layout() {
    const rect = board.getBoundingClientRect();
    const cssW = Math.max(280, Math.round(rect.width));
    const cssH = Math.max(224, Math.min(300, Math.round(cssW * 0.52)));
    if (board.width !== cssW || board.height !== cssH) {
      board.width = cssW;
      board.height = cssH;
      board.style.height = cssH + "px";
    }
    W = board.width;
    H = board.height;
  }

  function currentMax() {
    return frozenMax === null ? Core.axisMax(state) : frozenMax;
  }

  function geometry() {
    const max = currentMax();
    const left = 44;
    const right = W - 12;
    const lineY = Math.round(H * 0.52);
    const row = Math.min(56, Math.round(H * 0.19));
    return {
      max, left, right, lineY,
      pY: lineY - row,
      qY: lineY + row,
      toX: (v) => left + (v / max) * (right - left),
      fromX: (x) => ((x - left) / (right - left)) * max,
    };
  }

  function line(x1, y1, x2, y2, colourValue, width) {
    ctx.strokeStyle = colourValue;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function dot(x, y, colourValue, radius) {
    ctx.fillStyle = colourValue;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
  }

  /** How many multiples to skip so their written numbers do not collide. */
  function labelEvery(n, max) {
    const gap = Math.abs((n / max) * (W - 56));
    return Math.max(1, Math.ceil(26 / Math.max(gap, 1)));
  }

  function row(n, y, above, g, ink, muted) {
    // A faint guide at the row's height, then a red dot for every multiple
    // except the first (the hollow handle sits there, as in the applet).
    ctx.save();
    ctx.globalAlpha = 0.3;
    line(g.left, y, g.right, y, muted, 1);
    ctx.restore();

    const nums = Core.multiples(n, g.max);
    const gap = labelEvery(n, g.max);
    nums.forEach((v, i) => {
      const x = g.toX(v);
      if (i > 0) dot(x, y, RED, 4);
      if (i % gap === 0) {
        ctx.fillStyle = muted;
        ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = above ? "bottom" : "top";
        ctx.fillText(String(v), x, y + (above ? -9 : 9));
      }
    });
  }

  function draw() {
    layout();
    const styles = getComputedStyle(document.documentElement);
    const stage = colour(styles, "--stage", "#f3f5f8");
    const ink = colour(styles, "--ink", "#1f2430");
    const muted = colour(styles, "--muted", "#5d6472");
    const accent = colour(styles, "--accent", "#5b4ee8");
    const highlight = colour(styles, "--highlight", "rgba(255,214,10,0.35)");
    const g = geometry();

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = stage;
    ctx.fillRect(0, 0, W, H);

    row(state.p, g.pY, true, g, ink, muted);
    row(state.q, g.qY, false, g, ink, muted);

    // The number line and its labelled ticks.
    line(g.left, g.lineY, g.right, g.lineY, ink, 2);
    const step = Core.tickStep(g.max);
    ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = muted;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let v = 0; v <= g.max; v += step) {
      const x = g.toX(v);
      line(x, g.lineY - 5, x, g.lineY + 5, ink, 1);
      ctx.fillText(String(v), x, g.lineY + 9);
    }

    // Blue dots on the line: the common multiples. The first gets its name.
    const blues = Core.commonMultiples(state.p, state.q, g.max);
    const blueGap = labelEvery(Core.lcm(state.p, state.q), g.max);
    blues.forEach((v, i) => {
      const x = g.toX(v);
      dot(x, g.lineY, BLUE, i === 0 ? 6 : 5);
      if (i === 0 || i % blueGap === 0) {
        ctx.fillStyle = BLUE;
        ctx.font = (i === 0 ? "600 13px " : "12px ") + "ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(i === 0 ? "lcm = " + v : String(v), x, g.lineY - 9);
      }
    });

    // A guide from each hollow dot down to its value on the line.
    [["p", g.pY], ["q", g.qY]].forEach(([which, y]) => {
      const x = g.toX(state[which]);
      ctx.save();
      ctx.globalAlpha = 0.45;
      line(x, y + 10, x, g.lineY - 7, accent, 1);
      ctx.restore();
    });

    // The two hollow, draggable dots, with a soft halo on the selected one.
    [["p", g.pY], ["q", g.qY]].forEach(([which, y]) => {
      const x = g.toX(state[which]);
      if (which === selected) {
        ctx.fillStyle = highlight;
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.fillStyle = stage;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    });

    // Row letters in the left margin.
    ctx.fillStyle = muted;
    ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("P", 20, g.pY);
    ctx.fillText("Q", 20, g.qY);
  }

  function render() {
    if (document.activeElement !== pInput) pInput.value = String(state.p);
    if (document.activeElement !== qInput) qInput.value = String(state.q);
    draw();
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function applySet(which, value) {
    const next = Core.move(state, { which, value });
    if (!next || next === state) return;
    state = next;
    selected = which;
    render();
    say(Core.describe("move", state), Core.result(state));
  }

  function newGame() {
    drag = null;
    frozenMax = null;
    selected = "p";
    state = Core.start({});
    render();
    say(Core.describe("reset", state), null);
  }

  /** Pointer coordinates in canvas pixels, mapped through the canvas size. */
  function point(event) {
    const rect = board.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (board.width / rect.width),
      y: (event.clientY - rect.top) * (board.height / rect.height),
    };
  }

  board.addEventListener("pointerdown", (event) => {
    const pt = point(event);
    const g = geometry();
    const dP = Math.hypot(pt.x - g.toX(state.p), pt.y - g.pY);
    const dQ = Math.hypot(pt.x - g.toX(state.q), pt.y - g.qY);
    if (Math.min(dP, dQ) > 20) return;
    event.preventDefault();
    drag = dP <= dQ ? "p" : "q";
    selected = drag;
    frozenMax = g.max;
    board.setPointerCapture(event.pointerId);
    say("Take hold of " + drag.toUpperCase() + " and slide it along the row.", null);
    render();
  });

  board.addEventListener("pointermove", (event) => {
    if (!drag) return;
    event.preventDefault();
    let g = geometry();
    let raw = g.fromX(point(event).x);
    // Zoom out if the dot is dragged past the current view.
    if (raw > g.max * 0.92 && g.max < 2000) {
      frozenMax = Math.min(5000, g.max * 2);
      g = geometry();
      raw = g.fromX(point(event).x);
    }
    applySet(drag, Core.clampValue(raw));
  });

  function endDrag() {
    if (!drag) return;
    drag = null;
    frozenMax = null;
    render();
  }
  board.addEventListener("pointerup", endDrag);
  board.addEventListener("pointercancel", endDrag);

  board.addEventListener("keydown", (event) => {
    let which = selected;
    if (event.key === "p" || event.key === "P") which = "p";
    else if (event.key === "q" || event.key === "Q") which = "q";
    if (event.key === "p" || event.key === "P" || event.key === "q" || event.key === "Q") {
      event.preventDefault();
      selected = which;
      say("Now moving " + which.toUpperCase() + ". Use the arrow keys to change it.", null);
      render();
      return;
    }
    let value = state[which];
    const amount = event.shiftKey ? 5 : 1;
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown": value -= amount; break;
      case "ArrowRight":
      case "ArrowUp": value += amount; break;
      case "Home": value = Core.MIN_VALUE; break;
      case "End": value = Core.MAX_VALUE; break;
      default: return;
    }
    event.preventDefault();
    selected = which;
    applySet(which, value);
  });

  function fromInput(input, which) {
    if (input.value === "") return;
    const value = Core.clampValue(Number(input.value));
    input.value = String(value);
    applySet(which, value);
  }

  pInput.addEventListener("input", () => fromInput(pInput, "p"));
  qInput.addEventListener("input", () => fromInput(qInput, "q"));
  pInput.addEventListener("blur", () => { pInput.value = String(state.p); });
  qInput.addEventListener("blur", () => { qInput.value = String(state.q); });

  newBtn.addEventListener("click", newGame);
  window.addEventListener("themechange", draw);
  if (window.ResizeObserver) new ResizeObserver(draw).observe(board);

  render();
  say(Core.describe("start", state), null);
})();
