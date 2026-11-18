"use strict";

/*
 * Browser UI for Hamilton's Apportionment Method. The arithmetic and the
 * largest-remainder rule are in hamilton-apportionment-core.js.
 *
 * The table shows the standard quota, the lower quota, the leftover fraction,
 * the surplus seats and the final allocation. Edit a population or the seat
 * and state counts to watch the surplus move, including the paradoxes.
 */

(() => {
  const C = HamiltonApportionmentCore;
  const stage = document.getElementById("stage");
  const status = document.getElementById("status");
  const seatsLess = document.getElementById("seatsLess");
  const seatsMore = document.getElementById("seatsMore");
  const seatsOut = document.getElementById("seatsOut");
  const statesLess = document.getElementById("statesLess");
  const statesMore = document.getElementById("statesMore");
  const statesOut = document.getElementById("statesOut");
  const resetBtn = document.getElementById("resetBtn");

  let state = null;
  let focusKey = null;

  function say(text, kind) {
    status.textContent = text;
    status.classList.remove("win", "lose", "done");
    if (kind) status.classList.add(kind);
  }

  function render() {
    if (!focusKey) {
      const el = document.activeElement;
      if (el && el.dataset && el.dataset.part) focusKey = { part: el.dataset.part, index: el.dataset.index };
    }
    stage.replaceChildren();

    const a = C.apportion(state);
    const table = document.createElement("table");
    table.className = "apportion-table";
    const head = document.createElement("tr");
    for (const title of ["State", "Population", "Standard Q", "Lower Q", "Leftover", "Surplus", "Final"]) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = title;
      head.appendChild(th);
    }
    table.appendChild(head);

    a.final.forEach((final, index) => {
      const tr = document.createElement("tr");
      const cells = [
        C.LETTERS[index], "", a.quotas[index].toFixed(2), String(a.lower[index]),
        a.leftover[index].toFixed(2), a.winners.includes(index) ? "1" : "0", String(final),
      ];
      cells.forEach((text, col) => {
        const td = document.createElement("td");
        if (col === 1) {
          const input = document.createElement("input");
          input.type = "number";
          input.min = "0";
          input.max = String(C.MAX_POP);
          input.step = "1";
          input.value = String(state.populations[index]);
          input.dataset.part = "population";
          input.dataset.index = String(index);
          input.setAttribute("aria-label", `Population of state ${C.LETTERS[index]}`);
          input.addEventListener("change", () => {
            focusKey = { part: "population", index: String(index) };
            state = C.setPopulation(state, index, Number(input.value));
            render();
          });
          td.appendChild(input);
        } else td.textContent = text;
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });

    const totals = document.createElement("tr");
    totals.className = "totals";
    const totalCells = ["Totals", String(C.total(state)), (C.total(state) / state.seats).toFixed(2),
      String(a.lower.reduce((x, y) => x + y, 0)), a.surplus, String(a.winners.length),
      String(a.final.reduce((x, y) => x + y, 0))];
    for (const text of totalCells) {
      const td = document.createElement("td");
      td.textContent = text;
      totals.appendChild(td);
    }
    table.appendChild(totals);
    stage.appendChild(table);

    seatsOut.textContent = String(state.seats);
    statesOut.textContent = String(state.states);
    seatsLess.disabled = state.seats <= C.MIN_SEATS;
    seatsMore.disabled = state.seats >= C.MAX_SEATS;
    statesLess.disabled = state.states <= C.MIN_STATES;
    statesMore.disabled = state.states >= C.MAX_STATES;

    say(`${a.surplus} surplus seat${a.surplus === 1 ? "" : "s"} went to the largest leftovers. ` +
      `The final column adds to ${a.final.reduce((x, y) => x + y, 0)}.`, a.surplus >= 0 ? "done" : "");

    if (window.Track) {
      window.Track.state({ seats: state.seats, states: state.states, populations: state.populations.slice(), final: a.final });
    }
    if (focusKey) {
      const target = stage.querySelector(`[data-part="${focusKey.part}"][data-index="${focusKey.index}"]`);
      if (target) {
        focusKey = null;
        target.focus();
      }
    }
  }

  seatsLess.addEventListener("click", () => {
    state = C.setSeats(state, state.seats - 1);
    render();
  });
  seatsMore.addEventListener("click", () => {
    state = C.setSeats(state, state.seats + 1);
    render();
  });
  statesLess.addEventListener("click", () => {
    state = C.setStates(state, state.states - 1);
    render();
  });
  statesMore.addEventListener("click", () => {
    state = C.setStates(state, state.states + 1);
    render();
  });
  resetBtn.addEventListener("click", () => {
    focusKey = null;
    state = C.start({ seats: state.seats, states: state.states });
    render();
  });

  state = C.start({ seats: 23, states: 3 });
  render();
})();
