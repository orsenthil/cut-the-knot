"use strict";

/*
 * The Vanishing Digit: the player reverses a 3-digit number, subtracts the
 * smaller from the larger, and reports the first two digits of the result.
 * The result is always 99*k (k = 0..9), whose digits sum to 18 (except 000),
 * so the hidden digit is 18 minus the two reported digits.
 */

const VALID_RESULTS = ["000", "099", "198", "297", "396", "495", "594", "693", "792", "891"];

const stage = document.getElementById("stage");
const statsEl = document.getElementById("stats");
const historyEl = document.getElementById("history");

let attempts = 0;
let correct = 0;
const history = [];

let phase = "input"; // input | guessed | confirmed
let digits = [null, null];
let guess = null;
let wasRight = null;

function isValidPrefix(d1, d2) {
  return VALID_RESULTS.some((r) => r.startsWith("" + d1 + d2));
}

function computeGuess(d1, d2) {
  if (d1 === 0 && d2 === 0) return 0;
  return 18 - (d1 + d2);
}

function pressDigit(d) {
  if (phase !== "input") return;
  const slot = digits[0] === null ? 0 : digits[1] === null ? 1 : -1;
  if (slot === -1) return;
  digits[slot] = d;
  render();
}

function clearSlot(i) {
  if (phase !== "input") return;
  digits[i] = null;
  render();
}

function reveal() {
  if (digits[0] === null || digits[1] === null) return;
  guess = isValidPrefix(digits[0], digits[1]) ? computeGuess(digits[0], digits[1]) : null;
  phase = "guessed";
  render();
}

function confirmAnswer(isRight) {
  wasRight = isRight;
  attempts++;
  if (isRight) correct++;
  history.push({ d1: digits[0], d2: digits[1], guess, right: isRight });
  phase = "confirmed";
  render();
}

function tryAgain() {
  digits = [null, null];
  guess = null;
  wasRight = null;
  phase = "input";
  render();
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, className, onClick) {
  const b = el("button", className, label);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

function renderDigitRow() {
  const row = el("div", "digits");
  digits.forEach((v, i) => {
    if (phase === "input") {
      const tile = button(v === null ? "?" : v, "tile" + (v === null ? " empty" : ""), () => clearSlot(i));
      tile.setAttribute("aria-label", v === null ? `Digit ${i + 1}: empty` : `Digit ${i + 1}: ${v}. Click to clear`);
      row.appendChild(tile);
    } else {
      row.appendChild(el("div", "tile", v));
    }
  });
  if (phase !== "input") {
    const cls = phase === "confirmed" ? (wasRight ? "right" : "wrong") : "guess";
    row.appendChild(el("div", "tile " + cls, guess === null ? "?" : guess));
  }
  return row;
}

function render() {
  stage.innerHTML = "";
  stage.appendChild(renderDigitRow());

  if (phase === "input") {
    stage.appendChild(el("div", "msg small", "Type or tap the first two digits of your answer."));
    const pad = el("div", "keypad");
    for (let d = 0; d <= 9; d++) pad.appendChild(button(d, "", () => pressDigit(d)));
    stage.appendChild(pad);
    const go = button("Guess my digit", "btn", reveal);
    go.disabled = digits[0] === null || digits[1] === null;
    stage.appendChild(go);
  } else if (phase === "guessed") {
    if (guess === null) {
      stage.appendChild(el("div", "msg", "Hmm, that can't be right."));
      stage.appendChild(
        el("div", "msg small", "The answer must be 000, 099, 198, 297, 396, 495, 594, 693, 792 or 891. Check the subtraction.")
      );
      stage.appendChild(button("Try again", "btn", tryAgain));
    } else {
      stage.appendChild(el("div", "msg", `Your missing digit is ${guess}.`));
      stage.appendChild(el("div", "msg small", "Was I right?"));
      const row = el("div", "row");
      row.appendChild(button("Yes", "btn", () => confirmAnswer(true)));
      row.appendChild(button("No", "btn", () => confirmAnswer(false)));
      stage.appendChild(row);
    }
  } else {
    stage.appendChild(
      el(
        "div",
        "msg",
        wasRight ? "Knew it!" : "Huh, that shouldn't happen. Double-check your subtraction."
      )
    );
    stage.appendChild(button("Try another number", "btn", tryAgain));
  }

  statsEl.textContent = `Guesses: ${attempts}   Right: ${correct}`;
  historyEl.innerHTML = "";
  for (const h of history) {
    historyEl.appendChild(el("span", "chip", `${h.d1}${h.d2}? → ${h.guess === null ? "?" : h.guess}${h.right ? " ✓" : " ✗"}`));
  }
}

document.addEventListener("keydown", (evt) => {
  if (evt.ctrlKey || evt.metaKey || evt.altKey) return;
  if (phase === "input") {
    if (/^[0-9]$/.test(evt.key)) {
      pressDigit(parseInt(evt.key, 10));
    } else if (evt.key === "Backspace") {
      const last = digits[1] !== null ? 1 : 0;
      clearSlot(last);
    } else if (evt.key === "Enter" && evt.target.tagName !== "BUTTON" && digits[0] !== null && digits[1] !== null) {
      reveal();
    }
  }
});

render();
