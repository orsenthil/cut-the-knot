"use strict";

/*
 * UI for Odd Scoring. The rules and the computer live in odd-scoring-core.js;
 * this file draws the band and handles turns.
 *
 * The band is a row of cells with the chip on one of them. On your turn the
 * one, two or three cells to the chip's left are buttons: press one to move
 * the chip there. The applet dragged the chip instead; pressing works the
 * same with a mouse, a finger or the keyboard (Tab and Enter, or the keys 1,
 * 2 and 3 while the band has the focus).
 *
 * Under the band is a running count of the steps each player has made, since
 * that count decides the winner. The applet kept it out of sight.
 *
 * Every cell keeps a width a finger can hit, so a long band does not squeeze:
 * it slides sideways inside the play area instead.
 */
(() => {
  const C = OddScoringCore;

  const scrollEl = document.getElementById("boardScroll");
  const boardEl = scrollEl.querySelector(".board");
  const slideEl = document.getElementById("slideHint");
  const tallyEl = document.getElementById("tally");
  const statusEl = document.getElementById("status");
  const scoreEl = document.getElementById("score");
  const stepsInput = document.getElementById("stepsInput");
  const hintInput = document.getElementById("hintInput");
  const newBtn = document.getElementById("newBtn");

  const THINK_MS = 600;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const YOUR_MOVE = "Your move. Pick a cell up to 3 steps to the left.";

  let state = null;
  let cameFrom = null; // the cell the computer's last move left
  let busy = false;
  let timer = null;
  const score = { you: 0, computer: 0 };

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const steps = (n) => `${n} ${n === 1 ? "step" : "steps"}`;

  function showScore() {
    scoreEl.textContent = `Score: you ${score.you}, computer ${score.computer}`;
  }

  function showSlide() {
    slideEl.hidden = scrollEl.scrollWidth <= scrollEl.clientWidth + 1;
  }

  /** The applet's four hints: what is written under each cell. */
  function hintFor(cell) {
    const cells = state.steps + 1;
    switch (hintInput.value) {
      case "forward": return String(cells - (cell + 1)); // steps from the start
      case "backward": return String(cell + 1);          // cells from the left
      case "modular": return cell > 0 && cell % (C.MAX_MOVE + 1) === 0 ? "•" : "";
      default: return "";
    }
  }

  /* ------------------------------------------------------------ drawing */

  /** Redraws the band; with `focus`, the nearest cell to press gets the focus. */
  function render(focus) {
    const canPlay = !state.over && !busy && state.turn === "you";
    boardEl.replaceChildren();
    boardEl.style.setProperty("--n", String(state.steps + 1));

    for (let cell = 0; cell <= state.steps; cell++) {
      const col = document.createElement("div");
      col.className = "col";
      const d = state.left - cell;
      let box;
      if (canPlay && d >= 1 && d <= C.MAX_MOVE) {
        box = document.createElement("button");
        box.type = "button";
        box.className = "cell target";
        box.dataset.step = String(d);
        box.setAttribute("aria-label", `Move the chip ${steps(d)} left${cell === 0 ? ", to the last cell" : ""}`);
        box.addEventListener("click", () => play(d));
      } else {
        box = document.createElement("div");
        box.className = "cell";
      }
      if (cell === 0) box.classList.add("goal");
      if (cell === cameFrom) box.classList.add("left");
      if (cell === state.left) {
        box.classList.add("chip");
        const disc = document.createElement("span");
        disc.className = "disc";
        box.append(disc);
      }
      const label = document.createElement("span");
      label.className = "col-label";
      label.textContent = hintFor(cell);
      col.append(box, label);
      boardEl.append(col);
    }
    boardEl.setAttribute("aria-label",
      `The band: the chip has ${steps(state.left)} to go to reach the last cell on the left`);

    tallyEl.textContent = `Steps so far: you ${state.you}, computer ${state.computer}. Left to go: ${state.left}.`;
    showSlide();
    const chip = boardEl.querySelector(".chip");
    if (chip && !slideEl.hidden) chip.scrollIntoView({ block: "nearest", inline: "center" });
    if (focus) {
      const el = boardEl.querySelector('.target[data-step="1"]');
      if (el) el.focus();
    }
    if (window.Track) window.Track.state(C.snapshot(state));
  }

  /* -------------------------------------------------------------- turns */

  function finish(prefix) {
    const tally = `You made ${steps(state.you)} and I made ${steps(state.computer)}.`;
    if (state.winner === "you") {
      score.you++;
      say(`${prefix}Congratulations! You won! ${tally}`, "win");
    } else {
      score.computer++;
      say(`${prefix}I won! ${tally}`, "lose");
    }
    showScore();
    render();
    newBtn.focus();
  }

  function play(d) {
    if (busy) return;
    const next = C.move(state, d);
    if (!next) return;
    const hadFocus = boardEl.contains(document.activeElement);
    state = next;
    cameFrom = null;
    if (state.over) { finish(""); return; }

    busy = true;
    say("Thinking…", "");
    render();

    timer = window.setTimeout(() => {
      timer = null;
      busy = false;
      const before = state.left;
      state = C.computerMove(state);
      cameFrom = before;
      const moved = `I moved the chip ${steps(before - state.left)}. `;
      if (state.over) { finish(moved); return; }
      say(moved + YOUR_MOVE, "");
      // Redrawing dropped the focus; give it back to a cell the player can press.
      render(hadFocus || document.activeElement === document.body);
    }, reduceMotion.matches ? 120 : THINK_MS);
  }

  /* ----------------------------------------------------------- controls */

  function newGame() {
    if (timer) window.clearTimeout(timer);
    timer = null;
    busy = false;
    cameFrom = null;
    state = C.start({ steps: Number(stepsInput.value) });
    say(YOUR_MOVE, "");
    render();
    scrollEl.scrollLeft = scrollEl.scrollWidth;
  }

  for (let n = C.MIN_STEPS; n <= C.MAX_STEPS; n += 2) {
    const opt = document.createElement("option");
    opt.value = String(n);
    opt.textContent = String(n);
    if (n === C.DEFAULT_STEPS) opt.selected = true;
    stepsInput.append(opt);
  }
  stepsInput.addEventListener("change", newGame);
  hintInput.addEventListener("change", () => render());
  newBtn.addEventListener("click", newGame);

  // 1, 2 and 3 move the chip that many steps while the band has the focus.
  boardEl.addEventListener("keydown", (e) => {
    const d = Number(e.key);
    if (d >= 1 && d <= C.MAX_MOVE && boardEl.querySelector(`.target[data-step="${d}"]`)) {
      e.preventDefault();
      play(d);
    }
  });

  window.addEventListener("resize", showSlide);

  showScore();
  newGame();
})();
