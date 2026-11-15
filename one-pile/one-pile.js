"use strict";

/*
 * UI for One Pile. The rules and the computer live in one-pile-core.js.
 *
 * The pile size is a big number in the middle. Below it, in a wrapping row,
 * is a button for every take from Min to Max; a take bigger than the pile is
 * switched off. Min and Max are set with the two number controls and dealing
 * a new pile is what changing them does, as in the applet. "Make move" lets
 * the computer play (so it can go first); "Take back" undoes the last take.
 *
 * The computer says how many it removed, in words, because the applet did
 * ("I have removed N") and a tint on a button is not enough for everyone.
 * The score is not the applet's: it has none; it is kept here across games.
 */

(() => {
  const C = OnePileCore;

  const pileEl = document.getElementById("pile");
  const movesEl = document.getElementById("moves");
  const statusEl = document.getElementById("status");
  const scoreEl = document.getElementById("score");
  const minInput = document.getElementById("minInput");
  const maxInput = document.getElementById("maxInput");
  const newBtn = document.getElementById("newBtn");
  const makeBtn = document.getElementById("makeBtn");
  const backBtn = document.getElementById("backBtn");

  const THINK_MS = 550;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let state = null;
  let busy = false;
  let timer = null;
  let lastComputerTake = null;
  const score = { you: 0, computer: 0 };

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function showScore() {
    scoreEl.textContent = `Score: you ${score.you}, computer ${score.computer}`;
  }

  function fillOptionRange(select, from, to, selected) {
    select.replaceChildren();
    for (let v = from; v <= to; v++) {
      const opt = document.createElement("option");
      opt.value = String(v);
      opt.textContent = String(v);
      if (v === selected) opt.selected = true;
      select.append(opt);
    }
  }

  function syncControls() {
    fillOptionRange(minInput, C.MIN_MIN, C.MAX_MIN, state.min);
    fillOptionRange(maxInput, C.MIN_MAX, C.ABSOLUTE_MAX, state.max);
  }

  /** What to say when it is the player's turn. */
  const yourMove = () => `Your move: take from ${state.min} to ${Math.min(state.max, state.n)}.`;

  /** Redraws everything; with `focus`, the take to hold the keyboard focus. */
  function render(focus) {
    pileEl.textContent = String(state.n);
    pileEl.setAttribute("aria-label", `Pile of ${state.n}`);

    const canPlay = !state.over && !busy && state.turn === "you";
    movesEl.replaceChildren();
    for (let t = state.min; t <= state.max; t++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "take";
      btn.textContent = String(t);
      btn.dataset.take = String(t);
      btn.setAttribute("aria-label", `Take ${t}`);
      btn.disabled = !canPlay || t > state.n;
      if (lastComputerTake === t) btn.classList.add("just-taken");
      btn.addEventListener("click", () => play(t));
      movesEl.append(btn);
    }

    // Take back is for a game in progress: a finished game is scored, so it
    // is not reopened. Make move works on either turn, as in the applet.
    backBtn.disabled = busy || state.over || state.history.length === 0;
    makeBtn.disabled = busy || state.over;
    minInput.disabled = busy;
    maxInput.disabled = busy;
    newBtn.disabled = busy;

    if (focus !== undefined) {
      const el = movesEl.querySelector(`.take[data-take="${focus}"]:not(:disabled)`) ||
        movesEl.querySelector(".take:not(:disabled)");
      if (el) el.focus();
    }

    if (window.Track) window.Track.state(C.snapshot(state));
  }

  /** The game has ended: the last player to take wins. */
  function finish(prefix) {
    if (state.winner === "you") {
      score.you++;
      say(`${prefix}You won!`, "win");
    } else {
      score.computer++;
      say(`${prefix}I won`, "lose");
    }
    showScore();
    render();
    newBtn.focus();
  }

  function thinkThenComputer() {
    // Pressing a take switches every take off, so the focus would be lost.
    const hadFocus = document.activeElement === document.body || movesEl.contains(document.activeElement) ||
      document.activeElement === makeBtn;
    busy = true;
    lastComputerTake = null;
    say("Thinking …");
    render();
    timer = setTimeout(() => {
      timer = null;
      const before = state.n;
      const next = C.computerMove(state);
      busy = false;
      if (!next) { render(); return; }
      state = next;
      const took = before - state.n;
      lastComputerTake = took;
      const removed = `I have removed ${took}. `;
      if (state.over) { finish(removed); return; }
      say(`${removed}The pile is ${state.n}. ${yourMove()}`);
      // Redrawing dropped the focus: give it back to a take the player can use.
      render(hadFocus ? took : undefined);
    }, reduceMotion.matches ? 0 : THINK_MS);
  }

  function play(take) {
    if (busy || state.over || state.turn !== "you") return;
    const next = C.move(state, take);
    if (!next) return;
    lastComputerTake = null;
    state = next;
    if (state.over) { finish(""); return; }
    thinkThenComputer();
  }

  function newGame(pair) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    busy = false;
    lastComputerTake = null;
    state = C.start(pair || { min: Number(minInput.value), max: Number(maxInput.value) });
    syncControls();
    say(yourMove());
    render();
  }

  /** "Make move": the computer plays now, from wherever the game stands. */
  function makeMove() {
    if (busy || state.over) return;
    state = C.skip(state) || state;
    thinkThenComputer();
  }

  function takeBack() {
    if (busy) return;
    const prev = C.takeBack(state);
    if (!prev) return;
    lastComputerTake = null;
    state = prev;
    say(state.turn === "you" ? yourMove() : "Computer to move. Press Make move, or Take back again.");
    render();
  }

  // Changing Min or Max deals a new pile, and keeps Min no more than Max the
  // way the applet does: a Min above Max lifts Max, a Max below Min lowers Min.
  minInput.addEventListener("change", () => newGame(C.setMin(state, Number(minInput.value))));
  maxInput.addEventListener("change", () => newGame(C.setMax(state, Number(maxInput.value))));
  newBtn.addEventListener("click", () => newGame());
  makeBtn.addEventListener("click", makeMove);
  backBtn.addEventListener("click", takeBack);

  // Arrow keys move along the takes; Enter or Space takes the one in focus.
  movesEl.addEventListener("keydown", (e) => {
    if (busy || state.over || state.turn !== "you") return;
    const buttons = [...movesEl.querySelectorAll(".take:not(:disabled)")];
    if (!buttons.length) return;
    const i = buttons.indexOf(document.activeElement);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      buttons[(i + 1) % buttons.length].focus();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      buttons[(i - 1 + buttons.length) % buttons.length].focus();
    }
  });

  state = C.start({ min: C.DEFAULT_MIN, max: C.DEFAULT_MAX });
  showScore();
  newGame({ min: C.DEFAULT_MIN, max: C.DEFAULT_MAX });
})();
