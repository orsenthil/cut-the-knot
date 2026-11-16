"use strict";

/*
 * UI for Plainim. The board is a rows×cols grid of cell buttons; click to
 * toggle a pending selection in one row, then Make move. The computer's reply
 * flashes the cells it changed. Arrow keys move a focus cursor on the grid;
 * Space or Enter toggles the focused cell.
 */

(function () {
  const Core = PlainimCore;
  const boardEl = document.getElementById("board");
  const bitHintEl = document.getElementById("bitHint");
  const statusEl = document.getElementById("status");
  const scoreEl = document.getElementById("score");
  const colsInput = document.getElementById("colsInput");
  const rowsInput = document.getElementById("rowsInput");
  const misereInput = document.getElementById("misereInput");
  const moveBtn = document.getElementById("moveBtn");
  const newBtn = document.getElementById("newBtn");

  const THINK_MS = 550;
  const FLASH_MS = 700;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let state = null;
  let busy = false;
  let focusCell = { row: 0, col: 0 };
  let flash = null; // { row, mask } while showing the computer's reply
  let timer = null;
  const score = { wins: 0, losses: 0 };

  for (let c = Core.MIN_COLS; c <= Core.MAX_COLS; c++) {
    const o = document.createElement("option");
    o.value = String(c);
    o.textContent = String(c);
    colsInput.appendChild(o);
  }
  for (let r = Core.MIN_ROWS; r <= Core.MAX_ROWS; r++) {
    const o = document.createElement("option");
    o.value = String(r);
    o.textContent = String(r);
    rowsInput.appendChild(o);
  }
  colsInput.value = String(Core.DEFAULT_COLS);
  rowsInput.value = String(Core.DEFAULT_ROWS);

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function showScore() {
    scoreEl.textContent = "Score (computer wins:losses): " + score.wins + ":" + score.losses;
  }

  function optionsFromControls() {
    return {
      cols: Number(colsInput.value),
      rows: Number(rowsInput.value),
      misere: misereInput.checked,
      wins: score.wins,
      losses: score.losses,
    };
  }

  function renderBitHint() {
    bitHintEl.innerHTML = "";
    bitHintEl.style.setProperty("--cols", String(state.cols));
    for (let col = 0; col < state.cols; col++) {
      const span = document.createElement("span");
      span.textContent = String(Core.bitForCol(state.cols, col));
      bitHintEl.appendChild(span);
    }
  }

  function render() {
    boardEl.innerHTML = "";
    boardEl.style.setProperty("--cols", String(state.cols));
    boardEl.style.setProperty("--rows", String(state.rows));
    boardEl.setAttribute("aria-rowcount", String(state.rows));
    boardEl.setAttribute("aria-colcount", String(state.cols));
    renderBitHint();

    const canPlay = !state.over && !busy && state.turn === "you";
    for (let row = 0; row < state.rows; row++) {
      for (let col = 0; col < state.cols; col++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cell";
        btn.dataset.row = String(row);
        btn.dataset.col = String(col);
        btn.setAttribute("role", "gridcell");
        btn.setAttribute("aria-rowindex", String(row + 1));
        btn.setAttribute("aria-colindex", String(col + 1));
        if ((row + col) % 2 === 1) btn.classList.add("dark");

        const has = Core.cellHasChip(state, row, col);
        const pending = Core.cellSelected(state, row, col);
        if (has) {
          btn.classList.add("has-chip");
          const chip = document.createElement("span");
          chip.className = "chip";
          chip.setAttribute("aria-hidden", "true");
          btn.appendChild(chip);
        }
        if (pending) btn.classList.add("pending");

        if (flash && flash.row === row && (flash.mask & Core.bitForCol(state.cols, col))) {
          btn.classList.add("computer-flash");
        }

        const label =
          "Row " + (row + 1) + ", column " + (col + 1) +
          (has ? ", chip" : ", empty") +
          (pending ? ", selected" : "");
        btn.setAttribute("aria-label", label);
        btn.disabled = !canPlay;
        btn.tabIndex = focusCell.row === row && focusCell.col === col ? 0 : -1;
        btn.addEventListener("click", () => onToggle(row, col));
        btn.addEventListener("keydown", onCellKey);
        boardEl.appendChild(btn);
      }
    }

    moveBtn.disabled = !(canPlay && Core.isLegalSelection(state));
    showScore();

    if (window.Track) window.Track.state(Core.snapshot(state));
  }

  function focusButton() {
    const btn = boardEl.querySelector(
      '.cell[data-row="' + focusCell.row + '"][data-col="' + focusCell.col + '"]',
    );
    if (btn) btn.focus();
  }

  function onToggle(row, col) {
    if (busy || state.over || state.turn !== "you") return;
    focusCell = { row, col };
    state = Core.toggle(state, row, col);
    if (state.announce) say(state.announce);
    else say("Your move. Select cells in one row, then Make move.");
    render();
    focusButton();
  }

  function onCellKey(ev) {
    const row = Number(ev.currentTarget.dataset.row);
    const col = Number(ev.currentTarget.dataset.col);
    let nr = row;
    let nc = col;
    if (ev.key === "ArrowLeft") nc = Math.max(0, col - 1);
    else if (ev.key === "ArrowRight") nc = Math.min(state.cols - 1, col + 1);
    else if (ev.key === "ArrowUp") nr = Math.max(0, row - 1);
    else if (ev.key === "ArrowDown") nr = Math.min(state.rows - 1, row + 1);
    else if (ev.key === " " || ev.key === "Enter") {
      ev.preventDefault();
      onToggle(row, col);
      return;
    } else return;
    ev.preventDefault();
    focusCell = { row: nr, col: nc };
    render();
    focusButton();
  }

  function endIfOver(s) {
    if (!s.over) return false;
    score.wins = s.wins;
    score.losses = s.losses;
    showScore();
    const kind = Core.result(s);
    say(s.announce || (kind === "win" ? "You won!" : "I won!"), kind);
    return true;
  }

  function afterHuman() {
    if (endIfOver(state)) {
      render();
      return;
    }
    busy = true;
    say("Thinking…");
    render();
    const wait = reduceMotion.matches ? 0 : THINK_MS;
    timer = setTimeout(() => {
      const before = state.heaps.slice();
      const pick = Core.chooseComputerMove(state);
      const next = Core.computerMove(state);
      if (!next) {
        busy = false;
        say("Your move.");
        render();
        return;
      }
      flash = pick;
      state = next;
      busy = false;
      if (endIfOver(state)) {
        render();
        setTimeout(() => {
          flash = null;
          render();
        }, reduceMotion.matches ? 0 : FLASH_MS);
        return;
      }
      // Describe the computer's reply in words.
      const changed = [];
      for (let col = 0; col < state.cols; col++) {
        const bit = Core.bitForCol(state.cols, col);
        if (pick.mask & bit) {
          const had = (before[pick.row] & bit) !== 0;
          changed.push(had ? "removed a chip in column " + (col + 1) : "added a chip in column " + (col + 1));
        }
      }
      say("Computer on row " + (pick.row + 1) + ": " + changed.join("; ") + ". Your move.");
      render();
      focusButton();
      setTimeout(() => {
        flash = null;
        render();
        focusButton();
      }, reduceMotion.matches ? 0 : FLASH_MS);
    }, wait);
  }

  function doMakeMove() {
    if (busy || state.over || state.turn !== "you") return;
    const res = Core.makeMove(state);
    state = res.state;
    if (!res.ok) {
      say(state.announce || "You can't do that!");
      render();
      return;
    }
    afterHuman();
  }

  function newGame() {
    if (timer) clearTimeout(timer);
    busy = false;
    flash = null;
    state = Core.start(optionsFromControls());
    focusCell = { row: 0, col: 0 };
    say("Your move. Select cells in one row, then Make move.");
    render();
  }

  moveBtn.addEventListener("click", doMakeMove);
  newBtn.addEventListener("click", newGame);
  colsInput.addEventListener("change", newGame);
  rowsInput.addEventListener("change", newGame);
  misereInput.addEventListener("change", newGame);

  newGame();
})();
