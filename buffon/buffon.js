"use strict";

/*
 * The page for Buffon's Needle: drawing and input only; the rules live in
 * buffon-core.js. The stage holds a canvas of the floor with two cracks and
 * the last throw, with the count written in its corner. Below it are the
 * applet's buttons (Start/Stop, Repeat) and its three settings, plus a small
 * drawing pad that builds a broken-line "noodle" of the same total length.
 */

(function () {
  const Core = BuffonCore;
  const statusEl = document.getElementById("status");
  const board = document.getElementById("board");
  const boardCtx = board.getContext("2d");
  const readout = document.getElementById("readout");
  const startBtn = document.getElementById("startBtn");
  const repeatBtn = document.getElementById("repeatBtn");
  const singleBtn = document.getElementById("singleBtn");
  const resetBtn = document.getElementById("resetBtn");
  const drawToggle = document.getElementById("drawToggle");
  const showPi = document.getElementById("showPi");
  const trialsInput = document.getElementById("trials");
  const trialsVal = document.getElementById("trialsVal");
  const skipInput = document.getElementById("skip");
  const skipVal = document.getElementById("skipVal");
  const drawPanel = document.getElementById("drawPanel");
  const pad = document.getElementById("drawCanvas");
  const padCtx = pad.getContext("2d");
  const clearShapeBtn = document.getElementById("clearShapeBtn");
  const saveShapeBtn = document.getElementById("saveShapeBtn");
  const cancelShapeBtn = document.getElementById("cancelShapeBtn");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const W = board.width;
  const H = board.height;
  const R = Math.min(W, H) / 2 - H / 4; // the applet's strip radius
  const CY = H / 2;
  const CRACK_TOP = CY - R;
  const CRACK_BOTTOM = CY + R;
  const PW = pad.width;
  const PH = pad.height;

  let tokens = {};
  function refreshTokens() {
    const cs = getComputedStyle(document.documentElement);
    tokens = {
      stage: cs.getPropertyValue("--stage").trim(),
      ink: cs.getPropertyValue("--ink").trim(),
      accent: cs.getPropertyValue("--accent").trim(),
      muted: cs.getPropertyValue("--muted").trim(),
      bad: cs.getPropertyValue("--bad").trim(),
      highlight: cs.getPropertyValue("--highlight").trim(),
      border: cs.getPropertyValue("--border-strong").trim(),
    };
  }
  refreshTokens();
  window.addEventListener("themechange", () => { refreshTokens(); render(); });

  let state = Core.start({ trials: Number(trialsInput.value) * Core.TRIAL_STEP });
  let drawn = []; // points of the broken line being drawn
  let cursor = null; // where a keyboard drawer would put the next point
  let dragging = false;
  let frame = null;
  let lastDrawnAt = 0;

  /** Shows a line under the game. "done" is also how the record sees a finished demo. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  // ---- drawing ------------------------------------------------------------

  const toX = (x) => W / 2 + (x - Core.LENGTH / 2) * (2 * R / Core.LENGTH);
  const toY = (y) => CRACK_TOP + (y / Core.LENGTH) * (2 * R);

  function line(ctx, x1, y1, x2, y2, colour, width) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function dot(ctx, x, y, colour, radius) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
  }

  function drawBoard() {
    boardCtx.fillStyle = tokens.stage;
    boardCtx.fillRect(0, 0, W, H);
    boardCtx.fillStyle = tokens.highlight;
    boardCtx.fillRect(0, CRACK_TOP, W, CRACK_BOTTOM - CRACK_TOP);
    line(boardCtx, 0, CY, W - 1, CY, tokens.border, 1); // the middle guide
    line(boardCtx, 0, CRACK_TOP, W, CRACK_TOP, tokens.ink, 2);
    line(boardCtx, 0, CRACK_BOTTOM, W, CRACK_BOTTOM, tokens.ink, 2);

    const last = state.last;
    if (last) {
      const pieces = last.segments || [{ x1: last.x1, y1: last.y1, x2: last.x2, y2: last.y2, hit: last.hit }];
      pieces.forEach((s) => {
        line(boardCtx, toX(s.x1), toY(s.y1), toX(s.x2), toY(s.y2), s.hit ? tokens.bad : tokens.accent, 4);
      });
      pieces.forEach((s) => dot(boardCtx, toX(s.x2), toY(s.y2), tokens.ink, 3));
      dot(boardCtx, toX((pieces[0].x1 + pieces[0].x2) / 2), toY(last.centerY), tokens.accent, 4);
    }

    boardCtx.fillStyle = tokens.ink;
    boardCtx.font = "16px ui-sans-serif, system-ui, sans-serif";
    boardCtx.textAlign = "right";
    boardCtx.fillText(Core.countText(state), W - 12, H - 12);
    boardCtx.textAlign = "left";
    boardCtx.fillStyle = tokens.muted;
    boardCtx.font = "14px ui-sans-serif, system-ui, sans-serif";
    boardCtx.fillText("crack", 8, CRACK_TOP - 8);
    boardCtx.fillText("crack", 8, CRACK_BOTTOM + 18);
  }

  function drawPad() {
    padCtx.fillStyle = tokens.stage;
    padCtx.fillRect(0, 0, PW, PH);
    padCtx.strokeStyle = tokens.border;
    padCtx.lineWidth = 2;
    padCtx.strokeRect(1, 1, PW - 2, PH - 2);
    const pts = drawn.concat(cursor ? [cursor] : []);
    if (pts.length > 1) {
      padCtx.strokeStyle = tokens.accent;
      padCtx.lineWidth = 4;
      padCtx.lineJoin = "round";
      padCtx.beginPath();
      padCtx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) padCtx.lineTo(pts[i][0], pts[i][1]);
      padCtx.stroke();
    }
    pts.forEach((p) => dot(padCtx, p[0], p[1], tokens.accent, 5));
    padCtx.fillStyle = tokens.muted;
    padCtx.font = "13px ui-sans-serif, system-ui, sans-serif";
    padCtx.fillText(drawn.length < 2 ? "Drag or press Enter to place points" : drawn.length + " points", 8, PH - 10);
  }

  function render() {
    drawBoard();
    if (!drawPanel.hidden) drawPad();
    readout.textContent = Core.countText(state);
    trialsVal.textContent = state.trials + (state.trials === 1 ? " throw" : " throws");
    skipVal.textContent = state.skip === 0 ? "redraw every throw" : "redraw every " + state.skip + " throws";
    startBtn.textContent = state.running ? "Stop" : "Start";
    startBtn.setAttribute("aria-label", state.running ? "Stop throwing needles" : "Start throwing needles");
    repeatBtn.disabled = state.running || !drawPanel.hidden;
    singleBtn.disabled = !drawPanel.hidden;
    drawToggle.disabled = state.running;
    drawToggle.checked = !drawPanel.hidden;
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  // ---- playing ------------------------------------------------------------

  function stopFrame() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  }

  function finishMessage() {
    const pieces = state.shape ? state.shape.length : 1;
    const noun = pieces === 1 ? "needle" : "noodle";
    const pi = Core.estimatePi(state);
    const throwWord = state.throws === 1 ? "throw" : "throws";
    const crossWord = state.crossings === 1 ? "crossing" : "crossings";
    say("Finished " + state.throws + " " + throwWord + " of the " + noun + ": " + state.crossings +
      " " + crossWord + ", so pi is about " + pi + ".", "done");
  }

  function animate() {
    frame = null;
    if (!state.running) return;
    for (let i = 0; i < 8 && state.running && state.throws < state.trials; i++) {
      state = Core.throwOnce(state, Math.random);
    }
    const boundary = Math.max(1, state.skip);
    if (state.skip === 0 || Math.floor(state.throws / boundary) !== Math.floor(lastDrawnAt / boundary)) {
      drawBoard();
      lastDrawnAt = state.throws;
    }
    readout.textContent = Core.countText(state);
    if (state.running && state.throws < state.trials) {
      frame = requestAnimationFrame(animate);
    } else {
      state = Core.stopRun(state);
      finishMessage();
      render();
    }
  }

  function startPlaying() {
    if (state.running) {
      stopFrame();
      state = Core.stopRun(state);
      say("Stopped after " + state.throws + " throws and " + state.crossings + " crossings.", "done");
      render();
      return;
    }
    state = Core.startRun(state);
    lastDrawnAt = 0;
    say("Throwing " + state.trials + " needles onto the floor.", null);
    render();
    if (reducedMotion) {
      state = Core.run(state, Math.random, state.trials);
      if (state.running) state = Core.stopRun(state);
      finishMessage();
      render();
    } else {
      frame = requestAnimationFrame(animate);
    }
  }

  function singleThrow() {
    if (!drawPanel.hidden) return;
    stopFrame();
    if (state.running) state = Core.stopRun(state);
    const before = state.crossings;
    state = Core.throwOnce(state, Math.random);
    const gained = state.crossings - before;
    if (state.completed) finishMessage();
    else say("Threw one " + (state.shape ? "noodle" : "needle") + ": " +
      (gained === 0 ? "it missed both cracks" : "it crossed " + (gained === 1 ? "a crack" : gained + " cracks")) +
      ". " + state.crossings + (state.crossings === 1 ? " crossing" : " crossings") + " in " +
      state.throws + (state.throws === 1 ? " throw" : " throws") + ".", null);
    render();
  }

  function repeatRun() {
    if (state.running || !drawPanel.hidden) return;
    const added = state.perRun;
    state = Core.repeat(state);
    lastDrawnAt = state.throws;
    say("Added " + added + " more throws; continuing from " + state.throws + ".", null);
    render();
    if (reducedMotion) {
      state = Core.run(state, Math.random, added);
      if (state.running) state = Core.stopRun(state);
      finishMessage();
      render();
    } else {
      frame = requestAnimationFrame(animate);
    }
  }

  function resetRun() {
    stopFrame();
    state = Core.reset(state);
    say("Counters cleared; 0 throws and 0 crossings so far.", null);
    render();
  }

  // ---- the drawing pad ----------------------------------------------------

  function padPoint(event) {
    const rect = pad.getBoundingClientRect();
    const x = Math.max(0, Math.min(PW, (event.clientX - rect.left) * (PW / rect.width)));
    const y = Math.max(0, Math.min(PH, (event.clientY - rect.top) * (PH / rect.height)));
    return [x, y];
  }

  function openPad() {
    stopFrame();
    if (state.running) state = Core.stopRun(state);
    drawPanel.hidden = false;
    drawn = [];
    cursor = [PW / 2, PH / 2];
    render();
    say("Draw a broken line on the pad, then press Save noodle.", null);
  }

  function closePad() {
    drawPanel.hidden = true;
    drawn = [];
    cursor = null;
    render();
    say("Drawing closed; throwing the " + (state.shape ? "noodle" : "straight needle") + " again.", null);
  }

  function saveShape() {
    const points = drawn.length >= 2 ? drawn : null;
    const next = Core.setShape(state, points);
    if (!next.shape) {
      say("A noodle needs at least two different points; please draw again.", null);
      drawPad();
      return;
    }
    state = next;
    drawPanel.hidden = true;
    drawn = [];
    cursor = null;
    render();
    say("Saved a noodle with " + state.shape.length + " pieces, resized to the same length as the needle.", "done");
  }

  function clearShape() {
    drawn = [];
    cursor = [PW / 2, PH / 2];
    drawPad();
    say("Cleared the drawing; no noodle saved yet.", null);
  }

  // ---- listeners ----------------------------------------------------------

  startBtn.addEventListener("click", startPlaying);
  repeatBtn.addEventListener("click", repeatRun);
  singleBtn.addEventListener("click", singleThrow);
  resetBtn.addEventListener("click", resetRun);
  drawToggle.addEventListener("change", () => { if (drawToggle.checked) openPad(); else closePad(); });
  showPi.addEventListener("change", () => {
    state = Core.setShowPi(state, showPi.checked);
    say(showPi.checked ? "Showing the pi estimate after each batch of throws." : "Hiding the pi estimate.", null);
    render();
  });
  trialsInput.addEventListener("input", () => {
    stopFrame();
    state = Core.setTrials(state, Number(trialsInput.value));
    say("Set the batch to " + state.trials + " throws; the counters are back to zero.", null);
    render();
  });
  skipInput.addEventListener("input", () => {
    state = Core.setSkip(state, Number(skipInput.value));
    say(state.skip === 0 ? "The floor will redraw after every throw." :
      "The floor will redraw only every " + state.skip + " throws.", null);
    render();
  });

  board.addEventListener("keydown", (event) => {
    if (!drawPanel.hidden) return;
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      singleThrow();
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const step = event.key === "ArrowUp" ? 1 : -1;
      const slider = Math.max(0, Math.min(Core.TRIAL_STEP, Number(trialsInput.value) + step));
      trialsInput.value = String(slider);
      trialsInput.dispatchEvent(new Event("input"));
    } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const step = event.key === "ArrowRight" ? 50 : -50;
      const slider = Math.max(Core.SKIP_MIN, Math.min(Core.SKIP_MAX, Number(skipInput.value) + step));
      skipInput.value = String(slider);
      skipInput.dispatchEvent(new Event("input"));
    }
  });

  pad.addEventListener("keydown", (event) => {
    if (!cursor) cursor = [PW / 2, PH / 2];
    const moves = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] };
    if (moves[event.key]) {
      event.preventDefault();
      cursor = [Math.max(2, Math.min(PW - 2, cursor[0] + moves[event.key][0])),
        Math.max(2, Math.min(PH - 2, cursor[1] + moves[event.key][1]))];
      drawPad();
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      drawn.push(cursor.slice());
      drawPad();
    } else if (event.key === "Backspace") {
      event.preventDefault();
      drawn.pop();
      drawPad();
    } else if (event.key.toLowerCase() === "s") {
      event.preventDefault();
      saveShape();
    } else if (event.key.toLowerCase() === "c") {
      event.preventDefault();
      clearShape();
    }
  });

  pad.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    pad.setPointerCapture(event.pointerId);
    const p = padPoint(event);
    if (drawn.length === 0) drawn.push(p);
    cursor = p;
    dragging = true;
    drawPad();
  });
  pad.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    cursor = padPoint(event);
    drawPad();
  });
  pad.addEventListener("pointerup", (event) => {
    if (!dragging) return;
    const p = padPoint(event);
    drawn.push(p);
    cursor = p;
    dragging = false;
    drawPad();
  });

  clearShapeBtn.addEventListener("click", clearShape);
  saveShapeBtn.addEventListener("click", saveShape);
  cancelShapeBtn.addEventListener("click", closePad);

  trialsInput.value = String(Math.round(state.trials / Core.TRIAL_STEP));
  skipInput.value = String(state.skip);
  trialsVal.textContent = state.trials + " throws";
  skipVal.textContent = "redraw every throw";
  drawPanel.hidden = true;
  say("Nothing thrown yet. Press Start to throw " + state.trials + " needles.", null);
  render();
})();
