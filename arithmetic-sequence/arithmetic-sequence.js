"use strict";

/*
 * UI for 3-Term Arithmetic Progression. The play area is a single wrap of
 * nine number buttons (the ninth is taken out of play when the applet is set
 * to eight numbers); each button is itself the little On/Off box beneath the
 * number. The core decides which evenly spaced triple is lit, and this file
 * only draws that decision and takes clicks and keys. All colours come from
 * the CSS tokens, so light and dark follow the page theme on their own.
 */

(function () {
  const Core = ArithmeticSequenceCore;
  const boardEl = document.getElementById("board");
  const groupsEl = document.getElementById("groups");
  const statusEl = document.getElementById("status");
  const btn8 = document.getElementById("btn8");
  const btn9 = document.getElementById("btn9");
  const newBtn = document.getElementById("newBtn");

  let state = null;
  const cells = [];

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function joinWords(list) {
    if (list.length === 0) return "none";
    if (list.length === 1) return String(list[0]);
    if (list.length === 2) return list[0] + " and " + list[1];
    return list.slice(0, -1).join(", ") + " and " + list[list.length - 1];
  }

  // Build the nine buttons once so focus survives a toggle.
  function buildBoard() {
    for (let i = 0; i < Core.MAX; i++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.index = String(i);

      const num = document.createElement("span");
      num.className = "num";
      num.textContent = String(i + 1);

      const dot = document.createElement("span");
      dot.className = "dot";
      dot.setAttribute("aria-hidden", "true");

      cell.append(num, dot);
      cell.addEventListener("click", () => onToggle(i));
      cell.addEventListener("keydown", onCellKey);
      boardEl.appendChild(cell);
      cells.push(cell);
    }
  }

  function render() {
    const special = Core.findSpecial(state);
    const lit = new Set(special || []);

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const inPlay = i < state.n;
      const on = state.colors[i] === 1;
      cell.disabled = !inPlay;
      cell.classList.toggle("out", !inPlay);
      cell.classList.toggle("special", lit.has(i));
      cell.setAttribute("aria-pressed", on ? "true" : "false");
      cell.setAttribute(
        "aria-label",
        inPlay
          ? "Number " + (i + 1) + ", " + (on ? "On" : "Off") +
            ". Press to switch to " + (on ? "Off" : "On") +
            (lit.has(i) ? ", part of a three-step pattern" : "")
          : "Number 9 is not in play at eight numbers",
      );
    }

    btn8.setAttribute("aria-pressed", state.n === 8 ? "true" : "false");
    btn9.setAttribute("aria-pressed", state.n === 9 ? "true" : "false");

    const onNums = [];
    const offNums = [];
    for (let i = 0; i < state.n; i++) {
      (state.colors[i] ? onNums : offNums).push(i + 1);
    }
    groupsEl.textContent =
      "On: " + joinWords(onNums) + "  ·  Off: " + joinWords(offNums);

    const outcome = Core.result(state);
    if (outcome === "done" && special) {
      const colour = state.colors[special[0]] ? "On" : "Off";
      say(
        "Done — " + joinWords(Core.numbers(special)) + " are all " + colour +
        ": three evenly spaced numbers in the same group.",
        "done",
      );
    } else if (outcome === "done") {
      say(
        "Done — with eight numbers you can colour them so that no three " +
        "evenly spaced numbers share a group.",
        "done",
      );
    } else {
      say(
        "Boxes that are On form one group; Off boxes form the other. " +
        "Switch a box and watch which numbers line up.",
      );
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function onToggle(i) {
    const next = Core.toggle(state, i);
    if (next === state) return;
    state = next;
    render();
  }

  function onCellKey(ev) {
    const i = Number(ev.currentTarget.dataset.index);
    let next = null;
    if (ev.key === "ArrowRight" || ev.key === "ArrowDown") next = i + 1;
    else if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") next = i - 1;
    else if (ev.key === "Home") next = 0;
    else if (ev.key === "End") next = state.n - 1;
    if (next === null) return;
    ev.preventDefault();
    next = Math.max(0, Math.min(state.n - 1, next));
    cells[next].focus();
  }

  function setCount(n) {
    const next = Core.setN(state, n);
    if (next === state) return;
    state = next;
    render();
  }

  function clearAll() {
    state = Core.start({ n: state.n });
    render();
  }

  btn8.addEventListener("click", () => setCount(8));
  btn9.addEventListener("click", () => setCount(9));
  newBtn.addEventListener("click", clearAll);
  // Colours are CSS tokens, so a theme flip needs no redraw; re-render anyway
  // to keep every button's label and the saved position in sync.
  window.addEventListener("themechange", render);

  buildBoard();
  state = Core.start({ n: Core.DEFAULT_N });
  render();
})();
