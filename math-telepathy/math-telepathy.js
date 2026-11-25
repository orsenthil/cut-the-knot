"use strict";

/*
 * The page for Math Telepathy: drawing and input only. Before any digit is
 * given the instructions show; after, the digits given so far; after Guess,
 * the computer's answer. The rules are in math-telepathy-core.js.
 */

(function () {
  const Core = MathTelepathyCore;
  const linesEl = document.getElementById("lines");
  const givenEl = document.getElementById("given");
  const answerEl = document.getElementById("answer");
  const padEl = document.getElementById("pad");
  const guessBtn = document.getElementById("guessBtn");
  const backBtn = document.getElementById("backBtn");
  const statusEl = document.getElementById("status");

  let state = Core.start();

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  Core.INSTRUCTIONS.forEach((t) => { const li = document.createElement("li"); li.textContent = t; linesEl.appendChild(li); });
  for (let d = 0; d <= 9; d++) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = d;
    b.setAttribute("aria-label", `Digit ${d}`);
    b.addEventListener("click", () => { state = Core.add(state, d); say(""); render(); });
    padEl.appendChild(b);
  }

  function render() {
    const started = state.digits.length > 0;
    linesEl.hidden = started;
    givenEl.textContent = started ? "You gave me the following digits: " + state.digits.join(", ") : "";
    answerEl.textContent = "";
    if (state.guessed !== null) {
      answerEl.append("You have been thinking of");
      const big = document.createElement("span"); big.className = "big"; big.textContent = state.guessed; answerEl.appendChild(big);
    }
    backBtn.disabled = !Core.canTakeBack(state);
    if (window.Track) window.Track.state(state);
  }

  guessBtn.addEventListener("click", () => {
    state = Core.guess(state);
    render();
    say(`The digit you circled is ${state.guessed}.`, "done");
  });
  backBtn.addEventListener("click", () => { const s = Core.takeBack(state); if (s) { state = s; say(""); render(); } });
  document.getElementById("resetBtn").addEventListener("click", () => { state = Core.start(); say(""); render(); });
  render();
})();
