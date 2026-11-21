"use strict";

/* Browser UI: an editable Horner table for a polynomial and a value of x. */
(() => {
  const C = HornerMethodCore;
  const stage = document.getElementById("stage");
  const status = document.getElementById("status");
  let state = null;
  let focusKey = null;

  function render() {
    if (!focusKey) {
      const el = document.activeElement;
      if (el && el.dataset && el.dataset.part) focusKey = { part: el.dataset.part, index: el.dataset.index };
    }
    stage.replaceChildren();
    const r = C.analyze(state);
    const table = document.createElement("table");
    table.className = "horner-table";
    const head = document.createElement("tr");
    for (const title of ["", ...state.coefficients.map((_, i) => `x^${state.coefficients.length - 1 - i}`), ""]) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = title;
      head.appendChild(th);
    }
    table.appendChild(head);

    const coeffRow = document.createElement("tr");
    const labelC = document.createElement("th");
    labelC.scope = "row";
    labelC.textContent = "a";
    coeffRow.appendChild(labelC);
    state.coefficients.forEach((a, i) => {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "number";
      input.min = "-99";
      input.max = "99";
      input.value = String(a);
      input.dataset.part = "coefficient";
      input.dataset.index = String(i);
      input.setAttribute("aria-label", `Coefficient of x to the ${state.coefficients.length - 1 - i}`);
      input.addEventListener("change", () => {
        focusKey = { part: "coefficient", index: String(i) };
        state = C.setCoefficient(state, i, Number(input.value));
        render();
      });
      td.appendChild(input);
      coeffRow.appendChild(td);
    });
    coeffRow.appendChild(document.createElement("td"));
    table.appendChild(coeffRow);

    const resultRow = document.createElement("tr");
    const labelB = document.createElement("th");
    labelB.scope = "row";
    labelB.textContent = "b";
    resultRow.appendChild(labelB);
    r.rows.forEach((b) => {
      const td = document.createElement("td");
      td.textContent = String(b);
      resultRow.appendChild(td);
    });
    table.appendChild(resultRow);
    stage.appendChild(table);

    const summary = document.createElement("div");
    summary.className = "horner-summary";
    const tInput = document.createElement("input");
    tInput.type = "number";
    tInput.min = "-20";
    tInput.max = "20";
    tInput.value = String(state.t);
    tInput.id = "tInput";
    tInput.setAttribute("aria-label", "Value of x at which to evaluate");
    tInput.addEventListener("change", () => {
      state = C.setT(state, Number(tInput.value));
      render();
      const again = document.getElementById("tInput");
      if (again) again.focus();
    });
    const label = document.createElement("label");
    label.textContent = "x = ";
    label.appendChild(tInput);
    summary.appendChild(label);
    const facts = document.createElement("p");
    facts.textContent = `P(${state.t}) = ${r.value}   ·   P(${state.t})' = ${r.derivative}   ·   Quotient by (x − ${state.t}): ${r.quotient.join(", ") || "0"}, remainder ${r.remainder}`;
    summary.appendChild(facts);
    stage.appendChild(summary);

    say(`Starting from ${state.coefficients[0]}, each step multiplies by ${state.t} and adds the next coefficient. The last value is P(${state.t}) = ${r.value}.`);
    if (window.Track) window.Track.state({ coefficients: state.coefficients.slice(), t: state.t, value: r.value, derivative: r.derivative });
    if (focusKey) {
      const target = stage.querySelector(`[data-part="${focusKey.part}"][data-index="${focusKey.index}"]`);
      if (target) { focusKey = null; target.focus(); }
    }
  }

  function say(text) { status.textContent = text; status.classList.add("done"); }
  state = C.start();
  render();
})();
