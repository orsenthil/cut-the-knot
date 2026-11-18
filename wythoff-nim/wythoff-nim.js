"use strict";

/*
 * Browser UI for Wythoff's Nim: drawing and input only; the rules and the
 * computer's strategy are in wythoff-nim-core.js.
 *
 * Each heap is a row of buttons, one per counter. Clicking a button removes
 * that counter and every counter to its right, so the number on the button is
 * how many are left. With "two heaps" chosen the same number is removed from
 * the other heap too. The computer answers after a short pause, as the applet
 * did with its "Thinking ..." ticker.
 */

(() => {
  const C = WythoffNimCore;
  const stage = document.getElementById("stage");
  const status = document.getElementById("status");
  const goBtn = document.getElementById("goBtn");
  const resetBtn = document.getElementById("resetBtn");
  const lessBtn = document.getElementById("lessBtn");
  const moreBtn = document.getElementById("moreBtn");
  const maxOut = document.getElementById("maxOut");
  const oneRadio = document.getElementById("oneHeap");
  const twoRadio = document.getElementById("twoHeap");

  let state = null;
  let busy = false;
  let timer = 0;
  let focusKey = null;
  let computerNote = "";

  function say(text, kind) {
    status.textContent = text;
    status.classList.remove("win", "lose", "done");
    if (kind) status.classList.add(kind);
  }

  function saveFocus() {
    const el = document.activeElement;
    if (!el || !stage.contains(el)) return;
    if (el.dataset.heap !== undefined) {
      focusKey = { heap: Number(el.dataset.heap), index: Number(el.dataset.index) };
    } else if (el.id) {
      focusKey = { id: el.id };
    }
  }

  function restoreFocus() {
    if (!focusKey) return;
    let target = null;
    if (focusKey.id) target = document.getElementById(focusKey.id);
    else {
      const exact = stage.querySelector(`.square[data-heap="${focusKey.heap}"][data-index="${focusKey.index}"]`);
      const any = stage.querySelector(`.square[data-heap="${focusKey.heap}"]`);
      const fallback = stage.querySelector(".square");
      target = exact || any || fallback;
    }
    if (target && !target.disabled) {
      focusKey = null;
      target.focus();
    }
  }

  function render() {
    if (focusKey === null) saveFocus();
    stage.replaceChildren();

    state.heaps.forEach((size, heap) => {
      const label = document.createElement("p");
      label.className = "board-label";
      label.textContent = `Heap ${heap + 1} — ${size} ${size === 1 ? "counter" : "counters"}`;
      stage.appendChild(label);

      const rail = document.createElement("div");
      rail.className = "rail counters";
      rail.setAttribute("role", "group");
      rail.setAttribute("aria-label", `Heap ${heap + 1}, ${size} counters left`);
      if (size === 0) {
        const empty = document.createElement("span");
        empty.className = "empty-heap";
        empty.textContent = "empty";
        rail.appendChild(empty);
      }
      for (let index = 0; index < size; index++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "square";
        btn.dataset.heap = String(heap);
        btn.dataset.index = String(index);
        // Kept focusable while the computer thinks: play() ignores clicks then,
        // and a disabled button cannot hold the keyboard focus across the pause.
        btn.disabled = C.result(state) !== null;
        btn.textContent = String(index + 1);
        btn.setAttribute(
          "aria-label",
          `Heap ${heap + 1}, square ${index + 1}: remove from here onward, leaving ${index}`,
        );
        btn.addEventListener("click", () => play(heap, index));
        rail.appendChild(btn);
      }
      stage.appendChild(rail);
    });

    maxOut.textContent = String(state.max);
    lessBtn.disabled = busy || state.max <= C.MIN_MAX;
    moreBtn.disabled = busy || state.max >= C.MAX_MAX;
    oneRadio.disabled = busy;
    twoRadio.disabled = busy;

    const over = C.result(state);
    goBtn.textContent = over === "win" ? "You won" : over === "lose" ? "I won" : busy ? "Thinking ..." : "Go";
    goBtn.disabled = !busy;
    goBtn.setAttribute("aria-label", over ? "The game is over; press Reset to play again" : "Make the computer move now");

    if (over === "win") say("You won! Press Reset to play again.", "win");
    else if (over === "lose") say("I won! Press Reset to play again.", "lose");
    else if (busy) say("Thinking ...");
    else say(`${computerNote ? computerNote + " " : ""}Click a square to remove it and those to its right.`);

    if (window.Track) {
      window.Track.state({
        max: state.max,
        heaps: state.heaps.slice(),
        mode: state.mode,
        turn: state.turn,
        moves: state.moves,
      });
    }
    restoreFocus();
  }

  function play(heap, index) {
    if (busy || C.result(state) !== null) return;
    const type = state.mode === "two" ? "two" : "one";
    const next = C.move(state, { type, heap, remaining: index });
    if (!next) {
      say("This move is not allowed!");
      return;
    }
    focusKey = null;
    state = next;
    computerNote = "";
    if (C.result(state) === "win") {
      render();
      return;
    }
    busy = true;
    render();
    timer = window.setTimeout(computerReply, 320);
  }

  function computerReply() {
    timer = 0;
    const move = C.computerMove(state);
    if (!move) {
      busy = false;
      render();
      return;
    }
    computerNote = C.describe(move);
    const next = C.move(state, move);
    busy = false;
    if (!next) {
      render(); // the applet never reaches this, but never leave the page stuck
      return;
    }
    focusKey = null;
    state = next;
    render();
  }

  function newGame() {
    if (timer) {
      window.clearTimeout(timer);
      timer = 0;
    }
    focusKey = null;
    busy = false;
    computerNote = "";
    state = C.start({ max: state ? state.max : 15, mode: state ? state.mode : "one" });
    render();
  }

  function changeMax(by) {
    const next = C.clampMax(state.max + by);
    if (next === state.max) return;
    state = { ...state, max: next };
    newGame();
  }

  lessBtn.addEventListener("click", () => changeMax(-1));
  moreBtn.addEventListener("click", () => changeMax(1));
  resetBtn.addEventListener("click", newGame);
  goBtn.addEventListener("click", () => {
    if (!busy) return;
    if (timer) window.clearTimeout(timer);
    timer = 0;
    computerReply();
  });
  for (const radio of [oneRadio, twoRadio]) {
    radio.addEventListener("change", () => {
      if (radio.checked) {
        state = { ...state, mode: radio.value };
        newGame();
      }
    });
  }

  // Arrow keys walk along a heap; Enter and Space activate the buttons.
  stage.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const el = document.activeElement;
    if (!el || !stage.contains(el) || !el.classList.contains("square")) return;
    const rail = el.parentElement;
    const squares = [...rail.querySelectorAll(".square")];
    const at = squares.indexOf(el);
    const next = squares[at + (event.key === "ArrowRight" ? 1 : -1)];
    if (!next) return;
    event.preventDefault();
    focusKey = null;
    next.focus();
  });

  newGame();
})();
