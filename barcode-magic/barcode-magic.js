"use strict";

/*
 * The page for Barcode Magic: drawing and input only. The UPC-A arithmetic,
 * the eleven-cell cycle and the four announcements live in
 * barcode-magic-core.js.
 *
 * The play area has twelve buttons (one per digit of the code) above a canvas
 * that draws the UPC-A barcode for those digits. A click on the right half of
 * a button steps that digit up, a click on the left half steps it down; the
 * arrow keys do the same while a button has focus. The canvas is redrawn from
 * the site's CSS tokens whenever the theme or its size changes.
 */

(function () {
  const Core = BarcodeMagicCore;
  const stageEl = document.getElementById("stage");
  const statusEl = document.getElementById("status");
  const checkBtn = document.getElementById("checkBtn");
  const newBtn = document.getElementById("newBtn");

  const digitRow = document.getElementById("digitRow");
  const canvas = document.getElementById("barcode");
  const ctx = canvas.getContext("2d");

  const buttons = [];
  let state = Core.start();

  /**
   * Shows a line under the game. `kind` is "done" here (a demo has no win or
   * loss); the shared progress tracker reads that class to see the play ended.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** CSS custom properties are read at draw time, so both themes work. */
  function token(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function drawBarcode() {
    const modules = Core.moduleString(state.digits);
    const ink = token("--ink", "#1b1d20");
    const accent = token("--accent", "#2d6cdf");
    const stage = token("--stage", "#ffffff");
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = stage;
    ctx.fillRect(0, 0, width, height);

    const unit = width / modules.length;
    const dataTop = height * 0.16;
    const dataH = height * 0.52;
    const guardTop = height * 0.06;
    const guardH = height * 0.72;
    for (let i = 0; i < modules.length; i++) {
      const ch = modules[i];
      if (ch === "0") continue;
      const guard = i < 3 || (i >= 45 && i < 50) || i >= 92;
      const blank = ch === "?";
      ctx.fillStyle = blank ? accent : ink;
      // Paint thin bars with a tiny overlap so no hairline gaps appear.
      const x = i * unit;
      const w = Math.max(unit * (blank ? 1 : 0.92), 0.5);
      ctx.fillRect(x, blank || guard ? guardTop : dataTop, w, blank || guard ? guardH : dataH);
    }
    canvas.setAttribute(
      "aria-label",
      "UPC-A barcode for the digits " + state.digits.map(Core.digitText).join(", ")
    );
  }

  function render() {
    // The buttons are made once, so a keyboard user keeps focus after a move.
    for (let i = 0; i < buttons.length; i++) {
      const value = state.digits[i];
      const text = Core.digitText(value);
      buttons[i].textContent = text;
      buttons[i].classList.toggle("blank", value === Core.BLANK);
      buttons[i].setAttribute(
        "aria-label",
        `Digit ${i + 1}: ${value === Core.BLANK ? "blank" : value}. ` +
          `Click the right half to count up, the left half to count down. ` +
          `Arrow keys also change it.`
      );
    }
    drawBarcode();
    // The position, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        digits: state.digits.slice(),
        message: state.message,
        outcome: state.outcome,
      });
    }
  }

  /** One click or arrow key on a digit: step it up or down through 0..9, ?. */
  function step(i, direction) {
    state = Core.cycle(state, i, direction);
    say("", null); // the applet clears its announcement on the next repaint
    render();
  }

  function doCheck() {
    state = Core.pressCheck(state);
    say(state.message, "done");
    render();
  }

  function newGame() {
    state = Core.start();
    say("", null);
    render();
  }

  // Build the twelve digit buttons once.
  for (let i = 0; i < Core.LENGTH; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "digit";
    btn.dataset.index = String(i);
    btn.addEventListener("click", (evt) => {
      // Keyboard-activated clicks have detail 0: count up by default.
      const rect = btn.getBoundingClientRect();
      const right = evt.detail === 0 || evt.clientX - rect.left > rect.width / 2;
      step(i, right ? 1 : -1);
    });
    btn.addEventListener("keydown", (evt) => {
      if (evt.key === "ArrowUp" || evt.key === "ArrowRight") {
        evt.preventDefault();
        step(i, 1);
      } else if (evt.key === "ArrowDown" || evt.key === "ArrowLeft") {
        evt.preventDefault();
        step(i, -1);
      }
    });
    digitRow.appendChild(btn);
    buttons.push(btn);
  }

  checkBtn.addEventListener("click", doCheck);
  newBtn.addEventListener("click", newGame);
  window.addEventListener("themechange", drawBarcode);
  window.addEventListener("resize", drawBarcode);
  if (window.ResizeObserver) new ResizeObserver(drawBarcode).observe(canvas);

  newGame();
})();
