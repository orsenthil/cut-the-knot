"use strict";

/*
 * Browser UI for the Subtraction Game: drawing and input only. The Grundy
 * table, the legal moves and the computer's strategy are in
 * subtraction-game-core.js.
 *
 * The minuends sit in a grid above a line; the subtrahends sit in a row below.
 * Select a minuend, then click a subtrahend to subtract it. With "Define"
 * checked the subtrahends can be edited instead, each in the range 1..9.
 */

(() => {
  const C = SubtractionGameCore;
  const stage = document.getElementById("stage");
  const status = document.getElementById("status");
  const moveBtn = document.getElementById("moveBtn");
  const resetBtn = document.getElementById("resetBtn");
  const defineCheck = document.getElementById("defineCheck");
  const numsOut = document.getElementById("numsOut");
  const subsOut = document.getElementById("subsOut");
  const maxOut = document.getElementById("maxOut");
  const numsLess = document.getElementById("numsLess");
  const numsMore = document.getElementById("numsMore");
  const subsLess = document.getElementById("subsLess");
  const subsMore = document.getElementById("subsMore");
  const maxLess = document.getElementById("maxLess");
  const maxMore = document.getElementById("maxMore");

  let state = null;
  let selected = null; // index of the chosen minuend
  let note = "";
  let busy = false;
  let timer = 0;
  let focusKey = null;

  function say(text, kind) {
    status.textContent = text;
    status.classList.remove("win", "lose", "done");
    if (kind) status.classList.add(kind);
  }

  function saveFocus() {
    const el = document.activeElement;
    if (!el || !stage.contains(el) || !el.dataset.part) return;
    focusKey = { part: el.dataset.part, index: el.dataset.index, delta: el.dataset.delta };
  }

  function restoreFocus() {
    if (!focusKey) return;
    const selector = `.choice[data-part="${focusKey.part}"][data-index="${focusKey.index}"]` +
      (focusKey.delta ? `[data-delta="${focusKey.delta}"]` : ":not([data-delta])");
    const target = stage.querySelector(selector) || stage.querySelector(".choice");
    if (target && !target.disabled) {
      focusKey = null;
      target.focus();
    }
  }

  function render() {
    if (!focusKey) saveFocus();
    stage.replaceChildren();

    const grid = document.createElement("div");
    grid.className = "num-grid";
    state.nums.forEach((value, heap) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice num" + (selected === heap ? " selected" : "") + (value === 0 ? " empty" : "");
      btn.dataset.part = "num";
      btn.dataset.index = String(heap);
      btn.disabled = busy || Boolean(state.winner) || value === 0;
      btn.textContent = String(value);
      btn.setAttribute("aria-label", `Minuend ${heap + 1}: ${value}${selected === heap ? ", selected" : ", click to select"}`);
      btn.addEventListener("click", () => {
        focusKey = { part: "num", index: String(heap) };
        selected = heap;
        note = "";
        render();
      });
      grid.appendChild(btn);
    });
    stage.appendChild(grid);

    const line = document.createElement("div");
    line.className = "divider";
    stage.appendChild(line);

    const row = document.createElement("div");
    row.className = "sub-row";
    state.subs.forEach((value, index) => {
      const wrap = document.createElement("div");
      wrap.className = "sub-wrap";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice sub";
      btn.dataset.part = "sub";
      btn.dataset.index = String(index);
      btn.dataset.sub = String(value);
      btn.disabled = busy || Boolean(state.winner) || (defineCheck.checked && value >= C.MAX_SUB);
      btn.textContent = String(value);
      btn.setAttribute("aria-label", defineCheck.checked
        ? `Subtrahend ${index + 1}: ${value}, click to increase`
        : `Subtract ${value} from the selected minuend`);
      btn.addEventListener("click", () => chooseSub(index));
      wrap.appendChild(btn);
      if (defineCheck.checked) {
        const down = document.createElement("button");
        down.type = "button";
        down.className = "choice tiny";
        down.dataset.part = "sub";
        down.dataset.index = String(index);
        down.dataset.delta = "down";
        down.textContent = "−";
        down.disabled = busy || value <= C.MIN_SUB;
        down.setAttribute("aria-label", `Decrease subtrahend ${index + 1}`);
        down.addEventListener("click", () => changeSub(index, -1));
        wrap.appendChild(down);
      }
      row.appendChild(wrap);
    });
    stage.appendChild(row);

    numsOut.textContent = String(state.nnums);
    subsOut.textContent = String(state.nsubs);
    maxOut.textContent = String(state.max);
    numsLess.disabled = busy || state.nnums <= C.MIN_NUMS;
    numsMore.disabled = busy || state.nnums >= C.MAX_NUMS;
    subsLess.disabled = busy || state.nsubs <= C.MIN_SUBS;
    subsMore.disabled = busy || state.nsubs >= C.MAX_SUBS;
    maxLess.disabled = busy || state.max <= C.MIN_MAX;
    maxMore.disabled = busy || state.max >= C.MAX_MAX;
    defineCheck.disabled = busy;

    moveBtn.disabled = busy || state.moves !== 0 || Boolean(state.winner);
    moveBtn.textContent = state.winner ? (state.winner === "you" ? "You won" : "I won") : "You start";
    resetBtn.disabled = busy;

    if (state.winner === "you") say("You won! The computer has no move left. Press Reset to play again.", "win");
    else if (state.winner === "computer") say("I won! You have no move left. Press Reset to try again.", "lose");
    else if (busy) say(C.NOTE_THINKING || "Thinking ...");
    else if (note) say(note);
    else if (defineCheck.checked) say("Define: change the subtrahends, then uncheck Define to play.");
    else if (selected === null) say("Select a minuend, then click a subtrahend to subtract it.");
    else say(`Minuend ${selected + 1} selected. Click a subtrahend.`);

    if (window.Track) {
      window.Track.state({
        nums: state.nums.slice(), subs: state.subs.slice(), max: state.max,
        turn: state.turn, winner: state.winner, moves: state.moves,
      });
    }
    restoreFocus();
  }

  function chooseSub(index) {
    if (busy || state.winner) return;
    if (defineCheck.checked) {
      changeSub(index, 1);
      return;
    }
    if (selected === null) {
      focusKey = { part: "sub", index: String(index) };
      note = "First select a number";
      render();
      return;
    }
    const m = { heap: selected, sub: state.subs[index] };
    const next = C.move(state, m);
    if (!next) {
      focusKey = { part: "sub", index: String(index) };
      note = "Illegal Move";
      render();
      return;
    }
    focusKey = null;
    state = next;
    selected = null;
    note = "";
    if (state.winner) {
      render();
      return;
    }
    busy = true;
    render();
    timer = window.setTimeout(reply, 320);
  }

  function changeSub(index, delta) {
    const subs = state.subs.slice();
    const value = Math.max(C.MIN_SUB, Math.min(C.MAX_SUB, subs[index] + delta));
    if (value === subs[index]) return;
    subs[index] = value;
    focusKey = { part: "sub", index: String(index), delta: delta < 0 ? "down" : undefined };
    state = { ...state, subs: C.sortedSubs(subs) };
    render();
  }

  function reply() {
    timer = 0;
    const move = C.computerMove(state);
    busy = false;
    if (!move) {
      render();
      return;
    }
    focusKey = null;
    state = move.state;
    note = move.description;
    render();
  }

  function newGame(patch) {
    if (timer) {
      window.clearTimeout(timer);
      timer = 0;
    }
    focusKey = null;
    selected = null;
    note = "";
    busy = false;
    state = C.start({
      nnums: patch.nnums !== undefined ? patch.nnums : state.nnums,
      nsubs: patch.nsubs !== undefined ? patch.nsubs : state.nsubs,
      max: patch.max !== undefined ? patch.max : state.max,
      random: Math.random,
    });
    render();
  }

  function reset() {
    if (timer) window.clearTimeout(timer);
    focusKey = null;
    selected = null;
    note = "";
    busy = false;
    state = C.start({
      nnums: state ? state.nnums : 20,
      nsubs: state ? state.nsubs : 3,
      max: state ? state.max : 20,
    });
    render();
  }

  numsLess.addEventListener("click", () => newGame({ nnums: state.nnums - 1 }));
  numsMore.addEventListener("click", () => newGame({ nnums: state.nnums + 1 }));
  subsLess.addEventListener("click", () => newGame({ nsubs: state.nsubs - 1 }));
  subsMore.addEventListener("click", () => newGame({ nsubs: state.nsubs + 1 }));
  maxLess.addEventListener("click", () => newGame({ max: state.max - 1 }));
  maxMore.addEventListener("click", () => newGame({ max: state.max + 1 }));
  defineCheck.addEventListener("change", render);
  moveBtn.addEventListener("click", () => {
    if (busy || state.moves !== 0 || state.winner) return;
    focusKey = null;
    state = { ...state, turn: "computer" };
    busy = true;
    render();
    timer = window.setTimeout(reply, 320);
  });
  resetBtn.addEventListener("click", reset);

  reset();
})();
