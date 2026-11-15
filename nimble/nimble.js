"use strict";

/*
 * UI for Nimble. The rules and the computer live in nimble-core.js; this file
 * draws the board and handles turns.
 *
 * The board is a row of numbered positions (0 to length-1) drawn as vertical
 * needles. A chip is a button: press it to pick it up, then press one of the
 * positions to its left, which become buttons while a chip is picked up.
 * The applet dragged the chip instead; pressing works the same with a mouse,
 * a finger or the keyboard (Tab, Enter, and Escape to put the chip back).
 *
 * Every position keeps a width a finger can hit, so a long board does not
 * squeeze: it slides sideways inside the play area instead. Chips on the same
 * position stack and overlap; they are interchangeable, so any of them will do.
 *
 * The score is the applet's: it counts the computer's wins and losses and
 * survives New Game and a change of options.
 */
(() => {
  const Core = NimbleCore;

  const scrollEl = document.getElementById("boardScroll");
  const boardEl = scrollEl.querySelector(".board");
  const hintEl = document.getElementById("slideHint");
  const statusEl = document.getElementById("status");
  const scoreEl = document.getElementById("score");
  const lengthInput = document.getElementById("lengthInput");
  const chipsInput = document.getElementById("chipsInput");
  const newBtn = document.getElementById("newBtn");

  const THINK_MS = 600;
  const STACK_STEP = 0.9; // rem between chips stacked on one position
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const YOUR_MOVE = "Your move. Pick a chip.";

  let state = null;
  let selected = null; // chip id currently picked up
  let busy = false;
  let timer = null;
  const score = { you: 0, computer: 0 };

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

  function showScore() {
    scoreEl.textContent = `Score: you ${score.you}, computer ${score.computer}`;
  }

  /* ------------------------------------------------------------ drawing */

  /**
   * Redraws the board. `focus` names what should hold the keyboard focus
   * afterwards ({ chip: id } or { spot: position }), because redrawing
   * replaces the buttons the player was on.
   */
  function render(focus) {
    boardEl.innerHTML = "";
    const len = state.length;
    const canPlay = !state.over && !busy && state.turn === "you";
    const selChip = selected === null ? null : state.chips.find((c) => c.id === selected);

    const stacks = new Array(len).fill(0);
    for (const c of state.chips) stacks[c.pos]++;
    boardEl.style.setProperty("--n", String(len));
    boardEl.style.setProperty("--stack", String(Math.max(...stacks)));

    const cols = [];
    for (let p = 0; p < len; p++) {
      const col = document.createElement("div");
      col.className = "needle-col";

      if (canPlay && selChip && p < selChip.pos) {
        col.classList.add("target");
        const spot = document.createElement("button");
        spot.type = "button";
        spot.className = "spot";
        spot.dataset.pos = String(p);
        spot.setAttribute("aria-label", p === 0 ? "Move the chip home, to position 0" : `Move the chip to position ${p}`);
        spot.addEventListener("click", () => moveChip(p));
        col.appendChild(spot);
      }

      const needle = document.createElement("div");
      needle.className = "needle";
      col.appendChild(needle);

      const label = document.createElement("span");
      label.className = "needle-label";
      label.textContent = String(p);
      col.appendChild(label);

      boardEl.appendChild(col);
      cols.push(col);
    }

    const height = new Array(len).fill(0);
    for (const c of state.chips) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.dataset.id = String(c.id);
      if (c.pos === 0) chip.classList.add("home");
      if (selected === c.id) chip.classList.add("selected");
      chip.style.backgroundColor = CHIP_COLORS[c.id % CHIP_COLORS.length];
      chip.style.bottom = (height[c.pos] * STACK_STEP + 2.2) + "rem";
      chip.setAttribute("aria-label",
        c.pos === 0 ? `Chip ${c.id + 1}, home` : `Chip ${c.id + 1} at position ${c.pos}`);
      chip.setAttribute("aria-pressed", selected === c.id ? "true" : "false");
      if (canPlay && c.pos > 0) chip.addEventListener("click", () => selectChip(c.id));
      else chip.disabled = true;
      height[c.pos]++;
      cols[c.pos].appendChild(chip);
    }

    hintEl.hidden = scrollEl.scrollWidth <= scrollEl.clientWidth + 1;

    if (focus) {
      const el = focus.chip !== undefined
        ? boardEl.querySelector(`.chip[data-id="${focus.chip}"]:not(:disabled)`)
        : boardEl.querySelector(`.spot[data-pos="${focus.spot}"]`);
      if (el) el.focus();
    }

    if (window.Track) window.Track.state(Core.snapshot(state));
  }

  /** Brings a chip into view when the board is wider than the play area. */
  function reveal(chipId) {
    const el = boardEl.querySelector(`.chip[data-id="${chipId}"]`);
    if (el) el.scrollIntoView({ block: "nearest", inline: "center" });
  }

  function selectChip(id) {
    if (busy || state.over) return;
    selected = selected === id ? null : id;
    render({ chip: id });
    say(selected !== null ? "Now pick a position to its left." : YOUR_MOVE, "");
  }

  function moveChip(dest) {
    if (busy || state.over || selected === null) return;
    const moved = selected;
    const res = Core.playerMove(state, selected, dest);
    selected = null;
    if (res === "illegal") {
      say("You can only move a chip to the left!", "");
      render({ chip: moved });
      return;
    }
    if (res !== "ok") return;

    if (state.over) {
      score.you++;
      showScore();
      say("Congratulations! You won!", "win");
      render();
      newBtn.focus();
      return;
    }

    busy = true;
    say("Thinking…", "");
    render();

    timer = window.setTimeout(() => {
      timer = null;
      const reply = Core.computerMove(state);
      busy = false;
      if (state.over) {
        score.computer++;
        showScore();
        say("I won!", "lose");
        render();
        newBtn.focus();
        return;
      }
      say(`I moved a chip from ${reply.from} to ${reply.dest}. ` + YOUR_MOVE, "");
      // Redrawing dropped the focus; give it back to a chip the player can use.
      const next = state.chips.find((c) => c.id === moved && c.pos > 0) || state.chips.find((c) => c.pos > 0);
      render(document.activeElement === document.body && next ? { chip: next.id } : undefined);
      reveal(reply.chipId);
    }, reduceMotion.matches ? 120 : THINK_MS);
  }

  /* ----------------------------------------------------------- controls */

  function newGame() {
    if (timer) window.clearTimeout(timer);
    timer = null;
    busy = false;
    selected = null;
    state = Core.start(Number(lengthInput.value), Number(chipsInput.value));
    say(YOUR_MOVE, "");
    render();
    scrollEl.scrollLeft = 0;
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

  boardEl.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && selected !== null) {
      const id = selected;
      selected = null;
      render({ chip: id });
      say(YOUR_MOVE, "");
    }
  });

  window.addEventListener("resize", () => {
    hintEl.hidden = scrollEl.scrollWidth <= scrollEl.clientWidth + 1;
  });

  showScore();
  newGame();
})();
