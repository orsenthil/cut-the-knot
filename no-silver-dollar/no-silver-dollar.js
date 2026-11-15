"use strict";

/* Board and accessible input for No Silver Dollar; rules live in its core. */
(function () {
  const C = NoSilverDollarCore;
  const stage = document.getElementById("stage");
  const status = document.getElementById("status");
  const lengthInput = document.getElementById("lengthInput");
  const chipsInput = document.getElementById("chipsInput");
  const setupInput = document.getElementById("setupInput");
  let state, selected = null;

  for (let n = C.MIN_LENGTH; n <= C.MAX_LENGTH; n++) {
    const o = document.createElement("option"); o.value = n; o.textContent = n; lengthInput.append(o);
  }
  lengthInput.value = C.DEFAULT_LENGTH;
  function fillChips() {
    const max = Math.min(C.MAX_CHIPS, Number(lengthInput.value) - 4);
    const old = Number(chipsInput.value) || C.DEFAULT_CHIPS;
    chipsInput.replaceChildren();
    for (let n = C.MIN_CHIPS; n <= max; n++) {
      const o = document.createElement("option"); o.value = n; o.textContent = n; chipsInput.append(o);
    }
    chipsInput.value = Math.min(old, max);
  }
  fillChips(); chipsInput.value = C.DEFAULT_CHIPS;

  function say(message, kind) {
    status.textContent = message;
    status.classList.remove("win", "lose", "done");
    if (kind) status.classList.add(kind);
  }
  function render() {
    stage.replaceChildren();
    const board = document.createElement("div"); board.className = "board";
    board.setAttribute("role", "group"); board.setAttribute("aria-label", "Numbered row of spaces");
    for (let p = 0; p < state.length; p++) {
      const col = document.createElement("div"); col.className = "space";
      const cell = document.createElement("button"); cell.type = "button"; cell.className = "spot";
      cell.setAttribute("aria-label", `Space ${p}`);
      const index = state.positions.indexOf(p);
      if (index >= 0) {
        cell.classList.add("chip"); cell.textContent = "●";
        cell.setAttribute("aria-label", `Counter at ${p}${selected === index ? ", selected" : ""}`);
        cell.classList.toggle("selected", selected === index);
        cell.disabled = state.over || (!setupInput.checked && state.turn !== "you");
        cell.addEventListener("click", () => {
          if (selected === null) { selected = index; say(setupInput.checked ? `Counter at ${p} selected. Choose any empty space.` : `Counter at ${p} selected. Choose an empty space to its left.`); render(); }
          else if (selected === index) { selected = null; say(""); render(); }
          else if (setupInput.checked) trySetup(selected, p);
          else tryMove(selected, p);
        });
      } else {
        cell.textContent = "";
        cell.disabled = state.over || (!setupInput.checked && state.turn !== "you") || selected === null;
        cell.addEventListener("click", () => { if (selected !== null) setupInput.checked ? trySetup(selected, p) : tryMove(selected, p); });
      }
      col.append(cell);
      const label = document.createElement("span"); label.className = "space-label"; label.textContent = p; col.append(label);
      board.append(col);
    }
    stage.append(board);
    if (window.Track) window.Track.state(C.snapshot(state));
  }
  function trySetup(chip, to) {
    const next = C.setupMove(state, chip, to);
    if (!next) { say("Choose a space that is not already occupied."); return; }
    state = next; selected = null; say("Counter moved. Arrange more, or switch to Play."); render();
  }
  function tryMove(chip, to) {
    const next = C.move(state, { chip, to });
    if (!next) { say("That counter cannot move there. Choose an empty space to its left."); return; }
    selected = null; state = next; render();
    if (state.over) { say("You win!", "win"); return; }
    say("The computer is moving…");
    window.setTimeout(() => {
      state = C.computerMove(state);
      render();
      if (state && state.over) say("The computer wins!", "lose");
      else say("Your turn. Choose a counter.");
    }, 220);
  }
  function newGame() {
    selected = null;
    state = C.start({ length: Number(lengthInput.value), chips: Number(chipsInput.value) });
    say(setupInput.checked ? "Set up the counters, or switch to Play." : "Your turn. Choose a counter."); render();
  }
  document.getElementById("newBtn").addEventListener("click", newGame);
  lengthInput.addEventListener("change", () => { fillChips(); newGame(); });
  chipsInput.addEventListener("change", newGame);
  setupInput.addEventListener("change", () => {
    selected = null;
    if (setupInput.checked) state = { ...state, turn: "you", over: false, winner: null, moves: 0 };
    say(setupInput.checked ? "Set up the counters, or switch to Play." : "Your turn. Choose a counter."); render();
  });
  newGame();
})();
