"use strict";

/*
 * Browser UI for Adams' Apportionment Method. The arithmetic and the divisor
 * search live in adams-apportionment-core.js; this file draws the table and
 * takes input.
 *
 * Each row is a state: its population, its standard quota at total/seats, the
 * lower (rounded down) quota, the quota at the current divisor and the upward
 * (rounded up) quota. Edit the divisor until the upward quotas add to the
 * number of seats, or press "Find divisor" to search for it.
 */

(() => {
  const C = AdamsApportionmentCore;
  const stage = document.getElementById("stage");
  const status = document.getElementById("status");
  const seatsLess = document.getElementById("seatsLess");
  const seatsMore = document.getElementById("seatsMore");
  const seatsOut = document.getElementById("seatsOut");
  const statesLess = document.getElementById("statesLess");
  const statesMore = document.getElementById("statesMore");
  const statesOut = document.getElementById("statesOut");
  const divisorInput = document.getElementById("divisorInput");
  const findBtn = document.getElementById("findBtn");
  const resetBtn = document.getElementById("resetBtn");

  let state = null;
  let focusKey = null;
  let note = "";

  function say(text, kind) {
    status.textContent = text;
    status.classList.remove("win", "lose", "done");
    if (kind) status.classList.add(kind);
  }

  function render() {
    if (!focusKey) {
      const el = document.activeElement;
      if (el && el.dataset && el.dataset.part) {
        focusKey = { part: el.dataset.part, index: el.dataset.index };
      }
    }
    stage.replaceChildren();

    const table = document.createElement("table");
    table.className = "apportion-table";
    const head = document.createElement("tr");
    for (const title of ["State", "Population", "Standard Q", "Lower Q", "Modified Q", "Upward Q"]) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = title;
      head.appendChild(th);
    }
    table.appendChild(head);

    const rows = C.quotas(state, state.divisor);
    const total = C.total(state);
    const sumLower = rows.reduce((a, q) => a + q.lower, 0);
    const sumUpper = rows.reduce((a, q) => a + q.upward, 0);
    rows.forEach((q, index) => {
      const tr = document.createElement("tr");
      const cells = [
        C.LETTERS[index],
        "",
        q.standard.toFixed(2),
        String(q.lower),
        q.modified.toFixed(2),
        String(q.upward),
      ];
      cells.forEach((text, col) => {
        const td = document.createElement("td");
        if (col === 1) {
          const input = document.createElement("input");
          input.type = "number";
          input.min = "0";
          input.max = String(C.MAX_POP);
          input.step = "1";
          input.value = String(q.population);
          input.dataset.part = "population";
          input.dataset.index = String(index);
          input.setAttribute("aria-label", `Population of state ${C.LETTERS[index]}`);
          input.addEventListener("change", () => {
            focusKey = { part: "population", index: String(index) };
            state = C.setPopulation(state, index, Number(input.value));
            render();
          });
          td.appendChild(input);
        } else {
          td.textContent = text;
        }
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });

    const totals = document.createElement("tr");
    totals.className = "totals";
    const totalCells = ["Totals", String(total), (total / state.seats).toFixed(2), String(sumLower), "", String(sumUpper)];
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
    if (document.activeElement !== divisorInput) divisorInput.value = state.divisor.toFixed(2);

    if (note) say(note);
    else if (sumUpper === state.seats) say(`The upward quotas add to ${state.seats} — this divisor works.`, "done");
    else say(`The upward quotas add to ${sumUpper}, not ${state.seats}. Change the divisor until they match.`);

    if (window.Track) {
      window.Track.state({
        seats: state.seats, states: state.states, populations: state.populations.slice(), divisor: state.divisor,
      });
    }

    if (focusKey) {
      const target = stage.querySelector(`[data-part="${focusKey.part}"][data-index="${focusKey.index}"]`);
      if (target) {
        focusKey = null;
        target.focus();
      }
    }
  }

  function setDivisor(value) {
    const d = Math.max(C.MIN_DIVISOR, Math.min(C.MAX_DIVISOR, Number(value) || 1));
    note = "";
    state = { ...state, divisor: d };
    render();
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
  divisorInput.addEventListener("change", () => setDivisor(divisorInput.value));
  findBtn.addEventListener("click", () => {
    const d = C.findDivisor(state);
    if (d === null) note = "No divisor fits these numbers: the quotas jump over the seat count.";
    else {
      note = "";
      state = { ...state, divisor: d };
    }
    render();
  });
  resetBtn.addEventListener("click", () => {
    focusKey = null;
    note = "";
    state = C.start({ seats: state.seats, states: state.states });
    render();
  });

  state = C.start({ seats: 23, states: 3 });
  render();
})();
