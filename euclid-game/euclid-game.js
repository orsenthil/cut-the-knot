"use strict";

/*
 * Euclid's Game - the page.
 *
 * Rules and the computer live in euclid-game-core.js; this file draws the
 * grid and runs the turns, as the applet did: click a number to mark it, the
 * computer replies after a moment ("Thinking ..."), and a refused number gets
 * "You can't do that". The applet's "You start" button, which in fact makes
 * the computer move first, is labelled "Let the computer start" here; as there,
 * it only works before the first move.
 */

(() => {
  const E = EuclidGameCore;

  const grid = document.getElementById("grid");
  const nInput = document.getElementById("nInput");
  const startBtn = document.getElementById("startBtn");
  const newBtn = document.getElementById("newBtn");
  const statusEl = document.getElementById("status");
  const THINK_MS = 500;

  let s = null;
  let busy = false;
  let timer = null;
  let last = 0;
  let buttons = [];

  function say(text, cls) {
    statusEl.textContent = text;
    statusEl.className = cls || "";
  }

  function build() {
    grid.style.setProperty("--n", s.n);
    grid.textContent = "";
    buttons = [null];
    for (let x = 1; x <= s.n * s.n; x++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "num";
      b.textContent = String(x);
      b.addEventListener("click", () => tap(x));
      grid.appendChild(b);
      buttons.push(b);
    }
  }

  function render() {
    for (let x = 1; x <= s.n * s.n; x++) {
      const who = s.marked[x];
      const b = buttons[x];
      b.className = "num" + (who ? " " + who : "") + (x === last ? " last" : "");
      b.disabled = !!who || !!s.winner || busy;
      b.setAttribute("aria-label", `${x}: ${who === "start" ? "marked at the start" : who === "you" ? "marked by you" : who === "computer" ? "marked by the computer" : "not marked"}`);
    }
    startBtn.disabled = s.moves > 0 || busy || !!s.winner;
  }

  function finish() {
    if (s.winner === "you") say(`You won! You marked the last number. ${E.forecast(s).total} moves in all.`, "win");
    else say(`I won! I marked the last number. ${E.forecast(s).total} moves in all.`, "lose");
  }

  function computerTurn() {
    if (s.winner) return;
    busy = true;
    say("Thinking ...", "");
    render();
    timer = setTimeout(() => {
      timer = null;
      busy = false;
      const x = E.computerMove(s);
      if (x < 0) {
        // Only possible when the two starting numbers leave nothing to mark.
        s.winner = "you";
        say("I can't move: there is nothing left to mark. You won!", "win");
        render();
        return;
      }
      E.mark(s, x, "computer");
      last = x;
      if (s.winner) finish();
      else say(`I marked ${x}. Your move.`, "");
      render();
    }, THINK_MS);
  }

  function tap(x) {
    if (busy || s.winner || s.turn !== "you") return;
    if (!E.legal(s, x)) {
      say("You can't do that: pick a number that is the gap between two marked numbers.", "");
      return;
    }
    E.mark(s, x, "you");
    last = x;
    if (s.winner) {
      finish();
      render();
      return;
    }
    computerTurn();
  }

  function newGame() {
    if (timer) clearTimeout(timer);
    timer = null;
    busy = false;
    s = E.start(Number(nInput.value));
    last = 0;
    build();
    if (E.over(s)) {
      say(`${s.a} and ${s.b}: there is nothing to mark, so whoever has to move first loses. Let the computer start!`, "");
    } else {
      say(`${s.a} and ${s.b} are marked. Your move, or let the computer start.`, "");
    }
    render();
  }

  for (let n = E.MIN_N; n <= E.MAX_N; n++) {
    const o = document.createElement("option");
    o.value = String(n);
    o.textContent = `${n} by ${n}`;
    if (n === E.DEFAULT_N) o.selected = true;
    nInput.appendChild(o);
  }
  nInput.addEventListener("change", newGame);
  newBtn.addEventListener("click", newGame);
  startBtn.addEventListener("click", () => {
    if (s.moves > 0 || busy || s.winner) return;
    s.turn = "computer";
    computerTurn();
  });

  newGame();
})();
