"use strict";

/*
 * UI for Dawson's Chess. Every rule lives in dawson-core.js; this file lays the
 * skittles out around a ring, handles clicks and keys, and runs the turns.
 *
 * The controls are the applet's panel: the number of skittles (10 to 60), the
 * "Full circle" checkbox that decides whether the opening ring has gaps punched
 * in it, Reset, and the button that hands the move to the computer. That last
 * one is labelled "You start" in the applet, which is backwards -- it calls
 * ForceMove(), so the computer moves -- so it is labelled for what it does.
 * "Full circle" starts unchecked, because a broken ring gives a different
 * opening every time; the applet took its initial state from an HTML parameter
 * that is not in classes.zip.
 */
(() => {
  const C = DawsonCore;

  const ring = document.getElementById("ring");
  const statusEl = document.getElementById("status");
  const countLabel = document.getElementById("countLabel");
  const fewerBtn = document.getElementById("fewerBtn");
  const moreBtn = document.getElementById("moreBtn");
  const fullBox = document.getElementById("fullBox");
  const cpuBtn = document.getElementById("cpuBtn");
  const newBtn = document.getElementById("newBtn");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const THINK_MS = 420;

  let n = C.N_DEFAULT;
  let up = [];
  let buttons = [];
  let thinking = false;
  let over = ""; // "" while the game runs, then "you" or "cpu"
  let lastMove = []; // the places the previous move knocked down
  let timer = 0;

  /* ----------------------------------------------------------------- layout */

  /*
   * Skittle diameter and ring radius as fractions of the square stage. The two
   * constrain each other, so they are settled by iterating from a guess, the
   * way circle-solitaire does it: 1.2 is the gap left between neighbours and
   * 0.13 caps how fat one skittle gets when there are only ten of them.
   */
  function geometry(count) {
    let d = 0.13;
    let rho = 0.5 - d / 2 - 0.006;
    for (let k = 0; k < 5; k++) {
      d = Math.min(0.13, (2 * rho * Math.sin(Math.PI / count)) / 1.2);
      rho = 0.5 - d / 2 - 0.006;
    }
    return { d, rho };
  }

  function build() {
    const { d, rho } = geometry(n);
    ring.style.setProperty("--d", `${(d * 100).toFixed(3)}%`);
    ring.textContent = "";
    buttons = [];
    for (let i = 0; i < n; i++) {
      // Place 0 sits at twelve o'clock and the places run clockwise.
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "skittle";
      b.style.left = `${(50 + 100 * rho * Math.cos(angle)).toFixed(3)}%`;
      b.style.top = `${(50 + 100 * rho * Math.sin(angle)).toFixed(3)}%`;
      b.addEventListener("click", () => play(i));
      ring.appendChild(b);
      buttons.push(b);
    }
  }

  /* ----------------------------------------------------------------- render */

  /** "a closed ring of 18" or "arcs of 4 + 12", so the sum of games is visible. */
  function shape() {
    const { full, arcs } = C.decompose(up);
    if (!arcs.length) return "nothing left";
    if (full) return `a closed ring of ${arcs[0].len}`;
    const lens = arcs.map((a) => a.len).sort((a, b) => b - a);
    return lens.length === 1 ? `one arc of ${lens[0]}` : `arcs of ${lens.join(" + ")}`;
  }

  function render() {
    for (let i = 0; i < n; i++) {
      const b = buttons[i];
      const standing = up[i] === 1;
      b.classList.toggle("down", !standing);
      b.classList.toggle("fell", lastMove.includes(i));
      b.disabled = !standing || thinking || over !== "";
      b.setAttribute(
        "aria-label",
        `Place ${i + 1} of ${n}: ${standing ? "standing, click to knock it down" : "already down"}`
      );
    }
    if (over === "you") {
      statusEl.textContent = "You knocked down the last skittle. You won!";
    } else if (over === "cpu") {
      statusEl.textContent = "The computer knocked down the last skittle. You lost.";
    } else if (thinking) {
      statusEl.textContent = "Thinking …";
    } else {
      statusEl.textContent = `Your turn — ${C.standing(up)} standing, ${shape()}.`;
    }
    statusEl.classList.toggle("win", over === "you");
    statusEl.classList.toggle("lose", over === "cpu");
    countLabel.textContent = String(n);
    fewerBtn.disabled = thinking || n <= C.N_MIN;
    moreBtn.disabled = thinking || n >= C.N_MAX;
    fullBox.disabled = thinking;
    cpuBtn.disabled = thinking || over !== "";
  }

  /* ------------------------------------------------------------------- play */

  /** One move by either side, then the win check. */
  function apply(i) {
    lastMove = C.footprint(up, i);
    up = C.move(up, i);
    if (reduceMotion.matches) lastMove = [];
  }

  function computerTurn() {
    thinking = true;
    render();
    timer = setTimeout(() => {
      thinking = false;
      const i = C.bestMove(up);
      if (i >= 0) {
        apply(i);
        if (C.isFinished(up)) over = "cpu";
      }
      render();
    }, reduceMotion.matches ? 0 : THINK_MS);
  }

  function play(i) {
    if (thinking || over || !up[i]) return;
    apply(i);
    if (C.isFinished(up)) {
      over = "you";
      render();
      return;
    }
    computerTurn();
  }

  /* --------------------------------------------------------------- controls */

  function start() {
    clearTimeout(timer);
    thinking = false;
    over = "";
    lastMove = [];
    up = C.openingRing(n, fullBox.checked);
    render();
  }

  function resize(delta) {
    const next = Math.min(C.N_MAX, Math.max(C.N_MIN, n + delta));
    if (next === n) return;
    n = next;
    build();
    start();
  }

  newBtn.addEventListener("click", start);
  fullBox.addEventListener("change", start);
  fewerBtn.addEventListener("click", () => resize(-1));
  moreBtn.addEventListener("click", () => resize(+1));
  cpuBtn.addEventListener("click", () => {
    if (thinking || over) return;
    computerTurn();
  });

  build();
  start();
})();
