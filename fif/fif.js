"use strict";

/*
 * The page for the Game of Fif: drawing and input only; the rules and the computer are in
 * fif-core.js. A row of nine numbered squares (or, with the box ticked, the same nine squares
 * laid out as the magic square 4 9 2 / 3 5 7 / 8 1 6): press a number to take it; the computer
 * answers at once. Whoever first holds three numbers that add up to 15 wins.
 */

(function () {
  const Core = FifCore;
  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const scoreEl = document.getElementById("score");
  const firstBox = document.getElementById("firstBox");
  const startBtn = document.getElementById("startBtn");
  const clearBtn = document.getElementById("clearBtn");
  const magicBox = document.getElementById("magicBox");
  const holdEl = document.getElementById("holds");

  let state = Core.start({ seed: (Date.now() % 1000003) + 1 });
  let focusNum = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const MAGIC_ROWS = [[4, 9, 2], [3, 5, 7], [8, 1, 6]];

  function render() {
    boardEl.textContent = "";
    boardEl.classList.toggle("magic", magicBox.checked);
    const order = magicBox.checked ? MAGIC_ROWS.flat() : [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (const n of order) {
      const bit = 1 << Core.bitOf(n);
      const b = document.createElement("button");
      b.type = "button"; b.className = "sq"; b.dataset.n = n;
      const mine = !!(state.black & bit), its = !!(state.white & bit);
      b.classList.toggle("you", mine); b.classList.toggle("it", its);
      b.textContent = mine ? "X" : its ? "O" : String(n);
      b.setAttribute("aria-label", mine ? `Square ${n}: yours (X)` : its ? `Square ${n}: the computer's (O)` : `Square ${n}: free. Press to take it.`);
      b.disabled = (mine || its) && !state.finished ? true : false;
      if (state.first && state.white === 0 && !state.finished) b.disabled = true;
      boardEl.appendChild(b);
    }
    firstBox.checked = state.first;
    startBtn.disabled = !state.first || state.white !== 0;
    scoreEl.textContent = `Computer ${state.whiteWins} : ${state.blackWins} You`;
    holdEl.textContent = `You hold ${Core.numbers(state.black).join(", ") || "nothing"}; the computer holds ${Core.numbers(state.white).join(", ") || "nothing"}.`;
    if (focusNum) { const b = boardEl.querySelector(`button[data-n="${focusNum}"]`); if (b && !b.disabled) b.focus(); else { const f = boardEl.querySelector("button:not(:disabled)"); if (f) f.focus(); } focusNum = null; }
    if (window.Track) window.Track.state(state);
  }

  function describe() {
    const r = Core.status(state);
    if (r !== 0) return state.announce;
    if (state.first && state.white === 0) return "Press Start: the computer opens.";
    return "Your move: take a number.";
  }

  function apply(m) {
    const next = Core.move(state, m);
    if (!next) return false;
    state = next; render();
    say(describe(), Core.result(state));
    return true;
  }

  boardEl.addEventListener("click", (e) => {
    const b = e.target.closest("button.sq"); if (!b || b.disabled) return;
    focusNum = Number(b.dataset.n);
    if (!apply({ type: "click", number: Number(b.dataset.n) })) say(state.first && state.white === 0 ? "Press Start first." : "That square is taken.");
  });
  boardEl.addEventListener("keydown", (e) => {
    const b = e.target.closest("button.sq"); if (!b) return;
    const all = [...boardEl.querySelectorAll("button.sq")], i = all.indexOf(b);
    const cols = magicBox.checked ? 3 : 9;
    let j = i;
    if (e.key === "ArrowRight") j = Math.min(all.length - 1, i + 1);
    else if (e.key === "ArrowLeft") j = Math.max(0, i - 1);
    else if (e.key === "ArrowDown") j = Math.min(all.length - 1, i + (magicBox.checked ? cols : 0));
    else if (e.key === "ArrowUp") j = Math.max(0, i - (magicBox.checked ? cols : 0));
    else if (/^[1-9]$/.test(e.key)) { const t = boardEl.querySelector(`button[data-n="${e.key}"]`); if (t && !t.disabled) { e.preventDefault(); t.click(); } return; }
    else return;
    e.preventDefault(); all[j].focus();
  });
  firstBox.addEventListener("change", () => { apply({ type: "first", value: firstBox.checked }); say(firstBox.checked ? "The computer will open. Press Start." : "You open: take a number."); });
  startBtn.addEventListener("click", () => { if (apply({ type: "start" })) say("The computer opened. Your move."); });
  clearBtn.addEventListener("click", () => { state = Core.move(state, { type: "clear" }); render(); say(state.first ? "Cleared. Press Start." : "Cleared. Your move."); });
  magicBox.addEventListener("change", render);

  render();
  say("Take a number. Three numbers that add up to 15 win.");
})();
