"use strict";

/*
 * Browser UI for Monotone Number Sequences. The rules and the chain test are in
 * up-and-down-game-core.js; this file only draws the board and takes input.
 *
 * The top rail holds the boxes, read from left to right; the bottom rail holds
 * the numbers 1..N. Click a number and then a box to place it, or drag a number
 * onto a box. A placed number can be picked up again to rearrange the board.
 * Every box and number is a real button, so mouse, touch and keyboard all work.
 */

(() => {
  const C = UpAndDownGameCore;
  const stage = document.getElementById("stage");
  const status = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");

  let state = null;
  let selected = null; // the number picked up, waiting for a box
  let focusKey = null; // which button had the keyboard before a re-render

  /** Sets the shared status line. Only "win"/"lose"/"done" end a play. */
  function say(text, kind) {
    status.textContent = text;
    status.classList.remove("win", "lose", "done");
    if (kind) status.classList.add(kind);
  }

  function saveFocus() {
    const el = document.activeElement;
    if (!el || !stage.contains(el)) return;
    if (el.dataset.value !== undefined) focusKey = { kind: "tile", value: el.dataset.value };
    else if (el.dataset.box !== undefined) focusKey = { kind: "box", box: el.dataset.box };
  }

  function restoreFocus() {
    if (!focusKey) return;
    const selector =
      focusKey.kind === "tile"
        ? `.tile[data-value="${focusKey.value}"]`
        : `.box[data-box="${focusKey.box}"]`;
    const target = stage.querySelector(selector);
    if (target) {
      focusKey = null;
      target.focus();
    }
  }

  function message() {
    const outcome = C.result(state);
    if (outcome === "win") {
      return ["Every box is full and no four numbers go up or down. You did it!", "win"];
    }
    if (outcome === "lose") {
      return state.n === 10
        ? ["Four numbers go up or down — with ten numbers that cannot be avoided. Press New Game to try again.", "lose"]
        : ["Four of these numbers go up or down. Move one to break the run.", "lose"];
    }
    const fault = C.faulty(state);
    if (fault) return [`Four numbers already go ${fault.direction}. Move one to break the run.`, null];
    if (selected !== null) return [`Number ${selected} picked. Choose a box, or drag it into place.`, null];
    return ["Pick a number, then click a box — or drag the number into a box.", null];
  }

  function render() {
    if (focusKey === null) saveFocus();
    const fault = C.faulty(state);
    const badBoxes = fault ? fault.indices : [];
    stage.replaceChildren();

    const boxLabel = document.createElement("p");
    boxLabel.className = "board-label";
    boxLabel.textContent = "Boxes — read them from left to right";
    stage.appendChild(boxLabel);

    const boxRail = document.createElement("div");
    boxRail.className = "rail boxes";
    boxRail.setAttribute("role", "group");
    boxRail.setAttribute("aria-label", "Boxes, in order from left to right");
    for (let box = 0; box < state.n; box++) {
      const value = state.boxes[box];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "box" + (value === null ? "" : " filled") + (badBoxes.includes(box) ? " faulty" : "");
      btn.dataset.box = String(box);
      if (value !== null) btn.textContent = String(value);
      btn.setAttribute("aria-label", `Box ${box + 1}, ${value === null ? "empty" : `number ${value}`}`);
      btn.addEventListener("click", () => {
        if (selected !== null) place(selected, box);
        else if (value !== null) pickUp(value);
        else say("Pick a number first, then choose a box.", null);
      });
      btn.addEventListener("dragover", (event) => {
        event.preventDefault();
        btn.classList.add("over");
      });
      btn.addEventListener("dragleave", () => btn.classList.remove("over"));
      btn.addEventListener("drop", (event) => {
        event.preventDefault();
        btn.classList.remove("over");
        const value = Number(event.dataTransfer.getData("text/plain"));
        if (Number.isInteger(value) && value >= 1 && value <= state.n) place(value, box);
      });
      boxRail.appendChild(btn);
    }
    stage.appendChild(boxRail);

    const tileLabel = document.createElement("p");
    tileLabel.className = "board-label";
    tileLabel.textContent = "Numbers — pick one up";
    stage.appendChild(tileLabel);

    const tileRail = document.createElement("div");
    tileRail.className = "rail tiles";
    tileRail.setAttribute("role", "group");
    tileRail.setAttribute("aria-label", "The numbers to place");
    for (let value = 1; value <= state.n; value++) {
      const inBox = state.boxes.indexOf(value);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tile" + (selected === value ? " selected" : "") + (inBox === -1 ? "" : " placed");
      btn.dataset.value = String(value);
      btn.draggable = true;
      btn.textContent = String(value);
      btn.setAttribute(
        "aria-label",
        `Number ${value}, ${inBox === -1 ? "not placed yet" : `in box ${inBox + 1}`}`,
      );
      btn.addEventListener("click", () => pickUp(value));
      btn.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/plain", String(value));
        event.dataTransfer.effectAllowed = "move";
      });
      tileRail.appendChild(btn);
    }
    stage.appendChild(tileRail);

    const [text, kind] = message();
    say(text, kind);

    // The position, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({ n: state.n, boxes: state.boxes.slice(), moves: state.moves });
    }
    restoreFocus();
  }

  function pickUp(value) {
    selected = value;
    const firstEmpty = state.boxes.indexOf(null);
    focusKey = { kind: "box", box: firstEmpty === -1 ? 0 : firstEmpty };
    render();
  }

  function place(value, box) {
    const next = C.move(state, { value, box });
    if (!next) return; // already there: nothing to do
    focusKey = { kind: "box", box };
    state = next;
    selected = null;
    render();
  }

  function newGame() {
    const checked = document.querySelector('input[name="length"]:checked');
    const n = checked ? Number(checked.value) : 9;
    state = C.start({ n });
    selected = null;
    focusKey = null;
    render();
  }

  // Arrow keys walk along a rail; Enter and Space are handled by the buttons.
  stage.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const el = document.activeElement;
    if (!el || !stage.contains(el)) return;
    const rail = el.parentElement;
    if (!rail || !rail.classList.contains("rail")) return;
    const items = [...rail.children];
    const at = items.indexOf(el);
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next = items[at + step];
    if (!next) return;
    event.preventDefault();
    focusKey = null;
    next.focus();
  });

  newBtn.addEventListener("click", newGame);
  for (const radio of document.querySelectorAll('input[name="length"]')) {
    radio.addEventListener("change", newGame);
  }

  newGame();
})();
