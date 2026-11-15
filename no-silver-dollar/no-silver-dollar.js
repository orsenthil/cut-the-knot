"use strict";

/*
 * UI for No Silver Dollar. The rules and the computer live in
 * no-silver-dollar-core.js; this file draws the board and handles turns.
 *
 * The board is a row of numbered squares. Every square is a button: press a
 * counter to pick it up, then press one of the lit squares to its left. The
 * applet dragged the counter instead; pressing works the same with a mouse, a
 * finger or the keyboard (Tab, Enter, and Escape to put the counter back).
 *
 * Both players move the same counters, so after the computer has moved the
 * page says which one, and marks the counter and the square it came from.
 *
 * Every square keeps a width a finger can hit, so a long board does not
 * squeeze: it slides sideways inside the play area instead.
 *
 * The score is the applet's: it survives New Game and a change of options.
 */
(() => {
  const C = NoSilverDollarCore;

  const scrollEl = document.getElementById("boardScroll");
  const boardEl = scrollEl.querySelector(".board");
  const hintEl = document.getElementById("slideHint");
  const statusEl = document.getElementById("status");
  const scoreEl = document.getElementById("score");
  const lengthInput = document.getElementById("lengthInput");
  const chipsInput = document.getElementById("chipsInput");
  const setupInput = document.getElementById("setupInput");
  const newBtn = document.getElementById("newBtn");

  const THINK_MS = 600;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const YOUR_MOVE = "Your move. Pick a counter.";
  const SETTING_UP = "Setting up: pick a counter, then any empty square. Untick Set up to play.";

  let state = null;
  let selected = null; // index of the counter picked up
  let last = null;     // the computer's last move, { from, to }
  let busy = false;
  let timer = null;
  const score = { you: 0, computer: 0 };

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function showScore() {
    scoreEl.textContent = `Score: you ${score.you}, computer ${score.computer}`;
  }

  function showHint() {
    hintEl.hidden = scrollEl.scrollWidth <= scrollEl.clientWidth + 1;
  }

  /** The squares the picked-up counter may go to. */
  function targets() {
    if (selected === null) return [];
    if (setupInput.checked) {
      const out = [];
      for (let p = 0; p < state.length; p++) if (!state.positions.includes(p)) out.push(p);
      return out;
    }
    return C.legalMoves(state).filter((m) => m.chip === selected).map((m) => m.to);
  }

  /* ------------------------------------------------------------ drawing */

  /**
   * Redraws the board. `focus` is the square that should hold the keyboard
   * focus afterwards, because redrawing replaces the button the player was on.
   */
  function render(focus) {
    const setup = setupInput.checked;
    const canPlay = setup || (!state.over && !busy && state.turn === "you");
    const movable = new Set(C.legalMoves(state).map((m) => m.chip));
    const open = new Set(canPlay ? targets() : []);

    boardEl.replaceChildren();
    boardEl.style.setProperty("--n", String(state.length));

    for (let p = 0; p < state.length; p++) {
      const col = document.createElement("div");
      col.className = "col";
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.pos = String(p);

      const index = state.positions.indexOf(p);
      if (index >= 0) {
        cell.classList.add("counter");
        const disc = document.createElement("span");
        disc.className = "disc";
        cell.append(disc);
        const moved = last && last.to === p;
        if (moved) cell.classList.add("arrived");
        if (selected === index) cell.classList.add("selected");
        cell.setAttribute("aria-label", `Counter on square ${p}${moved ? ", just moved by the computer" : ""}`);
        cell.setAttribute("aria-pressed", selected === index ? "true" : "false");
        if (canPlay && (setup || movable.has(index))) cell.addEventListener("click", () => pick(index));
        else cell.disabled = true;
      } else {
        if (last && last.from === p) cell.classList.add("left");
        if (open.has(p)) {
          cell.classList.add("target");
          cell.setAttribute("aria-label", `Move the counter to square ${p}`);
          cell.addEventListener("click", () => drop(p));
        } else {
          cell.setAttribute("aria-label", `Empty square ${p}`);
          cell.disabled = true;
        }
      }

      const label = document.createElement("span");
      label.className = "col-label";
      label.textContent = String(p);
      col.append(cell, label);
      boardEl.append(col);
    }

    showHint();
    if (focus !== undefined) {
      const el = boardEl.querySelector(`.cell[data-pos="${focus}"]:not(:disabled)`) ||
        boardEl.querySelector(".cell.counter:not(:disabled)");
      if (el) el.focus();
    }
    if (window.Track) window.Track.state(C.snapshot(state));
  }

  /** Brings a square into view when the board is wider than the play area. */
  function reveal(p) {
    const el = boardEl.querySelector(`.cell[data-pos="${p}"]`);
    if (el) el.scrollIntoView({ block: "nearest", inline: "center" });
  }

  /* -------------------------------------------------------------- turns */

  function idleText() { return setupInput.checked ? SETTING_UP : YOUR_MOVE; }

  /** Pick a counter up, put it back, or swap to another one. */
  function pick(index) {
    if (busy) return;
    selected = selected === index ? null : index;
    if (selected === null) say(idleText(), "");
    else say(setupInput.checked ? "Now pick any empty square." : "Now pick an empty square to its left.", "");
    render(state.positions[index]);
  }

  function drop(to) {
    if (busy || selected === null) return;
    const chip = selected;
    selected = null;

    if (setupInput.checked) {
      const next = C.setupMove(state, chip, to);
      if (next) state = next;
      say(SETTING_UP, "");
      render(to);
      return;
    }

    const next = C.move(state, { chip, to });
    if (!next) {
      say("A counter can only move left, onto an empty square it can reach.", "");
      render(state.positions[chip]);
      return;
    }
    state = next;
    last = null;

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
      busy = false;
      // Counters never pass each other, so the one that moved keeps its index.
      const before = state.positions;
      state = C.computerMove(state);
      const i = before.findIndex((p, k) => p !== state.positions[k]);
      const reply = { from: before[i], to: state.positions[i] };
      last = reply;
      if (state.over) {
        score.computer++;
        showScore();
        say(`I moved a counter from ${reply.from} to ${reply.to}. I won!`, "lose");
        render();
        reveal(reply.to);
        newBtn.focus();
        return;
      }
      say(`I moved a counter from ${reply.from} to ${reply.to}. ` + YOUR_MOVE, "");
      // Redrawing dropped the focus; give it back to a counter the player can use.
      render(document.activeElement === document.body ? to : undefined);
      reveal(reply.to);
    }, reduceMotion.matches ? 120 : THINK_MS);
  }

  /* ----------------------------------------------------------- controls */

  function stopThinking() {
    if (timer) window.clearTimeout(timer);
    timer = null;
    busy = false;
  }

  function newGame() {
    stopThinking();
    selected = null;
    last = null;
    state = C.start({ length: Number(lengthInput.value), chips: Number(chipsInput.value) });
    say(idleText(), "");
    render();
    scrollEl.scrollLeft = 0;
  }

  function fill(select, from, to, value) {
    select.replaceChildren();
    for (let n = from; n <= to; n++) {
      const opt = document.createElement("option");
      opt.value = String(n);
      opt.textContent = String(n);
      if (n === value) opt.selected = true;
      select.append(opt);
    }
  }

  /** The counters on offer depend on the length: at most three fewer. */
  function fillChips(value) {
    const max = C.maxChips(Number(lengthInput.value));
    fill(chipsInput, C.MIN_CHIPS, max, Math.min(value, max));
  }

  fill(lengthInput, C.MIN_LENGTH, C.MAX_LENGTH, C.DEFAULT_LENGTH);
  fillChips(C.DEFAULT_CHIPS);
  lengthInput.addEventListener("change", () => { fillChips(Number(chipsInput.value)); newGame(); });
  chipsInput.addEventListener("change", newGame);
  newBtn.addEventListener("click", newGame);

  setupInput.addEventListener("change", () => {
    stopThinking();
    selected = null;
    last = null;
    // Play goes on from the board as arranged, with the player to move.
    state = { ...state, turn: "you", over: false, winner: null, moves: 0 };
    if (setupInput.checked) say(SETTING_UP, "");
    else if (!C.legalMoves(state).length) say("No counter can move from here. Set up again, or press New Game.", "");
    else say(YOUR_MOVE, "");
    render();
  });

  boardEl.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && selected !== null) {
      const p = state.positions[selected];
      selected = null;
      say(idleText(), "");
      render(p);
    }
  });

  window.addEventListener("resize", showHint);

  showScore();
  newGame();
})();
