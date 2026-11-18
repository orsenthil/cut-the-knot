"use strict";

/*
 * Browser UI for the Five Methods of Apportionment calculator. The methods
 * are in apportionment-methods-core.js.
 *
 * The table compares all five methods at once for the current country. The
 * selector picks which method's quota column is shown below the table, and
 * the steppers change the number of seats and states. Populations are editable.
 */

(() => {
  const C = ApportionmentMethodsCore;
  const stage = document.getElementById("stage");
  const status = document.getElementById("status");
  const methodSelect = document.getElementById("methodSelect");
  const seatsLess = document.getElementById("seatsLess");
  const seatsMore = document.getElementById("seatsMore");
  const seatsOut = document.getElementById("seatsOut");
  const statesLess = document.getElementById("statesLess");
  const statesMore = document.getElementById("statesMore");
  const statesOut = document.getElementById("statesOut");
  const resetBtn = document.getElementById("resetBtn");

  let state = null;
  let focusKey = null;
  const LABELS = {
    hamilton: "Hamilton", jefferson: "Jefferson", adams: "Adams",
    webster: "Webster", "huntington-hill": "Huntington-Hill",
  };

  function render() {
    if (!focusKey) {
      const el = document.activeElement;
      if (el && el.dataset && el.dataset.part) focusKey = { part: el.dataset.part, index: el.dataset.index };
    }
    stage.replaceChildren();

    const results = Object.fromEntries(C.METHODS.map((m) => [m, C.apportion(state, m)]));
    const table = document.createElement("table");
    table.className = "compare-table";
    const head = document.createElement("tr");
    for (const title of ["State", "Pop.", ...C.METHODS.map((m) => LABELS[m])]) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = title;
      head.appendChild(th);
    }
    table.appendChild(head);

    state.populations.forEach((pop, i) => {
      const tr = document.createElement("tr");
      const name = document.createElement("td");
      name.textContent = C.LETTERS[i];
      tr.appendChild(name);
      const popCell = document.createElement("td");
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.max = String(C.MAX_POP);
      input.step = "1";
      input.value = String(pop);
      input.dataset.part = "population";
      input.dataset.index = String(i);
      input.setAttribute("aria-label", `Population of state ${C.LETTERS[i]}`);
      input.addEventListener("change", () => {
        focusKey = { part: "population", index: String(i) };
        state = C.setPopulation(state, i, Number(input.value));
        render();
      });
      popCell.appendChild(input);
      tr.appendChild(popCell);
      for (const m of C.METHODS) {
        const td = document.createElement("td");
        td.textContent = String(results[m].final[i]);
        if (m === methodSelect.value) td.className = "chosen";
        tr.appendChild(td);
      }
      table.appendChild(tr);
    });

    const totals = document.createElement("tr");
    totals.className = "totals";
    for (const text of ["Total", String(C.total(state)), ...C.METHODS.map((m) => String(results[m].final.reduce((a, b) => a + b, 0)))]) {
      const td = document.createElement("td");
      td.textContent = text;
      totals.appendChild(td);
    }
    table.appendChild(totals);
    stage.appendChild(table);

    const chosen = results[methodSelect.value];
    const detail = document.createElement("p");
    detail.className = "detail";
    detail.textContent = `${LABELS[methodSelect.value]}: standard divisor ${chosen.divisor.toFixed(2)}` +
      (methodSelect.value === "hamilton" ? `, ${chosen.surplus} surplus seat${chosen.surplus === 1 ? "" : "s"} by largest remainder.` : ".");
    stage.appendChild(detail);

    seatsOut.textContent = String(state.seats);
    statesOut.textContent = String(state.states);
    seatsLess.disabled = state.seats <= C.MIN_SEATS;
    seatsMore.disabled = state.seats >= C.MAX_SEATS;
    statesLess.disabled = state.states <= C.MIN_STATES;
    statesMore.disabled = state.states >= C.MAX_STATES;

    say(`${C.METHODS.length} methods share ${state.seats} seats among ${state.states} states. ` +
      `${LABELS[methodSelect.value]} is highlighted.`);

    if (window.Track) {
      window.Track.state({
        seats: state.seats, states: state.states, populations: state.populations.slice(),
        method: methodSelect.value, allocations: Object.fromEntries(C.METHODS.map((m) => [m, results[m].final])),
      });
    }
    if (focusKey) {
      const target = stage.querySelector(`[data-part="${focusKey.part}"][data-index="${focusKey.index}"]`);
      if (target) { focusKey = null; target.focus(); }
    }
  }

  function say(text) {
    status.textContent = text;
    status.classList.remove("done");
    status.classList.add("done");
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
  methodSelect.addEventListener("change", render);
  resetBtn.addEventListener("click", () => {
    focusKey = null;
    state = C.start({ seats: state.seats, states: state.states });
    render();
  });

  state = C.start({ seats: 23, states: 3 });
  render();
})();
