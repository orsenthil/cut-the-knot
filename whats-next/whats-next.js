"use strict";

/*
 * What's Next? - the page.
 *
 * The sequences come from whats-next-core.js. This file runs the applet's
 * rounds: New() shows a fresh sequence and counts a try; Check() marks the
 * guess right or wrong and keeps the "x out of y" score; after a wrong
 * guess the applet names the rule as a hint ("Think ...") and offers Repeat,
 * which shows the same sequence again as a new try. As in the applet, a
 * sequence is checked once: after that it is Repeat (if you were wrong) or
 * a new sequence. The answer itself is never shown.
 */

(function () {
  const Q = GuessCore;

  const seqEl = document.getElementById("sequence");
  const form = document.getElementById("guessForm");
  const input = document.getElementById("guessInput");
  const checkBtn = document.getElementById("checkBtn");
  const repeatBtn = document.getElementById("repeatBtn");
  const newBtn = document.getElementById("newBtn");
  const hintEl = document.getElementById("hint");
  const scoreEl = document.getElementById("score");
  const statusEl = document.getElementById("status");

  let round = null;
  let total = 0;
  let correct = 0;
  let checked = false;

  function say(text, cls) {
    statusEl.textContent = text;
    statusEl.className = cls || "";
  }

  function show() {
    seqEl.textContent = "";
    for (const t of round.terms) {
      const li = document.createElement("li");
      li.textContent = t;
      seqEl.appendChild(li);
    }
    const next = document.createElement("li");
    next.className = "next";
    next.textContent = "?";
    next.setAttribute("aria-label", "next term");
    seqEl.appendChild(next);

    checked = false;
    input.value = "";
    input.disabled = false;
    checkBtn.disabled = false;
    repeatBtn.disabled = true;
    hintEl.textContent = "";
    say("", "");
  }

  function newRound() {
    round = Q.generate();
    total++;
    show();
    scoreLine();
  }

  function repeat() {
    total++;
    show();
    scoreLine();
    input.focus();
  }

  function scoreLine() {
    const done = checked ? total : total - 1;
    scoreEl.textContent = done > 0 ? "Score: " + correct + " out of " + done : "";
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (checked) return;
    const typed = input.value;
    if (typed.trim() === "") {
      say("What guess are you talking about? Type a number first.", "");
      input.focus();
      return;
    }
    checked = true;
    input.disabled = true;
    checkBtn.disabled = true;
    if (Q.isRight(round, typed)) {
      correct++;
      say("That's correct! It's now " + correct + " out of " + total + ".", "win");
      seqEl.lastChild.textContent = round.answer;
      seqEl.lastChild.removeAttribute("aria-label");
      newBtn.focus();
    } else {
      say("Sorry, that's wrong. It's now " + correct + " out of " + total + ".", "lose");
      hintEl.textContent = "Hint: think “" + round.rule + "”.";
      repeatBtn.disabled = false;
      repeatBtn.focus();
    }
    scoreLine();
  });

  repeatBtn.addEventListener("click", repeat);
  newBtn.addEventListener("click", () => {
    newRound();
    input.focus();
  });

  newRound();
})();
