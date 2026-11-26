"use strict";

/*
 * The page for Scoring: drawing and input only; the rules and the
 * computer's play are in scoring-core.js. The strip is a row of columns,
 * square 0 on the left, with the counters piled in them. Click a pile (its
 * top counter is the one that moves), then a highlighted square up to
 * Max Step to its left. Hint writes the applet's labels under the squares.
 */

(function () {
  const Core = ScoringCore;
  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const scoreEl = document.getElementById("scoreLine");
  const countersSel = document.getElementById("countersInput");
  const stepSel = document.getElementById("stepInput");
  const lengthSel = document.getElementById("lengthInput");
  const hintSel = document.getElementById("hintInput");
  const resetBtn = document.getElementById("resetBtn");

  let state = null;
  let selected = null; // square whose top counter is picked up
  let hint = 0;
  let busy = false;
  let focusSquare = null;

  function fill(sel, r) {
    for (let n = r.min; n <= r.max; n++) {
      const o = document.createElement("option");
      o.value = o.textContent = String(n);
      sel.appendChild(o);
    }
    sel.value = String(r.def);
  }
  fill(countersSel, Core.COUNTERS);
  fill(stepSel, Core.STEP);
  fill(lengthSel, Core.LENGTH);

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    boardEl.replaceChildren();
    boardEl.style.setProperty("--len", String(state.length));
    const targets = selected !== null ? Core.targets(state, selected) : [];
    for (let c = 0; c < state.length; c++) {
      const col = document.createElement("button");
      col.type = "button";
      col.className = "col";
      col.dataset.square = String(c);
      const pile = state.stacks[c].length;
      const canPick = !state.over && !busy && state.turn === "you" && c > 0 && pile > 0;
      const isTarget = targets.includes(c);
      if (isTarget) col.classList.add("target");
      if (selected === c) col.classList.add("selected");
      if (state.last && state.last.to === c) col.classList.add("arrived");
      col.disabled = !(canPick || isTarget);
      col.setAttribute("aria-label", `Square ${c}, ${pile} counter${pile === 1 ? "" : "s"}` +
        (isTarget ? ": move here" : canPick ? (selected === c ? ": picked up, press again to put down" : ": pick up the top counter") : ""));
      const stack = document.createElement("span");
      stack.className = "stack";
      for (let k = 0; k < pile; k++) {
        const chip = document.createElement("span");
        chip.className = "chip";
        if (selected === c && k === pile - 1) chip.classList.add("lifted");
        stack.appendChild(chip);
      }
      col.appendChild(stack);
      const num = document.createElement("span");
      num.className = "num";
      num.textContent = String(c);
      col.appendChild(num);
      const lab = document.createElement("span");
      lab.className = "hint";
      lab.textContent = Core.hintLabel(state, hint, c) || " ";
      col.appendChild(lab);
      boardEl.appendChild(col);
    }
    scoreEl.textContent = `Score, computer : you = ${state.wins}:${state.losses}`;
    if (focusSquare !== null) {
      const el = boardEl.querySelector(`[data-square="${focusSquare}"]`);
      if (el && !el.disabled) el.focus();
      else { const any = boardEl.querySelector(".col:not(:disabled)"); if (any) any.focus(); }
      focusSquare = null;
    }
    if (window.Track) window.Track.state({ maxStep: state.maxStep, length: state.length, towers: state.towers, turn: state.turn, over: state.over, winner: state.winner });
  }

  function finish() {
    say(Core.message(state), Core.result(state));
  }

  function computerTurn() {
    busy = true;
    say("My move…");
    render();
    window.setTimeout(() => {
      state = Core.playComputer(state);
      busy = false;
      const l = state.last;
      if (state.over) finish();
      else say(`I moved a counter from square ${l.from} to square ${l.to}. Your move.`);
      focusSquare = l.to;
      render();
    }, 450);
  }

  boardEl.addEventListener("click", (e) => {
    const col = e.target.closest(".col");
    if (!col || col.disabled || busy || state.over) return;
    const c = Number(col.dataset.square);
    if (selected !== null && Core.targets(state, selected).includes(c)) {
      state = Core.move(state, { from: selected, to: c });
      selected = null;
      focusSquare = c;
      if (state.over) { finish(); render(); return; }
      computerTurn();
      return;
    }
    selected = selected === c ? null : c;
    focusSquare = c;
    say(selected === null ? "Pick a pile." : `Now pick a square 1 to ${state.maxStep} places to the left.`);
    render();
  });

  // Arrow keys move along the strip.
  boardEl.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const cols = [...boardEl.querySelectorAll(".col:not(:disabled)")];
    const i = cols.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const j = e.key === "ArrowLeft" ? Math.max(0, i - 1) : Math.min(cols.length - 1, i + 1);
    cols[j].focus();
  });

  function newGame() {
    const wins = state ? state.wins : 0, losses = state ? state.losses : 0;
    state = Core.start({ nRings: countersSel.value, maxStep: stepSel.value, length: lengthSel.value, wins, losses });
    selected = null;
    busy = false;
    say("You move first: pick a pile, then a square to its left.");
    render();
  }

  [countersSel, stepSel, lengthSel].forEach((el) => el.addEventListener("change", newGame));
  hintSel.addEventListener("change", () => { hint = Number(hintSel.value); render(); });
  resetBtn.addEventListener("click", newGame);

  newGame();
})();
