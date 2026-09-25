"use strict";

/*
 * Cool Maths Quiz: an elementary arithmetic quiz inspired by TuxMath, ported
 * from the original coolmaths Python app. Each problem uses numbers from 1 to
 * 20 with +, -, x or ÷.
 * Subtraction never goes negative and division always comes out even,
 * because a division problem is built backwards from a multiplication.
 */

function randInt(lo, hi) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function getRandomProblem() {
  let a = randInt(1, 20);
  let b = randInt(1, 20);
  let answer = 0;
  let op = ["+", "-", "×"][randInt(0, 2)];
  if (op === "+") {
    answer = a + b;
  } else if (op === "-") {
    [a, b] = [Math.max(a, b), Math.min(a, b)];
    answer = a - b;
  } else {
    answer = a * b;
  }
  if ((a + b + randInt(1, 10)) % 2 === 0) {
    op = "÷";
    answer = a;
    a = a * b;
  }
  return { a, b, op, answer };
}

const questionEl = document.getElementById("question");
const inputEl = document.getElementById("answer");
const feedbackEl = document.getElementById("feedback");
const statsEl = document.getElementById("stats");
const keypadEl = document.getElementById("keypad");

let problem = null;
let attempts = 0;
let correct = 0;
let streak = 0;
let best = 0;

function problemText(p) {
  return `${p.a} ${p.op} ${p.b}`;
}

function nextProblem() {
  problem = getRandomProblem();
  questionEl.textContent = problemText(problem);
  inputEl.value = "";
}

function renderStats() {
  statsEl.textContent =
    `Score: ${correct} / ${attempts}` +
    `  ·  Streak: ${streak}` +
    `  ·  Best streak: ${best}`;
}

function check() {
  const data = inputEl.value.trim();
  if (data === "") {
    inputEl.focus();
    return;
  }
  const q = problemText(problem);
  attempts++;
  if (Number(data) === problem.answer) {
    correct++;
    streak++;
    best = Math.max(best, streak);
    feedbackEl.textContent = `Yes. ${q} = ${problem.answer}. You got it! Let's try another one.`;
    feedbackEl.className = "right";
  } else {
    streak = 0;
    feedbackEl.textContent = `Nope. ${q} is not ${data}. It is ${problem.answer}. Keep practicing.`;
    feedbackEl.className = "wrong";
  }
  renderStats();
  nextProblem();
  inputEl.focus();
}

function pressKey(k) {
  if (k === "⌫") {
    inputEl.value = inputEl.value.slice(0, -1);
  } else if (k === "OK") {
    check();
    return;
  } else if (inputEl.value.length < 4) {
    inputEl.value += k;
  }
  inputEl.focus();
}

["7", "8", "9", "4", "5", "6", "1", "2", "3", "⌫", "0", "OK"].forEach((k) => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = k;
  if (k === "OK") btn.className = "primary";
  btn.addEventListener("click", () => pressKey(k));
  keypadEl.appendChild(btn);
});

inputEl.addEventListener("input", () => {
  inputEl.value = inputEl.value.replace(/[^0-9]/g, "").slice(0, 4);
});
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") check();
});

nextProblem();
renderStats();
inputEl.focus();
