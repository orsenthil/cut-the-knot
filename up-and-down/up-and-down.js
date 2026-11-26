"use strict";

/*
 * The page for Up And Down: drawing and input only; the permutation, the run
 * the applet hides and the coin toss are in up-and-down-core.js. The board is
 * a row of ten (or five) cards. In the applet's default "Visible part" view
 * the hidden cards are empty frames; press one to open it. The other two
 * radio choices show the hidden run or the whole permutation. Colours say
 * which way the hidden run goes: red rises, blue falls.
 */

(function () {
  const Core = UpAndDownCore;
  const board = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const viewBtns = {
    visible: document.getElementById("visibleBtn"),
    hidden: document.getElementById("hiddenBtn"),
    all: document.getElementById("allBtn"),
  };
  const trainingIn = document.getElementById("trainingIn");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const belongs = (i) => state.hidden.includes(i);
  const shown = (i) => state.view === "all" || (state.view === "hidden" ? belongs(i) : !belongs(i) || state.revealed.includes(i));
  const runNumbers = () => state.hidden.slice().sort((a, b) => a - b).map((i) => state.values[i]).join(", ");
  const rising = () => state.direction === "up";

  function message() {
    const shownCount = state.values.filter((_, i) => shown(i)).length;
    const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
    if (state.view === "hidden") return `The hidden run is ${runNumbers()}. It ${rising() ? "rises (red)" : "falls (blue)"}, so those are the numbers that were left blank.`;
    if (state.view === "all") return `The hidden run ${runNumbers()} ${rising() ? "rises" : "falls"}. The other ${plural(state.n - state.hidden.length, "number")} ${state.n - state.hidden.length === 1 ? "is" : "are"} the ones you were shown.`;
    if (state.revealed.length) {
      const i = state.revealed[state.revealed.length - 1];
      return `Position ${i + 1} held ${state.values[i]}: it is part of the hidden run. Open the other blank cards, or press "Hidden part" to see the whole run.`;
    }
    return `${plural(shownCount, "number")} ${shownCount === 1 ? "is" : "are"} shown. Can you work out the ${state.hidden.length} hidden ${state.hidden.length === 1 ? "number" : "ones"}?`;
  }

  function render() {
    board.textContent = "";
    board.setAttribute("aria-label", `A row of ${state.n} cards from the permutation`);
    const row = document.createElement("div");
    row.className = "cards";

    for (let i = 0; i < state.n; i++) {
      const visible = shown(i);
      let card;
      if (visible) {
        card = document.createElement("span");
        // The applet draws every card it shows in the run's colour, except the
        // ordinary numbers in "Whole permutation", which are drawn in ink.
        const tinted = belongs(i) || state.view === "visible";
        card.className = "card shown" + (tinted ? " run " + state.direction : "") + (state.revealed.includes(i) ? " revealed" : "");
        card.setAttribute("role", "img");
        card.setAttribute("aria-label", `Position ${i + 1}, number ${state.values[i]}${belongs(i) ? ", part of the hidden run" : ""}.`);
        card.textContent = String(state.values[i]);
      } else {
        card = document.createElement("button");
        card.type = "button";
        card.className = "card blank";
        card.setAttribute("aria-label", `Position ${i + 1}, hidden. Press to reveal the number.`);
        card.textContent = "?";
        card.addEventListener("click", () => {
          const next = Core.reveal(state, i);
          if (!next) return;
          state = next;
          render();
          const cards = board.querySelectorAll(".card");
          if (cards[i]) cards[i].focus({ preventScroll: true });
        });
      }
      card.tabIndex = 0;
      card.dataset.position = String(i);
      row.appendChild(card);
    }
    board.appendChild(row);

    row.addEventListener("keydown", (e) => {
      const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      const cards = row.querySelectorAll(".card");
      const at = Array.prototype.indexOf.call(cards, document.activeElement);
      const next = cards[(at + step + cards.length) % cards.length];
      if (next) next.focus({ preventScroll: true });
    });

    for (const view in viewBtns) viewBtns[view].setAttribute("aria-pressed", String(view === state.view));
    trainingIn.checked = state.n === Core.TRAINING;

    const result = Core.result(state);
    say(message(), result === "done" ? "done" : undefined);
    if (window.Track) window.Track.state(Core.position(state));
  }

  for (const view in viewBtns) {
    viewBtns[view].addEventListener("click", () => {
      const next = Core.setView(state, view);
      if (!next) return;
      state = next;
      render();
    });
  }

  trainingIn.addEventListener("change", () => {
    state = Core.start({ training: trainingIn.checked });
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  render();
})();
