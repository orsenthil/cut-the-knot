"use strict";

/*
 * UI for Four By Four. FourByFourCore (fbf-core.js) owns the board and the
 * AI; this file renders the cube as its four z-layers and wires up the
 * controls. Every cell is a real <button>, so mouse, touch and keyboard all
 * work the same way.
 */
(() => {
  const layersEl = document.getElementById("layers");
  const skillInput = document.getElementById("skillInput");
  const undoBtn = document.getElementById("undoBtn");
  const newGameBtn = document.getElementById("newGameBtn");
  const statusEl = document.getElementById("status");
  const scoreLineEl = document.getElementById("scoreLine");
  const bestScoresEl = document.getElementById("bestScores");
  const bestScoresListEl = document.getElementById("bestScoresList");

  const BEST_KEY = "coolmaths-fourbyfour-best";
  const LEVEL_WEIGHT = 1311;
  const MOVE_WEIGHT = 111;
  const TIME_WEIGHT = 1000;

  let B = FourByFourCore.create();
  let gameOver = false;
  let winningCells = [];
  const cellButtons = []; // 64 buttons, each cell appears in exactly one layer

  function layerLabel(z) {
    return ["Bottom layer", "Layer 2", "Layer 3", "Top layer"][z];
  }

  function buildBoard() {
    layersEl.innerHTML = "";
    cellButtons.length = 0;
    for (let z = 0; z < 4; z++) {
      const wrap = document.createElement("div");
      wrap.className = "layer";
      const h2 = document.createElement("h2");
      h2.textContent = layerLabel(z);
      wrap.appendChild(h2);
      const grid = document.createElement("div");
      grid.className = "layerGrid";
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          const cell = x + 4 * y + 16 * z;
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "cell";
          btn.addEventListener("click", () => onCellClick(cell));
          grid.appendChild(btn);
          cellButtons[cell] = btn;
        }
      }
      wrap.appendChild(grid);
      layersEl.appendChild(wrap);
    }
  }

  function findWinningCells() {
    for (const row of B.combinations) {
      if (row[0] === 4) return [row[2], row[3], row[4], row[5]];
    }
    return [];
  }

  function render() {
    for (let cell = 0; cell < 64; cell++) {
      const btn = cellButtons[cell];
      btn.innerHTML = "";
      btn.classList.remove("winCell");
      const owner = B.occupied[cell];
      const empty = owner === 0;
      btn.disabled = !empty || gameOver;
      if (!empty) {
        const mark = document.createElement("div");
        mark.className = "mark " + (owner === FourByFourCore.HUMAN ? "human" : "machine");
        btn.appendChild(mark);
      }
      if (winningCells.includes(cell)) btn.classList.add("winCell");
      const { x, y, z } = FourByFourCore.xyz(cell);
      const who = owner === 0 ? "empty" : owner === FourByFourCore.HUMAN ? "yours (red)" : "the computer's (blue)";
      btn.setAttribute("aria-label", `Row ${y + 1}, column ${x + 1}, layer ${z + 1}: ${who}.`);
    }
  }

  function onCellClick(cell) {
    if (gameOver || B.occupied[cell] !== 0) return;
    FourByFourCore.selection(B, cell);
    render();
  }

  function loadBest() {
    try {
      const raw = localStorage.getItem(BEST_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveBest(list) {
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify(list));
    } catch (e) {
      // private browsing or storage disabled; the game still works
    }
  }

  function recordScore(score) {
    const list = loadBest();
    list.push(score);
    list.sort((a, b) => b - a);
    list.length = Math.min(list.length, 5);
    saveBest(list);
    renderBest();
  }

  function renderBest() {
    const list = loadBest();
    if (list.length === 0) {
      bestScoresEl.hidden = true;
      return;
    }
    bestScoresEl.hidden = false;
    bestScoresListEl.textContent = list.join(", ");
  }

  function onWin(winner, skillLevel, nmoves, elapsedSeconds) {
    gameOver = true;
    winningCells = findWinningCells();
    if (winner === FourByFourCore.HUMAN) {
      const score = Math.round(
        skillLevel * LEVEL_WEIGHT + (66 - nmoves) * MOVE_WEIGHT - Math.min(elapsedSeconds * TIME_WEIGHT, 5000)
      );
      statusEl.textContent = "You win!";
      statusEl.classList.add("win");
      statusEl.classList.remove("lose");
      scoreLineEl.textContent = `Score: ${score} (skill ${skillLevel}, ${nmoves} moves, ${Math.round(elapsedSeconds)}s)`;
      recordScore(score);
    } else {
      statusEl.textContent = "The computer wins.";
      statusEl.classList.add("lose");
      statusEl.classList.remove("win");
      scoreLineEl.textContent = "";
    }
  }

  function startNewGame() {
    B = FourByFourCore.create();
    FourByFourCore.setSkillLevel(B, Number(skillInput.value));
    B.onWin = onWin;
    gameOver = false;
    winningCells = [];
    statusEl.textContent = "";
    statusEl.classList.remove("win", "lose");
    scoreLineEl.textContent = "";
    render();
  }

  function onUndo() {
    if (gameOver || B.nmoves === 0) return;
    FourByFourCore.undoMove(B);
    render();
  }

  skillInput.addEventListener("change", startNewGame);
  undoBtn.addEventListener("click", onUndo);
  newGameBtn.addEventListener("click", startNewGame);

  buildBoard();
  B.onWin = onWin;
  render();
  renderBest();
})();
