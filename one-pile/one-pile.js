"use strict";

/*
 * UI for One Pile. The rules and the computer live in one-pile-core.js.
 *
 * The pile size is a big number in the middle. Around it (below, in a wrapping
 * row) are buttons for every legal take from Min to Max. Min and Max are set
 * with the two number controls; Reset deals a new pile the applet's way.
 * "Make move" lets the computer play (so it can go first); "Take back" undoes
 * the last take.
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
  const YOUR_MOVE = "Your move. Take between Min and Max.";

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

  function render() {
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
      btn.disabled = !canPlay;
      if (lastComputerTake === t) btn.classList.add("just-taken");
      btn.addEventListener("click", () => play(t));
      movesEl.append(btn);
    }

    backBtn.disabled = busy || state.history.length === 0;
    makeBtn.disabled = busy || state.over || state.turn !== "you";
    minInput.disabled = busy;
    maxInput.disabled = busy;
    newBtn.disabled = busy;

    if (window.Track) window.Track.state(C.snapshot(state));
  }

  function finish(s) {
    const kind = C.result(s);
    if (kind === "win") {
      score.you++;
      say("You won!", "win");
    } else if (kind === "lose") {
      score.computer++;
      say("I won", "lose");
    }
    showScore();
  }

  function afterComputer(prevTake) {
    lastComputerTake = prevTake;
    render();
    if (state.over) finish(state);
    else say(YOUR_MOVE);
  }

  function thinkThenComputer() {
    busy = true;
    lastComputerTake = null;
    say("Thinking …");
    render();
    const wait = reduceMotion.matches ? 0 : THINK_MS;
    timer = setTimeout(() => {
      timer = null;
      const before = state.n;
      const next = C.computerMove(state);
      busy = false;
      if (!next) {
        render();
        return;
      }
      state = next;
      afterComputer(before - state.n);
    }, wait);
  }

  function play(take) {
    if (busy || state.over || state.turn !== "you") return;
    const next = C.move(state, take);
    if (!next) return;
    lastComputerTake = null;
    state = next;
    render();
    if (state.over) {
      finish(state);
      return;
    }
    thinkThenComputer();
  }

  function newGame() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    busy = false;
    lastComputerTake = null;
    const pair = C.clampPair(minInput.value, maxInput.value);
    state = C.start({ min: pair.min, max: pair.max });
    syncControls();
    say(YOUR_MOVE);
    render();
  }

  function makeMove() {
    if (busy || state.over || state.turn !== "you") return;
    // The applet's "Make move": the computer plays now (you skip).
    state = { ...state, turn: "computer" };
    thinkThenComputer();
  }

  function takeBack() {
    if (busy) return;
    const prev = C.takeBack(state);
    if (!prev) return;
    lastComputerTake = null;
    state = prev;
    // Undoing one take often leaves the computer's reply; undo again so the
    // player is back on their own move, matching how the stack is used after
    // a full exchange. One press undoes one take, as the applet does.
    statusEl.classList.remove("win", "lose", "done");
    say(state.turn === "you" ? YOUR_MOVE : "Computer to move. Press Make move, or Take back again.");
    render();
  }

  minInput.addEventListener("change", () => {
    const pair = C.clampPair(minInput.value, maxInput.value);
    fillOptionRange(minInput, C.MIN_MIN, C.MAX_MIN, pair.min);
    fillOptionRange(maxInput, C.MIN_MAX, C.ABSOLUTE_MAX, pair.max);
    newGame();
  });
  maxInput.addEventListener("change", () => {
    const pair = C.clampPair(minInput.value, maxInput.value);
    fillOptionRange(minInput, C.MIN_MIN, C.MAX_MIN, pair.min);
    fillOptionRange(maxInput, C.MIN_MAX, C.ABSOLUTE_MAX, pair.max);
    newGame();
  });

  newBtn.addEventListener("click", newGame);
  makeBtn.addEventListener("click", makeMove);
  backBtn.addEventListener("click", takeBack);

  // Number keys and arrows while a take button is focused: Enter already
  // activates the button; digits jump to that take when it is on offer.
  movesEl.addEventListener("keydown", (e) => {
    if (busy || state.over || state.turn !== "you") return;
    if (e.key >= "0" && e.key <= "9") {
      // Build a two-digit take from typed digits when Max ≥ 10.
      return; // leave native button activation alone for single keys
    }
    const buttons = [...movesEl.querySelectorAll(".take:not(:disabled)")];
    if (!buttons.length) return;
    const i = buttons.indexOf(document.activeElement);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      buttons[(i + 1 + buttons.length) % buttons.length].focus();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      buttons[(i - 1 + buttons.length) % buttons.length].focus();
    }
  });

  // Seed the selects, then deal.
  fillOptionRange(minInput, C.MIN_MIN, C.MAX_MIN, C.DEFAULT_MIN);
  fillOptionRange(maxInput, C.MIN_MAX, C.ABSOLUTE_MAX, C.DEFAULT_MAX);
  showScore();
  newGame();
})();
