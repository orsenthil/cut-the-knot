"use strict";

/*
 * The page for Northcott's Game: drawing and input only. The board is a grid of
 * buttons, one per square. You press one of your white checkers, then a
 * highlighted square in its row. The computer answers after a short pause. The
 * rules, the computer's play and the winning move are in northcotts-game-core.js.
 */

(function () {
  const Core = NorthcottCore;
  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const scoreEl = document.getElementById("score");
  const nxIn = document.getElementById("nxIn"), nyIn = document.getElementById("nyIn");
  const newBtn = document.getElementById("newBtn"), hintBtn = document.getElementById("hintBtn");

  let state = null;
  let picked = null;          // the row of the white checker that has been picked up
  let lastMoved = null;       // { row, col } of the checker that just moved
  let timer = null;
  let computerWins = 0, playerWins = 0;
  let announced = false;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    boardEl.textContent = "";
    boardEl.style.gridTemplateColumns = `repeat(${state.nx}, minmax(1.5rem, 1fr))`;
    const over = Core.result(state) !== null;
    const myTurn = state.turn === "white" && !over;
    for (let r = 0; r < state.ny; r++) {
      const targets = picked === r && myTurn ? Core.targets(state, "white", r) : [];
      for (let c = 0; c < state.nx; c++) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "cell" + ((r + c) % 2 ? " dark" : "");
        const isWhite = state.white[r] === c, isBlack = state.black[r] === c;
        const label = `Row ${r + 1}, column ${c + 1}`;
        if (isWhite || isBlack) {
          const chip = document.createElement("span");
          chip.className = "chip " + (isWhite ? "w" : "b");
          b.appendChild(chip);
        }
        if (lastMoved && lastMoved.row === r && lastMoved.col === c) b.classList.add("moved");
        if (isWhite && myTurn && Core.targets(state, "white", r).length) {
          b.classList.add("mine");
          if (picked === r) b.classList.add("picked");
          b.setAttribute("aria-label", `${label}: your white checker. ${picked === r ? "Picked up." : "Press to pick it up."}`);
          b.addEventListener("click", () => { picked = picked === r ? null : r; render(); focusCell(r, c); });
        } else if (targets.includes(c)) {
          b.classList.add("target");
          b.setAttribute("aria-label", `${label}: slide your checker here`);
          b.addEventListener("click", () => playerMove(r, c));
        } else {
          b.setAttribute("aria-label", `${label}: ${isWhite ? "your white checker, it cannot move" : isBlack ? "the computer's black checker" : "empty"}`);
          b.tabIndex = -1;
          b.disabled = !(isWhite || isBlack) ? false : false;
        }
        boardEl.appendChild(b);
      }
    }
    const heaps = Core.gaps(state);
    scoreEl.textContent = `Score: computer ${computerWins}, you ${playerWins}.`;
    hintBtn.disabled = !myTurn;
    if (window.Track) window.Track.state({ ...state, picked, gaps: heaps, nimSum: Core.nimSum(state) });
  }

  function focusCell(r, c) {
    const cell = boardEl.children[r * state.nx + c];
    if (cell) cell.focus();
  }

  function finish() {
    const res = Core.result(state);
    if (!res || announced) return;
    announced = true;
    if (res === "win") { playerWins++; say(`Congratulations! You won! It's now ${computerWins}:${playerWins} (computer:you).`, "win"); }
    else { computerWins++; say(`I won! It's now ${computerWins}:${playerWins} (computer:you).`, "lose"); }
    render();
  }

  function playerMove(r, c) {
    const next = Core.move(state, "white", r, c);
    if (!next) return;
    state = next;
    picked = null;
    lastMoved = { row: r, col: c };
    say("");
    render();
    if (Core.result(state)) { finish(); return; }
    say("The computer is thinking…");
    clearTimeout(timer);
    timer = setTimeout(computerTurn, 450);
  }

  function computerTurn() {
    if (state.turn !== "black" || Core.result(state)) return;
    const mv = Core.computerMove(state);
    const next = Core.move(state, "black", mv.row, mv.to);
    if (!next) return;
    state = next;
    lastMoved = { row: mv.row, col: mv.to };
    say("");
    render();
    if (Core.result(state)) finish();
  }

  function newGame() {
    clearTimeout(timer);
    state = Core.start({ nx: nxIn.value, ny: nyIn.value });
    nxIn.value = String(state.nx);
    nyIn.value = String(state.ny);
    picked = null; lastMoved = null; announced = false;
    say("");
    render();
    if (Core.result(state)) finish();
  }

  hintBtn.addEventListener("click", () => {
    const h = Core.hint(state);
    if (!h) { say("There is no winning move: with every move the computer can set the board right again. Play on and hope it slips."); return; }
    picked = h.row;
    render();
    say(`Try this: slide the white checker in row ${h.row + 1} to column ${h.to + 1}.`);
  });
  newBtn.addEventListener("click", newGame);
  nxIn.addEventListener("change", newGame);
  nyIn.addEventListener("change", newGame);
  newGame();
})();
