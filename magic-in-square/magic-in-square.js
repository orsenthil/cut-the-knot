"use strict";

/*
 * The page for Magic in a Square: drawing and input only. The square is a CSS
 * grid of numbers with one real button under each column. The rules are in
 * magic-in-square-core.js.
 */

(function () {
  const Core = MagicInSquareCore;
  const squareEl = document.getElementById("square");
  const promptEl = document.getElementById("prompt");
  const statusEl = document.getElementById("status");
  const nEl = document.getElementById("n");
  const nOut = document.getElementById("nOut");

  let state = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const n = state.n, v = Core.view(state), found = Core.revealedCell(state), msg = Core.message(state);
    nOut.textContent = n;
    squareEl.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`;
    squareEl.textContent = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const cell = document.createElement("div");
      cell.className = "cell" + (found && found.row === r && found.col === c ? " found" : "");
      cell.textContent = v[r][c];
      squareEl.appendChild(cell);
    }
    for (let c = 0; c < n; c++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pick";
      b.textContent = "▲";
      b.disabled = state.stage === 2;
      b.setAttribute("aria-label", `My number is in column ${c + 1}`);
      b.addEventListener("click", () => play(c));
      squareEl.appendChild(b);
    }
    promptEl.textContent = "";
    promptEl.append(msg.upper);
    if (state.stage === 2) { const big = document.createElement("span"); big.className = "big"; big.textContent = Core.answer(state); promptEl.appendChild(big); promptEl.append(msg.lower); }
    else { promptEl.appendChild(document.createElement("br")); promptEl.append(msg.lower); }
    if (window.Track) window.Track.state(state);
  }

  function play(c) {
    const next = Core.pick(state, c);
    if (!next) return;
    state = next;
    render();
    if (Core.result(state) === "done") say(`Your number is ${Core.answer(state)}. Press Reset to try again.`, "done");
    else say("");
    // keep the keyboard on the same column after the numbers move
    const b = squareEl.querySelectorAll(".pick")[c];
    if (b && !b.disabled) b.focus();
  }

  function newGame() {
    state = Core.start({ n: nEl.value });
    nEl.value = state.n;
    say("");
    render();
  }

  nEl.addEventListener("input", newGame);
  document.getElementById("resetBtn").addEventListener("click", newGame);
  newGame();
})();
