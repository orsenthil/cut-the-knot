"use strict";

/* Browser UI: the Jefferson apportionment table with editable populations. */
(() => {
  const C = JeffersonApportionmentCore;
  const stage = document.getElementById("stage");
  const status = document.getElementById("status");
  const seatsLess = document.getElementById("seatsLess");
  const seatsMore = document.getElementById("seatsMore");
  const seatsOut = document.getElementById("seatsOut");
  const statesLess = document.getElementById("statesLess");
  const statesMore = document.getElementById("statesMore");
  const statesOut = document.getElementById("statesOut");
  const divisorInput = document.getElementById("divisorInput");
  const resetBtn = document.getElementById("resetBtn");
  let state = null;
  let focusKey = null;

  function render() {
    if (!focusKey) {
      const el = document.activeElement;
      if (el && el.dataset && el.dataset.part) focusKey = { part: el.dataset.part, index: el.dataset.index };
    }
    stage.replaceChildren();
    const r = C.analyze(state, Number(divisorInput.value) || C.findDivisor(state));
    const table = document.createElement("table");
    table.className = "jeff-table";
    const head = document.createElement("tr");
    for (const title of ["State", "Population", "Quota", "Floored", "Final"]) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = title;
      head.appendChild(th);
    }
    table.appendChild(head);
    r.letters.forEach((letter, i) => {
      const tr = document.createElement("tr");
      const cells = [letter, "", r.quotas[i].toFixed(2), String(r.lower[i]), String(r.final[i])];
      cells.forEach((text, col) => {
        const td = document.createElement("td");
        if (col === 1) {
          const input = document.createElement("input");
          input.type = "number";
          input.min = "0";
          input.max = String(C.MAX_POP);
          input.value = String(state.populations[i]);
          input.dataset.part = "population";
          input.dataset.index = String(i);
          input.setAttribute("aria-label", `Population of state ${letter}`);
          input.addEventListener("change", () => {
            focusKey = { part: "population", index: String(i) };
            state = C.setPopulation(state, i, Number(input.value));
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
    for (const text of ["Total", String(C.total(state)), "", "", String(r.total)]) {
      const td = document.createElement("td");
      td.textContent = text;
      totals.appendChild(td);
    }
    table.appendChild(totals);
    stage.appendChild(table);

    seatsOut.textContent = String(state.seats);
    statesOut.textContent = String(state.states);
    if (document.activeElement !== divisorInput) divisorInput.value = r.divisor.toFixed(2);
    seatsLess.disabled = state.seats <= C.MIN_SEATS;
    seatsMore.disabled = state.seats >= C.MAX_SEATS;
    statesLess.disabled = state.states <= C.MIN_STATES;
    statesMore.disabled = state.states >= C.MAX_STATES;
    say(`${r.total} seats apportioned by rounding every quota down after lowering the divisor to ${r.divisor.toFixed(2)}.`);
    if (window.Track) window.Track.state({
      seats: state.seats, states: state.states, populations: state.populations.slice(),
      divisor: r.divisor, final: r.final, total: r.total,
    });
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

  seatsLess.addEventListener("click", () => { state = C.setSeats(state, state.seats - 1); render(); });
  seatsMore.addEventListener("click", () => { state = C.setSeats(state, state.seats + 1); render(); });
  statesLess.addEventListener("click", () => { state = C.setStates(state, state.states - 1); render(); });
  statesMore.addEventListener("click", () => { state = C.setStates(state, state.states + 1); render(); });
  divisorInput.addEventListener("change", render);
  resetBtn.addEventListener("click", () => {
    focusKey = null;
    state = C.start({ seats: state.seats, states: state.states });
    divisorInput.value = "";
    render();
  });
  state = C.start();
  render();
})();
