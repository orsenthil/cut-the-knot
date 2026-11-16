"use strict";

(function () {
  const Core = ScoringMisereCore;
  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const scoreEl = document.getElementById("scoreLine");
  const countersSel = document.getElementById("countersInput");
  const stepSel = document.getElementById("stepInput");
  const lengthSel = document.getElementById("lengthInput");
  const hintSel = document.getElementById("hintInput");
  const backBtn = document.getElementById("backBtn");
  const resetBtn = document.getElementById("resetBtn");

  let state = null;
  let selected = null;

  function fillSelect(sel, from, to, value) {
    sel.replaceChildren();
    for (let n = from; n <= to; n++) {
      const o = document.createElement("option");
      o.value = String(n);
      o.textContent = String(n);
      sel.appendChild(o);
    }
    sel.value = String(value);
  }

  fillSelect(countersSel, Core.MIN_COUNTERS, Core.MAX_COUNTERS, Core.DEFAULT_COUNTERS);
  fillSelect(stepSel, Core.MIN_STEP, Core.MAX_STEP, Core.DEFAULT_STEP);
  fillSelect(lengthSel, Core.MIN_LENGTH, Core.MAX_LENGTH, Core.DEFAULT_LENGTH);
  hintSel.value = "0";

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function modLabel(cell) {
    const m = state.maxStep + 1;
    const r = cell % m;
    if (state.hint === 1) return String(cell); // Forward: show index
    if (state.hint === 2) return String(state.length - 1 - cell); // Backward
    if (state.hint === 3) return String(r); // Modular
    return "";
  }

  function render() {
    boardEl.replaceChildren();
    boardEl.style.setProperty("--len", String(state.length));
    const stacks = Array.from({ length: state.length }, () => []);
    state.positions.forEach((p, i) => stacks[p].push(i));

    for (let c = 0; c < state.length; c++) {
      const col = document.createElement("div");
      col.className = "col";
      col.dataset.col = String(c);
      if (selected !== null && !state.over && state.turn === "you") {
        const from = state.positions[selected];
        const steps = from - c;
        if (c < from && steps >= 1 && steps <= state.maxStep) {
          col.classList.add("target");
          col.tabIndex = 0;
          col.setAttribute("role", "button");
          col.setAttribute("aria-label", "Move counter to cell " + c);
          col.addEventListener("click", () => playYou(selected, c));
          col.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              playYou(selected, c);
            }
          });
        }
      }
      const label = document.createElement("div");
      label.className = "col-label";
      label.textContent = modLabel(c) || String(c);
      col.appendChild(label);

      const stack = document.createElement("div");
      stack.className = "stack";
      for (const idx of stacks[c]) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip";
        if (selected === idx) chip.classList.add("selected");
        chip.setAttribute("aria-label", "Counter " + (idx + 1) + " at cell " + c);
        chip.disabled = state.over || state.turn !== "you" || c === 0;
        chip.addEventListener("click", (e) => {
          e.stopPropagation();
          if (state.over || state.turn !== "you") return;
          selected = selected === idx ? null : idx;
          say(selected === null
            ? "Pick a counter to the right of 0."
            : "Pick a cell up to " + state.maxStep + " steps left.");
          render();
        });
        stack.appendChild(chip);
      }
      col.appendChild(stack);
      boardEl.appendChild(col);
    }

    backBtn.disabled = state.history.length === 0 || state.over;
    scoreEl.textContent = "Score " + state.wins + ":" + state.losses;
    if (window.Track) window.Track.state(Core.snapshot(state));
  }

  function afterHuman() {
    selected = null;
    if (state.over) {
      say(
        state.winner === "you"
          ? "Congratulations! You won! It's now " + state.wins + ":" + state.losses
          : "I won! It's now " + state.wins + ":" + state.losses,
        state.winner === "you" ? "win" : "lose",
      );
      render();
      return;
    }
    say("Thinking…");
    render();
    window.setTimeout(() => {
      state = Core.playComputer(state);
      selected = null;
      if (state.over) {
        say(
          state.winner === "you"
            ? "Congratulations! You won! It's now " + state.wins + ":" + state.losses
            : "I won! It's now " + state.wins + ":" + state.losses,
          state.winner === "you" ? "win" : "lose",
        );
      } else {
        say("Your move — pick a counter, then a cell to its left.");
      }
      render();
    }, 280);
  }

  function playYou(index, to) {
    if (state.over || state.turn !== "you") return;
    state = Core.applyMove(state, index, to);
    afterHuman();
  }

  function newGame() {
    const wins = state ? state.wins : 0;
    const losses = state ? state.losses : 0;
    state = Core.start({
      nRings: Number(countersSel.value),
      maxStep: Number(stepSel.value),
      length: Number(lengthSel.value),
      hint: Number(hintSel.value),
    });
    state.wins = wins;
    state.losses = losses;
    selected = null;
    say("Your move — pick a counter, then a cell to its left.");
    render();
  }

  resetBtn.addEventListener("click", newGame);
  backBtn.addEventListener("click", () => {
    state = Core.undo(state);
    selected = null;
    say("Took back. Your move.");
    render();
  });
  countersSel.addEventListener("change", newGame);
  stepSel.addEventListener("change", newGame);
  lengthSel.addEventListener("change", newGame);
  hintSel.addEventListener("change", () => {
    state = { ...state, hint: Number(hintSel.value) };
    render();
  });

  newGame();
})();
