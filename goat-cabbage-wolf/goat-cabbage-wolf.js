"use strict";

/*
 * Browser UI for Goat, Cabbage and Wolf: drawing and input only. The rules,
 * the loss conditions and the breadth-first hint are in goat-cabbage-wolf-core.js.
 *
 * The board has two shores and a river. Items on the farmer's shore are
 * buttons: click one to ferry it across. The boat in the middle crosses alone
 * when pressed. The Hint checkbox shows the next crossing of a shortest safe
 * route, which the core finds by searching the whole state space.
 */

(() => {
  const C = GoatCabbageWolfCore;
  const stage = document.getElementById("stage");
  const status = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const hintCheck = document.getElementById("hintCheck");

  const ICONS = ["🐐", "🥬", "🐺"];

  let state = null;
  let note = "";
  let focusKey = null;

  function say(text, kind) {
    status.textContent = text;
    status.classList.remove("win", "lose", "done");
    if (kind) status.classList.add(kind);
  }

  function render() {
    if (focusKey === null) {
      const active = document.activeElement;
      if (active && active.dataset && active.dataset.item !== undefined) {
        focusKey = { item: Number(active.dataset.item), side: active.dataset.side };
      } else if (active && active.id === "crossBtn") focusKey = { cross: true };
    }
    stage.replaceChildren();

    const board = document.createElement("div");
    board.className = "board";

    for (const side of ["left", "right"]) {
      const shore = document.createElement("div");
      shore.className = "shore";
      const heading = document.createElement("h2");
      heading.textContent = side === "left" ? "This shore" : "Far shore";
      shore.appendChild(heading);

      for (let item = 0; item < 3; item++) {
        if ((state.right[item] ? "right" : "left") !== side) continue;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "item-btn";
        btn.dataset.item = String(item);
        btn.dataset.side = side;
        btn.disabled = state.boat !== side || Boolean(state.outcome);
        const icon = document.createElement("span");
        icon.className = "icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = ICONS[item];
        const label = document.createElement("span");
        label.textContent = `${C.NAMES[item]}${btn.disabled ? "" : " — take across"}`;
        btn.append(icon, label);
        btn.setAttribute("aria-label", `${C.NAMES[item]} on the ${side} shore${btn.disabled ? "" : "; take it across"}`);
        btn.addEventListener("click", () => ferry(item, side));
        shore.appendChild(btn);
      }
      if (!shore.querySelector(".item-btn")) {
        const empty = document.createElement("p");
        empty.className = "empty-shore";
        empty.textContent = "empty";
        shore.appendChild(empty);
      }
      board.appendChild(shore);

      if (side === "left") {
        const river = document.createElement("div");
        river.className = "river";
        const cross = document.createElement("button");
        cross.type = "button";
        cross.className = "cross-btn";
        cross.id = "crossBtn";
        cross.disabled = Boolean(state.outcome);
        cross.textContent = state.boat === "left" ? "➜" : "⬅";
        cross.setAttribute("aria-label", `Cross the river alone from the ${state.boat} shore`);
        cross.addEventListener("click", () => ferry(null, state.boat));
        river.appendChild(cross);
        board.appendChild(river);
      }
    }
    stage.appendChild(board);

    const moves = document.createElement("p");
    moves.className = "move-count";
    moves.textContent = `${state.moves} ${state.moves === 1 ? "crossing" : "crossings"}`;
    stage.appendChild(moves);

    if (state.outcome === "win") say("You won! All three are across. Press Reset to play again.", "win");
    else if (state.outcome === "lose") say(`${note} Press Reset to try again.`, "lose");
    else {
      const hint = hintCheck.checked ? C.hint(state) : null;
      const hintText = hint && hint.length ? ` Hint: ${C.describe(hint[0])}.` : "";
      say(`${note ? note + " " : ""}The farmer is on the ${state.boat} shore.${hintText}`);
    }

    if (window.Track) {
      window.Track.state({
        right: state.right.slice(), boat: state.boat, moves: state.moves, outcome: state.outcome,
      });
    }

    if (focusKey) {
      const target = focusKey.cross
        ? document.getElementById("crossBtn")
        : stage.querySelector(`.item-btn[data-item="${focusKey.item}"][data-side="${focusKey.side}"]`);
      if (target && !target.disabled) {
        focusKey = null;
        target.focus();
      }
    }
  }

  function ferry(item, side) {
    if (state.outcome) return;
    const move = item === null ? { item: null } : { item };
    const next = C.move(state, move);
    if (!next) return;
    focusKey = item === null
      ? { cross: true }
      : { item, side: next.right[item] ? "right" : "left" };
    state = next;
    note = item === null ? "The farmer crossed alone." : `The farmer took ${C.NAMES[item]} across.`;
    if (next.outcome === "lose") note = C.LOSS[C.danger(next)];
    render();
  }

  function reset() {
    focusKey = null;
    note = "";
    state = C.start();
    render();
  }

  resetBtn.addEventListener("click", reset);
  hintCheck.addEventListener("change", render);

  reset();
})();
