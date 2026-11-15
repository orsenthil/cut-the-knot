"use strict";

/*
 * UI for Nimble. The rules and the computer live in nimble-core.js; this file
 * draws the board and handles turns.
 *
 * The board is a row of numbered positions (0 to length-1) drawn as vertical
 * needles. Chips sit on the needles and can be clicked to select, then click
 * a needle to the left to move there. On phones, tapping works the same way.
 */
(() => {
  const Core = NimbleCore;

  const stageEl = document.getElementById("stage");
  const statusEl = document.getElementById("status");
  const lengthInput = document.getElementById("lengthInput");
  const chipsInput = document.getElementById("chipsInput");
  const newBtn = document.getElementById("newBtn");

  const THINK_MS = 600;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let state = null;
  let selected = null; // chip id currently selected
  let busy = false;
  let timer = null;

  /* chip colours: distinct, readable on both light and dark backgrounds */
  const CHIP_COLORS = [
    "#e25c5c", "#4ea6e2", "#4ec26a", "#e2a64e",
    "#9b6ed6", "#d64ea0", "#4ecec4", "#c4a630",
    "#e26e3a", "#3a8ae2", "#6bc44e", "#d64ed6",
  ];

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* ------------------------------------------------------------ drawing */

  function render() {
    stageEl.querySelector(".board").innerHTML = "";
    const board = stageEl.querySelector(".board");

    const len = state.length;

    // Count chips at each position for stacking
    const stacks = new Array(len).fill(0);
    for (const c of state.chips) stacks[c.pos]++;

    // Build needles
    for (let p = 0; p < len; p++) {
      const col = document.createElement("div");
      col.className = "needle-col";
      if (!state.over && !busy && selected !== null) {
        const selChip = state.chips.find((c) => c.id === selected);
        if (selChip && p < selChip.pos) {
          col.classList.add("target");
          col.addEventListener("click", () => moveChip(p));
        }
      }

      const needle = document.createElement("div");
      needle.className = "needle";
      col.appendChild(needle);

      // Label
      const label = document.createElement("span");
      label.className = "needle-label";
      label.textContent = String(p);
      col.appendChild(label);

      board.appendChild(col);
    }

    // Place chips on their needles
    const posCount = new Array(len).fill(0);
    const sortedChips = state.chips.slice().sort((a, b) => a.id - b.id);
    for (const c of sortedChips) {
      const col = board.children[c.pos];
      if (!col) continue;
      const chip = document.createElement("button");
      chip.className = "chip";
      if (c.pos === 0) chip.classList.add("home");
      if (selected === c.id) chip.classList.add("selected");
      chip.style.backgroundColor = CHIP_COLORS[c.id % CHIP_COLORS.length];
      chip.style.bottom = (posCount[c.pos] * 1.6 + 2.2) + "rem";
      chip.setAttribute("aria-label",
        c.pos === 0 ? `Chip ${c.id + 1} (home)` : `Chip ${c.id + 1} at position ${c.pos}`
      );
      if (!state.over && !busy && c.pos > 0 && state.turn === "you") {
        chip.addEventListener("click", (e) => {
          e.stopPropagation();
          selectChip(c.id);
        });
      } else {
        chip.disabled = true;
      }
      posCount[c.pos]++;
      col.appendChild(chip);
    }

    if (window.Track) window.Track.state({ chips: state.chips.map((c) => c.pos), turn: state.turn });
  }

  function selectChip(id) {
    if (busy || state.over) return;
    selected = selected === id ? null : id;
    render();
    if (selected !== null) {
      say("Now click a position to the left to move the chip there.", "");
    } else {
      say("Your move. Click a chip to select it.", "");
    }
  }

  function moveChip(dest) {
    if (busy || state.over || selected === null) return;
    const res = Core.playerMove(state, selected, dest);
    selected = null;
    if (res === "illegal") {
      say("You can only move a chip to the left!", "");
      render();
      return;
    }
    if (res !== "ok") return;

    if (state.over) {
      say("Congratulations! You won!", "win");
      render();
      return;
    }

    busy = true;
    say("Thinking…", "");
    render();

    timer = window.setTimeout(() => {
      timer = null;
      Core.computerMove(state);
      busy = false;
      if (state.over) {
        say("I won!", "lose");
      } else {
        say("Your move. Click a chip to select it.", "");
      }
      render();
    }, reduceMotion.matches ? 120 : THINK_MS);
  }

  /* ----------------------------------------------------------- controls */

  function newGame() {
    if (timer) window.clearTimeout(timer);
    timer = null;
    busy = false;
    selected = null;
    const len = Number(lengthInput.value);
    const chips = Number(chipsInput.value);
    state = Core.start(len, chips);
    say("Your move. Click a chip to select it.", "");
    render();
  }

  function fill(select, from, to, value) {
    for (let n = from; n <= to; n++) {
      const opt = document.createElement("option");
      opt.value = String(n);
      opt.textContent = String(n);
      if (n === value) opt.selected = true;
      select.appendChild(opt);
    }
  }

  fill(lengthInput, Core.MIN_LENGTH, Core.MAX_LENGTH, Core.DEFAULT_LENGTH);
  fill(chipsInput, Core.MIN_CHIPS, Core.MAX_CHIPS, Core.DEFAULT_CHIPS);
  lengthInput.addEventListener("change", newGame);
  chipsInput.addEventListener("change", newGame);
  newBtn.addEventListener("click", newGame);

  window.addEventListener("themechange", () => render());

  newGame();
})();
