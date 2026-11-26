"use strict";

/*
 * The page for Two Numbers: drawing and input only; the rules and the
 * announcement are in two-numbers-core.js. The stage shows the two numbers
 * as buttons you can mark as your pick, the applet's two multiplier
 * instructions and a box for the sum. Pressing Guess (or Enter) asks the
 * computer to name a number. Nothing about the win or loss lives here: it
 * is a demo, so an announcement ends the play with "done".
 */

(function () {
  const Core = TwoNumbersCore;
  const statusEl = document.getElementById("status");
  const numEls = [document.getElementById("numA"), document.getElementById("numB")];
  const chosenWordEl = document.getElementById("chosenWord");
  const otherWordEl = document.getElementById("otherWord");
  const formEl = document.getElementById("guessForm");
  const sumIn = document.getElementById("sumIn");
  const guessBtn = document.getElementById("guessBtn");
  const answerEl = document.getElementById("answer");
  const hintEl = document.getElementById("hint");
  const newBtn = document.getElementById("newBtn");

  let state = null;
  let picked = null; // which card the player marked; the computer never reads it

  /**
   * Shows a line under the game. `kind` is "win", "lose", "done" or nothing;
   * those three classes are also how the player's record learns that a play
   * has ended (assets/progress.js), so use them for that and nothing else.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const words = Core.instruction(state);
    numEls.forEach((el, i) => {
      const value = i === 0 ? state.n : state.m;
      el.textContent = String(value);
      el.setAttribute("aria-label", `Mark ${value}, the ${i === 0 ? "first" : "second"} number, as your choice`);
      el.setAttribute("aria-pressed", String(picked === i));
      el.classList.toggle("picked", picked === i);
    });
    chosenWordEl.textContent = words.chosenWord;
    otherWordEl.textContent = words.otherWord;
    answerEl.textContent = state.announcement || "";
    hintEl.textContent = state.announcement
      ? "Type another sum, or press Try again for two new numbers."
      : "Press the Enter key or \"Guess\". I'll announce your selection.";
    sumIn.disabled = false;
    guessBtn.disabled = sumIn.value.length === 0;

    if (state.announcement) say(`${state.announcement} I read only the parity of your sum.`, "done");
    else say("Press the Enter key or \"Guess\". I'll announce your selection.");

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function newGame(focus) {
    state = Core.start({ seed: 1 + Math.floor(Math.random() * 2147483647) });
    picked = null;
    sumIn.value = "";
    render();
    if (focus) sumIn.focus();
  }

  numEls.forEach((el, i) => {
    el.addEventListener("click", () => { picked = i; render(); });
  });
  document.getElementById("numbers").addEventListener("keydown", (e) => {
    const d = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (d === undefined) return;
    e.preventDefault();
    const next = (picked === null ? 0 : (picked + d + 2) % 2);
    picked = next;
    render();
    numEls[next].focus();
  });

  sumIn.addEventListener("input", () => {
    // The applet's text field throws away anything that is not a digit.
    const clean = sumIn.value.replace(/[^0-9]/g, "");
    if (clean !== sumIn.value) sumIn.value = clean;
    guessBtn.disabled = clean.length === 0;
  });
  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!sumIn.value) return;
    state = Core.guess(state, sumIn.value);
    render();
  });
  newBtn.addEventListener("click", () => newGame(true));

  newGame(false);
})();
