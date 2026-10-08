"use strict";

/*
 * UI for Four Knights. KnightsCore (knights-core.js) owns the board/ring
 * mapping and move legality; this file renders both views from one shared
 * state and handles select-then-move (real <button>s throughout, so mouse,
 * touch and keyboard all work the same way).
 */
(() => {
  const chessBoardEl = document.getElementById("chessBoard");
  const ringBoardEl = document.getElementById("ringBoard");
  const resetBtn = document.getElementById("resetBtn");
  const hintInput = document.getElementById("hintInput");
  const statusEl = document.getElementById("status");
  const moveNumEl = document.getElementById("moveNum");

  let state = KnightsCore.start();
  let selected = null;

  const cellRefs = {}; // ring -> { chess: button, ring: button }

  function buildBoards() {
    chessBoardEl.innerHTML = "";
    ringBoardEl.innerHTML = "";

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const ring = KnightsCore.ringAt(row, col);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cell " + ((row + col) % 2 === 0 ? "light" : "dark");
        if (ring === null) {
          btn.classList.add("center");
          btn.disabled = true;
          btn.setAttribute("aria-label", "Centre square: a knight can never reach this square.");
        } else {
          btn.dataset.ring = String(ring);
          btn.addEventListener("click", () => onCellClick(ring));
          const label = document.createElement("div");
          label.className = "ringLabel";
          label.textContent = String(ring);
          btn.appendChild(label);
          cellRefs[ring] = cellRefs[ring] || {};
          cellRefs[ring].chess = btn;
        }
        chessBoardEl.appendChild(btn);
      }
    }

    const radius = 85;
    const center = 110;
    for (let ring = 1; ring <= 8; ring++) {
      const angle = ((ring - 1) * 45 - 90) * (Math.PI / 180);
      const x = center + radius * Math.cos(angle);
      const y = center + radius * Math.sin(angle);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cell";
      btn.style.left = x + "px";
      btn.style.top = y + "px";
      btn.dataset.ring = String(ring);
      btn.addEventListener("click", () => onCellClick(ring));
      const label = document.createElement("div");
      label.className = "ringLabel";
      label.textContent = String(ring);
      btn.appendChild(label);
      ringBoardEl.appendChild(btn);
      cellRefs[ring].ring = btn;
    }
  }

  function describeCell(ring) {
    const occ = state.occupied[ring];
    if (!occ) return `Square ${ring}: empty`;
    return `Square ${ring}: ${occ} knight`;
  }

  function render() {
    const legal = selected ? KnightsCore.legalMoves(state, selected) : [];
    for (let ring = 1; ring <= 8; ring++) {
      const occ = state.occupied[ring];
      for (const btn of [cellRefs[ring].chess, cellRefs[ring].ring]) {
        const existingKnight = btn.querySelector(".knight");
        if (existingKnight) existingKnight.remove();
        if (occ) {
          const piece = document.createElement("div");
          piece.className = "knight " + occ;
          piece.textContent = "♞"; // chess knight glyph
          btn.appendChild(piece);
        }
        btn.classList.toggle("selected", ring === selected);
        btn.classList.toggle("selectable", legal.includes(ring));
        btn.querySelector(".ringLabel").style.visibility = hintInput.checked ? "visible" : "hidden";

        let label = describeCell(ring);
        if (ring === selected) label += ", selected";
        else if (legal.includes(ring)) label += ", press to move the selected knight here";
        else if (occ) label += ", press to select";
        btn.setAttribute("aria-label", label);
      }
    }
    moveNumEl.textContent = String(state.moves);
  }

  function onCellClick(ring) {
    const occ = state.occupied[ring];
    if (selected !== null && KnightsCore.legalMoves(state, selected).includes(ring)) {
      state = KnightsCore.move(state, selected, ring);
      selected = null;
      render();
      if (KnightsCore.isSolved(state)) {
        statusEl.textContent = `Solved in ${state.moves} moves! Red and blue have swapped sides.`;
        statusEl.classList.add("win");
      }
      return;
    }
    if (occ) {
      selected = selected === ring ? null : ring;
    } else {
      selected = null;
    }
    render();
  }

  function onReset() {
    state = KnightsCore.start();
    selected = null;
    statusEl.textContent = "";
    statusEl.classList.remove("win");
    render();
  }

  resetBtn.addEventListener("click", onReset);
  hintInput.addEventListener("change", render);

  buildBoards();
  render();
})();
