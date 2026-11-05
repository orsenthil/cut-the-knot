"use strict";

/*
 * UI for the Aliquot game. All the game logic lives in aliquot-core.js; this
 * file only renders the number, offers its aliquot parts as buttons and runs
 * the turn order.
 *
 * The applet asked you to type a divisor into a text field and complained when
 * it was not a factor. Buttons for the legal moves say the same thing without
 * the typing, and work on a phone. Everything else follows AliquotCanvas: you
 * open, the computer replies with FindFactor after a short pause, "Take Move
 * Back" undoes a whole round, and the running score is kept across games.
 */
(() => {
  const A = AliquotCore;

  const stage = document.getElementById("stage");
  const numberEl = document.getElementById("number");
  const partsEl = document.getElementById("parts");
  const partsLabel = document.getElementById("partsLabel");
  const thinkingEl = document.getElementById("thinking");
  const logEl = document.getElementById("log");
  const statusEl = document.getElementById("status");
  const scoreYou = document.getElementById("scoreYou");
  const scoreMe = document.getElementById("scoreMe");
  const startInput = document.getElementById("startInput");
  const newBtn = document.getElementById("newBtn");
  const backBtn = document.getElementById("backBtn");

  const THINK_MS = 550;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let num = 0;
  // The applet's move stack: the number as it stood before each move.
  let stack = [];
  let log = [];
  let wins = 0; // the player's
  let losses = 0;
  let state = "yours"; // "yours" | "thinking" | "over"
  let timer = null;

  /* ------------------------------------------------------------- rendering */

  function setStatus(text, cls) {
    statusEl.textContent = text || "";
    statusEl.className = cls || "";
  }

  function renderLog() {
    logEl.replaceChildren();
    const lines = log.length
      ? log.slice(-2)
      : [state === "over" ? "" : "You go first \u2014 pick a number to take off."];
    for (const line of lines) {
      if (!line) continue;
      const li = document.createElement("li");
      li.textContent = line;
      logEl.appendChild(li);
    }
  }

  function renderParts() {
    partsEl.replaceChildren();
    const parts = A.aliquotParts(num);
    if (state === "over" || !parts.length) {
      partsLabel.textContent = num === 1 ? "1 has nothing to take off." : " ";
      return;
    }
    partsLabel.textContent = state === "thinking" ? " " : "Take one of these off:";
    for (const d of parts) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = String(d);
      b.setAttribute("aria-label", `Take ${d} off ${num}, leaving ${num - d}`);
      b.disabled = state !== "yours";
      b.addEventListener("click", () => playerMove(d));
      partsEl.appendChild(b);
    }
  }

  function render(flash) {
    numberEl.textContent = String(num);
    numberEl.classList.toggle("dead", num === 1);
    if (flash && !reduceMotion.matches) {
      numberEl.classList.remove("flash");
      // Restart the animation: read a layout property to force a reflow.
      void numberEl.offsetWidth;
      numberEl.classList.add("flash");
    }
    scoreYou.textContent = String(wins);
    scoreMe.textContent = String(losses);
    thinkingEl.innerHTML = state === "thinking" ? "<span>&bull;</span><span>&bull;</span><span>&bull;</span>" : "";
    backBtn.disabled = stack.length === 0;
    renderParts();
    renderLog();
  }

  /* ----------------------------------------------------------------- play */

  function playerMove(d) {
    if (state !== "yours" || !A.isLegalMove(num, d)) return;
    stack.push({ num, computer: false });
    num -= d;
    log.push(`You took ${d} off. It is now ${num}.`);
    if (num === 1) {
      // The computer has been handed 1 and has no move.
      wins++;
      state = "over";
      setStatus(`Well done — I am left with 1 and cannot move. It is now ${wins}:${losses} to you.`, "win");
      render(true);
      return;
    }
    state = "thinking";
    setStatus("Thinking…");
    render(true);
    timer = window.setTimeout(computerMove, reduceMotion.matches ? 120 : THINK_MS);
  }

  function computerMove() {
    timer = null;
    stack.push({ num, computer: true });
    const f = A.findFactor(num);
    num -= f;
    log.push(`I took ${f} off. It is now ${num}.`);
    if (num === 1) {
      losses++;
      state = "over";
      setStatus(`I got you — you are left with 1 and cannot move. It is now ${wins}:${losses} to you.`, "lose");
    } else {
      state = "yours";
      setStatus(`I took ${f} off.`);
    }
    render(true);
  }

  function takeBack() {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
    if (!stack.length) return;
    // The applet pops the computer's move and your move together, so one click
    // undoes a whole round.
    let move = stack.pop();
    if (move.computer && stack.length) move = stack.pop();
    num = move.num;
    log = log.slice(0, Math.max(0, log.length - (move.computer ? 1 : 2)));
    state = "yours";
    setStatus("");
    render(false);
  }

  function newGame() {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
    const typed = parseInt(startInput.value, 10);
    num = Number.isFinite(typed)
      ? Math.min(A.MAX_START, Math.max(A.MIN_START, typed))
      : A.randomStart(Math.random);
    startInput.value = String(num);
    stack = [];
    log = [];
    state = "yours";
    setStatus("");
    render(false);
  }

  /* ------------------------------------------------------------- wiring */

  newBtn.addEventListener("click", newGame);
  backBtn.addEventListener("click", takeBack);
  startInput.addEventListener("change", newGame);
  stage.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && state !== "thinking") {
      e.preventDefault();
      takeBack();
    }
  });

  // The applet deals a random number between 20 and 99 on load.
  num = A.randomStart(Math.random);
  startInput.value = String(num);
  render(false);
})();
