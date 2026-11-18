"use strict";

/*
 * Browser UI for the Date Game. The rules and the computer's diagonal strategy
 * live in date-game-core.js; this file only draws the date and takes input.
 *
 * The month and the day are buttons. Click either one to advance it; once you
 * have started with one, keep clicking that same one until you press Move, as
 * the applet requires. A date that is not real is undone when Move is pressed.
 */

(() => {
  const C = DateGameCore;
  const stage = document.getElementById("stage");
  const status = document.getElementById("status");
  const moveBtn = document.getElementById("moveBtn");
  const resetBtn = document.getElementById("resetBtn");
  const monthBtn = document.getElementById("monthBtn");
  const dayBtn = document.getElementById("dayBtn");
  const readOut = document.getElementById("readOut");

  let state = null;
  let note = "";
  let busy = false;
  let timer = 0;
  let focusKey = null;

  function say(text, kind) {
    status.textContent = text;
    status.classList.remove("win", "lose", "done");
    if (kind) status.classList.add(kind);
  }

  function render() {
    if (focusKey === null) {
      const active = document.activeElement;
      if (active && active.dataset && active.dataset.word) focusKey = active.dataset.word;
    }
    const allowed = C.allowedWords(state);
    monthBtn.textContent = C.MONTHS[state.month];
    dayBtn.textContent = C.DATES[state.day];
    monthBtn.disabled = busy || !allowed.includes("month");
    dayBtn.disabled = busy || !allowed.includes("day");
    monthBtn.setAttribute("aria-label", `Month: ${C.LONG_MONTHS[state.month]}, click to advance`);
    dayBtn.setAttribute("aria-label", `Day: ${state.day + 1}, click to advance`);
    readOut.textContent = C.label(state);
    stage.dataset.month = String(state.month);
    stage.dataset.day = String(state.day);

    moveBtn.disabled = busy || state.turn !== "you" || state.last === null || Boolean(state.winner);
    moveBtn.textContent = state.winner ? (state.winner === "you" ? "You won" : "I won") : "Move";
    resetBtn.disabled = busy;

    const result = C.result(state);
    if (result) {
      say(state.winner === "you" ? "You won! Press Reset to play again." : "I won! Press Reset to play again.",
        state.winner === "you" ? "win" : "lose");
    } else if (busy) say(C.NOTE_THINKING);
    else if (note) say(note);
    else if (state.last) say(`Keep clicking ${state.last === "month" ? "Month" : "Day"}, then press Move.`);
    else say("Click the month or the day to change the date, then press Move. Reach December 31 to win.");

    if (window.Track) {
      window.Track.state({
        month: state.month, day: state.day, leap: state.leap, turn: state.turn,
        winner: state.winner, moves: state.moves, last: state.last,
      });
    }
    if (focusKey) {
      const target = focusKey === "month" ? monthBtn : dayBtn;
      focusKey = null;
      if (!target.disabled) target.focus();
    }
  }

  function click(word) {
    if (busy || state.winner) return;
    const moved = C.advance(state, word);
    if (!moved) return;
    focusKey = word;
    state = moved.state;
    note = moved.note;
    render();
  }

  function pressMove() {
    if (busy || state.winner) return;
    const pressed = C.commit(state);
    if (!pressed) return;
    focusKey = null;
    state = pressed.state;
    note = pressed.note;
    if (pressed.kind === "invalid" || pressed.kind === "win") {
      render();
      return;
    }
    busy = true;
    render();
    timer = window.setTimeout(reply, 320);
  }

  function reply() {
    timer = 0;
    const move = C.computerMove(state);
    busy = false;
    if (!move) {
      render();
      return;
    }
    focusKey = null;
    state = move.state;
    note = move.note || move.description;
    render();
  }

  function reset() {
    if (timer) window.clearTimeout(timer);
    timer = 0;
    busy = false;
    note = "";
    focusKey = null;
    state = C.start({ leap: state ? state.leap : undefined });
    render();
  }

  monthBtn.addEventListener("click", () => click("month"));
  dayBtn.addEventListener("click", () => click("day"));
  moveBtn.addEventListener("click", pressMove);
  resetBtn.addEventListener("click", reset);

  reset();
})();
