"use strict";

/*
 * The page for Bad Limit: drawing and input only. All the geometry and the
 * invariant live in BadLimitCore (bad-limit-core.js); this file owns the
 * canvas, the break-point controls and the words in the status line.
 *
 * The play area is a canvas: a big square, the diamond of side midpoints
 * inside it, and the staircase that follows the diamond. Changing n redraws
 * the staircase without ever changing its length.
 */

(function () {
  const Core = BadLimitCore;
  const canvas = document.getElementById("picture");
  const ctx = canvas.getContext("2d");
  const canvasBox = document.getElementById("canvasBox");
  const statusEl = document.getElementById("status");
  const nRange = document.getElementById("nRange");
  const nValue = document.getElementById("nValue");
  const lessBtn = document.getElementById("lessBtn");
  const moreBtn = document.getElementById("moreBtn");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});
  let cssWidth = 0;
  let cssHeight = 0;
  let tokens = {};

  function refreshTokens() {
    const cs = getComputedStyle(document.documentElement);
    const token = (name) => cs.getPropertyValue(name).trim();
    tokens = {
      stage: token("--stage"),
      ink: token("--ink"),
      accent: token("--accent"),
      muted: token("--muted"),
      borderStrong: token("--border-strong"),
      boardA: token("--board-a"),
      boardB: token("--board-b"),
      highlight: token("--highlight"),
    };
  }

  /**
   * Shows a line under the game. `kind` is "win", "lose", "done" or nothing;
   * those three classes are also how the player's record learns that a play
   * has ended (assets/progress.js), so use them for that and nothing else.
   * This is a demo, so the only end is "done".
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function sizeCanvas() {
    const rect = canvasBox.getBoundingClientRect();
    cssWidth = Math.max(200, Math.round(rect.width));
    cssHeight = Math.max(150, Math.round(rect.height));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state = { n: state ? state.n : Core.DEFAULT_N, width: cssWidth, height: cssHeight };
  }

  function path(points, close) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    if (close) ctx.closePath();
  }

  function draw() {
    if (!state) return;
    ctx.fillStyle = tokens.stage;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    ctx.strokeStyle = tokens.borderStrong;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, cssWidth - 1, cssHeight - 1);

    // The two guide squares, drawn the same muted way as the applet's grey.
    ctx.lineJoin = "miter";
    ctx.lineWidth = 2;
    ctx.strokeStyle = tokens.boardB;
    path(Core.bigSquare(state), true);
    ctx.stroke();

    ctx.strokeStyle = tokens.muted;
    ctx.lineWidth = 2;
    path(Core.smallSquare(state), true);
    ctx.stroke();

    // The staircase. DrawPoly in the applet joins the last point back to the
    // first, so this is a closed polyline too.
    ctx.strokeStyle = tokens.accent;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    path(Core.brokenLine(state), true);
    ctx.stroke();

    // Mark the four break-point anchors, so the corners are easy to see.
    ctx.fillStyle = tokens.accent;
    for (const p of Core.smallSquare(state)) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Words that say what just changed, not just a new number on the slider. */
  function describeChange(previousN) {
    const n = state.n;
    let first;
    if (previousN === null) {
      first = `At ${n} break points on each side, the zigzag already looks almost like the small square.`;
    } else if (n > previousN) {
      first = `Break points went from ${previousN} to ${n}: the zigzag takes smaller steps and hugs the small square more closely.`;
    } else {
      first = `Break points went from ${previousN} to ${n}: the zigzag takes bigger steps and sits further from the small square.`;
    }
    return `${first} Its length has not changed — walking it still covers the big square's perimeter S, about 1.41 times the small square's perimeter s.`;
  }

  function render(previousN) {
    draw();
    nValue.textContent = String(state.n);
    nRange.value = String(state.n);
    lessBtn.disabled = state.n <= Core.MIN_N;
    moreBtn.disabled = state.n >= Core.MAX_N;

    say(describeChange(previousN === undefined ? null : previousN), "done");

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state({ n: state.n, width: state.width, height: state.height });
  }

  function setN(n) {
    const previous = state.n;
    const next = Core.withN(state, n);
    if (next.n === previous) return;
    state = next;
    render(previous);
  }

  function reset() {
    const previous = state.n;
    state = Core.withN(state, Core.DEFAULT_N);
    if (state.n !== previous) render(previous);
    else render(null);
  }

  nRange.addEventListener("input", () => setN(Number(nRange.value)));
  lessBtn.addEventListener("click", () => setN(state.n - 1));
  moreBtn.addEventListener("click", () => setN(state.n + 1));
  resetBtn.addEventListener("click", reset);

  // Keyboard play on the canvas: arrows step, Home/End jump to the extremes.
  // The canvas itself is never replaced, so focus stays on it after a move.
  canvas.addEventListener("keydown", (evt) => {
    let next = null;
    switch (evt.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = state.n + 1;
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = state.n - 1;
        break;
      case "Home":
        next = Core.MIN_N;
        break;
      case "End":
        next = Core.MAX_N;
        break;
      case "PageUp":
        next = state.n + 10;
        break;
      case "PageDown":
        next = state.n - 10;
        break;
      default:
        return;
    }
    evt.preventDefault();
    setN(next);
  });

  refreshTokens();
  window.addEventListener("themechange", () => {
    refreshTokens();
    draw();
  });
  window.addEventListener("resize", () => {
    sizeCanvas();
    draw();
  });

  sizeCanvas();
  render(null);
})();
