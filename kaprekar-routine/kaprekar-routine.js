"use strict";

/* Browser UI: run Kaprekar's routine and list every subtraction. */
(() => {
  const C = KaprekarRoutineCore;
  const stage = document.getElementById("stage");
  const status = document.getElementById("status");
  const startInput = document.getElementById("startInput");
  const baseSel = document.getElementById("baseSel");
  const widthSel = document.getElementById("widthSel");
  const paddedCheck = document.getElementById("paddedCheck");
  const stepBtn = document.getElementById("stepBtn");
  const runBtn = document.getElementById("runBtn");
  const resetBtn = document.getElementById("resetBtn");
  let state = null;
  let limit = 1;

  function format(n, base) {
    if (base <= 10) return String(n);
    return n.toString(base).toUpperCase();
  }

  function render() {
    stage.replaceChildren();
    const r = C.analyze(state);
    const shown = r.result.steps.slice(0, Math.min(limit, r.result.steps.length));
    const table = document.createElement("table");
    table.className = "kap-table";
    const head = document.createElement("tr");
    for (const title of ["Step", "Descending", "Ascending", "Difference"]) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = title;
      head.appendChild(th);
    }
    table.appendChild(head);
    shown.forEach((s, i) => {
      const tr = document.createElement("tr");
      for (const text of [String(i + 1), format(s.desc, state.base), format(s.asc, state.base), format(s.diff, state.base)]) {
        const td = document.createElement("td");
        td.textContent = text;
        tr.appendChild(td);
      }
      if (i === shown.length - 1) tr.className = "last";
      table.appendChild(tr);
    });
    stage.appendChild(table);

    startInput.value = String(state.start);
    startInput.max = String(state.base ** state.width - 1);
    baseSel.value = String(state.base);
    widthSel.value = String(state.width);
    paddedCheck.checked = state.padded;
    stepBtn.disabled = limit >= r.result.steps.length;
    runBtn.disabled = limit >= r.result.steps.length;
    status.textContent = r.result.zero
      ? `Reached 0 after ${r.result.count} steps.`
      : r.result.fixed
        ? `Reached the constant ${format(r.result.result, state.base)} after ${r.result.count - 1} steps.`
        : `Step ${limit}: ${format(r.result.steps[limit - 1].desc, state.base)} − ${format(r.result.steps[limit - 1].asc, state.base)} = ${format(r.result.steps[limit - 1].diff, state.base)}.`;
    status.className = r.result.zero || r.result.fixed ? "win" : "done";
    if (window.Track) window.Track.state({
      start: state.start, base: state.base, width: state.width, padded: state.padded,
      shown: limit, result: r.result.result, count: r.result.count,
    });
  }

  startInput.addEventListener("change", () => {
    state = C.setStart(state, Number(startInput.value));
    limit = 1;
    render();
  });
  baseSel.addEventListener("change", () => {
    state = C.setBase(state, Number(baseSel.value));
    limit = 1;
    render();
  });
  widthSel.addEventListener("change", () => {
    state = C.setWidth(state, Number(widthSel.value));
    limit = 1;
    render();
  });
  paddedCheck.addEventListener("change", () => {
    state = { ...state, padded: paddedCheck.checked };
    limit = 1;
    render();
  });
  stepBtn.addEventListener("click", () => { limit = Math.min(limit + 1, C.analyze(state).result.steps.length); render(); });
  runBtn.addEventListener("click", () => { limit = C.analyze(state).result.steps.length; render(); });
  resetBtn.addEventListener("click", () => { state = C.start(); limit = 1; render(); });

  for (let b = 2; b <= 16; b++) {
    const option = document.createElement("option");
    option.value = String(b);
    option.textContent = `Base ${b}`;
    baseSel.appendChild(option);
  }
  for (let w = 2; w <= 6; w++) {
    const option = document.createElement("option");
    option.value = String(w);
    option.textContent = String(w);
    widthSel.appendChild(option);
  }
  state = C.start();
  render();
})();
