"use strict";

/*
 * The page for Euclid's Game (typed numbers): drawing and input only; the rules and
 * the computer are in euclid-alg-core.js. The numbers on the board are shown as
 * chips; you type a number that is a difference of two on the board and press Enter
 * or Put. The computer answers a moment later. "Please start" lets the computer
 * move first.
 */

(function () {
  const Core = EuclidAlgCore;
  const boardEl = document.getElementById("board");
  const form = document.getElementById("form");
  const numIn = document.getElementById("numIn");
  const startBox = document.getElementById("startBox");
  const newBtn = document.getElementById("newBtn");
  const statusEl = document.getElementById("status");
  const infoEl = document.getElementById("info");

  let state = Core.start({ seed: (Date.now() % 100000) + 1 });
  let timer = null;
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    boardEl.textContent = "";
    const fresh = state.computerNumber;
    state.board.forEach((n) => {
      const c = document.createElement("span");
      c.className = "chip" + (n === state.n1 || n === state.n2 ? " given" : "") + (state.board.length > 2 && n === fresh && state.last === "computer" ? " fresh" : "");
      c.textContent = String(n);
      boardEl.appendChild(c);
    });
    boardEl.setAttribute("aria-label", "Numbers on the board: " + state.board.join(", "));
    const over = Core.finished(state);
    numIn.disabled = over || state.turn !== "you";
    startBox.disabled = state.moves > 0 || over;
    startBox.checked = state.started && state.moves > 0 && state.last === "computer" && state.moves === 1 ? true : startBox.checked && state.moves === 0;
    infoEl.textContent = `${state.board.length} of ${state.total} numbers are on the board.`;
    if (window.Track) window.Track.state(state);
  }

  function finishMessage() {
    const r = Core.result(state);
    if (r) say(state.message, r);
    return r;
  }

  function computerTurn() {
    timer = null;
    const t = Core.move(state, { type: "computer" });
    if (!t) return;
    state = t; render();
    if (!finishMessage()) { say(`I put ${state.computerNumber}. Your move: type a number that is a difference of two numbers on the board.`); numIn.focus(); }
  }
  function scheduleComputer() { clearTimeout(timer); timer = setTimeout(computerTurn, reduced ? 0 : 500); }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (state.turn !== "you") return;
    const raw = numIn.value.trim();
    if (!/^\d+$/.test(raw)) { say(raw === "" ? "Type a number first." : "Please check your calculations..."); return; }
    const next = Core.move(state, { type: "put", n: Number(raw) });
    if (!next) return;
    if (next.rejected) { say(next.message); numIn.select(); return; }
    state = next; numIn.value = ""; render();
    if (!finishMessage()) { say("Thinking…"); scheduleComputer(); }
  });

  startBox.addEventListener("change", () => {
    if (!startBox.checked || state.moves > 0) return;
    const t = Core.move(state, { type: "computer" });
    if (!t) return;
    state = t; render();
    if (!finishMessage()) { say(`I put ${state.computerNumber}. Your move.`); numIn.focus(); }
  });

  newBtn.addEventListener("click", () => { clearTimeout(timer); startBox.checked = false; state = Core.move(state, { type: "reset", seed: Date.now() % 100000 + 1 }); numIn.value = ""; render(); say("A new game. Type a number that is the difference of two numbers on the board."); numIn.focus(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && timer) { clearTimeout(timer); computerTurn(); } });

  render();
  say("Type a number that is the difference of two numbers on the board, or tick Please start to let me begin.");
})();
