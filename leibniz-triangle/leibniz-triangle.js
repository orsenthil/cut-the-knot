"use strict";

/* Browser UI: Pascal and Leibniz triangles reduced modulo a chosen number. */
(() => {
  const C = LeibnizTriangleCore;
  const stage = document.getElementById("stage");
  const status = document.getElementById("status");
  const readout = document.getElementById("readout");
  const rowsInput = document.getElementById("rowsInput");
  const modInput = document.getElementById("modInput");
  const kindRadios = [...document.querySelectorAll('input[name="kind"]')];
  let state = null;

  function render() {
    stage.replaceChildren();
    const r = C.analyze(state);
    stage.style.setProperty("--rows", String(state.rows));
    r.shown.forEach((row, n) => {
      const line = document.createElement("div");
      line.className = "tri-row";
      row.forEach((v) => {
        const cell = document.createElement("span");
        cell.className = "tri-cell" + (v === 0 ? " zero" : "");
        cell.textContent = String(v);
        cell.setAttribute("aria-label", `Row ${n + 1}: ${state.kind === "leibniz" ? `denominator remainder ${v}` : v}`);
        line.appendChild(cell);
      });
      stage.appendChild(line);
    });

    rowsInput.value = String(state.rows);
    modInput.value = String(state.mod);
    kindRadios.forEach((radio) => { radio.checked = radio.value === state.kind; });
    readout.textContent = `${state.kind === "leibniz" ? "Leibniz" : "Pascal"} triangle · ${state.rows} rows · modulo ${state.mod}`;
    status.textContent = state.kind === "leibniz"
      ? `Entries are the denominators of the unit fractions, reduced modulo ${state.mod}. The second diagonal sums to 1.`
      : `Each entry is the sum of the two above it, reduced modulo ${state.mod}. Row sums are powers of two.`;
    status.className = "done";
    if (window.Track) window.Track.state({
      rows: state.rows, mod: state.mod, kind: state.kind,
      shown: r.shown.map((row) => row.slice()), symmetric: r.symmetric,
      telescopingLast: r.telescoping.last,
    });
  }

  rowsInput.addEventListener("input", () => { state = C.setRows(state, Number(rowsInput.value)); render(); });
  modInput.addEventListener("input", () => { state = C.setMod(state, Number(modInput.value)); render(); });
  kindRadios.forEach((radio) => radio.addEventListener("change", () => {
    if (radio.checked) { state = C.setKind(state, radio.value); render(); }
  }));

  state = C.start();
  render();
})();
