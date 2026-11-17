"use strict";

/*
 * Another Sticky Problem UI: the applet TwoStickStart's two kinds of move on
 * one screen. Click a square to the right of a break line to split a stick;
 * use a Remove button to take k sticks of length k. The computer answers with
 * the applet's own plan, and the player whose move empties the board wins.
 *
 * The page keeps the turn and the result, which the core deliberately does
 * not: the core is only the rules and the computer's strategy.
 */
(() => {
  const C = AnotherStickyProblemCore;
  const stage = document.getElementById("stage");
  const removals = document.getElementById("removals");
  const status = document.getElementById("status");
  const nInput = document.getElementById("nInput");
  const newBtn = document.getElementById("newBtn");
  const startBtn = document.getElementById("computerStarts");

  let state = C.start({ n: 10 });
  let humanTurn = true;
  let busy = false;
  let timer = 0;
  let lastMover = null; // "you", "computer", or null before the first move
  let message = ""; // what the computer just did
  let focusKey = null;

  function setStatus(text, cls) {
    status.textContent = text;
    status.classList.remove("win", "lose", "done");
    if (cls) status.classList.add(cls);
  }

  /** Remember which cell or button had the keyboard, across a re-render. */
  function saveFocus() {
    const el = document.activeElement;
    if (!el || (!stage.contains(el) && !removals.contains(el))) return;
    if (el.dataset.cell !== undefined) {
      focusKey = { kind: "cell", index: el.dataset.index, cell: el.dataset.cell };
    } else if (el.dataset.length !== undefined) {
      focusKey = { kind: "remove", length: el.dataset.length };
    }
  }

  function restoreFocus() {
    const key = focusKey;
    if (!key) return;
    let target = null;
    if (key.kind === "cell") {
      target =
        stage.querySelector(`.cell[data-index="${key.index}"][data-cell="${key.cell}"]:not(:disabled)`) ||
        stage.querySelector(`.cell[data-index="${key.index}"]:not(:disabled)`) ||
        stage.querySelector(".cell:not(:disabled)");
    } else {
      target =
        removals.querySelector(`button[data-length="${key.length}"]:not(:disabled)`) ||
        removals.querySelector("button:not(:disabled)") ||
        stage.querySelector(".cell:not(:disabled)");
    }
    // Keep the key while the computer is thinking: the cells are disabled
    // during the short pause, and the next render can still restore it.
    if (target) {
      focusKey = null;
      target.focus();
    }
  }

  function describe(move, before) {
    if (move.type === "break") {
      const length = before.sticks[move.stick];
      return `The computer broke a length ${length} stick into ${move.at} and ${length - move.at}.`;
    }
    const sticks = move.length === 1 ? "stick" : "sticks";
    return `The computer removed ${move.length} ${sticks} of length ${move.length}.`;
  }

  function render() {
    saveFocus();

    if (window.Track) {
      window.Track.state({ n: state.n, sticks: state.sticks.slice() });
    }

    const over = C.isOver(state);
    stage.replaceChildren();
    stage.setAttribute("aria-label", "Sticks made of unit squares");

    if (over) {
      const done = document.createElement("p");
      done.className = "empty-board";
      done.textContent = "No sticks left.";
      stage.appendChild(done);
    } else {
      const list = document.createElement("div");
      list.className = "sticks";
      state.sticks.forEach((length, index) => {
        const row = document.createElement("div");
        row.className = "stick-row";

        const label = document.createElement("span");
        label.className = "len";
        label.textContent = String(length);
        label.setAttribute("aria-hidden", "true");

        const bar = document.createElement("div");
        bar.className = "stick";
        bar.style.setProperty("--len", String(length));
        bar.setAttribute("role", "group");
        bar.setAttribute("aria-label", `Stick of length ${length}`);

        for (let cell = 0; cell < length; cell++) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "cell";
          btn.dataset.index = String(index);
          btn.dataset.cell = String(cell);
          btn.disabled = busy || !humanTurn;

          if (length === 1) {
            // A length-1 stick cannot be broken; a click removes it, which is
            // the removal move k = 1 and what the applet's Break mode does.
            btn.classList.add("single");
            btn.setAttribute("aria-label", "Remove this length 1 stick");
            btn.title = "Remove this length-1 stick";
            btn.addEventListener("click", () => play({ kind: "remove", length: 1, index }));
          } else if (cell === 0) {
            btn.classList.add("first");
            btn.setAttribute(
              "aria-label",
              `Length ${length} stick, first square: a break cannot be made before it`,
            );
            btn.title = "The first square cannot be a break";
            btn.addEventListener("click", () => {
              setStatus("The first square cannot be a break. Click a square further right.");
            });
          } else {
            btn.setAttribute(
              "aria-label",
              `Break the length ${length} stick after ${cell} square${cell === 1 ? "" : "s"}, into ${cell} and ${length - cell}`,
            );
            btn.title = `Break into ${cell} + ${length - cell}`;
            btn.addEventListener("click", () => play({ kind: "break", index, at: cell }));
          }
          bar.appendChild(btn);
        }

        row.append(label, bar);
        list.appendChild(row);
      });
      stage.appendChild(list);
    }

    // One button for each k with at least k sticks of length k.
    removals.replaceChildren();
    const removable = C.removableLengths(state);
    if (!over && removable.length > 0) {
      const label = document.createElement("span");
      label.className = "remove-label";
      label.textContent = "Remove k sticks of length k:";
      removals.appendChild(label);
      for (const length of removable) {
        const count = state.sticks.filter((v) => v === length).length;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.length = String(length);
        btn.textContent = `Remove ${length} of length ${length}`;
        btn.setAttribute(
          "aria-label",
          `Remove ${length} stick${length === 1 ? "" : "s"} of length ${length}; there ${count === 1 ? "is" : "are"} ${count}`,
        );
        btn.disabled = busy || !humanTurn;
        btn.addEventListener("click", () => play({ kind: "remove", length }));
        removals.appendChild(btn);
      }
    }

    if (over) {
      if (lastMover === "you") setStatus("You made the last move. You win!", "win");
      else setStatus("The computer made the last move. It wins.", "lose");
    } else if (busy) {
      setStatus("The computer is thinking…");
    } else if (humanTurn) {
      setStatus(
        `${message ? message + " " : ""}Your turn: click a square to break a stick, or use a Remove button.`,
      );
    } else {
      setStatus("The computer's turn.");
    }

    restoreFocus();
  }

  function scheduleComputer() {
    timer = window.setTimeout(() => {
      timer = 0;
      const before = state;
      const move = C.computerMove(before, Math.random);
      const next = move && C.move(before, move);
      busy = false;
      if (!next) {
        // Not reachable from a position in play, but never leave the page stuck.
        humanTurn = true;
        render();
        return;
      }
      state = next;
      lastMover = "computer";
      message = describe(move, before);
      humanTurn = !C.isOver(state);
      render();
    }, 280);
  }

  function play(move) {
    if (busy || !humanTurn || C.isOver(state)) return;
    const before = state;
    let next;
    if (move.kind === "break") {
      next = C.split(state, move.index, move.at);
      if (!next) {
        setStatus("That break is not allowed.");
        return;
      }
    } else {
      next = C.remove(state, move.length, move.index);
      if (!next) {
        setStatus(`There are not ${move.length} sticks of length ${move.length}.`);
        return;
      }
    }

    state = next;
    lastMover = "you";
    message = "";
    humanTurn = false;

    if (C.isOver(state)) {
      busy = false;
      render();
      return;
    }

    busy = true;
    render();
    scheduleComputer();
  }

  function newGame(computerStarts) {
    if (timer) {
      window.clearTimeout(timer);
      timer = 0;
    }
    const n = C.clampN(nInput.value);
    nInput.value = String(n);
    state = C.start({ n });
    humanTurn = !computerStarts;
    busy = false;
    lastMover = null;
    message = "";
    focusKey = null;
    render();
    if (computerStarts) {
      busy = true;
      humanTurn = false;
      render();
      scheduleComputer();
    }
  }

  newBtn.addEventListener("click", () => newGame(false));
  startBtn.addEventListener("click", () => newGame(true));
  nInput.addEventListener("change", () => newGame(false));

  render();
})();
