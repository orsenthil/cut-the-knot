"use strict";

/*
 * UI for Scout out of Desert. The board is a CSS grid of cell buttons; desert
 * rows are sandy, land rows green. Select a scout, then a target two steps away.
 */

(function () {
  const Core = ReverseDesertCore;
  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const colsInput = document.getElementById("colsInput");
  const habInput = document.getElementById("habInput");
  const levelInput = document.getElementById("levelInput");
  const setPosInput = document.getElementById("setPosInput");
  const backBtn = document.getElementById("backBtn");
  const newBtn = document.getElementById("newBtn");

  let state = null;
  let focus = { x: 0, y: 0 };

  function fillSelect(sel, lo, hi, val) {
    sel.innerHTML = "";
    for (let n = lo; n <= hi; n++) {
      const o = document.createElement("option");
      o.value = String(n);
      o.textContent = String(n);
      sel.appendChild(o);
    }
    sel.value = String(val);
  }

  fillSelect(colsInput, Core.MIN_X, Core.MAX_X, Core.DEFAULT_X);
  fillSelect(habInput, Core.MIN_Y, Core.MAX_Y, Core.DEFAULT_Y);
  fillSelect(levelInput, Core.MIN_LEVEL, Core.MAX_LEVEL, Core.DEFAULT_LEVEL);

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function targets() {
    if (!state.selected) return new Set();
    const set = new Set();
    for (const m of Core.legalMoves(state)) {
      if (m.from.x === state.selected.x && m.from.y === state.selected.y) {
        set.add(m.to.x + "," + m.to.y);
      }
    }
    return set;
  }

  function render() {
    const tset = targets();
    boardEl.innerHTML = "";
    boardEl.style.gridTemplateColumns = "repeat(" + state.cols + ", 2.1rem)";
    boardEl.style.gridTemplateRows = "repeat(" + state.rows + ", 2.1rem)";
    boardEl.setAttribute("aria-rowcount", String(state.rows));
    boardEl.setAttribute("aria-colcount", String(state.cols));

    for (let y = 0; y < state.rows; y++) {
      for (let x = 0; x < state.cols; x++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cell " + (y < state.level ? "desert" : "land");
        btn.dataset.x = String(x);
        btn.dataset.y = String(y);
        btn.setAttribute("role", "gridcell");
        const v = state.board[x][y];
        const zone = y < state.level ? "desert" : "land";
        if (v === Core.SCOUT || v === Core.SELECTED) {
          const sc = document.createElement("span");
          sc.className = "scout";
          sc.setAttribute("aria-hidden", "true");
          btn.appendChild(sc);
        }
        if (v === Core.SELECTED) btn.classList.add("selected");
        if (tset.has(x + "," + y)) btn.classList.add("target");
        btn.setAttribute(
          "aria-label",
          zone + " cell " + (x + 1) + "," + (y + 1) +
            (v === Core.SELECTED ? ", selected scout" :
              v === Core.SCOUT ? ", scout" : ", empty"),
        );
        btn.tabIndex = focus.x === x && focus.y === y ? 0 : -1;
        btn.addEventListener("click", () => onClick(x, y));
        btn.addEventListener("keydown", onKey);
        boardEl.appendChild(btn);
      }
    }

    backBtn.disabled = state.history.length === 0 || state.won;
    if (state.won) say("Congratulations! You did it!", "win");
    else if (state.setting) say("Set position: press cells to add or remove starting scouts.");
    else if (state.selected) say("Press an empty cell two steps away (over empty), or press elsewhere to cancel.");
    else say("Press a scout, then its landing cell.");

    if (window.Track) window.Track.state(Core.snapshot(state));
  }

  function focusButton() {
    const btn = boardEl.querySelector('.cell[data-x="' + focus.x + '"][data-y="' + focus.y + '"]');
    if (btn) btn.focus();
  }

  function onClick(x, y) {
    focus = { x, y };
    state = Core.click(state, x, y);
    render();
    focusButton();
  }

  function onKey(ev) {
    const x = Number(ev.currentTarget.dataset.x);
    const y = Number(ev.currentTarget.dataset.y);
    let nx = x, ny = y;
    if (ev.key === "ArrowLeft") nx = Math.max(0, x - 1);
    else if (ev.key === "ArrowRight") nx = Math.min(state.cols - 1, x + 1);
    else if (ev.key === "ArrowUp") ny = Math.max(0, y - 1);
    else if (ev.key === "ArrowDown") ny = Math.min(state.rows - 1, y + 1);
    else if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      onClick(x, y);
      return;
    } else return;
    ev.preventDefault();
    focus = { x: nx, y: ny };
    render();
    focusButton();
  }

  function newGame() {
    state = Core.start({
      cols: Number(colsInput.value),
      habitable: Number(habInput.value),
      level: Number(levelInput.value),
    });
    setPosInput.checked = false;
    focus = { x: Math.floor(state.cols / 2), y: 0 };
    render();
  }

  newBtn.addEventListener("click", () => {
    state = Core.reset(state);
    setPosInput.checked = false;
    render();
  });
  backBtn.addEventListener("click", () => {
    state = Core.undo(state);
    render();
  });
  setPosInput.addEventListener("change", () => {
    state = Core.setSetting(state, setPosInput.checked);
    render();
  });
  function onDim() {
    state = Core.setDims(state, {
      cols: Number(colsInput.value),
      habitable: Number(habInput.value),
      level: Number(levelInput.value),
    });
    setPosInput.checked = false;
    focus = { x: Math.floor(state.cols / 2), y: 0 };
    render();
  }
  colsInput.addEventListener("change", onDim);
  habInput.addEventListener("change", onDim);
  levelInput.addEventListener("change", onDim);

  newGame();
})();
